import { describe, expect, it } from 'vitest';
import {
  PLAN_CATALOG,
  PLAN_CODES,
  addBillingPeriod,
  approvalModeAllowed,
  canonicalLimitKey,
  getPlan,
  isPlanCode,
  limitsExceededByUsage,
  normalizePlanCode,
  planHasFeature,
  planPriceUsdCents,
  DEFAULT_PLAN_FOR_NEW_TENANTS,
  GRANDFATHER_PLAN_FOR_EXISTING,
} from './plans';
import { YEARLY_MONTHS_CHARGED } from './vat';

describe('plan catalog', () => {
  it('defines Starter, Pro, and Agency with the published limits', () => {
    expect(PLAN_CODES).toEqual(['starter', 'pro', 'agency']);
    expect(getPlan('starter').priceMonthlyUsd).toBe(39);
    expect(getPlan('pro').priceMonthlyUsd).toBe(79);
    expect(getPlan('agency').priceMonthlyUsd).toBe(249);
    expect(getPlan('starter').limits).toMatchObject({
      brands: 3,
      social_accounts: 4,
      seats: 3,
      scheduled_posts_per_month: 60,
      ai_credits_per_month: 300,
      listening_keywords: 3,
      mentions_per_month: 1000,
    });
    expect(getPlan('pro').limits).toMatchObject({
      brands: 10,
      social_accounts: 10,
      seats: 10,
      scheduled_posts_per_month: 300,
      ai_credits_per_month: 1500,
      listening_keywords: 10,
      mentions_per_month: 5000,
    });
    expect(getPlan('agency').limits).toMatchObject({
      brands: 25,
      social_accounts: 30,
      seats: 25,
      scheduled_posts_per_month: 1500,
      ai_credits_per_month: 6000,
      listening_keywords: 30,
      mentions_per_month: 25000,
    });
  });

  it('maps legacy plan codes and aliases limit keys', () => {
    expect(normalizePlanCode('free')).toBe('starter');
    expect(normalizePlanCode('basic')).toBe('starter');
    expect(normalizePlanCode('enterprise')).toBe('agency');
    expect(normalizePlanCode('pro')).toBe('pro');
    expect(isPlanCode('basic')).toBe(false);
    expect(canonicalLimitKey('social_channels')).toBe('social_accounts');
    expect(canonicalLimitKey('posts_per_month')).toBe('scheduled_posts_per_month');
    expect(canonicalLimitKey('ai_runs_per_month')).toBe('ai_credits_per_month');
  });

  it('gates approval modes and analytics by plan', () => {
    expect(approvalModeAllowed('starter', 'optional')).toBe(true);
    expect(approvalModeAllowed('starter', 'required')).toBe(false);
    expect(approvalModeAllowed('pro', 'required')).toBe(true);
    expect(approvalModeAllowed('pro', 'multi_level')).toBe(false);
    expect(approvalModeAllowed('agency', 'multi_level')).toBe(true);
    expect(planHasFeature('starter', 'analytics')).toBe(false);
    expect(planHasFeature('pro', 'analytics')).toBe(true);
    expect(planHasFeature('agency', 'custom_roles')).toBe(true);
  });

  it('defaults new tenants to Starter and grandfathers existing to Pro', () => {
    expect(DEFAULT_PLAN_FOR_NEW_TENANTS).toBe('starter');
    expect(GRANDFATHER_PLAN_FOR_EXISTING).toBe('pro');
    expect(PLAN_CATALOG.pro.popular).toBe(true);
  });

  it('prices a billing period before VAT and rejects a downgrade that exceeds usage', () => {
    expect(planPriceUsdCents('starter', 'monthly')).toBe(3900);
    expect(planPriceUsdCents('pro', 'monthly')).toBe(7900);
    expect(planPriceUsdCents('agency', 'monthly')).toBe(24900);
    expect(planPriceUsdCents('pro', 'yearly')).toBe(79 * YEARLY_MONTHS_CHARGED * 100);
    const start = new Date('2026-01-31T00:00:00.000Z');
    expect(addBillingPeriod(start, 'monthly').toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(limitsExceededByUsage(getPlan('starter').limits, { brands: 4 })).toEqual(['brands']);
    expect(limitsExceededByUsage(getPlan('pro').limits, { brands: 4, seats: 2 })).toEqual([]);
  });
});
