import { hydratePlan } from '@oma/db';
import { normalizePlanCode } from '@oma/domain';
const ACTIVE_STATUSES = new Set(['trialing', 'active', 'past_due']);

type SubRow = {
  planCode: string;
  status: string;
  billingCycle: string;
  xApiAddon: boolean;
};

export async function estimateMrrUsdCents(
  rows: SubRow[],
  xApiAddonMonthlyUsdCents: number,
): Promise<{ mrr_usd_cents: number; active_subscriptions: number }> {
  let mrr = 0;
  let active = 0;
  for (const sub of rows) {
    if (!ACTIVE_STATUSES.has(sub.status)) continue;
    active += 1;
    const code = normalizePlanCode(sub.planCode);
    if (!code) continue;
    const plan = await hydratePlan(code);
    const monthly = Math.round((plan.priceMonthlyUsd ?? 0) * 100);
    const yearlyPerMonth = Math.round(
      (plan.priceYearlyPerMonthUsd ?? plan.priceMonthlyUsd ?? 0) * 100,
    );
    const base = sub.billingCycle === 'yearly' ? yearlyPerMonth : monthly;
    mrr += base;
    if (sub.xApiAddon) mrr += xApiAddonMonthlyUsdCents;
  }
  return { mrr_usd_cents: mrr, active_subscriptions: active };
}
