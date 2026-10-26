/**
 * Live end-to-end check against a real Imkan WorkDrive backend (feat/integration-api-keys).
 * Skipped unless WORKDRIVE_LIVE_URL and WORKDRIVE_LIVE_KEY are set.
 */
import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { parseEncryptionKey } from '@oma/domain';
import { authHeaders, createBrand, seedBrandTenant } from '../helpers/brand-test';
import { runLogoMigrationTick } from '../../apps/worker/src/media/media-jobs';

const URL_ = process.env.WORKDRIVE_LIVE_URL;
const KEY = process.env.WORKDRIVE_LIVE_KEY;

describe.skipIf(!URL_ || !KEY)('WorkDrive live E2E', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let brandId = '';
  const prev = process.env.WORKDRIVE_ENCRYPTION_KEY;
  beforeAll(async () => {
    process.env.WORKDRIVE_ENCRYPTION_KEY = 'f'.repeat(64);
    seed = await seedBrandTenant();
    brandId = (await createBrand(seed, `Live ${Date.now().toString(36)}`)).body.data.id as string;
  });
  afterAll(async () => {
    process.env.WORKDRIVE_ENCRYPTION_KEY = prev;
    await seed?.app.close();
  });

  it('connects, uploads (single + resumable), serves signed URLs and migrates a logo', async () => {
    const c = await fetch(`${seed.baseUrl}/api/v1/workspace/workdrive`, {
      method: 'PUT',
      headers: authHeaders(seed),
      body: JSON.stringify({ base_url: URL_, api_key: KEY }),
    });
    expect(c.status).toBe(200);
    const conn = (await c.json()).data.connection;
    expect(conn.org_name).toBeTruthy();

    const up = async (bytes: Buffer, name: string, type: string) => {
      const r = await fetch(
        `${seed.baseUrl}/api/v1/brands/${brandId}/media?kind=posts&name=${name}`,
        {
          method: 'POST',
          headers: { ...authHeaders(seed), 'content-type': type },
          body: bytes,
        },
      );
      expect(r.status).toBe(201);
      return (await r.json()).data;
    };
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const small = await up(png, 'live.png', 'image/png');
    const big = randomBytes(40 * 1024 * 1024); // > 32 MiB → resumable parts
    const video = await up(big, 'live.mp4', 'video/mp4');
    expect(video.size).toBe(big.length);

    const v = await fetch(`${seed.baseUrl}/api/v1/media/${small.id}/view`, {
      headers: authHeaders(seed),
      redirect: 'manual',
    });
    expect(v.status).toBe(302);
    const signed = await fetch(v.headers.get('location')!);
    expect(Buffer.from(await signed.arrayBuffer()).equals(png)).toBe(true);
    const range = await fetch(`${seed.baseUrl}/api/v1/media/${video.id}/stream`, {
      headers: { ...authHeaders(seed), range: 'bytes=0-1023' },
    });
    expect(range.status).toBe(206);
    expect(Buffer.from(await range.arrayBuffer()).equals(big.subarray(0, 1024))).toBe(true);

    const browse = await (
      await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/media/browse?kind=posts`, {
        headers: authHeaders(seed),
      })
    ).json();
    expect(browse.data.files.map((f: { name: string }) => f.name)).toEqual(
      expect.arrayContaining(['live.png', 'live.mp4']),
    );

    await getPrisma().brandWorkspace.update({
      where: { id: brandId },
      data: { logoUrl: `data:image/png;base64,${png.toString('base64')}` },
    });
    const key = parseEncryptionKey('f'.repeat(64))!;
    await runLogoMigrationTick({ key });
    await runLogoMigrationTick({ key });
    const b = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(b.logoUrl).toBe(`/api/v1/media/${b.logoAssetId}/view`);
    const logo = await getPrisma().mediaAsset.findUniqueOrThrow({ where: { id: b.logoAssetId! } });
    expect(logo.sha256).toBe(createHash('sha256').update(png).digest('hex'));
    expect(await getPrisma().mediaAsset.count({ where: { brandId, kind: 'logos' } })).toBe(1);
  }, 180_000);
});
