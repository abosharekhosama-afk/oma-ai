import { describe, expect, it } from 'vitest';
import { canAccessAdminHub } from '../../apps/web/src/lib/platform-operator';

describe('canAccessAdminHub', () => {
  it('allows super admin', () => {
    expect(canAccessAdminHub({ systemRole: 'SUPER_ADMIN' })).toMatchObject({
      ok: true,
      superAdmin: true,
      support: true,
    });
  });

  it('allows support specialist', () => {
    expect(canAccessAdminHub({ systemRole: 'SUPPORT_SPECIALIST' })).toMatchObject({
      ok: true,
      superAdmin: false,
      support: true,
    });
  });

  it('allows legacy platform.support.access', () => {
    expect(
      canAccessAdminHub({ systemRole: 'USER', capabilities: ['platform.support.access'] }),
    ).toMatchObject({ ok: true, support: true });
  });

  it('denies normal users', () => {
    expect(canAccessAdminHub({ systemRole: 'USER', capabilities: [] })).toMatchObject({
      ok: false,
    });
  });
});
