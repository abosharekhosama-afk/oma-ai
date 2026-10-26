import { describe, expect, it } from 'vitest';
import { brandRoleAllows, capabilitiesForBrandRole, SYSTEM_PROFILES } from '@oma/domain';
import { brandScopeClause, runWithBrandScope, scopeArgs } from '@oma/db';
import { CapabilitiesGuard } from '../../apps/api/src/common/guards/capabilities.guard';
import { parseBrandSettings, parseLogoUrl } from '../../apps/api/src/brand/brand-input';

describe('brand roles', () => {
  const writer = SYSTEM_PROFILES.ADMIN!;
  it('viewer is read-only, approver can approve, editor cannot manage the brand', () => {
    expect(brandRoleAllows('VIEWER', 'content.read')).toBe(true);
    expect(brandRoleAllows('VIEWER', 'content.update')).toBe(false);
    expect(brandRoleAllows('APPROVER', 'content.approve')).toBe(true);
    expect(brandRoleAllows('APPROVER', 'content.create')).toBe(false);
    expect(brandRoleAllows('EDITOR', 'content.schedule')).toBe(true);
    expect(brandRoleAllows('EDITOR', 'brand.archive')).toBe(false);
    expect(brandRoleAllows('EDITOR', 'membership.manage')).toBe(false);
    expect(brandRoleAllows('MANAGER', 'brand.archive')).toBe(true);
  });
  it('narrows but never widens workspace capabilities', () => {
    const member = SYSTEM_PROFILES.MEMBER!;
    expect(capabilitiesForBrandRole(member, 'MANAGER')).toEqual(member);
    expect(capabilitiesForBrandRole(member, 'MANAGER')).not.toContain('brand.archive');
    expect(
      capabilitiesForBrandRole(writer, 'VIEWER').every(
        (c) => c.endsWith('.read') || c === 'strategy.compare',
      ),
    ).toBe(true);
  });
});

describe('brand scope (Prisma query filter)', () => {
  it('restricts brand-owned models, the brand table and child rows', () => {
    expect(brandScopeClause('ContentItem', ['b1'])).toEqual({ brandId: { in: ['b1'] } });
    expect(brandScopeClause('BrandWorkspace', ['b1'])).toEqual({ id: { in: ['b1'] } });
    expect(brandScopeClause('ContentComment', ['b1'])).toEqual({
      content: { brandId: { in: ['b1'] } },
    });
    expect(brandScopeClause('User', ['b1'])).toBeNull();
  });
  it('only applies inside a restricted scope and preserves existing filters', () => {
    expect(scopeArgs('ContentItem', 'findMany', { where: { tenantId: 't' } })).toEqual({
      where: { tenantId: 't' },
    });
    runWithBrandScope({ allowed: ['b1', 'b2'] }, () => {
      const a = scopeArgs('ContentItem', 'findMany', { where: { tenantId: 't', AND: [{ x: 1 }] } });
      expect(a).toEqual({
        where: { tenantId: 't', AND: [{ x: 1 }, { brandId: { in: ['b1', 'b2'] } }] },
      });
      // Creates are not rewritten (the guard checks the target brand).
      expect(scopeArgs('ContentItem', 'create', { data: {} })).toEqual({ data: {} });
    });
    runWithBrandScope({ allowed: null }, () => {
      expect(scopeArgs('ContentItem', 'count', { where: {} })).toEqual({ where: {} });
    });
  });
});

describe('capabilities guard', () => {
  const ctx = (method: string, path: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method, path, oma: { userId: 'u', tenantId: 't' } }),
      }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    }) as never;
  it('denies routes without a capability mapping (no silent allow)', async () => {
    const g = new CapabilitiesGuard();
    await expect(g.canActivate(ctx('GET', '/api/v1/not-a-mapped-route'))).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED',
    });
  });
});

describe('brand settings validation', () => {
  it('validates name, logo and timezone and rejects unknown fields', () => {
    expect(parseBrandSettings({ name: '  Acme   Coffee ', version: 2 })).toEqual({
      name: 'Acme Coffee',
      version: 2,
    });
    expect(() => parseBrandSettings({ name: '', version: 1 })).toThrow();
    expect(() => parseBrandSettings({ name: 'x'.repeat(121), version: 1 })).toThrow();
    expect(() => parseBrandSettings({ name: 'ok\u0007', version: 1 })).toThrow();
    expect(() => parseBrandSettings({ name: 'ok' })).toThrow(/version/);
    expect(() => parseBrandSettings({ status: 'ACTIVE', version: 1 })).toThrow(/unknown field/);
    expect(parseBrandSettings({ timezone: 'Asia/Jerusalem', version: 1 }).timezone).toBe(
      'Asia/Jerusalem',
    );
    expect(() => parseBrandSettings({ timezone: 'Mars/Base', version: 1 })).toThrow();
    expect(parseBrandSettings({}, '"3"').version).toBe(3);
  });
  it('accepts https or small image data URLs only', () => {
    expect(parseLogoUrl('https://cdn.example.com/logo.png')).toBe(
      'https://cdn.example.com/logo.png',
    );
    expect(parseLogoUrl(null)).toBeNull();
    expect(() => parseLogoUrl('http://insecure/logo.png')).toThrow();
    expect(() => parseLogoUrl('javascript:alert(1)')).toThrow();
    expect(() => parseLogoUrl('data:image/svg+xml;base64,PHN2Zz4=')).toThrow();
    expect(parseLogoUrl('data:image/png;base64,iVBORw0KGgo=')).toMatch(/^data:image\/png/);
    expect(() => parseLogoUrl(`data:image/png;base64,${'A'.repeat(300_000)}`)).toThrow(/200 KB/);
  });
});
