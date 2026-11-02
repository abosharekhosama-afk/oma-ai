import { describe, expect, it } from 'vitest';
import {
  DomainError,
  PLAN_CATALOG,
  approvalModeAllowed,
  planHasFeature,
} from '@oma/domain';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('plan enforcement wiring', () => {
  it('registers PLAN_LIMIT_REACHED and PLAN_FEATURE_REQUIRED error codes', () => {
    const err = new DomainError(
      'PLAN_LIMIT_REACHED',
      'limit',
      402,
      'errors.plan_limit.brands',
      [{ limit_key: 'brands' }],
    );
    expect(err.code).toBe('PLAN_LIMIT_REACHED');
    expect(err.status).toBe(402);
    const feat = new DomainError(
      'PLAN_FEATURE_REQUIRED',
      'feature',
      402,
      'errors.plan_feature.analytics',
    );
    expect(feat.code).toBe('PLAN_FEATURE_REQUIRED');
  });

  it('wires billing controller and migration into the repo', () => {
    const controller = readFileSync(
      resolve('apps/api/src/billing/billing.controller.ts'),
      'utf8',
    );
    expect(controller).toContain('api/v1/billing/plans');
    expect(controller).toContain('api/v1/billing/subscription');
    expect(controller).toContain('api/v1/billing/upgrade-requests');

    const migration = readFileSync(
      resolve(
        'packages/db/prisma/migrations/20261102180000_plans_pricing_permissions/migration.sql',
      ),
      'utf8',
    );
    expect(migration).toContain('WorkspaceSubscription');
    expect(migration).toContain("Grandfathered to Pro");
    expect(migration).toContain("'free'");
    expect(migration).toContain("'enterprise'");
  });

  it('enforces brand and post creation hooks in services', () => {
    const brand = readFileSync(resolve('apps/api/src/brand/brand.service.ts'), 'utf8');
    expect(brand).toContain("assertWithinLimit(tenantId, 'brands')");
    const content = readFileSync(resolve('apps/api/src/content/content.service.ts'), 'utf8');
    expect(content).toContain("assertWithinLimit(tenantId, 'posts_total')");
    expect(content).toContain("assertWithinLimit(tenantId, 'posts_per_month')");
    const tenant = readFileSync(resolve('apps/api/src/tenant/tenant.service.ts'), 'utf8');
    expect(tenant).toContain("assertWithinLimit(tenantId, kind === 'client' ? 'guests' : 'seats')");
    const social = readFileSync(resolve('apps/api/src/social/social.service.ts'), 'utf8');
    expect(social).toContain("assertWithinLimit(row.tenantId, 'social_channels'");
  });

  it('closes deliverable review permission gap (decide capability)', () => {
    const guard = readFileSync(
      resolve('apps/api/src/common/guards/capabilities.guard.ts'),
      'utf8',
    );
    expect(guard).toContain(
      "'POST /api/v1/deliverables/:deliverableId/review': ['deliverable.review.decide']",
    );
  });

  it('matches catalog limits used by UI pricing cards', () => {
    expect(PLAN_CATALOG.basic.priceMonthlyUsd).toBe(39);
    expect(PLAN_CATALOG.pro.priceMonthlyUsd).toBe(59);
    expect(approvalModeAllowed('basic', 'required')).toBe(false);
    expect(planHasFeature('enterprise', 'list_view')).toBe(true);
  });
});
