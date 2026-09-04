import { describe, expect, it } from 'vitest';
import { resolveMembershipRoute } from './membership-routing';

describe('resolveMembershipRoute', () => {
  it('routes zero memberships to onboarding', () => {
    expect(resolveMembershipRoute({ activeMemberships: [], activeTenantId: null })).toEqual({
      kind: 'ONBOARDING',
    });
  });

  it('ignores suspended tenants', () => {
    expect(
      resolveMembershipRoute({
        activeMemberships: [{ tenantId: 't1', tenantStatus: 'SUSPENDED' }],
        activeTenantId: null,
      }),
    ).toEqual({ kind: 'ONBOARDING' });
  });

  it('auto-activates a sole active membership', () => {
    expect(
      resolveMembershipRoute({
        activeMemberships: [{ tenantId: 't1', tenantStatus: 'ACTIVE' }],
        activeTenantId: null,
      }),
    ).toEqual({ kind: 'AUTO_ACTIVATE', tenantId: 't1' });
  });

  it('proceeds when active tenant is valid', () => {
    expect(
      resolveMembershipRoute({
        activeMemberships: [
          { tenantId: 't1', tenantStatus: 'ACTIVE' },
          { tenantId: 't2', tenantStatus: 'ACTIVE' },
        ],
        activeTenantId: 't2',
      }),
    ).toEqual({ kind: 'PROCEED', tenantId: 't2' });
  });

  it('asks multi-membership users to select when active is missing', () => {
    expect(
      resolveMembershipRoute({
        activeMemberships: [
          { tenantId: 't1', tenantStatus: 'ACTIVE' },
          { tenantId: 't2', tenantStatus: 'ACTIVE' },
        ],
        activeTenantId: 'gone',
      }),
    ).toEqual({ kind: 'SELECT_COMPANY' });
  });
});
