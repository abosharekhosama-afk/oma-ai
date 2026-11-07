import { describe, expect, it } from 'vitest';
import {
  PLAN_CATALOG,
  PLAN_CODES,
  addBillingPeriod,
  approvalModeAllowed,
  getPlan,
  isPlanCode,
  limitsExceededByUsage,
  planHasFeature,
  planPriceUsdCents,
  DEFAULT_PLAN_FOR_NEW_TENANTS,
  GRANDFATHER_PLAN_FOR_EXISTING,
} from './plans';

describe('plan catalog', () => {
  it('defines Free, Basic, Pro, Enterprise', () => {
    expect(PLAN_CODES).toEqual(['free', 'basic', 'pro', 'enterprise']);
    for (const code of PLAN_CODES) {
      expect(PLAN_CATALOG[code].code).toBe(code);
      expect(PLAN_CATALOG[code].nameEn.length).toBeGreaterThan(0);
      expect(PLAN_CATALOG[code].nameAr.length).toBeGreaterThan(0);
    }
  });

  it('keeps Free posts as lifetime total and paid as monthly', () => {
    expect(getPlan('free').limits.posts_total).toBe(50);
    expect(getPlan('free').limits.posts_per_month).toBeNull();
    expect(getPlan('basic').limits.posts_per_month).toBe(60);
    expect(getPlan('pro').limits.posts_per_month).toBe(150);
    expect(getPlan('enterprise').limits.posts_per_month).toBeNull();
  });

  it('gates approval modes by plan level', () => {
    expect(approvalModeAllowed('free', 'optional')).toBe(true);
    expect(approvalModeAllowed('free', 'required')).toBe(false);
    expect(approvalModeAllowed('pro', 'required')).toBe(true);
    expect(approvalModeAllowed('pro', 'multi_level')).toBe(false);
    expect(approvalModeAllowed('enterprise', 'multi_level')).toBe(true);
  });

  it('exposes analytics and client visibility from Pro up', () => {
    expect(planHasFeature('free', 'analytics')).toBe(false);
    expect(planHasFeature('basic', 'analytics')).toBe(false);
    expect(planHasFeature('pro', 'analytics')).toBe(true);
    expect(planHasFeature('pro', 'client_visibility')).toBe(true);
    expect(planHasFeature('enterprise', 'custom_roles')).toBe(true);
  });

  it('defaults new tenants to Free and grandfathers existing to Pro', () => {
    expect(DEFAULT_PLAN_FOR_NEW_TENANTS).toBe('free');
    expect(GRANDFATHER_PLAN_FOR_EXISTING).toBe('pro');
    expect(isPlanCode('pro')).toBe(true);
    expect(isPlanCode('gold')).toBe(false);
  });

  it('prices a billing period and rejects a downgrade that exceeds usage', () => {
    expect(planPriceUsdCents('free', 'monthly')).toBe(0);
    expect(planPriceUsdCents('pro', 'monthly')).toBe(5900);
    expect(planPriceUsdCents('pro', 'yearly')).toBe(49 * 12 * 100);
    expect(planPriceUsdCents('enterprise', 'monthly')).toBeNull();
    const start = new Date('2026-01-31T00:00:00.000Z');
    expect(addBillingPeriod(start, 'monthly').toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(limitsExceededByUsage(getPlan('free').limits, { brands: 2, posts_total: 10 })).toEqual([
      'brands',
    ]);
    expect(limitsExceededByUsage(getPlan('pro').limits, { brands: 2, posts_total: 400 })).toEqual(
      [],
    );
  });
});
