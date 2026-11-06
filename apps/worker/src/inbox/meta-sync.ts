import { getPrisma } from '@oma/db';
import { decryptToken, tokenKeyFromEnv } from '@oma/domain';
import { createLogger } from '@oma/observability';
import { ingestInboundMessage } from './ingest-conversation';

const log = createLogger('inbox-meta-sync');

const GRAPH = 'https://graph.facebook.com';
const GRAPH_VERSION = () => process.env.META_GRAPH_VERSION || 'v21.0';

type SyncResult = { pages: number; ingested: number; skipped: number; errors: string[] };

type GraphList<T> = { data?: T[]; paging?: { next?: string } };

async function graphGet<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<T> {
  const q = new URLSearchParams({ ...params, access_token: accessToken });
  const res = await fetch(`${GRAPH}/${GRAPH_VERSION()}/${path}?${q}`);
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(body.error?.message || `Graph HTTP ${res.status}`);
  }
  return body;
}

function postMeta(platform: 'META_FB' | 'META_IG', pageName: string, channelNetwork: string) {
  return JSON.stringify({
    source: 'meta-inbox-sync',
    channelName: `${pageName} · ${channelNetwork}`,
  });
}

async function syncFacebookPage(input: {
  tenantId: string;
  brandId: string;
  socialPageId: string;
  pageExternalId: string;
  pageName: string;
  accessToken: string;
  sinceDays: number;
}): Promise<{ ingested: number; skipped: number; errors: string[] }> {
  let ingested = 0;
  let skipped = 0;
  const errors: string[] = [];
  const since = Math.floor(Date.now() / 1000) - input.sinceDays * 86400;

  try {
    const feed = await graphGet<
      GraphList<{
        id: string;
        message?: string;
        created_time?: string;
        full_picture?: string;
        permalink_url?: string;
      }>
    >(`${input.pageExternalId}/feed`, input.accessToken, {
      fields: 'id,message,created_time,full_picture,permalink_url',
      limit: '40',
    });
    for (const post of feed.data ?? []) {
      const postCaption = post.message?.slice(0, 500) ?? '';
      const meta = JSON.stringify({
        source: 'meta-inbox-sync',
        channelName: `${input.pageName} · Facebook`,
        postCaption,
        postThumbnailUrl: post.full_picture ?? undefined,
        postPermalink: post.permalink_url ?? undefined,
        postPublishedAt: post.created_time,
      });
      try {
        const comments = await graphGet<
          GraphList<{
            id: string;
            message?: string;
            created_time?: string;
            from?: { id?: string; name?: string };
          }>
        >(`${post.id}/comments`, input.accessToken, {
          fields: 'id,message,from,created_time',
          filter: 'stream',
          limit: '100',
          since: String(since),
        });
        for (const c of comments.data ?? []) {
          const from = c.from;
          if (!from?.id) continue;
          if (from.id === input.pageExternalId) continue;
          const r = await ingestInboundMessage({
            tenantId: input.tenantId,
            brandId: input.brandId,
            socialPageId: input.socialPageId,
            platform: 'META_FB',
            externalThreadId: post.id,
            type: 'POST_COMMENT',
            externalMessageId: c.id,
            senderExternalId: from.id,
            senderName: from.name ?? from.id,
            content: c.message ?? '',
            subject: postCaption.slice(0, 200) || null,
            metadataJson: meta,
            createdAt: c.created_time ? new Date(c.created_time) : undefined,
          });
          if (r === 'duplicate') skipped += 1;
          else ingested += 1;
        }
      } catch (e) {
        errors.push(`FB comments ${post.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e) {
    errors.push(`FB feed: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const convs = await graphGet<
      GraphList<{
        id: string;
        updated_time?: string;
        participants?: { data?: Array<{ id?: string; name?: string }> };
        messages?: GraphList<{
          id?: string;
          message?: string;
          created_time?: string;
          from?: { id?: string; name?: string };
        }>;
      }>
    >(`${input.pageExternalId}/conversations`, input.accessToken, {
      fields: 'participants,messages.limit(15){message,from,created_time,id}',
      platform: 'messenger',
      limit: '25',
    });
    for (const conv of convs.data ?? []) {
      const messages = conv.messages?.data ?? [];
      for (const m of messages) {
        const from = m.from;
        if (!from?.id || from.id === input.pageExternalId) continue;
        const threadId = `${input.pageExternalId}:${from.id}`;
        const r = await ingestInboundMessage({
          tenantId: input.tenantId,
          brandId: input.brandId,
          socialPageId: input.socialPageId,
          platform: 'META_FB',
          externalThreadId: threadId,
          type: 'DIRECT_MESSAGE',
          externalMessageId: m.id ?? null,
          senderExternalId: from.id,
          senderName: from.name ?? from.id,
          content: m.message ?? '',
          metadataJson: postMeta('META_FB', input.pageName, 'Facebook'),
          createdAt: m.created_time ? new Date(m.created_time) : undefined,
        });
        if (r === 'duplicate') skipped += 1;
        else ingested += 1;
      }
    }
  } catch (e) {
    errors.push(`FB messenger: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { ingested, skipped, errors };
}

async function syncInstagramPage(input: {
  tenantId: string;
  brandId: string;
  socialPageId: string;
  igUserId: string;
  pageName: string;
  accessToken: string;
  sinceDays: number;
}): Promise<{ ingested: number; skipped: number; errors: string[] }> {
  let ingested = 0;
  let skipped = 0;
  const errors: string[] = [];
  const since = new Date(Date.now() - input.sinceDays * 86400_000).toISOString();

  try {
    const media = await graphGet<
      GraphList<{
        id: string;
        caption?: string;
        timestamp?: string;
        media_url?: string;
        thumbnail_url?: string;
        permalink?: string;
        comments?: GraphList<{
          id: string;
          text?: string;
          timestamp?: string;
          username?: string;
          from?: { id?: string; username?: string };
        }>;
      }>
    >(`${input.igUserId}/media`, input.accessToken, {
      fields:
        'id,caption,timestamp,media_url,thumbnail_url,permalink,comments.limit(50){id,text,timestamp,username,from}',
      limit: '30',
    });
    for (const item of media.data ?? []) {
      if (item.timestamp && item.timestamp < since) continue;
      const caption = item.caption?.slice(0, 500) ?? '';
      const thumb = item.thumbnail_url || item.media_url;
      const meta = JSON.stringify({
        source: 'meta-inbox-sync',
        channelName: `${input.pageName} · Instagram`,
        postCaption: caption,
        postThumbnailUrl: thumb,
        postPermalink: item.permalink,
        postPublishedAt: item.timestamp,
      });
      const comments = item.comments?.data ?? [];
      for (const c of comments) {
        const senderId = c.from?.id ?? c.username ?? 'ig_user';
        const senderName = c.username ?? c.from?.username ?? senderId;
        const r = await ingestInboundMessage({
          tenantId: input.tenantId,
          brandId: input.brandId,
          socialPageId: input.socialPageId,
          platform: 'META_IG',
          externalThreadId: item.id,
          type: 'POST_COMMENT',
          externalMessageId: c.id,
          senderExternalId: String(senderId),
          senderName: String(senderName),
          content: c.text ?? '',
          subject: caption.slice(0, 200) || null,
          metadataJson: meta,
          createdAt: c.timestamp ? new Date(c.timestamp) : undefined,
        });
        if (r === 'duplicate') skipped += 1;
        else ingested += 1;
      }
    }
  } catch (e) {
    errors.push(`IG media comments: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const convs = await graphGet<
      GraphList<{
        id: string;
        messages?: GraphList<{
          id?: string;
          message?: string;
          created_time?: string;
          from?: { id?: string; username?: string };
        }>;
      }>
    >(`${input.igUserId}/conversations`, input.accessToken, {
      fields: 'messages.limit(15){message,from,created_time,id}',
      platform: 'instagram',
      limit: '25',
    });
    for (const conv of convs.data ?? []) {
      for (const m of conv.messages?.data ?? []) {
        const from = m.from;
        if (!from?.id) continue;
        if (from.id === input.igUserId) continue;
        const r = await ingestInboundMessage({
          tenantId: input.tenantId,
          brandId: input.brandId,
          socialPageId: input.socialPageId,
          platform: 'META_IG',
          externalThreadId: `${input.igUserId}:${from.id}`,
          type: 'DIRECT_MESSAGE',
          externalMessageId: m.id ?? null,
          senderExternalId: from.id,
          senderName: from.username ?? from.id,
          content: m.message ?? '',
          metadataJson: postMeta('META_IG', input.pageName, 'Instagram'),
          createdAt: m.created_time ? new Date(m.created_time) : undefined,
        });
        if (r === 'duplicate') skipped += 1;
        else ingested += 1;
      }
    }
  } catch (e) {
    errors.push(`IG DMs: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { ingested, skipped, errors };
}

async function syncXPage(input: {
  tenantId: string;
  brandId: string;
  socialPageId: string;
  userId: string;
  pageName: string;
  accessToken: string;
}): Promise<{ ingested: number; skipped: number; errors: string[] }> {
  let ingested = 0;
  let skipped = 0;
  const errors: string[] = [];
  const headers = { authorization: `Bearer ${input.accessToken}` };
  const meta = JSON.stringify({
    source: 'x-inbox-sync',
    channelName: `${input.pageName} · X`,
  });

  try {
    const res = await fetch(
      'https://api.x.com/2/dm_events?event_types=MessageCreate&dm_event.fields=id,text,sender_id,created_at,dm_conversation_id&max_results=50',
      { headers },
    );
    const body = (await res.json().catch(() => ({}))) as {
      data?: Array<{
        id?: string;
        text?: string;
        sender_id?: string;
        created_at?: string;
        dm_conversation_id?: string;
      }>;
      errors?: Array<{ message?: string }>;
    };
    if (!res.ok) {
      errors.push(`X DMs: ${body.errors?.[0]?.message || `HTTP ${res.status}`}`);
    } else {
      for (const ev of body.data ?? []) {
        const sender = ev.sender_id ?? 'unknown';
        if (sender === input.userId) continue;
        const r = await ingestInboundMessage({
          tenantId: input.tenantId,
          brandId: input.brandId,
          socialPageId: input.socialPageId,
          platform: 'X',
          externalThreadId: ev.dm_conversation_id || `x-dm:${sender}`,
          type: 'DIRECT_MESSAGE',
          externalMessageId: ev.id ?? null,
          senderExternalId: sender,
          senderName: sender,
          content: ev.text ?? '',
          metadataJson: meta,
          createdAt: ev.created_at ? new Date(ev.created_at) : undefined,
        });
        if (r === 'duplicate') skipped += 1;
        else ingested += 1;
      }
    }
  } catch (e) {
    errors.push(`X DMs: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const res = await fetch(
      `https://api.x.com/2/users/${encodeURIComponent(input.userId)}/mentions?tweet.fields=created_at,text,author_id&expansions=author_id&user.fields=name,username&max_results=50`,
      { headers },
    );
    const body = (await res.json().catch(() => ({}))) as {
      data?: Array<{ id?: string; text?: string; author_id?: string; created_at?: string }>;
      includes?: { users?: Array<{ id?: string; name?: string; username?: string }> };
      errors?: Array<{ message?: string }>;
    };
    if (!res.ok) {
      errors.push(`X mentions: ${body.errors?.[0]?.message || `HTTP ${res.status}`}`);
    } else {
      const users = new Map((body.includes?.users ?? []).map((u) => [u.id ?? '', u]));
      for (const tw of body.data ?? []) {
        const author = users.get(tw.author_id ?? '');
        const r = await ingestInboundMessage({
          tenantId: input.tenantId,
          brandId: input.brandId,
          socialPageId: input.socialPageId,
          platform: 'X',
          externalThreadId: tw.id ?? 'x-mention',
          type: 'MENTION',
          externalMessageId: tw.id ?? null,
          senderExternalId: tw.author_id ?? 'unknown',
          senderName: author?.username ?? author?.name ?? tw.author_id ?? 'X user',
          content: tw.text ?? '',
          metadataJson: meta,
          createdAt: tw.created_at ? new Date(tw.created_at) : undefined,
        });
        if (r === 'duplicate') skipped += 1;
        else ingested += 1;
      }
    }
  } catch (e) {
    errors.push(`X mentions: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { ingested, skipped, errors };
}

export async function runInboxSync(input: {
  tenantId: string;
  brandId?: string | null;
  sinceDays?: number;
}): Promise<SyncResult> {
  const key = tokenKeyFromEnv(process.env);
  if (!key) {
    return {
      pages: 0,
      ingested: 0,
      skipped: 0,
      errors: ['SOCIAL_TOKEN_ENCRYPTION_KEY not configured'],
    };
  }

  const sinceDays = input.sinceDays ?? Number(process.env.INBOX_SYNC_DAYS ?? 14);
  const pages = await getPrisma().socialPage.findMany({
    where: {
      tenantId: input.tenantId,
      status: 'CONNECTED',
      network: { in: ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'X', 'LINKEDIN', 'TIKTOK'] },
      ...(input.brandId ? { brandId: input.brandId } : {}),
    },
  });

  let ingested = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const page of pages) {
    let accessToken: string;
    try {
      accessToken = decryptToken(page.accessTokenEnc, key);
    } catch {
      errors.push(`${page.name}: token decrypt failed`);
      continue;
    }

    const meta = (() => {
      try {
        return JSON.parse(page.metaJson || '{}') as Record<string, unknown>;
      } catch {
        return {};
      }
    })();

    try {
      if (page.network === 'FACEBOOK') {
        const r = await syncFacebookPage({
          tenantId: page.tenantId,
          brandId: page.brandId,
          socialPageId: page.id,
          pageExternalId: page.externalId,
          pageName: page.name,
          accessToken,
          sinceDays,
        });
        ingested += r.ingested;
        skipped += r.skipped;
        errors.push(...r.errors);
      } else if (page.network === 'INSTAGRAM') {
        const r = await syncInstagramPage({
          tenantId: page.tenantId,
          brandId: page.brandId,
          socialPageId: page.id,
          igUserId: page.externalId,
          pageName: page.name,
          accessToken,
          sinceDays,
        });
        ingested += r.ingested;
        skipped += r.skipped;
        errors.push(...r.errors);
      } else if (page.network === 'X') {
        const r = await syncXPage({
          tenantId: page.tenantId,
          brandId: page.brandId,
          socialPageId: page.id,
          userId: page.externalId,
          pageName: page.name,
          accessToken,
        });
        ingested += r.ingested;
        skipped += r.skipped;
        errors.push(...r.errors);
      } else {
        // WhatsApp Cloud API, LinkedIn, and TikTok deliver inbox events over webhooks.
        // There is no complete history list to backfill.
      }

      await getPrisma().socialPage.update({
        where: { id: page.id },
        data: {
          metaJson: JSON.stringify({
            ...meta,
            lastInboxSyncAt: new Date().toISOString(),
            inboxMode:
              page.network === 'FACEBOOK' || page.network === 'INSTAGRAM' || page.network === 'X'
                ? 'pull_and_webhook'
                : 'webhook_primary',
          }),
        },
      });
    } catch (e) {
      errors.push(`${page.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  log.info(
    { tenantId: input.tenantId, pages: pages.length, ingested, skipped },
    'inbox sync finished',
  );
  return { pages: pages.length, ingested, skipped, errors: errors.slice(0, 20) };
}
