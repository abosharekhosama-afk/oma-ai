import { getPrisma } from '@oma/db';
import { decryptToken, tokenKeyFromEnv } from '@oma/domain';

async function resolvePageToken(tenantId: string, socialPageId: string | null, brandId: string | null) {
  const key = tokenKeyFromEnv(process.env);
  if (!key) return { ok: false as const, reason: 'SOCIAL_TOKEN_ENCRYPTION_KEY is not configured.' };
  const page = socialPageId
    ? await getPrisma().socialPage.findFirst({
        where: { id: socialPageId, tenantId, status: 'CONNECTED' },
      })
    : await getPrisma().socialPage.findFirst({
        where: {
          tenantId,
          status: 'CONNECTED',
          ...(brandId ? { brandId } : {}),
        },
        orderBy: { updatedAt: 'desc' },
      });
  if (!page) {
    return { ok: false as const, reason: 'No connected social page for this conversation.' };
  }
  try {
    const accessToken = decryptToken(page.accessTokenEnc, key);
    return { ok: true as const, accessToken, platform: page.network };
  } catch {
    return { ok: false as const, reason: 'Could not decrypt page access token.' };
  }
}

export async function hidePlatformComment(input: {
  tenantId: string;
  socialPageId: string | null;
  brandId: string | null;
  externalCommentId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const tok = await resolvePageToken(input.tenantId, input.socialPageId, input.brandId);
  if (!tok.ok) return { ok: false, reason: tok.reason };
  const v = process.env.META_GRAPH_VERSION || 'v21.0';
  const url = `https://graph.facebook.com/${v}/${encodeURIComponent(input.externalCommentId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ is_hidden: 'true', access_token: tok.accessToken }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, reason: body.slice(0, 200) || `Graph HTTP ${res.status}` };
  }
  return { ok: true };
}

export async function deletePlatformComment(input: {
  tenantId: string;
  socialPageId: string | null;
  brandId: string | null;
  externalCommentId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const tok = await resolvePageToken(input.tenantId, input.socialPageId, input.brandId);
  if (!tok.ok) return { ok: false, reason: tok.reason };
  const v = process.env.META_GRAPH_VERSION || 'v21.0';
  const url = `https://graph.facebook.com/${v}/${encodeURIComponent(input.externalCommentId)}?access_token=${encodeURIComponent(tok.accessToken)}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, reason: body.slice(0, 200) || `Graph HTTP ${res.status}` };
  }
  return { ok: true };
}
