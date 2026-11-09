import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { authHeaders, createBrand, seedBrandTenant } from '../helpers/brand-test';
import { fakeKey, startFakeWorkDrive } from '../helpers/fake-workdrive';
import { WorkDriveService } from '../../apps/api/src/media/workdrive.service';

type Seed = Awaited<ReturnType<typeof seedBrandTenant>>;
const KEY = fakeKey('k');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('OMA_INTERNAL storage (platform master, no BYOS required)', () => {
  let wd: Awaited<ReturnType<typeof startFakeWorkDrive>>;
  let seed: Seed;
  let other: Seed;
  let brandId: string;
  let otherBrand: string;
  const prevImpl = WorkDriveService.masterConfigImpl;

  const upload = (s: Seed, b: string, bytes: Buffer, q: string) =>
    fetch(`${s.baseUrl}/api/v1/brands/${b}/media?${q}`, {
      method: 'POST',
      headers: {
        ...authHeaders(s),
        'content-type': 'image/png',
        'content-length': String(bytes.length),
      },
      body: bytes,
    });

  beforeAll(async () => {
    process.env.WORKDRIVE_ENCRYPTION_KEY = process.env.WORKDRIVE_ENCRYPTION_KEY || 'e'.repeat(64);
    wd = await startFakeWorkDrive({ key: KEY, rootName: 'OMA', orgName: 'Platform Org' });
    WorkDriveService.masterConfigImpl = () => ({ baseUrl: wd.baseUrl, apiKey: KEY });
    seed = await seedBrandTenant();
    other = await seedBrandTenant();
    brandId = (await createBrand(seed, 'Lumen Coffee')).body.data.id as string;
    otherBrand = (await createBrand(other, 'Other Co')).body.data.id as string;
  });

  afterAll(async () => {
    WorkDriveService.masterConfigImpl = prevImpl;
    await wd?.close();
    await seed?.app.close();
    await other?.app.close();
  });

  it('uploads without a workspace WorkDrive connection onto an isolated tenant path', async () => {
    const connected = await (
      await fetch(`${seed.baseUrl}/api/v1/workspace/workdrive`, { headers: authHeaders(seed) })
    ).json();
    expect(connected.data.connected).toBe(false);

    const r = await upload(seed, brandId, PNG, 'kind=posts&name=hero.png');
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.data.storage_provider).toBe('OMA_INTERNAL');
    expect(body.data.storage_path).toBe(`tenants/${seed.tenantId}/brands/${brandId}/posts`);

    const row = await getPrisma().mediaAsset.findUniqueOrThrow({ where: { id: body.data.id } });
    expect(row.storageProvider).toBe('OMA_INTERNAL');
    expect(row.storagePath).toBe(`tenants/${seed.tenantId}/brands/${brandId}/posts`);

    const view = await fetch(`${seed.baseUrl}/api/v1/media/${body.data.id}/view`, {
      headers: authHeaders(seed),
      redirect: 'manual',
    });
    expect([302, 307, 200]).toContain(view.status);

    const leak = await fetch(`${other.baseUrl}/api/v1/media/${body.data.id}/view`, {
      headers: authHeaders(other),
      redirect: 'manual',
    });
    expect(leak.status).toBe(404);

    const usage = await (
      await fetch(`${seed.baseUrl}/api/v1/workspace/storage`, { headers: authHeaders(seed) })
    ).json();
    expect(usage.data.mode).toBe('OMA_INTERNAL');
    expect(usage.data.internal_available).toBe(true);
    expect(usage.data.byos_connected).toBe(false);
    expect(usage.data.used_bytes).toBeGreaterThanOrEqual(PNG.length);
  });

  it('does not count BYOS uploads against the OMA plan quota', async () => {
    const put = await fetch(`${other.baseUrl}/api/v1/workspace/workdrive`, {
      method: 'PUT',
      headers: authHeaders(other),
      body: JSON.stringify({ base_url: wd.baseUrl, api_key: KEY }),
    });
    expect(put.status).toBe(200);

    const before = await (
      await fetch(`${other.baseUrl}/api/v1/workspace/storage`, { headers: authHeaders(other) })
    ).json();
    expect(before.data.mode).toBe('USER_WORKDRIVE');
    expect(before.data.byos_connected).toBe(true);
    const usedBefore = before.data.used_bytes;

    const r = await upload(other, otherBrand, PNG, 'kind=posts&name=byos.png');
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.data.storage_provider).toBe('USER_WORKDRIVE');

    const after = await (
      await fetch(`${other.baseUrl}/api/v1/workspace/storage`, { headers: authHeaders(other) })
    ).json();
    expect(after.data.used_bytes).toBe(usedBefore);
  });
});
