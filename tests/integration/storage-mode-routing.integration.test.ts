import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getPrisma,
  resolveStorageWriteTarget,
  snapshotUsage,
  uploadToStorageTarget,
} from '@oma/db';
import { DomainError, newId } from '@oma/domain';
import { authHeaders, createBrand, seedBrandTenant } from '../helpers/brand-test';
import { fakeKey, startFakeWorkDrive } from '../helpers/fake-workdrive';
import { WorkDriveService } from '../../apps/api/src/media/workdrive.service';

type Seed = Awaited<ReturnType<typeof seedBrandTenant>>;
const MASTER_KEY = fakeKey('m');
const USER_KEY = fakeKey('u');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('storage setting is respected for every write (OMA mode + connected WorkDrive)', () => {
  let master: Awaited<ReturnType<typeof startFakeWorkDrive>>;
  let user: Awaited<ReturnType<typeof startFakeWorkDrive>>;
  let seed: Seed;
  let brandId: string;
  const prevImpl = WorkDriveService.masterConfigImpl;
  const masterConfig = () => ({ baseUrl: master.baseUrl, apiKey: MASTER_KEY });

  beforeAll(async () => {
    process.env.WORKDRIVE_ENCRYPTION_KEY = process.env.WORKDRIVE_ENCRYPTION_KEY || 'e'.repeat(64);
    master = await startFakeWorkDrive({ key: MASTER_KEY, rootName: 'OMA', orgName: 'Platform' });
    user = await startFakeWorkDrive({ key: USER_KEY, rootName: 'OMA', orgName: 'Customer' });
    WorkDriveService.masterConfigImpl = masterConfig;
    seed = await seedBrandTenant();
    brandId = (await createBrand(seed, 'Velvet Studio')).body.data.id as string;
    const put = await fetch(`${seed.baseUrl}/api/v1/workspace/workdrive`, {
      method: 'PUT',
      headers: authHeaders(seed),
      body: JSON.stringify({ base_url: user.baseUrl, api_key: USER_KEY }),
    });
    expect(put.status).toBe(200);
    const mode = await fetch(`${seed.baseUrl}/api/v1/workspace/storage`, {
      method: 'PATCH',
      headers: authHeaders(seed),
      body: JSON.stringify({ mode: 'OMA_INTERNAL' }),
    });
    expect(mode.status).toBe(200);
  });

  afterAll(async () => {
    WorkDriveService.masterConfigImpl = prevImpl;
    await getPrisma()
      .workspaceStorageSetting.update({
        where: { tenantId: seed.tenantId },
        data: { adminStorageLimitBytes: null },
      })
      .catch(() => undefined);
    await master?.close();
    await user?.close();
    await seed?.app.close();
  });

  it('API uploads without an explicit source go to OMA storage, not the user key', async () => {
    const userFilesBefore = user.files.size;
    const r = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/media?kind=posts&name=a.png`, {
      method: 'POST',
      headers: { ...authHeaders(seed), 'content-type': 'image/png' },
      body: PNG,
    });
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.data.storage_provider).toBe('OMA_INTERNAL');
    expect(user.files.size).toBe(userFilesBefore);
  });

  it('worker/AI resolver picks OMA storage and never falls back to the user key', async () => {
    const t = await resolveStorageWriteTarget(seed.tenantId, { masterConfig });
    expect(t.provider).toBe('OMA_INTERNAL');
    await expect(
      resolveStorageWriteTarget(seed.tenantId, { masterConfig: () => null }),
    ).rejects.toMatchObject({ code: 'STORAGE_OMA_UNAVAILABLE' });
    // An explicit WorkDrive pick still works.
    const byos = await resolveStorageWriteTarget(seed.tenantId, {
      masterConfig,
      source: 'workdrive',
    });
    expect(byos.provider).toBe('USER_WORKDRIVE');
  });

  it('AI-generated media stored in OMA counts toward storage usage', async () => {
    const before = (await snapshotUsage(seed.tenantId, new Date())).storage_bytes;
    const target = await resolveStorageWriteTarget(seed.tenantId, { masterConfig });
    const bytes = Buffer.concat([PNG, Buffer.alloc(4096, 1)]);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const up = await uploadToStorageTarget({
      target,
      brand: { id: brandId, name: 'Velvet Studio' },
      kind: 'catalog',
      name: `ai-${sha256.slice(0, 8)}.jpg`,
      mime: 'image/jpeg',
      bytes,
      sha256,
    });
    expect(up.storageProvider).toBe('OMA_INTERNAL');
    expect(up.storagePath).toBe(`tenants/${seed.tenantId}/brands/${brandId}/catalog`);
    await getPrisma().mediaAsset.create({
      data: {
        id: newId(),
        tenantId: seed.tenantId,
        brandId,
        kind: 'catalog',
        workdriveFileId: up.fileId,
        folderId: up.folderId,
        storageProvider: up.storageProvider,
        storagePath: up.storagePath,
        name: up.name,
        mime: 'image/jpeg',
        size: BigInt(bytes.length),
        sha256,
        source: 'upload',
        createdBy: seed.userId,
      },
    });
    const after = (await snapshotUsage(seed.tenantId, new Date())).storage_bytes;
    expect(after - before).toBe(bytes.length);
  });

  it('enforces the OMA quota before AI writes and uploads', async () => {
    const used = (await snapshotUsage(seed.tenantId, new Date())).storage_bytes;
    await getPrisma().workspaceStorageSetting.update({
      where: { tenantId: seed.tenantId },
      data: { adminStorageLimitBytes: BigInt(used + 10) },
    });
    const target = await resolveStorageWriteTarget(seed.tenantId, { masterConfig });
    const bytes = Buffer.alloc(1024, 2);
    const err = await uploadToStorageTarget({
      target,
      brand: { id: brandId, name: 'Velvet Studio' },
      kind: 'catalog',
      name: 'too-big.jpg',
      mime: 'image/jpeg',
      bytes,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe('PLAN_LIMIT_REACHED');

    const r = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/media?kind=posts&name=b.png`, {
      method: 'POST',
      headers: { ...authHeaders(seed), 'content-type': 'image/png' },
      body: Buffer.concat([PNG, Buffer.alloc(2048, 3)]),
    });
    expect(r.status).toBe(402);
  });
});
