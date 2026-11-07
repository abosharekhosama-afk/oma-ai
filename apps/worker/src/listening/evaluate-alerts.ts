import { getPrisma } from '@oma/db';
import type IORedis from 'ioredis';
import { deliverListeningAlertNotifications } from './alert-delivery';

function safeArr(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function parseThreshold(json: string): Record<string, number> {
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, raw] of Object.entries(v)) {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

function alertFiresWhen(triggerType: string, threshold: Record<string, number>): string {
  if (triggerType === 'VOLUME_SPIKE') {
    const n = threshold.mentionsPerDay;
    return n ? `Over ${n} mentions / day` : 'More mentions than usual';
  }
  if (triggerType === 'SENTIMENT_POSITIVE') {
    return `Over ${threshold.sharePct ?? 0}% positive / day`;
  }
  if (triggerType === 'SENTIMENT_NEGATIVE') {
    return `Over ${threshold.sharePct ?? 0}% negative / day`;
  }
  return triggerType;
}

/** Nightly evaluation of workspace listening alerts (yesterday UTC). */
export async function evaluateListeningAlertsForYesterday(connection?: IORedis) {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() - 1);
  const start = new Date(day);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const dayKey = start.toISOString().slice(0, 10);

  const tenants = await getPrisma().listeningAlert.findMany({
    where: { isActive: true },
    select: { tenantId: true },
    distinct: ['tenantId'],
  });

  let fired = 0;
  for (const { tenantId } of tenants) {
    const alerts = await getPrisma().listeningAlert.findMany({
      where: { tenantId, isActive: true },
    });
    for (const alert of alerts) {
      const platforms = safeArr(alert.platformsJson);
      const ruleScope = {
        kind: 'BRAND',
        isLive: true,
        ...(alert.brandId ? { OR: [{ brandId: alert.brandId }, { brandId: null }] } : {}),
      };
      const dayHits = await getPrisma().listeningHit.findMany({
        where: {
          tenantId,
          isHidden: false,
          isExcluded: false,
          rule: ruleScope,
          ...(platforms.length ? { platform: { in: platforms as never[] } } : {}),
          capturedAt: { gte: start, lt: end },
        },
        select: { sentiment: true },
      });
      const total = dayHits.length;
      const threshold = parseThreshold(alert.thresholdJson);
      let shouldFire = false;
      if (alert.triggerType === 'VOLUME_SPIKE') {
        const min = threshold.mentionsPerDay ?? 0;
        if (min > 0 && total >= min) shouldFire = true;
        else if (!min && total > 0) {
          const histFrom = new Date(start.getTime() - 7 * 86400_000);
          const hist = await getPrisma().listeningHit.count({
            where: {
              tenantId,
              isHidden: false,
              isExcluded: false,
              rule: ruleScope,
              capturedAt: { gte: histFrom, lt: start },
            },
          });
          const avg = hist / 7;
          if (avg > 0 && total > avg * 1.2) shouldFire = true;
        }
      } else if (alert.triggerType === 'SENTIMENT_POSITIVE' && total > 0) {
        const pct = (dayHits.filter((h) => h.sentiment === 'POSITIVE').length / total) * 100;
        if (pct >= (threshold.sharePct ?? 0)) shouldFire = true;
      } else if (alert.triggerType === 'SENTIMENT_NEGATIVE' && total > 0) {
        const pct = (dayHits.filter((h) => h.sentiment === 'NEGATIVE').length / total) * 100;
        if (pct >= (threshold.sharePct ?? 0)) shouldFire = true;
      }
      if (shouldFire) {
        fired += 1;
        await getPrisma().listeningAlert.update({
          where: { id: alert.id },
          data: { lastFiredAt: end },
        });
        await deliverListeningAlertNotifications(
          tenantId,
          {
            alertId: alert.id,
            alertName: alert.name,
            triggerType: alert.triggerType,
            firesWhen: alertFiresWhen(alert.triggerType, threshold),
            notifyInApp: alert.notifyInApp,
            notifyEmail: alert.notifyEmail,
            notifySlack: alert.notifySlack,
          },
          dayKey,
          connection,
        );
      }
    }
  }
  return { tenants: tenants.length, fired };
}
