import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  authHeaders,
  createBrand,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
} from '../helpers/brand-test';
import { cookieHeader } from '../helpers/app';
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

  const patchMode = (s: Seed, mode: string, headers?: Record<string, string>) =>
    fetch(`${s.baseUrl}/api/v1/workspace/storage`, {
      method: 'PATCH',
      headers: headers ?? authHeaders(s),
      body: JSON.stringify({ mode }),
    });

  it('validates storage mode switches and restricts them to owners and admins', async () => {
    const denied = await patchMode(seed, 'USER_WORKDRIVE');
    expect(denied.status).toBe(409);
    expect((await denied.json()).error?.message_key).toBe('errors.storage_mode_byos_required');

    const syncDenied = await patchMode(seed, 'SYNC_BACKUP');
    expect(syncDenied.status).toBe(409);
    expect((await syncDenied.json()).error?.message_key).toBe(
      'errors.storage_mode_sync_unavailable',
    );

    const bad = await patchMode(seed, 'NOT_A_MODE');
    expect(bad.status).toBe(400);
    expect((await bad.json()).error?.message_key).toBe('errors.storage_mode_invalid');

    const member = await seedMemberWithoutBrandCaps(seed);
    const forbidden = await patchMode(seed, 'OMA_INTERNAL', {
      'content-type': 'application/json',
      cookie: cookieHeader(member.cookies),
      'x-csrf-token': member.csrf,
    });
    expect(forbidden.status).toBe(403);

    const ok = await patchMode(seed, 'OMA_INTERNAL');
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.mode).toBe('OMA_INTERNAL');

    const events = await getPrisma().auditEvent.findMany({
      where: { tenantId: seed.tenantId, action: 'storage.mode_changed' },
    });
    expect(events.some((e) => e.afterRef === 'OMA_INTERNAL')).toBe(true);

    const lib = await (
      await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/media?kind=posts`, {
        headers: authHeaders(seed),
      })
    ).json();
    expect(lib.data.workdrive.connected).toBe(false);
    expect(lib.data.workdrive.can_upload).toBe(true);
    expect(lib.data.workdrive.internal_available).toBe(true);

    const prev = WorkDriveService.masterConfigImpl;
    WorkDriveService.masterConfigImpl = () => undefined;
    const noMaster = await patchMode(seed, 'OMA_INTERNAL');
    expect(noMaster.status).toBe(409);
    expect((await noMaster.json()).error?.message_key).toBe(
      'errors.storage_mode_internal_unavailable',
    );
    WorkDriveService.masterConfigImpl = prev;
  });

  it('routes new uploads to the selected mode and leaves earlier files where they are', async () => {
    const toInternal = await patchMode(other, 'OMA_INTERNAL');
    expect(toInternal.status).toBe(200);
    expect((await toInternal.json()).data.mode).toBe('OMA_INTERNAL');

    const internalUp = await upload(other, otherBrand, PNG, 'kind=posts&name=after-internal.png');
    expect(internalUp.status).toBe(201);
    const internalBody = await internalUp.json();
    expect(internalBody.data.storage_provider).toBe('OMA_INTERNAL');

    const toByos = await patchMode(other, 'USER_WORKDRIVE');
    expect(toByos.status).toBe(200);
    const byosUp = await upload(other, otherBrand, PNG, 'kind=posts&name=after-byos.png');
    expect(byosUp.status).toBe(201);
    expect((await byosUp.json()).data.storage_provider).toBe('USER_WORKDRIVE');

    const stillInternal = await fetch(`${other.baseUrl}/api/v1/media/${internalBody.data.id}`, {
      headers: authHeaders(other),
    });
    expect(stillInternal.status).toBe(200);
    expect((await stillInternal.json()).data.storage_provider).toBe('OMA_INTERNAL');

    const toSync = await patchMode(other, 'SYNC_BACKUP');
    expect(toSync.status).toBe(200);
    expect((await toSync.json()).data.mode).toBe('SYNC_BACKUP');
    const syncUp = await upload(other, otherBrand, PNG, 'kind=posts&name=after-sync.png');
    expect(syncUp.status).toBe(201);
    expect((await syncUp.json()).data.storage_provider).toBe('OMA_INTERNAL');
  });

  it('browses internal storage at org and brand scope and creates folders on an empty brand', async () => {
    const emptyBrand = (await createBrand(seed, 'Empty Studio')).body.data.id as string;
    const empty = await fetch(
      `${seed.baseUrl}/api/v1/brands/${emptyBrand}/media/browse?kind=posts&scope=brand`,
      { headers: authHeaders(seed) },
    );
    expect(empty.status).toBe(200);
    const emptyBody = await empty.json();
    expect(emptyBody.data.source).toBe('oma');
    expect(emptyBody.data.mode).toBe('OMA_INTERNAL');
    expect(emptyBody.data.available_sources).toMatchObject({ oma: true, workdrive: false });
    expect(emptyBody.data.files).toEqual([]);
    expect(emptyBody.data.folder.id).toBeTruthy();
    expect(emptyBody.data.folders.map((f: { name: string }) => f.name)).toEqual(
      expect.arrayContaining(['posts', 'logos']),
    );

    const org = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/media/browse?kind=posts&scope=organization`,
      { headers: authHeaders(seed) },
    );
    expect(org.status).toBe(200);
    const orgBody = await org.json();
    expect(orgBody.data.source).toBe('oma');
    expect(orgBody.data.folders.map((f: { name: string }) => f.name)).toEqual(
      expect.arrayContaining(['brands']),
    );
    expect(orgBody.data.files.map((f: { name: string }) => f.name)).toContain('hero.png');

    const brand = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/media/browse?kind=posts&scope=brand`,
      { headers: authHeaders(seed) },
    );
    expect(brand.status).toBe(200);
    const brandBody = await brand.json();
    expect(brandBody.data.files.map((f: { name: string }) => f.name)).toContain('hero.png');

    const created = await fetch(`${seed.baseUrl}/api/v1/brands/${emptyBrand}/media/folders`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ name: 'Moodboards', kind: 'posts', scope: 'brand' }),
    });
    expect(created.status).toBe(201);
    const after = await (
      await fetch(
        `${seed.baseUrl}/api/v1/brands/${emptyBrand}/media/browse?kind=posts&scope=brand`,
        { headers: authHeaders(seed) },
      )
    ).json();
    expect(after.data.folders.map((f: { name: string }) => f.name)).toContain('Moodboards');
  });

  it('rejects browsing another tenant folder and previews/imports only inside the tenant tree', async () => {
    const otherOrg = await fetch(
      `${other.baseUrl}/api/v1/brands/${otherBrand}/media/browse?kind=posts&scope=organization&source=oma`,
      { headers: authHeaders(other) },
    );
    expect(otherOrg.status).toBe(200);
    const foreignFolder = (await otherOrg.json()).data.folder.id as string;

    const leak = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/media/browse?kind=posts&scope=organization&folder_id=${encodeURIComponent(foreignFolder)}`,
      { headers: authHeaders(seed) },
    );
    expect(leak.status).toBe(404);

    const brand = await (
      await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/media/browse?kind=posts&scope=brand`, {
        headers: authHeaders(seed),
      })
    ).json();
    const postsFolder = brand.data.folders.find((f: { name: string }) => f.name === 'posts');
    expect(postsFolder).toBeDefined();
    const fileId = randomUUID();
    wd.files.set(fileId, {
      id: fileId,
      folderId: postsFolder.id,
      name: 'imported-internal.png',
      mimeType: 'image/png',
      size: PNG.length,
      sha256: 'y',
    });
    const preview = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/media/file-preview?file_id=${encodeURIComponent(fileId)}&source=oma`,
      { headers: authHeaders(seed), redirect: 'manual' },
    );
    expect(preview.status).toBeGreaterThanOrEqual(300);
    expect(preview.status).toBeLessThan(400);

    const otherPreview = await fetch(
      `${other.baseUrl}/api/v1/brands/${otherBrand}/media/file-preview?file_id=${encodeURIComponent(fileId)}&source=oma`,
      { headers: authHeaders(other), redirect: 'manual' },
    );
    expect(otherPreview.status).toBe(404);

    const imp = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/media/import`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ kind: 'posts', file_id: fileId, source: 'oma' }),
    });
    expect(imp.status).toBe(201);
    expect((await imp.json()).data).toMatchObject({
      name: 'imported-internal.png',
      storage_provider: 'OMA_INTERNAL',
    });
  });

  it('keeps BYOS browse available via source=workdrive when the workspace uses internal storage', async () => {
    const lib = await (
      await fetch(`${other.baseUrl}/api/v1/brands/${otherBrand}/media?kind=posts`, {
        headers: authHeaders(other),
      })
    ).json();
    expect(lib.data.workdrive.mode).toBe('SYNC_BACKUP');
    expect(lib.data.workdrive.available_sources).toMatchObject({ oma: true, workdrive: true });
    expect(lib.data.workdrive.byos_connected).toBe(true);

    const internal = await fetch(
      `${other.baseUrl}/api/v1/brands/${otherBrand}/media/browse?kind=posts&scope=brand`,
      { headers: authHeaders(other) },
    );
    expect(internal.status).toBe(200);
    const internalBody = await internal.json();
    expect(internalBody.data.source).toBe('oma');
    expect(internalBody.data.files.map((f: { name: string }) => f.name)).toEqual(
      expect.arrayContaining(['after-internal.png', 'after-sync.png']),
    );

    const byos = await fetch(
      `${other.baseUrl}/api/v1/brands/${otherBrand}/media/browse?kind=posts&scope=brand&source=workdrive`,
      { headers: authHeaders(other) },
    );
    expect(byos.status).toBe(200);
    const byosBody = await byos.json();
    expect(byosBody.data.source).toBe('workdrive');
    expect(byosBody.data.files.map((f: { name: string }) => f.name)).toEqual(
      expect.arrayContaining(['byos.png', 'after-byos.png']),
    );

    const bad = await fetch(
      `${other.baseUrl}/api/v1/brands/${otherBrand}/media/browse?kind=posts&source=ftp`,
      { headers: authHeaders(other) },
    );
    expect(bad.status).toBe(400);
  });

  it('uploads into the organization root using the master key and then lists and previews the file', async () => {
    const org = await (
      await fetch(
        `${seed.baseUrl}/api/v1/brands/${brandId}/media/browse?kind=posts&scope=organization`,
        { headers: authHeaders(seed) },
      )
    ).json();
    const orgFolderId = org.data.folder.id as string;

    const r = await upload(
      seed,
      brandId,
      PNG,
      `kind=posts&name=from-org-root.png&folder_id=${encodeURIComponent(orgFolderId)}`,
    );
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.data.storage_provider).toBe('OMA_INTERNAL');
    expect(body.data.storage_path).toBe(`tenants/${seed.tenantId}/brands/${brandId}/posts`);

    const listed = await (
      await fetch(
        `${seed.baseUrl}/api/v1/brands/${brandId}/media/browse?kind=posts&scope=organization`,
        { headers: authHeaders(seed) },
      )
    ).json();
    const listedNames = listed.data.files.map((f: { name: string }) => f.name);
    expect(listedNames).toEqual(expect.arrayContaining(['hero.png', 'from-org-root.png']));
    const listedFile = listed.data.files.find(
      (f: { name: string }) => f.name === 'from-org-root.png',
    );
    expect(listedFile?.view_url).toBeTruthy();

    const view = await fetch(`${seed.baseUrl}/api/v1/media/${body.data.id}/view`, {
      headers: authHeaders(seed),
      redirect: 'manual',
    });
    expect([302, 307, 200]).toContain(view.status);

    const filePreview = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/media/file-preview?file_id=${encodeURIComponent(listedFile.id)}&source=oma`,
      { headers: authHeaders(seed), redirect: 'manual' },
    );
    expect(filePreview.status).toBeGreaterThanOrEqual(300);
    expect(filePreview.status).toBeLessThan(400);

    const grant = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/media/upload-grant`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({
        kind: 'posts',
        name: 'from-org-grant.png',
        mime: 'image/png',
        size: PNG.length,
        sha256: 'a'.repeat(64),
        folder_id: orgFolderId,
      }),
    });
    expect([200, 201]).toContain(grant.status);
    expect((await grant.json()).data.upload_url).toMatch(/^https?:\/\//);

    const otherOrg = await (
      await fetch(
        `${other.baseUrl}/api/v1/brands/${otherBrand}/media/browse?kind=posts&scope=organization&source=oma`,
        { headers: authHeaders(other) },
      )
    ).json();
    const foreign = await upload(
      seed,
      brandId,
      PNG,
      `kind=posts&name=leak.png&folder_id=${encodeURIComponent(otherOrg.data.folder.id)}`,
    );
    expect(foreign.status).toBe(404);
  });

  it('uploads only to the requested source and lists assets filtered by provider', async () => {
    const omaUp = await upload(other, otherBrand, PNG, 'kind=posts&name=only-oma.png&source=oma');
    expect(omaUp.status).toBe(201);
    expect((await omaUp.json()).data.storage_provider).toBe('OMA_INTERNAL');

    const wdUp = await upload(
      other,
      otherBrand,
      PNG,
      'kind=posts&name=only-wd.png&source=workdrive',
    );
    expect(wdUp.status).toBe(201);
    expect((await wdUp.json()).data.storage_provider).toBe('USER_WORKDRIVE');

    const omaList = await (
      await fetch(`${other.baseUrl}/api/v1/brands/${otherBrand}/media?kind=posts&source=oma`, {
        headers: authHeaders(other),
      })
    ).json();
    const omaNames = omaList.data.assets.map((a: { name: string }) => a.name);
    expect(omaNames).toContain('only-oma.png');
    expect(omaNames).not.toContain('only-wd.png');
    expect(
      omaList.data.assets.every(
        (a: { storage_provider: string }) => a.storage_provider === 'OMA_INTERNAL',
      ),
    ).toBe(true);

    const wdList = await (
      await fetch(
        `${other.baseUrl}/api/v1/brands/${otherBrand}/media?kind=posts&source=workdrive`,
        {
          headers: authHeaders(other),
        },
      )
    ).json();
    const wdNames = wdList.data.assets.map((a: { name: string }) => a.name);
    expect(wdNames).toContain('only-wd.png');
    expect(wdNames).not.toContain('only-oma.png');
    expect(
      wdList.data.assets.every(
        (a: { storage_provider: string }) => a.storage_provider === 'USER_WORKDRIVE',
      ),
    ).toBe(true);

    const grant = await fetch(`${other.baseUrl}/api/v1/brands/${otherBrand}/media/upload-grant`, {
      method: 'POST',
      headers: authHeaders(other),
      body: JSON.stringify({
        kind: 'posts',
        name: 'grant-wd.png',
        mime: 'image/png',
        size: PNG.length,
        sha256: 'b'.repeat(64),
        source: 'workdrive',
      }),
    });
    expect([200, 201]).toContain(grant.status);

    const noWd = await upload(seed, brandId, PNG, 'kind=posts&name=nope.png&source=workdrive');
    expect(noWd.status).toBe(409);
    const noWdBody = await noWd.json();
    expect(noWdBody.error.code).toBe('STORAGE_WORKDRIVE_UNAVAILABLE');
    expect(noWdBody.error.message_key).toBe('errors.storage_workdrive_unavailable');

    const browseWd = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/media/browse?kind=posts&source=workdrive`,
      { headers: authHeaders(seed) },
    );
    expect(browseWd.status).toBe(409);
    expect((await browseWd.json()).error.code).toBe('STORAGE_WORKDRIVE_UNAVAILABLE');

    const prev = WorkDriveService.masterConfigImpl;
    WorkDriveService.masterConfigImpl = () => undefined;
    const noOma = await upload(seed, brandId, PNG, 'kind=posts&name=no-oma.png&source=oma');
    expect(noOma.status).toBe(409);
    const noOmaBody = await noOma.json();
    expect(noOmaBody.error.code).toBe('STORAGE_OMA_UNAVAILABLE');
    expect(noOmaBody.error.message_key).toBe('errors.storage_oma_unavailable');
    WorkDriveService.masterConfigImpl = prev;
  });
});
