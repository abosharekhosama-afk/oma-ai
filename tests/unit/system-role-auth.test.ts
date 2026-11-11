import { describe, expect, it } from 'vitest';
import {
  isSuperAdmin,
  isSupportStaff,
  SYSTEM_ROLES,
} from '../../packages/domain/src/authz/system-role';

describe('SystemRole helpers', () => {
  it('defines the three platform roles', () => {
    expect(SYSTEM_ROLES).toEqual(['SUPER_ADMIN', 'SUPPORT_SPECIALIST', 'USER']);
  });

  it('identifies super admin', () => {
    expect(isSuperAdmin('SUPER_ADMIN')).toBe(true);
    expect(isSuperAdmin('SUPPORT_SPECIALIST')).toBe(false);
    expect(isSuperAdmin('USER')).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });

  it('identifies support staff (including super admin)', () => {
    expect(isSupportStaff('SUPER_ADMIN')).toBe(true);
    expect(isSupportStaff('SUPPORT_SPECIALIST')).toBe(true);
    expect(isSupportStaff('USER')).toBe(false);
  });
});
