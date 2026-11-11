import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { subscriptionAllowsUsage } from '../../../packages/db/src/billing-usage';

describe('manual activation and access', () => {
  it('allows trialing and active, allows past_due only during grace, then blocks', () => {
    expect(subscriptionAllowsUsage({ status: 'active' }).ok).toBe(true);
    expect(subscriptionAllowsUsage({ status: 'trialing' }).ok).toBe(true);
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);
    expect(subscriptionAllowsUsage({ status: 'past_due', gracePeriodEndsAt: future }).ok).toBe(
      true,
    );
    expect(subscriptionAllowsUsage({ status: 'past_due', gracePeriodEndsAt: past }).ok).toBe(false);
    expect(subscriptionAllowsUsage({ status: 'canceled' }).ok).toBe(false);
    expect(subscriptionAllowsUsage({ status: 'incomplete' }).ok).toBe(false);
  });

  it('exposes super-admin activate, extend, cancel and audit actions', () => {
    const admin = readFileSync(resolve('apps/api/src/billing/billing-admin.controller.ts'), 'utf8');
    expect(admin).toContain('requireSuperAdminOperator');
    expect(admin).toContain('api/v1/admin/billing/workspaces/:tenantId/activate');
    expect(admin).toContain('api/v1/admin/billing/workspaces/:tenantId/extend');
    expect(admin).toContain('api/v1/admin/billing/workspaces/:tenantId/cancel');
    expect(admin).toContain('api/v1/admin/billing/orders/:id/approve');
    const service = readFileSync(resolve('apps/api/src/billing/billing.service.ts'), 'utf8');
    expect(service).toContain("action: 'billing.plan.activated'");
    expect(service).toContain("action: 'billing.manual.extend'");
    expect(service).toContain("action: 'billing.manual.cancel'");
    expect(service).toContain("action: 'billing.manual.proof_uploaded'");
  });
});
