import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLAN_CATALOG,
  decideStorageWriteProvider,
  defaultLibrarySource,
  effectiveStorageMode,
  storageFolderSegments,
} from '@oma/domain';

const GB = 1024 ** 3;
const read = (p: string) => readFileSync(p, 'utf8');

describe('storage mode resolver precedence', () => {
  const both = { internalAvailable: true, byosAvailable: true };

  it('a saved OMA setting wins over a connected WorkDrive', () => {
    expect(effectiveStorageMode({ settingMode: 'OMA_INTERNAL', byosConnected: true })).toBe(
      'OMA_INTERNAL',
    );
    expect(decideStorageWriteProvider({ mode: 'OMA_INTERNAL', ...both })).toEqual({
      ok: true,
      provider: 'OMA_INTERNAL',
    });
    expect(decideStorageWriteProvider({ mode: 'SYNC_BACKUP', ...both })).toEqual({
      ok: true,
      provider: 'OMA_INTERNAL',
    });
  });

  it('never falls back to the user WorkDrive key when OMA storage is unavailable', () => {
    expect(
      decideStorageWriteProvider({
        mode: 'OMA_INTERNAL',
        internalAvailable: false,
        byosAvailable: true,
      }),
    ).toEqual({ ok: false, reason: 'oma_unavailable' });
    expect(
      decideStorageWriteProvider({
        mode: 'SYNC_BACKUP',
        internalAvailable: false,
        byosAvailable: true,
      }),
    ).toEqual({ ok: false, reason: 'oma_unavailable' });
  });

  it('keeps WorkDrive usable when the setting selects it', () => {
    expect(decideStorageWriteProvider({ mode: 'USER_WORKDRIVE', ...both })).toEqual({
      ok: true,
      provider: 'USER_WORKDRIVE',
    });
    // Disconnected WorkDrive in WorkDrive mode keeps files in OMA instead of failing.
    expect(
      decideStorageWriteProvider({
        mode: 'USER_WORKDRIVE',
        internalAvailable: true,
        byosAvailable: false,
      }),
    ).toEqual({ ok: true, provider: 'OMA_INTERNAL' });
  });

  it('an explicit library source wins and fails closed when that store is missing', () => {
    expect(
      decideStorageWriteProvider({ mode: 'OMA_INTERNAL', source: 'workdrive', ...both }),
    ).toEqual({ ok: true, provider: 'USER_WORKDRIVE' });
    expect(decideStorageWriteProvider({ mode: 'USER_WORKDRIVE', source: 'oma', ...both })).toEqual({
      ok: true,
      provider: 'OMA_INTERNAL',
    });
    expect(
      decideStorageWriteProvider({
        mode: 'OMA_INTERNAL',
        source: 'workdrive',
        internalAvailable: true,
        byosAvailable: false,
      }),
    ).toEqual({ ok: false, reason: 'workdrive_unavailable' });
  });

  it('keeps the legacy rule only for workspaces that never saved a setting', () => {
    expect(effectiveStorageMode({ settingMode: null, byosConnected: true })).toBe('USER_WORKDRIVE');
    expect(effectiveStorageMode({ settingMode: null, byosConnected: false })).toBe('OMA_INTERNAL');
    expect(defaultLibrarySource('SYNC_BACKUP')).toBe('oma');
    expect(defaultLibrarySource('USER_WORKDRIVE')).toBe('workdrive');
  });

  it('writes OMA files under the tenant tree and BYOS files under OMA/{slug}', () => {
    const brand = { id: 'brand_12345678abcdefgh', name: 'Velvet' };
    expect(
      storageFolderSegments({ provider: 'OMA_INTERNAL', tenantId: 't1', brand, kind: 'catalog' }),
    ).toEqual(['tenants', 't1', 'brands', brand.id, 'catalog']);
    expect(
      storageFolderSegments({
        provider: 'OMA_INTERNAL',
        tenantId: 't1',
        brand,
        kind: 'catalog',
        scopedRoot: true,
      }),
    ).toEqual(['brands', brand.id, 'catalog']);
    expect(
      storageFolderSegments({
        provider: 'USER_WORKDRIVE',
        tenantId: 't1',
        brand,
        kind: 'posts',
      })[0],
    ).toBe('OMA');
  });
});

describe('every storage writer goes through the shared resolver', () => {
  const writers = [
    'apps/worker/src/brand/catalog-creative.ts',
    'apps/worker/src/brand/catalog-product-media.ts',
    'apps/worker/src/media/prepare-publish-media.ts',
    'apps/worker/src/media/media-jobs.ts',
    'apps/api/src/catalog/catalog-generate.ts',
  ];
  it.each(writers)('%s does not hard-code the user WorkDrive', (file) => {
    const src = read(file);
    expect(src).not.toContain("storageProvider: 'USER_WORKDRIVE'");
    expect(src).not.toContain('workDriveConnection.findUnique');
    expect(src).toMatch(/resolveStorageWriteTarget|storageTargetForAsset/);
  });

  it('AI/scan writers record the real provider and pass the OMA quota gate', () => {
    for (const file of writers.slice(0, 4).concat(writers[4]!)) {
      const src = read(file);
      if (src.includes('uploadToStorageTarget')) {
        expect(src).toContain('storageProvider: uploaded.storageProvider');
      }
    }
    const helper = read('packages/db/src/storage-target.ts');
    expect(helper).toMatch(/uploadToStorageTarget[\s\S]*assertOmaStorageQuota/);
  });
});

describe('plan storage quotas', () => {
  it('Starter (regular) is 5 GB and Pro is 20 GB', () => {
    expect(PLAN_CATALOG.starter.limits.storage_bytes).toBe(5 * GB);
    expect(PLAN_CATALOG.pro.limits.storage_bytes).toBe(20 * GB);
    expect(PLAN_CATALOG.agency.limits.storage_bytes).toBe(200 * GB);
  });

  it('ships a migration that updates the seeded plan rows', () => {
    const sql = read(
      'packages/db/prisma/migrations/20261122170000_plan_storage_quotas/migration.sql',
    );
    expect(sql).toContain(String(5 * GB));
    expect(sql).toContain(String(20 * GB));
    expect(sql).toContain("'storage_bytes'");
    expect(sql).toMatch(/ON CONFLICT \("planId", "key"\) DO UPDATE/);
  });
});
