import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

export type InboxPlatform = 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN';
export type InboxConvType = 'DIRECT_MESSAGE' | 'POST_COMMENT' | 'DARK_COMMENT' | 'MENTION';

const NEG =
  /\b(bad|awful|terrible|hate|angry|worst|scam|refund|broken|disappointed|horrible|poor|fail)\b|سيء|سيئة|فظيع|احتيال|استرجاع|غاضب|محبط/i;
const POS =
  /\b(great|love|amazing|excellent|thanks|thank you|awesome|perfect|wonderful|best)\b|رائع|ممتاز|شكرا|أحب|ممتازة|جميل/i;

function classifySentiment(text: string): 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' {
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

export type IngestInboundInput = {
  tenantId: string;
  brandId?: string | null;
  socialPageId?: string | null;
  platform: InboxPlatform;
  externalThreadId: string;
  type: InboxConvType;
  externalMessageId?: string | null;
  senderExternalId: string;
  senderName: string;
  senderAvatar?: string | null;
  content: string;
  mediaUrls?: string[];
  subject?: string | null;
  metadataJson?: string | null;
  createdAt?: Date;
};

export async function ingestInboundMessage(
  input: IngestInboundInput,
): Promise<'created' | 'duplicate' | 'updated'> {
  const prisma = getPrisma();
  const sentiment = classifySentiment(input.content);
  const at = input.createdAt ?? new Date();

  const existing = await prisma.inboxConversation.findUnique({
    where: {
      tenantId_platform_externalThreadId: {
        tenantId: input.tenantId,
        platform: input.platform,
        externalThreadId: input.externalThreadId,
      },
    },
  });

  const convId = existing?.id ?? newId();
  const priority = sentiment === 'NEGATIVE';

  if (!existing) {
    await prisma.inboxConversation.create({
      data: {
        id: convId,
        tenantId: input.tenantId,
        brandId: input.brandId ?? null,
        socialPageId: input.socialPageId ?? null,
        platform: input.platform,
        externalThreadId: input.externalThreadId,
        type: input.type,
        status: 'UNREAD',
        sentiment,
        priority,
        subject: input.subject ?? null,
        participantName: input.senderName,
        participantAvatar: input.senderAvatar ?? null,
        participantExtId: input.senderExternalId,
        lastMessageAt: at,
        lastMessagePreview: previewOf(input.content),
        messageCount: 0,
        unreadCount: 0,
        metadataJson: input.metadataJson ?? null,
        lastMessageDirection: 'INBOUND',
      },
    });
  } else if (input.metadataJson || input.subject || input.socialPageId) {
    await prisma.inboxConversation.update({
      where: { id: convId },
      data: {
        ...(input.brandId ? { brandId: input.brandId } : {}),
        ...(input.socialPageId ? { socialPageId: input.socialPageId } : {}),
        ...(input.subject ? { subject: input.subject } : {}),
        ...(input.metadataJson ? { metadataJson: input.metadataJson } : {}),
      },
    });
  }

  if (input.externalMessageId) {
    const dup = await prisma.inboxMessage.findFirst({
      where: { conversationId: convId, externalMessageId: input.externalMessageId },
      select: { id: true },
    });
    if (dup) return 'duplicate';
  }

  await prisma.$transaction([
    prisma.inboxMessage.create({
      data: {
        id: newId(),
        tenantId: input.tenantId,
        conversationId: convId,
        externalMessageId: input.externalMessageId ?? null,
        senderExternalId: input.senderExternalId,
        senderName: input.senderName,
        senderAvatar: input.senderAvatar ?? null,
        content: input.content,
        mediaUrlsJson: input.mediaUrls?.length ? JSON.stringify(input.mediaUrls) : null,
        direction: 'INBOUND',
        createdAt: at,
      },
    }),
    prisma.inboxConversation.update({
      where: { id: convId },
      data: {
        lastMessageAt: at,
        lastMessagePreview: previewOf(input.content),
        messageCount: { increment: 1 },
        unreadCount: { increment: 1 },
        sentiment,
        priority: existing?.priority || priority,
        status: existing?.status === 'CLOSED' ? 'UNREAD' : (existing?.status ?? 'UNREAD'),
        lastMessageDirection: 'INBOUND',
        participantName: input.senderName,
        participantAvatar: input.senderAvatar ?? null,
      },
    }),
  ]);

  return existing ? 'updated' : 'created';
}
