import { describe, expect, it } from 'vitest';
import {
  STRATEGY_CAPABILITIES,
  SYSTEM_PROFILES,
  approveImpliesSetCurrent,
  hasCapability,
} from '../../../packages/domain/src/authz/capabilities';

describe('strategy capabilities', () => {
  it('includes all strategy.* codes', () => {
    expect(STRATEGY_CAPABILITIES).toContain('strategy.read');
    expect(STRATEGY_CAPABILITIES).toContain('strategy.approve');
    expect(STRATEGY_CAPABILITIES).toContain('strategy.set_current');
    expect(STRATEGY_CAPABILITIES).toHaveLength(12);
  });

  it('grants COMPANY_OWNER all strategy capabilities', () => {
    for (const code of STRATEGY_CAPABILITIES) {
      expect(hasCapability(SYSTEM_PROFILES.COMPANY_OWNER, code)).toBe(true);
    }
  });

  it('denies MEMBER strategy capabilities by default', () => {
    expect(hasCapability(SYSTEM_PROFILES.MEMBER, 'strategy.read')).toBe(false);
    expect(hasCapability(SYSTEM_PROFILES.MEMBER, 'strategy.approve')).toBe(false);
  });

  it('keeps approve separate from set_current', () => {
    expect(approveImpliesSetCurrent()).toBe(false);
    expect(hasCapability(['strategy.approve'], 'strategy.set_current')).toBe(false);
    expect(hasCapability(['strategy.set_current'], 'strategy.approve')).toBe(false);
  });
});
