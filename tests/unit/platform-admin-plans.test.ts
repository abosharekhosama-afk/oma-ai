import { describe, expect, it } from 'vitest';
import { canonicalLimitKey, PLAN_CODES } from '@oma/domain';

describe('platform admin plans', () => {
  it('covers all catalog plan codes', () => {
    expect(PLAN_CODES).toEqual(['starter', 'pro', 'agency']);
  });

  it('canonicalLimitKey maps legacy aliases', () => {
    expect(canonicalLimitKey('social_channels')).toBe('social_accounts');
    expect(canonicalLimitKey('posts_per_month')).toBe('scheduled_posts_per_month');
  });
});
