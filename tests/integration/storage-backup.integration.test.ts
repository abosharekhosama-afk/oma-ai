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
import { runBackupTick } from '../../apps/worker/src/media/storage-backup';

type Seed = Awaited<ReturnType<typeof seedBrandTenant>>;
const KEY = fakeKey('k');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('SYNC_BACKUP StorageBackupJob', () => {
  let wd: Awaited<ReturnType<typeof startFakeWorkDrive>>;
  let seed: Seed;
  let brandId: string;
  const prevImpl = WorkDriveService.masterConfigImpl;

  const upload = (bytes: Buffer, name: string) =>
    fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/media?kind=posts&name=${name}`, {
      method: 'POST',
      headers: {
        ...authHeaders(seed),
        'content-type': 'image/png',
      },
      body: bytes,
    });

  const tick = (extra?: Parameters<typeof runBackupTick>[0]) =>
    runBackupTick({
      masterConfig: () => ({ baseUrl: wd.baseUrl, apiKey: KEY }),
      ...extra,
    });

  beforeAll(async () => {
    process.env.WORKDRIVE_ENCRYPTION_KEY = process.env.WORKDRIVE_ENCRYPTION_KEY || 'e'.repeat(64);
    wd = await startFakeWorkDrive({ key: KEY, rootName: 'OMA', orgName: 'Studio' });
    WorkDriveService.masterConfigImpl = () => ({ baseUrl: wd.baseUrl, apiKey: KEY });
    seed = await seedBrandTenant();
    brandId = (await createBrand(seed, 'Lumen Coffee')).body.data.id as string;
    const put = await fetch(`${seed.baseUrl}/api/v1/workspace/workdrive`, {
      method: 'PUT',
      headers: authHeaders(seed),
      body: JSON.stringify({ base_url: wd.baseUrl, api_key: KEY }),
    });
    expect(put.status).toBe(200);
    const mode = await fetch(`${seed.baseUrl}/api/v1/workspace/storage`, {
      method: 'PATCH',
      headers: authHeaders(seed),
      body: JSON.stringify({ mode: 'SYNC_BACKUP' }),
    });
    expect(mode.status).toBe(200);
  });

  afterAll(async () => {
    WorkDriveService.masterConfigImpl = prevImpl;
    await wd?.close();
    await seed?.app.close();
  });

  it('enqueues a backup on each new INTERNAL upload and copies it to the user WorkDrive', async () => {
    const r = await upload(PNG, 'hero.png');
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.data.storage_provider).toBe('OMA_INTERNAL');

    const jobs = await getPrisma().storageBackupJob.findMany({
      where: { tenantId: seed.tenantId, mediaAssetId: body.data.id },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.status).toBe('PENDING');

    const first = await tick();
    expect(first.done).toBeGreaterThanOrEqual(1);
    const done = await getPrisma().storageBackupJob.findUniqueOrThrow({
      where: { id: jobs[0]!.id },
    });
    expect(done.status).toBe('DONE');
    expect(done.replicaFileId).toBeTruthy();
    const asset = await getPrisma().mediaAsset.findUniqueOrThrow({ where: { id: body.data.id } });
    expect(asset.replicaFileId).toBe(done.replicaFileId);
    expect(asset.replicaStatus).toBe('ready');
    expect(wd.files.has(done.replicaFileId!)).toBe(true);
    expect(wd.pathOf(wd.files.get(done.replicaFileId!)!.folderId)).toMatch(/lumen-coffee\/posts/);

    const filesBefore = wd.files.size;
    await getPrisma().storageBackupJob.update({
      where: { id: done.id },
      data: { status: 'PENDING', nextAttemptAt: new Date(0), finishedAt: null },
    });
    const again = await tick();
    expect(again.done).toBeGreaterThanOrEqual(1);
    expect(wd.files.size).toBe(filesBefore);
    const still = await getPrisma().storageBackupJob.findUniqueOrThrow({ where: { id: done.id } });
    expect(still.status).toBe('DONE');
    expect(still.replicaFileId).toBe(done.replicaFileId);
  });

  it('retries with backoff, pauses on quota errors, and allows retry-failed', async () => {
    const r = await upload(PNG, 'retry.png');
    expect(r.status).toBe(201);
    const id = (await r.json()).data.id as string;
    const job = await getPrisma().storageBackupJob.findFirstOrThrow({
      where: { mediaAssetId: id },
    });

    wd.setRejectUploads({ status: 503, message: 'temporarily unavailable' });
    const retried = await tick({ maxAttempts: 8 });
    expect(retried.retried).toBeGreaterThanOrEqual(1);
    const waiting = await getPrisma().storageBackupJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(waiting.status).toBe('PENDING');
    expect(waiting.attempts).toBe(1);
    expect(waiting.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now() - 1000);

    const skipped = await tick();
    const stillWaiting = await getPrisma().storageBackupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(stillWaiting.attempts).toBe(1);
    expect(skipped.scanned === 0 || stillWaiting.status === 'PENDING').toBe(true);

    wd.setRejectUploads({ status: 403, message: 'Storage quota exceeded' });
    await getPrisma().storageBackupJob.update({
      where: { id: job.id },
      data: { nextAttemptAt: new Date(0) },
    });
    const paused = await tick();
    expect(paused.paused).toBeGreaterThanOrEqual(1);
    const failed = await getPrisma().storageBackupJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(failed.status).toBe('FAILED');
    const setting = await getPrisma().workspaceStorageSetting.findUniqueOrThrow({
      where: { tenantId: seed.tenantId },
    });
    expect(setting.backupPausedReason).toBe('quota_exceeded');
    const conn = await getPrisma().workDriveConnection.findUniqueOrThrow({
      where: { tenantId: seed.tenantId },
    });
    expect(conn.status).toBe('ERROR');

    const status = await (
      await fetch(`${seed.baseUrl}/api/v1/workspace/storage/backup`, { headers: authHeaders(seed) })
    ).json();
    expect(status.data.paused).toBe(true);
    expect(status.data.paused_reason).toBe('quota_exceeded');
    expect(status.data.counts.failed).toBeGreaterThanOrEqual(1);

    wd.setRejectUploads(null);
    const retry = await fetch(`${seed.baseUrl}/api/v1/workspace/storage/backup/retry-failed`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({}),
    });
    expect([200, 201]).toContain(retry.status);
    expect((await retry.json()).data.retried).toBeGreaterThanOrEqual(1);
    const afterRetry = await (
      await fetch(`${seed.baseUrl}/api/v1/workspace/storage/backup`, { headers: authHeaders(seed) })
    ).json();
    expect(afterRetry.data.paused).toBe(false);

    const recovered = await tick();
    expect(recovered.done).toBeGreaterThanOrEqual(1);
    const copied = await getPrisma().storageBackupJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(copied.status).toBe('DONE');
  });

  it('backfills existing INTERNAL files and rejects members without tenant.manage', async () => {
    await getPrisma().workspaceStorageSetting.update({
      where: { tenantId: seed.tenantId },
      data: { mode: 'OMA_INTERNAL', backupPausedAt: null, backupPausedReason: null },
    });
    const r = await upload(PNG, 'older.png');
    expect(r.status).toBe(201);
    const assetId = (await r.json()).data.id as string;
    expect(
      await getPrisma().storageBackupJob.findFirst({ where: { mediaAssetId: assetId } }),
    ).toBeNull();

    await getPrisma().workspaceStorageSetting.update({
      where: { tenantId: seed.tenantId },
      data: { mode: 'SYNC_BACKUP' },
    });
    const backfill = await fetch(`${seed.baseUrl}/api/v1/workspace/storage/backup/backfill`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({}),
    });
    expect([200, 201]).toContain(backfill.status);
    const payload = await backfill.json();
    expect(payload.data.enqueued).toBeGreaterThanOrEqual(1);
    expect(
      await getPrisma().storageBackupJob.findFirst({ where: { mediaAssetId: assetId } }),
    ).toBeTruthy();

    const member = await seedMemberWithoutBrandCaps(seed);
    const headers = {
      'content-type': 'application/json',
      cookie: cookieHeader(member.cookies),
      'x-csrf-token': member.csrf,
    };
    const forbiddenGet = await fetch(`${seed.baseUrl}/api/v1/workspace/storage/backup`, {
      headers,
    });
    expect(forbiddenGet.status).toBe(403);
    const forbiddenPost = await fetch(`${seed.baseUrl}/api/v1/workspace/storage/backup/backfill`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    expect(forbiddenPost.status).toBe(403);
  });
});
