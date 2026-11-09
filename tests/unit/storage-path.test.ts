import { describe, expect, it } from 'vitest';
import {
  assertPathBelongsToTenant,
  assertSafeStorageSegment,
  internalMediaSegments,
  storagePathOf,
  workDriveMasterConfig,
} from '@oma/domain';

describe('OMA_INTERNAL storage path isolation', () => {
  it('builds tenants/{tenantId}/brands/{brandId}/{kind} from system ids only', () => {
    expect(
      internalMediaSegments({ tenantId: 'tenant_abc', brandId: 'brand_1', kind: 'posts' }),
    ).toEqual(['tenants', 'tenant_abc', 'brands', 'brand_1', 'posts']);
    expect(
      storagePathOf(internalMediaSegments({ tenantId: 't1', kind: 'avatars', userId: 'u9' })),
    ).toBe('tenants/t1/avatars/u9');
  });

  it('rejects traversal and foreign tenant prefixes', () => {
    expect(() => assertSafeStorageSegment('../etc', 'tenantId')).toThrow(/Invalid tenantId/);
    expect(() => assertSafeStorageSegment('a/b', 'brandId')).toThrow(/Invalid brandId/);
    expect(() =>
      assertPathBelongsToTenant(['tenants', 'other', 'brands', 'b', 'posts'], 'mine'),
    ).toThrow(/does not belong/);
    expect(() => assertPathBelongsToTenant(['tenants', 'mine', '..', 'other'], 'mine')).toThrow(
      /traversal/,
    );
    expect(assertPathBelongsToTenant(['tenants', 'mine', 'brands', 'b', 'posts'], 'mine')[1]).toBe(
      'mine',
    );
  });

  it('reads the platform master from dedicated env vars', () => {
    const key = `wdk_0123456789ab_${'M'.repeat(43)}`;
    expect(workDriveMasterConfig({})).toBeNull();
    expect(
      workDriveMasterConfig({
        WORKDRIVE_MASTER_BASE_URL: 'https://wd.example.com/',
        WORKDRIVE_MASTER_API_KEY: key,
      }),
    ).toEqual({ baseUrl: 'https://wd.example.com', apiKey: key });
    expect(
      workDriveMasterConfig({
        WORKDRIVE_MASTER_BASE_URL: 'https://wd.example.com',
        WORKDRIVE_MASTER_API_KEY: 'not-a-key',
      }),
    ).toBeNull();
  });
});
