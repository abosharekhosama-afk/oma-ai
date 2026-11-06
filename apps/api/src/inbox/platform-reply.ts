import { getPrisma } from '@oma/db';
import { decryptToken, tokenKeyFromEnv } from '@oma/domain';

export type PlatformReplyResult =
  | { ok: true; externalMessageId: string | null; delivered: true }
  | { ok: false; delivered: false; reason: string };

/**
 * Attempt real outbound delivery when a connected SocialPage token exists.
 * Meta: Graph API messages / comments. Other networks: explicit not-wired yet.
 */
export async function tryPlatformReply(input: {
  tenantId: string;
  platform: 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN';
  brandId?: string | null;
  socialPageId?: string | null;
  externalThreadId: string;
  type: string;
  participantExtId?: string | null;
  /** For comment threads: Graph comment id to reply under. */
  replyToCommentId?: string | null;
  content: string;
}): Promise<PlatformReplyResult> {
  if (input.platform === 'TIKTOK' || input.platform === 'LINKEDIN') {
    return {
      ok: false,
      delivered: false,
      reason: `${input.platform} outbound reply is not wired yet — stored locally only.`,
    };
  }

  const page = await resolveSocialPage(input);
  if (!page) {
    return {
      ok: false,
      delivered: false,
      reason:
        'No connected social page token found for this conversation. Connect the page in Brand › Social.',
    };
  }

  let accessToken: string;
  try {
    const key = tokenKeyFromEnv(process.env);
    if (!key) {
      return {
        ok: false,
        delivered: false,
        reason: 'SOCIAL_TOKEN_ENCRYPTION_KEY is not configured.',
      };
    }
    accessToken = decryptToken(page.accessTokenEnc, key);
  } catch {
    return {
      ok: false,
      delivered: false,
      reason: 'Could not decrypt page access token. Check SOCIAL_TOKEN_ENCRYPTION_KEY.',
    };
  }

  if (input.type === 'DIRECT_MESSAGE') {
    return sendMetaPrivateMessage({
      platform: input.platform,
      accessToken,
      recipientId: input.participantExtId || extractPeerId(input.externalThreadId),
      text: input.content,
    });
  }

  const commentId =
    input.replyToCommentId ||
    (input.externalThreadId.includes(':') ? null : input.externalThreadId);
  if (!commentId) {
    return {
      ok: false,
      delivered: false,
      reason:
        'Missing platform comment id for reply. Run inbox sync or open the thread from a synced comment.',
    };
  }
  return sendMetaCommentReply({
    accessToken,
    commentId,
    text: input.content,
    platform: input.platform,
  });
}

async function resolveSocialPage(input: {
  tenantId: string;
  brandId?: string | null;
  socialPageId?: string | null;
  platform: 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN';
}) {
  const network = input.platform === 'META_IG' ? 'INSTAGRAM' : 'FACEBOOK';
  if (input.socialPageId) {
    return getPrisma().socialPage.findFirst({
      where: { id: input.socialPageId, tenantId: input.tenantId, status: 'CONNECTED' },
      select: { id: true, accessTokenEnc: true, externalId: true, network: true },
    });
  }
  return getPrisma().socialPage.findFirst({
    where: {
      tenantId: input.tenantId,
      status: 'CONNECTED',
      network: network as never,
      ...(input.brandId ? { brandId: input.brandId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, accessTokenEnc: true, externalId: true, network: true },
  });
}

function extractPeerId(externalThreadId: string): string | null {
  // Worker stores FB/IG DM threads as `${pageId}:${senderId}`
  const parts = externalThreadId.split(':');
  if (parts.length >= 2) return parts[parts.length - 1] || null;
  return externalThreadId || null;
}

async function sendMetaPrivateMessage(input: {
  platform: 'META_FB' | 'META_IG';
  accessToken: string;
  recipientId: string | null;
  text: string;
}): Promise<PlatformReplyResult> {
  if (!input.recipientId) {
    return { ok: false, delivered: false, reason: 'Missing recipient id for private message.' };
  }
  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(input.accessToken)}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: input.recipientId },
        message: { text: input.text },
        messaging_type: 'RESPONSE',
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      message_id?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        delivered: false,
        reason: body.error?.message || `Meta Graph HTTP ${res.status}`,
      };
    }
    return { ok: true, delivered: true, externalMessageId: body.message_id ?? null };
  } catch (e) {
    return {
      ok: false,
      delivered: false,
      reason: e instanceof Error ? e.message : 'Meta request failed',
    };
  }
}

async function sendMetaCommentReply(input: {
  accessToken: string;
  commentId: string;
  text: string;
  platform: 'META_FB' | 'META_IG';
}): Promise<PlatformReplyResult> {
  const v = process.env.META_GRAPH_VERSION || 'v21.0';
  const path = `${encodeURIComponent(input.commentId)}/${input.platform === 'META_IG' ? 'replies' : 'comments'}`;
  const url = `https://graph.facebook.com/${v}/${path}?access_token=${encodeURIComponent(input.accessToken)}`;
  const bodyField =
    input.platform === 'META_IG' ? { message: input.text } : { message: input.text };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(bodyField),
    });
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        delivered: false,
        reason: body.error?.message || `Meta Graph HTTP ${res.status}`,
      };
    }
    return { ok: true, delivered: true, externalMessageId: body.id ?? null };
  } catch (e) {
    return {
      ok: false,
      delivered: false,
      reason: e instanceof Error ? e.message : 'Meta comment reply failed',
    };
  }
}
