import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ALL_MANAGED_CAPABILITY_CODES,
  capabilitiesToPermissions,
  permissionsToCapabilityCodes,
} from '../../../apps/web/src/lib/team-api';

describe('team permissions sync', () => {
  it('maps planable toggles to exact capability codes', () => {
    const on = permissionsToCapabilityCodes({
      view: true,
      approve: false,
      edit: true,
      publish: false,
      analyze: false,
      engage: false,
      admin: false,
    });
    expect(on).toContain('content.read');
    expect(on).toContain('content.create');
    expect(on).not.toContain('content.approve');
    expect(capabilitiesToPermissions(on).edit).toBe(true);
    expect(capabilitiesToPermissions(on).approve).toBe(false);
  });

  it('exposes managed codes for revoke-safe updates', () => {
    expect(ALL_MANAGED_CAPABILITY_CODES).toContain('content.approve');
    expect(ALL_MANAGED_CAPABILITY_CODES).toContain('tenant.manage');
    expect(new Set(ALL_MANAGED_CAPABILITY_CODES).size).toBe(ALL_MANAGED_CAPABILITY_CODES.length);
  });

  it('API assignCapabilities revokes omitted managed grants', () => {
    const src = readFileSync(resolve('apps/api/src/tenant/tenant.service.ts'), 'utf8');
    expect(src).toContain('replaceManagedOnly');
    expect(src).toContain('revokedAt: new Date()');
    expect(src).toContain('Existing grants whose codes are omitted are revoked');
    const controller = readFileSync(
      resolve('apps/api/src/tenant/capability.controller.ts'),
      'utf8',
    );
    expect(controller).toContain('managed_codes');
    const client = readFileSync(resolve('apps/web/src/lib/team-api.ts'), 'utf8');
    expect(client).toContain('managed_codes: ALL_MANAGED_CAPABILITY_CODES');
  });
});
