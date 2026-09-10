import { describe, expect, it } from 'vitest';
import { assertDemoModeAllowed, demoDataProvider, isDemoModeEnabled } from '@oma/demo';

describe('demo mode guards', () => {
  it('never enables demo in production', () => {
    expect(isDemoModeEnabled({ NODE_ENV: 'production', OMA_DEMO_MODE: '1' })).toBe(false);
    expect(isDemoModeEnabled({ NODE_ENV: 'development', OMA_DEMO_MODE: '1' })).toBe(true);
    expect(isDemoModeEnabled({ NODE_ENV: 'development', OMA_DEMO_MODE: '0' })).toBe(false);
  });

  it('throws when production tries to force demo mode', () => {
    expect(() => assertDemoModeAllowed({ NODE_ENV: 'production', OMA_DEMO_MODE: '1' })).toThrow(
      /cannot activate in production/i,
    );
  });

  it('loadEnv refuses OMA_DEMO_MODE in production', async () => {
    const { loadEnv } = await import('@oma/config');
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://oma@127.0.0.1:5432/oma_ai?schema=public',
        REDIS_URL: 'redis://127.0.0.1:6379',
        OMA_DEMO_MODE: '1',
      }),
    ).toThrow(/cannot activate in production/i);
  });

  it('linked journey keeps consistent entity ids', () => {
    const j = demoDataProvider.getLinkedJourney();
    expect(j.strategy.brandId).toBe(j.brand.id);
    expect(j.organicCampaign.strategyId).toBe(j.strategy.id);
    expect(j.paidCampaign.strategyId).toBe(j.strategy.id);
    expect(j.brief.requestId).toBe(j.request.id);
    expect(j.deliverable.id).toBe(j.task.deliverableId);
    expect(j.scheduled.contentId).toBeTruthy();
  });
});
