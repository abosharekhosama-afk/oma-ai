import { describe, expect, it } from 'vitest';
import { SYSTEM_PROFILES, hasCapability } from '@oma/domain';

describe('capability profiles', () => {
  it('company owner can manage membership', () => {
    expect(hasCapability(SYSTEM_PROFILES.COMPANY_OWNER ?? [], 'membership.manage')).toBe(true);
  });
  it('member cannot assign capabilities', () => {
    expect(hasCapability(SYSTEM_PROFILES.MEMBER ?? [], 'capability.assign')).toBe(false);
  });
});
