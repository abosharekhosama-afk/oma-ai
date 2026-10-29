import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId, type SocialProviderAdapter } from '@oma/domain';
import { cookieHeader } from '../helpers/app';
import {
  addBrandMember,
  authHeaders,
  createBrand,
  grantCapability,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
} from '../helpers/brand-test';
import { fakeKey, startFakeWorkDrive } from '../helpers/fake-workdrive';
import {
  publicMediaUrl,
  runLogoMigrationTick,
  runMediaReconcileTick,
} from '../../apps/worker/src/media/media-jobs';
import { runPublishTick } from '../../apps/worker/src/social/social-jobs';
import { encryptToken, parseEncryptionKey } from '@oma/domain';

type Seed = Awaited<ReturnType<typeof seedBrandTenant>>;
const KEY = fakeKey('k');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

describe('WorkDrive storage (API + worker, local Postgres)', () => {
  let wd: Awaited<ReturnType<typeof startFakeWorkDrive>>;
  let seed: Seed;
  let other: Seed;
  let brandId: string;
  let otherBrand: string;
  const prev = { ...process.env };

  const put = (s: Seed, body: unknown) =>
    fetch(`${s.baseUrl}/api/v1/workspace/workdrive`, {
      method: 'PUT',
      headers: authHeaders(s),
      body: JSON.stringify(body),
    });
  const upload = (s: Seed, b: string, bytes: Buffer, q: string, type = 'image/png') =>
    fetch(`${s.baseUrl}/api/v1/brands/${b}/media?${q}`, {
      method: 'POST',
      headers: { ...authHeaders(s), 'content-type': type, 'content-length': String(bytes.length) },
      body: bytes,
    });

  beforeAll(async () => {
    process.env.WORKDRIVE_ENCRYPTION_KEY = 'e'.repeat(64);
    wd = await startFakeWorkDrive({ key: KEY, rootName: 'OMA', orgName: 'Imkan Studio' });
    seed = await seedBrandTenant();
    other = await seedBrandTenant();
    brandId = (await createBrand(seed, 'Lumen Coffee')).body.data.id as string;
    otherBrand = (await createBrand(other, 'Other Co')).body.data.id as string;
  });
  afterAll(async () => {
    process.env = prev;
    await wd?.close();
    await seed?.app.close();
    await other?.app.close();
  });

  it('shows a not-connected state and refuses uploads before connecting', async () => {
    const s = await (
      await fetch(`${seed.baseUrl}/api/v1/workspace/workdrive`, { headers: authHeaders(seed) })
    ).json();
    expect(s.data).toMatchObject({ available: true, connected: false, max_video_mb: 500 });
    const lib = await (
      await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/media`, { headers: authHeaders(seed) })
    ).json();
    expect(lib.data.workdrive.connected).toBe(false);
    const r = await upload(seed, brandId, PNG, 'kind=posts&name=a.png');
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe('WORKDRIVE_NOT_CONNECTED');
  });

  it('validates the address and key, and rejects keys WorkDrive refuses', async () => {
    expect((await put(seed, { base_url: 'ftp://x', api_key: KEY })).status).toBe(400);
    expect((await put(seed, { base_url: wd.baseUrl, api_key: 'wdk_nope' })).status).toBe(400);
    const wrong = await put(seed, { base_url: wd.baseUrl, api_key: fakeKey('z') });
    expect(wrong.status).toBe(422);
    expect((await wrong.json()).error.message_key).toBe('errors.workdrive_key_rejected');
  });

  it('connect errors are about the address or key, never "file removed"', async () => {
    const { createServer } = await import('node:http');
    const site = createServer((req, res) => {
      if (req.url?.startsWith('/nest')) {
        res.writeHead(404, { 'content-type': 'application/json' });
        return res.end(
          JSON.stringify({ message: `Cannot GET ${req.url}`, error: 'Not Found', statusCode: 404 }),
        );
      }
      if (req.url?.startsWith('/locked')) {
        res.writeHead(403, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ message: 'Forbidden', statusCode: 403 }));
      }
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('<!DOCTYPE html><html></html>');
    });
    await new Promise<void>((r) => site.listen(0, '127.0.0.1', r));
    const port = (site.address() as { port: number }).port;
    const expectKey = async (url: string, key: string, status: number) => {
      const r = await put(seed, { base_url: url, api_key: KEY });
      const e = (await r.json()).error;
      expect([r.status, e.message_key]).toEqual([status, key]);
      expect(e.code).not.toBe('MEDIA_MISSING');
    };
    try {
      await expectKey(`http://127.0.0.1:${port}`, 'errors.workdrive_not_workdrive', 422);
      await expectKey(`http://127.0.0.1:${port}/nest`, 'errors.workdrive_outdated', 422);
      await expectKey(`http://127.0.0.1:${port}/locked`, 'errors.workdrive_key_forbidden', 422);
    } finally {
      await new Promise((r) => site.close(r));
    }
    await expectKey(`http://127.0.0.1:${port}`, 'errors.workdrive_unreachable', 502);
  });

  it('only workspace admins can connect', async () => {
    const member = await seedMemberWithoutBrandCaps(seed);
    const r = await fetch(`${seed.baseUrl}/api/v1/workspace/workdrive`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(member.cookies),
        'x-csrf-token': member.csrf,
      },
      body: JSON.stringify({ base_url: wd.baseUrl, api_key: KEY }),
    });
    expect(r.status).toBe(403);
  });

  it('connects, stores the key encrypted and never returns it', async () => {
    const r = await put(seed, { base_url: `${wd.baseUrl}/api/`, api_key: KEY });
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).not.toContain(KEY);
    const data = JSON.parse(body).data;
    expect(data.connection).toMatchObject({
      org_name: 'Imkan Studio',
      base_url: wd.baseUrl,
      key_prefix: KEY.slice(0, 16),
      root_folder: { name: 'OMA' },
      status: 'CONNECTED',
    });
    const row = await getPrisma().workDriveConnection.findUniqueOrThrow({
      where: { tenantId: seed.tenantId },
    });
    expect(row.apiKeyEnc.startsWith('v1.')).toBe(true);
    expect(row.apiKeyEnc).not.toContain(KEY.slice(17));
    const test = await (
      await fetch(`${seed.baseUrl}/api/v1/workspace/workdrive/test`, {
        method: 'POST',
        headers: authHeaders(seed),
      })
    ).json();
    expect(test.data.connection.status).toBe('CONNECTED');
  });

  let assetId = '';
  let callsAtConnect = 0;
  it('proxies an upload (streamed) into OMA/{brand}/posts and records a MediaAsset', async () => {
    callsAtConnect = wd.calls.length;
    const r = await upload(
      seed,
      brandId,
      PNG,
      `kind=posts&name=${encodeURIComponent('launch post.png')}`,
    );
    expect(r.status).toBe(201);
    const a = (await r.json()).data;
    assetId = a.id;
    expect(a).toMatchObject({
      kind: 'posts',
      name: 'launch post.png',
      mime: 'image/png',
      size: PNG.length,
      status: 'READY',
      view_url: `/api/v1/media/${a.id}/view`,
    });
    const row = await getPrisma().mediaAsset.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.sha256).toBe(sha(PNG));
    expect(wd.pathOf(row.folderId!)).toBe('lumen-coffee/posts');
    expect(wd.files.get(row.workdriveFileId)!.bytes!.equals(PNG)).toBe(true);
    // The browser never talks to WorkDrive: the only Authorization header WorkDrive saw is the server key.
    expect(
      wd.calls.slice(callsAtConnect).filter((c) => c.auth && c.auth !== `Bearer ${KEY}`),
    ).toEqual([]);
  });

  it('keeps both files when a name already exists in WorkDrive', async () => {
    const r = await upload(
      seed,
      brandId,
      PNG,
      `kind=posts&name=${encodeURIComponent('launch post.png')}`,
    );
    expect(r.status).toBe(201);
    expect((await r.json()).data.name).toBe('launch post (2).png');
  });

  it('rejects unsupported types, oversize files and empty bodies', async () => {
    expect(
      (
        await upload(
          seed,
          brandId,
          Buffer.from('x'),
          'kind=posts&name=a.exe',
          'application/x-msdownload',
        )
      ).status,
    ).toBe(400);
    expect(
      (await upload(seed, brandId, Buffer.from('<svg/>'), 'kind=logos&name=a.svg', 'image/svg+xml'))
        .status,
    ).toBe(400);
    process.env.WORKDRIVE_MAX_IMAGE_MB = '0.00001';
    const big = await upload(seed, brandId, PNG, 'kind=posts&name=b.png');
    delete process.env.WORKDRIVE_MAX_IMAGE_MB;
    expect(big.status).toBe(413);
    expect((await upload(seed, brandId, Buffer.alloc(0), 'kind=posts&name=c.png')).status).toBe(
      400,
    );
  });

  it('serves a fresh signed URL via the stable view link', async () => {
    const r = await fetch(`${seed.baseUrl}/api/v1/media/${assetId}/view`, {
      headers: authHeaders(seed),
      redirect: 'manual',
    });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toMatch(
      new RegExp(`^${wd.baseUrl}/storage/objects\\?token=`),
    );
    const u = await (
      await fetch(`${seed.baseUrl}/api/v1/media/${assetId}/url`, { headers: authHeaders(seed) })
    ).json();
    expect(u.data.url).toContain('/storage/objects?token=');
    const st = await fetch(`${seed.baseUrl}/api/v1/media/${assetId}/stream`, {
      headers: { ...authHeaders(seed), range: 'bytes=0-7' },
    });
    expect(st.status).toBe(206);
    expect(Buffer.from(await st.arrayBuffer()).equals(PNG.subarray(0, 8))).toBe(true);
  });

  it('isolates tenants and brands', async () => {
    // Other tenant: not connected, cannot see this asset.
    expect(
      (await fetch(`${other.baseUrl}/api/v1/media/${assetId}`, { headers: authHeaders(other) }))
        .status,
    ).toBe(404);
    expect(
      (
        await fetch(`${other.baseUrl}/api/v1/media/${assetId}/view`, {
          headers: authHeaders(other),
          redirect: 'manual',
        })
      ).status,
    ).toBe(404);
    const s = await (
      await fetch(`${other.baseUrl}/api/v1/workspace/workdrive`, { headers: authHeaders(other) })
    ).json();
    expect(s.data.connected).toBe(false);
    // Asset of another brand cannot be attached.
    const r = await fetch(`${other.baseUrl}/api/v1/brands/${otherBrand}/content`, {
      method: 'POST',
      headers: authHeaders(other),
      body: JSON.stringify({
        title: 'x',
        contentType: 'POST',
        channel: 'instagram',
        preview_asset_id: assetId,
      }),
    });
    expect(r.status).toBe(404);
    // Brand member without access to the brand: 404.
    const outsider = await seedMemberWithoutBrandCaps(seed, { brands: [] });
    await grantCapability(seed.tenantId, outsider.membershipId, 'brand.read', seed.userId);
    const h = { cookie: cookieHeader(outsider.cookies), 'x-csrf-token': outsider.csrf };
    expect((await fetch(`${seed.baseUrl}/api/v1/media/${assetId}`, { headers: h })).status).toBe(
      404,
    );
    expect(
      (await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/media`, { headers: h })).status,
    ).toBe(404);
    // A viewer of the brand can see media but not upload post media.
    await addBrandMember(seed.tenantId, brandId, outsider.userId, 'VIEWER');
    expect((await fetch(`${seed.baseUrl}/api/v1/media/${assetId}`, { headers: h })).status).toBe(
      200,
    );
    const up = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/media?kind=posts&name=v.png`, {
      method: 'POST',
      headers: { ...h, 'content-type': 'image/png' },
      body: PNG,
    });
    expect(up.status).toBe(403);
  });

  it('links post media and the brand logo to MediaAssets (URL fields stay compatible)', async () => {
    const c = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/content`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({
        title: 'Launch',
        contentType: 'POST',
        channel: 'instagram',
        preview_asset_id: assetId,
      }),
    });
    expect(c.status).toBe(201);
    const content = (await c.json()).data;
    expect(content).toMatchObject({
      preview_asset_id: assetId,
      preview_asset_url: `/api/v1/media/${assetId}/view`,
    });
    const logo = (await (await upload(seed, brandId, PNG, 'kind=logos&name=logo.png')).json()).data;
    const b = (
      await (
        await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}`, { headers: authHeaders(seed) })
      ).json()
    ).data;
    const p = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}`, {
      method: 'PATCH',
      headers: authHeaders(seed),
      body: JSON.stringify({ logo_asset_id: logo.id, version: b.version }),
    });
    expect(p.status).toBe(200);
    expect((await p.json()).data).toMatchObject({
      logo_asset_id: logo.id,
      logo_url: `/api/v1/media/${logo.id}/view`,
    });
    // A post asset is not a logo.
    const p2 = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}`, {
      method: 'PATCH',
      headers: authHeaders(seed),
      body: JSON.stringify({ logo_asset_id: assetId, version: b.version + 1 }),
    });
    expect(p2.status).toBe(404);
  });

  it('browses WorkDrive folders and imports an existing file', async () => {
    const br = await (
      await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/media/browse?kind=posts`, {
        headers: authHeaders(seed),
      })
    ).json();
    expect(br.data.folder.name).toBe('lumen-coffee');
    const postsFolder = br.data.folders.find((f: { name: string }) => f.name === 'posts');
    expect(postsFolder).toBeDefined();
    if (!postsFolder) throw new Error('Expected the posts folder under the brand root');
    const posts = await (
      await fetch(
        `${seed.baseUrl}/api/v1/brands/${brandId}/media/browse?kind=posts&folder_id=${encodeURIComponent(postsFolder.id)}`,
        { headers: authHeaders(seed) },
      )
    ).json();
    expect(posts.data.files.map((f: { name: string }) => f.name)).toContain('launch post.png');
    // A file someone added in WorkDrive directly.
    const id = randomUUID();
    wd.files.set(id, {
      id,
      folderId: postsFolder.id,
      name: 'shoot.mp4',
      mimeType: 'video/mp4',
      size: 2048,
      sha256: 'x',
    });
    const imp = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/media/import`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ kind: 'posts', file_id: id }),
    });
    expect(imp.status).toBe(201);
    expect((await imp.json()).data).toMatchObject({
      name: 'shoot.mp4',
      source: 'workdrive',
      stream_url: expect.stringContaining('/stream'),
    });
  });

  it('browses the authorized organization tree independently of the active brand folder', async () => {
    const root = await (
      await fetch(
        `${seed.baseUrl}/api/v1/brands/${brandId}/media/browse?kind=posts&scope=organization`,
        { headers: authHeaders(seed) },
      )
    ).json();
    expect(root.data.folder.name).toBe('OMA');
    expect(root.data.folders.map((f: { name: string }) => f.name)).toEqual(
      expect.arrayContaining(['lumen-coffee']),
    );

    const brandFolder = root.data.folders.find((f: { name: string }) => f.name === 'lumen-coffee');
    expect(brandFolder).toBeDefined();
    if (!brandFolder) throw new Error('Expected the active brand folder under the authorized root');
    const nested = await (
      await fetch(
        `${seed.baseUrl}/api/v1/brands/${brandId}/media/browse?kind=posts&scope=organization&folder_id=${encodeURIComponent(brandFolder.id)}`,
        { headers: authHeaders(seed) },
      )
    ).json();
    expect(nested.data.folder.id).toBe(brandFolder.id);
    expect(nested.data.files.map((f: { name: string }) => f.name)).toContain('launch post.png');
  });

  it('a file deleted in WorkDrive stays referenced with a missing warning (no destructive sync)', async () => {
    const row = await getPrisma().mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
    wd.files.get(row.workdriveFileId)!.trashed = true;
    const v = await fetch(`${seed.baseUrl}/api/v1/media/${assetId}/view`, {
      headers: authHeaders(seed),
      redirect: 'manual',
    });
    expect(v.status).toBe(410);
    const d = (
      await (
        await fetch(`${seed.baseUrl}/api/v1/media/${assetId}`, { headers: authHeaders(seed) })
      ).json()
    ).data;
    expect(d).toMatchObject({ status: 'MISSING', missing: true });
    const content = await getPrisma().contentItem.findFirstOrThrow({
      where: { previewAssetId: assetId },
    });
    expect(content.previewAssetUrl).toBe(`/api/v1/media/${assetId}/view`);
    // Restored in WorkDrive → the reconcile job flips it back.
    wd.files.get(row.workdriveFileId)!.trashed = false;
    await getPrisma().mediaAsset.update({
      where: { id: assetId },
      data: { lastCheckedAt: new Date(Date.now() - 2 * 864e5) },
    });
    const rec = await runMediaReconcileTick({ key: parseEncryptionKey('e'.repeat(64)) });
    expect(rec.restored).toBeGreaterThanOrEqual(1);
    expect(
      (await getPrisma().mediaAsset.findUniqueOrThrow({ where: { id: assetId } })).status,
    ).toBe('READY');
  });

  it('migrates data-URL logos to WorkDrive idempotently', async () => {
    const key = parseEncryptionKey('e'.repeat(64))!;
    const b2 = (await createBrand(seed, 'Data Logo Brand')).body.data.id as string;
    const dataUrl = `data:image/png;base64,${PNG.toString('base64')}`;
    await getPrisma().brandWorkspace.update({
      where: { id: b2 },
      data: { logoUrl: dataUrl, logoAssetId: null },
    });
    const first = await runLogoMigrationTick({ key });
    expect(first.migrated).toBeGreaterThanOrEqual(1);
    const brand = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: b2 } });
    expect(brand.logoAssetId).toBeTruthy();
    expect(brand.logoUrl).toBe(`/api/v1/media/${brand.logoAssetId}/view`);
    const asset = await getPrisma().mediaAsset.findUniqueOrThrow({
      where: { id: brand.logoAssetId! },
    });
    expect(asset).toMatchObject({ kind: 'logos', source: 'migrated', sha256: sha(PNG) });
    expect(wd.pathOf(asset.folderId!)).toBe('data-logo-brand/logos');
    const filesBefore = wd.files.size;
    // Re-run: nothing to do.
    const again = await runLogoMigrationTick({ key });
    expect(
      await getPrisma().brandWorkspace.count({
        where: { id: b2, logoUrl: { startsWith: 'data:' } },
      }),
    ).toBe(0);
    expect(again.migrated).toBe(0);
    // Crash after upload, before the DB switch: re-run reuses the WorkDrive file instead of uploading again.
    await getPrisma().brandWorkspace.update({
      where: { id: b2 },
      data: { logoUrl: dataUrl, logoAssetId: null },
    });
    await getPrisma().mediaAsset.delete({ where: { id: asset.id } });
    const third = await runLogoMigrationTick({ key });
    expect(third.migrated).toBeGreaterThanOrEqual(1);
    expect(wd.files.size).toBe(filesBefore);
    expect(
      (await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: b2 } })).logoUrl,
    ).toMatch(/^\/api\/v1\/media\//);
  });

  it('social publishing sends a fresh signed URL for WorkDrive media', async () => {
    const key = parseEncryptionKey('e'.repeat(64))!;
    const img = (await (await upload(seed, brandId, PNG, 'kind=posts&name=ig.png')).json()).data;
    const pageId = newId();
    await getPrisma().socialPage.create({
      data: {
        id: pageId,
        tenantId: seed.tenantId,
        brandId,
        network: 'INSTAGRAM',
        externalId: `ig-${pageId.slice(-5)}`,
        name: 'IG',
        accessTokenEnc: encryptToken('tok', key),
        connectedBy: seed.userId,
      },
    });
    const post = newId();
    await getPrisma().contentItem.create({
      data: {
        id: post,
        tenantId: seed.tenantId,
        brandId,
        titleEn: 'IG',
        titleAr: 'IG',
        contentType: 'POST',
        channel: 'instagram',
        track: 'ORGANIC',
        status: 'SCHEDULED',
        approvalState: 'APPROVED',
        scheduleState: 'SCHEDULED',
        scheduledAt: new Date(Date.now() - 1000),
        socialPageId: pageId,
        publishState: 'QUEUED',
        previewAssetId: img.id,
        previewAssetUrl: img.view_url,
        createdBy: seed.userId,
      },
    });
    expect(
      await publicMediaUrl(
        { tenantId: seed.tenantId, previewAssetId: img.id, previewAssetUrl: img.view_url },
        { key },
      ),
    ).toMatch(/\/storage\/objects\?token=/);
    const seen: Array<string | null | undefined> = [];
    await runPublishTick({
      key,
      adapterFor: () =>
        ({
          network: 'instagram',
          usesPkce: false,
          isConfigured: () => true,
          authorizeUrl: () => '',
          exchangeCode: async () => [],
          refresh: async () => null,
          publish: async (_p, input) => {
            seen.push(input.mediaUrl);
            return { externalId: '1', url: 'https://instagram.com/p/1' };
          },
        }) as SocialProviderAdapter,
    });
    expect(
      seen.some(
        (u) => typeof u === 'string' && u.startsWith(`${wd.baseUrl}/storage/objects?token=`),
      ),
    ).toBe(true);
    expect(
      (await getPrisma().contentItem.findUniqueOrThrow({ where: { id: post } })).publishState,
    ).toBe('PUBLISHED');
  });

  it('disconnect keeps assets referenced', async () => {
    const r = await fetch(`${seed.baseUrl}/api/v1/workspace/workdrive`, {
      method: 'DELETE',
      headers: authHeaders(seed),
    });
    expect(r.status).toBe(200);
    expect(
      await getPrisma().workDriveConnection.count({ where: { tenantId: seed.tenantId } }),
    ).toBe(0);
    expect(
      await getPrisma().mediaAsset.count({ where: { tenantId: seed.tenantId } }),
    ).toBeGreaterThan(0);
    const v = await fetch(`${seed.baseUrl}/api/v1/media/${assetId}/view`, {
      headers: authHeaders(seed),
      redirect: 'manual',
    });
    expect(v.status).toBe(409);
  });
});
