import { describe, expect, it, vi } from 'vitest';
import { estimateMrrUsdCents } from '../../apps/api/src/platform/platform-admin-metrics';

vi.mock('@oma/db', () => ({
  hydratePlan: vi.fn(async (code: string) => {
    const prices: Record<string, { priceMonthlyUsd: number; priceYearlyPerMonthUsd: number }> = {
      starter: { priceMonthlyUsd: 39, priceYearlyPerMonthUsd: 33 },
      pro: { priceMonthlyUsd: 89, priceYearlyPerMonthUsd: 75 },
    };
    const p = prices[code] ?? { priceMonthlyUsd: 0, priceYearlyPerMonthUsd: 0 };
    return { ...p, code, limits: {}, features: {} };
  }),
}));

describe('estimateMrrUsdCents', () => {
  it('sums active monthly subscriptions and X addon', async () => {
    const result = await estimateMrrUsdCents(
      [
        { planCode: 'starter', status: 'active', billingCycle: 'monthly', xApiAddon: false },
        { planCode: 'pro', status: 'active', billingCycle: 'monthly', xApiAddon: true },
        { planCode: 'pro', status: 'canceled', billingCycle: 'monthly', xApiAddon: false },
      ],
      2900,
    );
    expect(result.active_subscriptions).toBe(2);
    expect(result.mrr_usd_cents).toBe(39 * 100 + 89 * 100 + 2900);
  });
});
