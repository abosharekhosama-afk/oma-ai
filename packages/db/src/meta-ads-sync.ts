import {
  MetaAdsClient,
  decryptToken,
  fixtureMetaInsights,
  flightKeyForCampaign,
  metaAdsModeFromEnv,
  newId,
  tokenKeyFromEnv,
  type MetaInsightRow,
} from '@oma/domain';
import { getPrisma } from './prisma.service';

export type MetaAdsSyncResult =
  | { ok: true; rows: number; days: number; source: 'META_API' | 'META_FIXTURE' }
  | {
      ok: false;
      reason: 'disabled' | 'not_connected' | 'needs_reconnect' | 'provider_error';
      message?: string;
    };

/**
 * DEC-029 4.8: pull daily campaign insights (read-only) into PaidSpendEntry. Rows are
 * keyed by (platform META, date, flight key, source) and re-syncs overwrite them, so the
 * last `days` days always reflect Meta's (possibly restated) numbers.
 */
export async function syncBrandMetaAds(
  tenantId: string,
  brandId: string,
  opts: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; now?: Date; days?: number } = {},
): Promise<MetaAdsSyncResult> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  const days = Math.min(90, Math.max(1, opts.days ?? 28));
  const mode = metaAdsModeFromEnv(env);
  if (mode === 'disabled') return { ok: false, reason: 'disabled' };
  const prisma = getPrisma();
  const link = await prisma.metaAdsLink.findFirst({ where: { tenantId, brandId } });
  if (!link || !link.adAccountId) return { ok: false, reason: 'not_connected' };
  const until = now.toISOString().slice(0, 10);
  const since = new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);

  // Flights of approved versions (latest approval wins per key).
  const flights = await prisma.strategyPaidFlight.findMany({
    where: { tenantId, brandId, version: { status: 'APPROVED' } },
    include: { version: { select: { approvedAt: true } } },
    orderBy: { version: { approvedAt: 'asc' } },
  });
  const flightVersion = new Map(flights.map((f) => [f.key, f.strategyVersionId]));
  const flightList = flights.map((f) => ({ key: f.key, name: f.name }));

  let rows: MetaInsightRow[];
  let source: 'META_API' | 'META_FIXTURE';
  if (mode === 'fixture' || link.status === 'FIXTURE') {
    if (mode !== 'fixture') return { ok: false, reason: 'disabled' };
    rows = fixtureMetaInsights(since, until, flightList);
    source = 'META_FIXTURE';
  } else {
    const key = tokenKeyFromEnv();
    if (!key || !link.accessTokenEnc) return { ok: false, reason: 'needs_reconnect' };
    if (link.tokenExpiresAt && link.tokenExpiresAt <= now) {
      await prisma.metaAdsLink.update({
        where: { id: link.id },
        data: { status: 'NEEDS_RECONNECT', lastError: 'token_expired' },
      });
      return { ok: false, reason: 'needs_reconnect' };
    }
    try {
      const client = new MetaAdsClient(env, opts.fetchImpl ?? fetch);
      rows = await client.insights(
        decryptToken(link.accessTokenEnc, key),
        link.adAccountId,
        since,
        until,
      );
      source = 'META_API';
    } catch (err) {
      const e = err as Error & { status?: number; code?: number };
      const message = String(e.message).slice(0, 300);
      const auth = e.status === 401 || e.code === 190 || e.code === 200;
      await prisma.metaAdsLink.update({
        where: { id: link.id },
        data: { lastError: message, ...(auth ? { status: 'NEEDS_RECONNECT' } : {}) },
      });
      return { ok: false, reason: auth ? 'needs_reconnect' : 'provider_error', message };
    }
  }

  // Aggregate per (date, flight); remember one campaign id for traceability.
  const agg = new Map<string, MetaInsightRow & { flightKey: string }>();
  for (const r of rows) {
    if (!r.date) continue;
    const flightKey = flightKeyForCampaign(r.campaign_name, flightList);
    const k = `${r.date}|${flightKey}`;
    const prev = agg.get(k);
    if (!prev) agg.set(k, { ...r, flightKey });
    else {
      prev.spend = Math.round((prev.spend + r.spend) * 100) / 100;
      prev.impressions = (prev.impressions ?? 0) + (r.impressions ?? 0);
      prev.clicks = (prev.clicks ?? 0) + (r.clicks ?? 0);
      prev.conversions =
        prev.conversions == null && r.conversions == null
          ? null
          : (prev.conversions ?? 0) + (r.conversions ?? 0);
    }
  }
  const sourceTag = source === 'META_API' ? 'META_API' : 'META_FIXTURE';
  await prisma.$transaction([
    // Replace the window so restated or removed rows never linger.
    prisma.paidSpendEntry.deleteMany({
      where: {
        tenantId,
        brandId,
        source: sourceTag,
        spendDate: { gte: new Date(`${since}T00:00:00Z`), lte: new Date(`${until}T00:00:00Z`) },
      },
    }),
    prisma.paidSpendEntry.createMany({
      data: [...agg.values()].map((r) => ({
        id: newId(),
        tenantId,
        brandId,
        strategyVersionId: r.flightKey ? (flightVersion.get(r.flightKey) ?? null) : null,
        flightKey: r.flightKey,
        platform: 'META' as const,
        spendDate: new Date(`${r.date}T00:00:00Z`),
        amount: r.spend,
        currency: r.currency,
        impressions: r.impressions,
        clicks: r.clicks,
        conversions: r.conversions,
        source: sourceTag,
        externalCampaignId: r.campaign_id || null,
      })),
    }),
    prisma.metaAdsLink.update({
      where: { id: link.id },
      data: { lastSyncAt: now, lastError: null },
    }),
  ]);
  return { ok: true, rows: agg.size, days, source };
}
