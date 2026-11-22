import {
  createSearchConsolePort,
  decryptToken,
  encryptToken,
  gscModeFromEnv,
  guessQueryLocale,
  newId,
  tokenKeyFromEnv,
} from '@oma/domain';
import { getPrisma } from './prisma.service';

export type SearchConsoleSyncResult =
  | { ok: true; rows: number; source: string }
  | {
      ok: false;
      reason: 'not_connected' | 'token_unavailable' | 'needs_reconnect' | 'provider_error';
      message?: string;
    };

/**
 * DEC-029 4.6: one Search Console sync used by the API (manual "sync now") and the
 * worker (weekly rank snapshot). Refreshes expired live tokens, records a dated
 * KeywordRankObservation per query (one snapshot per source per day) and the link status.
 */
export async function syncBrandSearchConsole(
  tenantId: string,
  brandId: string,
  opts: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<SearchConsoleSyncResult> {
  const env = opts.env ?? process.env;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? new Date();
  const prisma = getPrisma();
  const link = await prisma.brandSearchConsoleLink.findFirst({ where: { tenantId, brandId } });
  if (!link) return { ok: false, reason: 'not_connected' };

  let accessToken: string | undefined;
  if (gscModeFromEnv(env) === 'live') {
    const key = tokenKeyFromEnv();
    if (!key || !link.accessTokenEnc) return { ok: false, reason: 'token_unavailable' };
    accessToken = decryptToken(link.accessTokenEnc, key);
    const expiring = link.tokenExpiresAt && link.tokenExpiresAt.getTime() < now.getTime() + 60_000;
    if (expiring) {
      const refreshed = link.refreshTokenEnc
        ? await refreshGoogleToken(decryptToken(link.refreshTokenEnc, key), env, fetchImpl)
        : null;
      if (!refreshed) {
        await prisma.brandSearchConsoleLink.update({
          where: { id: link.id },
          data: { status: 'NEEDS_RECONNECT', lastError: 'token_refresh_failed' },
        });
        return { ok: false, reason: 'needs_reconnect' };
      }
      accessToken = refreshed.access_token;
      await prisma.brandSearchConsoleLink.update({
        where: { id: link.id },
        data: {
          accessTokenEnc: encryptToken(refreshed.access_token, key),
          tokenExpiresAt: new Date(now.getTime() + (refreshed.expires_in ?? 3600) * 1000),
          status: 'CONNECTED',
        },
      });
    }
  }

  const port = createSearchConsolePort(accessToken, env);
  if (!port.configured) return { ok: false, reason: 'token_unavailable' };
  const end = new Date(now.getTime() - 2 * 86_400_000); // GSC data lags ~2 days
  const start = new Date(end.getTime() - 28 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  let rows;
  try {
    rows = await port.querySearchAnalytics({
      siteUrl: link.siteUrl,
      startDate: fmt(start),
      endDate: fmt(end),
      rowLimit: 250,
    });
  } catch (err) {
    const message = String(err instanceof Error ? err.message : err).slice(0, 300);
    await prisma.brandSearchConsoleLink.update({
      where: { id: link.id },
      data: {
        lastError: message,
        ...(/ 40[13]\b/.test(message) ? { status: 'NEEDS_RECONNECT' } : {}),
      },
    });
    return { ok: false, reason: 'provider_error', message };
  }

  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await prisma.$transaction([
    prisma.keywordRankObservation.deleteMany({
      where: { tenantId, brandId, source: port.source, capturedAt: { gte: dayStart } },
    }),
    prisma.keywordRankObservation.createMany({
      data: rows
        .filter((r) => r.query.trim())
        .map((row) => ({
          id: newId(),
          tenantId,
          brandId,
          keyword: row.query,
          locale: guessQueryLocale(row.query),
          position: row.position,
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: row.ctr,
          pageUrl: row.page ?? null,
          source: port.source,
          capturedAt: now,
        })),
    }),
    prisma.brandSearchConsoleLink.update({
      where: { id: link.id },
      data: { lastSyncAt: now, lastError: null },
    }),
  ]);
  return { ok: true, rows: rows.length, source: port.source };
}

async function refreshGoogleToken(
  refreshToken: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<{ access_token: string; expires_in?: number } | null> {
  const clientId = env.GOOGLE_GSC_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_GSC_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    return body.access_token
      ? { access_token: body.access_token, expires_in: body.expires_in }
      : null;
  } catch {
    return null;
  }
}
