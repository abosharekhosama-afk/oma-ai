import { createLogger } from '@oma/observability';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

const log = createLogger('inbox-processor');

type InboxWebhookJob = {
  platform: 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN';
  tenantId?: string;
  brandId?: string;
  raw: unknown;
  receivedAt: string;
};

type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

const NEG = /\b(bad|awful|terrible|hate|angry|worst|scam|refund|broken|disappointed|horrible|poor|fail)\b|سيء|سيئة|فظيع|احتيال|استرجاع|غاضب|محبط/i;
const POS = /\b(great|love|amazing|excellent|thanks|thank you|awesome|perfect|wonderful|best)\b|رائع|ممتاز|شكرا|أحب|ممتازة|جميل/i;

function classifySentiment(text: string): Sentiment {
  const t = (text || '').trim();
  if (!t) return 'NEUTRAL';
  const neg = NEG.test(t);
  const pos = POS.test(t);
  if (neg && !pos) return 'NEGATIVE';
  if (pos && !neg) return 'POSITIVE';
  return 'NEUTRAL';
}

function previewOf(text: string, max = 140) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

type ParsedInbound = {
  tenantId?: string;
  platform: InboxWebhookJob['platform'];
  externalThreadId: string;
  type: 'DIRECT_MESSAGE' | 'POST_COMMENT' | 'DARK_COMMENT' | 'MENTION';
  externalMessageId?: string;
  senderExternalId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  mediaUrls?: string[];
};

function parseMeta(raw: unknown, platform: InboxWebhookJob['platform']): ParsedInbound[] {
  const out: ParsedInbound[] = [];
  if (!raw || typeof raw !== 'object') return out;
  const body = raw as {
    entry?: Array<{
      id?: string;
      messaging?: Array<{
        sender?: { id?: string };
        recipient?: { id?: string };
        message?: { mid?: string; text?: string; attachments?: Array<{ payload?: { url?: string } }> };
        timestamp?: number;
      }>;
      changes?: Array<{
        field?: string;
        value?: {
          from?: { id?: string; username?: string };
          media?: { id?: string };
          text?: string;
          id?: string;
          comment_id?: string;
          post_id?: string;
          parent_id?: string;
          item?: string;
        };
      }>;
    }>;
  };
  for (const entry of body.entry ?? []) {
    for (const m of entry.messaging ?? []) {
      const text = m.message?.text ?? '';
      const mid = m.message?.mid;
      const sender = m.sender?.id ?? 'unknown';
      if (!text && !m.message?.attachments?.length) continue;
      out.push({
        platform,
        externalThreadId: `${entry.id ?? 'page'}:${sender}`,
        type: 'DIRECT_MESSAGE',
        externalMessageId: mid,
        senderExternalId: sender,
        senderName: sender,
        content: text || '[media]',
        mediaUrls: (m.message?.attachments ?? [])
          .map((a) => a.payload?.url)
          .filter(Boolean) as string[],
      });
    }
    for (const ch of entry.changes ?? []) {
      const v = ch.value;
      if (!v) continue;
      const text = v.text ?? '';
      const fromId = v.from?.id ?? 'unknown';
      const fromName = v.from?.username ?? fromId;
      const isDark = ch.field === 'comments' && !v.parent_id && platform === 'META_IG';
      out.push({
        platform,
        externalThreadId: String(v.post_id ?? v.media?.id ?? v.id ?? entry.id ?? 'thread'),
        type: isDark ? 'DARK_COMMENT' : ch.field === 'mentions' ? 'MENTION' : 'POST_COMMENT',
        externalMessageId: v.comment_id ?? v.id,
        senderExternalId: fromId,
        senderName: fromName,
        content: text || '[comment]',
      });
    }
  }
  return out;
}

function parseGeneric(raw: unknown, platform: InboxWebhookJob['platform']): ParsedInbound[] {
  // TikTok / LinkedIn payload shapes vary; accept a normalized envelope when present.
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as {
    tenantId?: string;
    events?: Array<{
      threadId?: string;
      messageId?: string;
      type?: string;
      senderId?: string;
      senderName?: string;
      text?: string;
    }>;
  };
  return (o.events ?? []).map((e) => ({
    tenantId: o.tenantId,
    platform,
    externalThreadId: e.threadId ?? e.messageId ?? newId(),
    type: (e.type as ParsedInbound['type']) || 'DIRECT_MESSAGE',
    externalMessageId: e.messageId,
    senderExternalId: e.senderId ?? 'unknown',
    senderName: e.senderName ?? e.senderId ?? 'Unknown',
    content: e.text ?? '',
  }));
}

async function resolveTenantId(hint?: string, pageExternalId?: string): Promise<string | null> {
  if (hint) return hint;
  // Map connected social page external id → tenant when possible.
  if (pageExternalId) {
    try {
      const page = await getPrisma().socialPage.findFirst({
        where: { externalPageId: pageExternalId },
        select: { tenantId: true },
      });
      if (page?.tenantId) return page.tenantId;
    } catch {
      // socialPage model may not expose externalPageId the same way — ignore
    }
  }
  return process.env.INBOX_DEFAULT_TENANT_ID?.trim() || null;
}

async function ingest(item: ParsedInbound, fallbackTenant?: string) {
  const tenantId = await resolveTenantId(item.tenantId ?? fallbackTenant);
  if (!tenantId) {
    log.warn({ platform: item.platform, thread: item.externalThreadId }, 'inbox event dropped: no tenant');
    return;
  }
  const prisma = getPrisma();
  const existing = await prisma.inboxConversation.findUnique({
    where: {
      tenantId_platform_externalThreadId: {
        tenantId,
        platform: item.platform,
        externalThreadId: item.externalThreadId,
      },
    },
  });
  const convId = existing?.id ?? newId();
  const sentiment = classifySentiment(item.content);

  if (!existing) {
    await prisma.inboxConversation.create({
      data: {
        id: convId,
        tenantId,
        platform: item.platform,
        externalThreadId: item.externalThreadId,
        type: item.type,
        status: 'UNREAD',
        sentiment,
        participantName: item.senderName,
        participantExtId: item.senderExternalId,
        participantAvatar: item.senderAvatar ?? null,
        lastMessageAt: new Date(),
        lastMessagePreview: previewOf(item.content),
      },
    });
  }

  if (item.externalMessageId) {
    const dup = await prisma.inboxMessage.findFirst({
      where: { conversationId: convId, externalMessageId: item.externalMessageId },
      select: { id: true },
    });
    if (dup) return;
  }

  await prisma.$transaction([
    prisma.inboxMessage.create({
      data: {
        id: newId(),
        tenantId,
        conversationId: convId,
        externalMessageId: item.externalMessageId ?? null,
        senderExternalId: item.senderExternalId,
        senderName: item.senderName,
        senderAvatar: item.senderAvatar ?? null,
        content: item.content,
        mediaUrlsJson: item.mediaUrls?.length ? JSON.stringify(item.mediaUrls) : null,
        direction: 'INBOUND',
      },
    }),
    prisma.inboxConversation.update({
      where: { id: convId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: previewOf(item.content),
        messageCount: { increment: 1 },
        unreadCount: { increment: 1 },
        sentiment,
        status: existing?.status === 'CLOSED' ? 'UNREAD' : existing?.status ?? 'UNREAD',
      },
    }),
  ]);
}

export function startInboxProcessor(connection: IORedis) {
  const worker = new Worker<InboxWebhookJob>(
    'inbox',
    async (job: Job<InboxWebhookJob>) => {
      const { platform, raw, tenantId } = job.data;
      const parsed =
        platform === 'META_FB' || platform === 'META_IG'
          ? parseMeta(raw, platform)
          : parseGeneric(raw, platform);
      log.info({ platform, count: parsed.length, jobId: job.id }, 'inbox webhook job');
      for (const item of parsed) {
        await ingest(item, tenantId);
      }
    },
    {
      connection,
      prefix: process.env.BULLMQ_PREFIX || 'oma',
      concurrency: Number(process.env.INBOX_CONCURRENCY ?? 5),
    },
  );
  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: String(err) }, 'inbox job failed');
  });
  return worker;
}
