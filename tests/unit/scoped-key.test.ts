import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import {
  WorkDriveClient,
  ensurePlatformScopedKey,
  mintTenantScopedKey,
  revokePlatformKeyForTenant,
  tenantScopedKeyName,
  type PlatformKeyStore,
  type StoredPlatformKey,
} from '@oma/domain';
import { fakeKey, startFakeWorkDrive } from '../helpers/fake-workdrive';

function memoryStore(): PlatformKeyStore & { rows: Map<string, StoredPlatformKey> } {
  const rows = new Map<string, StoredPlatformKey>();
  return {
    rows,
    async get(tenantId) {
      return rows.get(tenantId) ?? null;
    },
    async save(tenantId, data) {
      rows.set(tenantId, data);
    },
  };
}

describe('per-workspace scoped keys', () => {
  const key = fakeKey('m');
  let wd: Awaited<ReturnType<typeof startFakeWorkDrive>>;

  beforeAll(async () => {
    wd = await startFakeWorkDrive({
      key,
      rootName: 'OMA',
      scopes: ['files:read', 'files:write', 'folders:read', 'folders:write', 'keys:manage'],
    });
  });
  afterAll(async () => {
    await wd.close();
  });

  it('mints a child key rooted at tenants/{tenantId} and falls back when minting is unsupported', async () => {
    const master = new WorkDriveClient(wd.baseUrl, key);
    const minted = await mintTenantScopedKey(master, 'tenant-a');
    expect(minted).not.toBe('unsupported');
    if (minted === 'unsupported') return;
    expect(minted.rootFolderId).toBeTruthy();
    const child = new WorkDriveClient(wd.baseUrl, minted.apiKey);
    const self = await child.self();
    expect(self.scopes).not.toContain('keys:manage');
    expect(self.rootFolder?.id).toBe(minted.rootFolderId);

    const plain = await startFakeWorkDrive({
      key: fakeKey('p'),
      rootName: 'OMA',
      scopes: ['files:read', 'files:write', 'folders:read', 'folders:write'],
    });
    try {
      const fallback = await mintTenantScopedKey(
        new WorkDriveClient(plain.baseUrl, fakeKey('p')),
        'tenant-b',
      );
      expect(fallback).toBe('unsupported');
    } finally {
      await plain.close();
    }
  });

  it('stores the encrypted child key and revokes it by tenant', async () => {
    const master = new WorkDriveClient(wd.baseUrl, key);
    const store = memoryStore();
    const secret = createHash('sha256').update(randomBytes(16)).digest();
    const saved = await ensurePlatformScopedKey({
      tenantId: 'tenant-c',
      master,
      secret,
      store,
    });
    expect(saved?.platformKeyStatus).toBe('active');
    expect(saved?.platformKeyEnc).toBeTruthy();
    const again = await ensurePlatformScopedKey({
      tenantId: 'tenant-c',
      master,
      secret,
      store,
    });
    expect(again?.platformKeyId).toBe(saved?.platformKeyId);
    await revokePlatformKeyForTenant({ tenantId: 'tenant-c', master, store });
    expect(store.rows.get('tenant-c')?.platformKeyStatus).toBe('revoked');
    const listed = await master.listChildKeys();
    expect(listed.find((k) => k.name === tenantScopedKeyName('tenant-c'))?.revokedAt).toBeTruthy();
  });
});
