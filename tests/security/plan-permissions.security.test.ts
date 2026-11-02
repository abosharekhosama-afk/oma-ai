import { describe, expect, it } from 'vitest';
import { SYSTEM_PROFILES, brandRoleAllows, hasCapability } from '@oma/domain';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('permissions audit (plans rollout)', () => {
  it('VIEWER cannot mutate content or approve', () => {
    const caps = SYSTEM_PROFILES.VIEWER ?? [];
    expect(hasCapability(caps, 'content.read')).toBe(true);
    expect(hasCapability(caps, 'content.create')).toBe(false);
    expect(hasCapability(caps, 'content.update')).toBe(false);
    expect(hasCapability(caps, 'content.approve')).toBe(false);
    expect(hasCapability(caps, 'content.schedule')).toBe(false);
    expect(hasCapability(caps, 'membership.invite')).toBe(false);
  });

  it('CLIENT can approve, comment, and create requests (not create posts)', () => {
    const caps = SYSTEM_PROFILES.CLIENT ?? [];
    expect(hasCapability(caps, 'content.read')).toBe(true);
    expect(hasCapability(caps, 'content.approve')).toBe(true);
    expect(hasCapability(caps, 'content.update')).toBe(true);
    expect(hasCapability(caps, 'request.create')).toBe(true);
    expect(hasCapability(caps, 'content.create')).toBe(false);
  });

  it('GUEST is read-only on content', () => {
    const caps = SYSTEM_PROFILES.GUEST ?? [];
    expect(hasCapability(caps, 'content.read')).toBe(true);
    expect(hasCapability(caps, 'content.approve')).toBe(false);
    expect(hasCapability(caps, 'content.create')).toBe(false);
  });

  it('brand VIEWER role allows client collaboration caps only', () => {
    expect(brandRoleAllows('VIEWER', 'content.read')).toBe(true);
    expect(brandRoleAllows('VIEWER', 'content.update')).toBe(true);
    expect(brandRoleAllows('VIEWER', 'request.create')).toBe(true);
    expect(brandRoleAllows('VIEWER', 'content.approve')).toBe(true);
    expect(brandRoleAllows('VIEWER', 'content.schedule')).toBe(false);
    expect(brandRoleAllows('VIEWER', 'membership.manage')).toBe(false);
  });

  it('MEMBER cannot decide deliverable reviews without review capability', () => {
    const caps = SYSTEM_PROFILES.MEMBER ?? [];
    expect(hasCapability(caps, 'deliverable.read')).toBe(true);
    expect(
      hasCapability(caps, ['deliverable.review.decide', 'deliverable.review'], 'any'),
    ).toBe(false);
  });

  it('isClientAudience hides hide-from-clients posts for clients and viewers', () => {
    const controller = readFileSync(
      resolve('apps/api/src/content/content.controller.ts'),
      'utf8',
    );
    expect(controller).toContain('isClientAudience');
    expect(controller).toContain("membershipKind ?? 'team') === 'client'");
    expect(controller).toContain("access.roles.get(brandId) === 'VIEWER'");
    expect(controller).toContain('client_visible === false');
  });

  it('maps billing routes in the capabilities guard', () => {
    const guard = readFileSync(
      resolve('apps/api/src/common/guards/capabilities.guard.ts'),
      'utf8',
    );
    expect(guard).toContain("'GET /api/v1/billing/plans': ['brand.read']");
    expect(guard).toContain("'PATCH /api/v1/billing/subscription': ['tenant.manage']");
  });
});
