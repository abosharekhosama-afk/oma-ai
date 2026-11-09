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
import { runOrphanCleanupTick } from '../../apps/worker/src/media/storage-orphan';
import { runQuotaReconcileTick } from '../../apps/worker/src/media/storage-quota-reconcile';

type Seed = Awaited<ReturnType<typeof seedBrandTenant>>;
const KEY = fakeKey('c');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('storage strategy cleanup (phase 5)', () => {
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
        'content-length': String(bytes.length),
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
    brandId = (await createBrand(seed, 'Cedar Labs')).body.data.id as string;
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

  it('cancels pending backups and trashes the replica when the primary asset is deleted', async () => {
    const pendingUp = await upload(PNG, 'pending-del.png');
    expect(pendingUp.status).toBe(201);
    const pendingId = (await pendingUp.json()).data.id as string;
    const pendingJob = await getPrisma().storageBackupJob.findFirstOrThrow({
      where: { mediaAssetId: pendingId, kind: 'BACKUP' },
    });
    const delPending = await fetch(`${seed.baseUrl}/api/v1/media/${pendingId}`, {
      method: 'DELETE',
      headers: authHeaders(seed),
    });
    expect(delPending.status).toBe(200);
    const skipped = await getPrisma().storageBackupJob.findUniqueOrThrow({
      where: { id: pendingJob.id },
    });
    expect(skipped.status).toBe('SKIPPED');
    const pendingAsset = await getPrisma().mediaAsset.findUniqueOrThrow({
      where: { id: pendingId },
    });
    expect(pendingAsset.status).toBe('MISSING');

    const copied = await upload(PNG, 'copied-del.png');
    expect(copied.status).toBe(201);
    const copiedId = (await copied.json()).data.id as string;
    expect((await tick()).done).toBeGreaterThanOrEqual(1);
    const asset = await getPrisma().mediaAsset.findUniqueOrThrow({ where: { id: copiedId } });
    expect(asset.replicaFileId).toBeTruthy();
    const replicaId = asset.replicaFileId!;
    expect(wd.files.get(replicaId)?.trashed).toBeFalsy();

    const del = await fetch(`${seed.baseUrl}/api/v1/media/${copiedId}`, {
      method: 'DELETE',
      headers: authHeaders(seed),
    });
    expect(del.status).toBe(200);
    const trashJob = await getPrisma().storageBackupJob.findFirstOrThrow({
      where: { mediaAssetId: copiedId, kind: 'REPLICA_TRASH' },
    });
    expect(trashJob.status).toBe('PENDING');
    expect((await tick()).done).toBeGreaterThanOrEqual(1);
    const done = await getPrisma().storageBackupJob.findUniqueOrThrow({
      where: { id: trashJob.id },
    });
    expect(done.status).toBe('DONE');
    expect(wd.files.get(replicaId)?.trashed).toBe(true);
    const after = await getPrisma().mediaAsset.findUniqueOrThrow({ where: { id: copiedId } });
    expect(after.status).toBe('MISSING');
    expect(after.replicaFileId).toBeNull();
  });

  it('does not retry replica trash when the WorkDrive key is revoked', async () => {
    const r = await upload(PNG, 'revoke-del.png');
    expect(r.status).toBe(201);
    const id = (await r.json()).data.id as string;
    expect((await tick()).done).toBeGreaterThanOrEqual(1);
    const asset = await getPrisma().mediaAsset.findUniqueOrThrow({ where: { id } });
    expect(asset.replicaFileId).toBeTruthy();

    wd.setRejectDeletes({ status: 401, message: 'Invalid integration key' });
    const del = await fetch(`${seed.baseUrl}/api/v1/media/${id}`, {
      method: 'DELETE',
      headers: authHeaders(seed),
    });
    expect(del.status).toBe(200);
    const result = await tick();
    expect(result.failed).toBeGreaterThanOrEqual(1);
    const job = await getPrisma().storageBackupJob.findFirstOrThrow({
      where: { mediaAssetId: id, kind: 'REPLICA_TRASH' },
    });
    expect(job.status).toBe('FAILED');
    const again = await tick();
    const still = await getPrisma().storageBackupJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(still.status).toBe('FAILED');
    expect(still.attempts).toBe(job.attempts);
    expect(again.retried).toBe(0);
    wd.setRejectDeletes(null);
  });

  it('migrates BYOS files to OMA storage, keeps the original, and supports cancel + quota + 403', async () => {
    await getPrisma().workspaceStorageSetting.update({
      where: { tenantId: seed.tenantId },
      data: { mode: 'USER_WORKDRIVE' },
    });
    const r = await upload(PNG, 'byos-move.png');
    expect(r.status).toBe(201);
    const assetId = (await r.json()).data.id as string;
    const before = await getPrisma().mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
    expect(before.storageProvider).toBe('USER_WORKDRIVE');
    const originalId = before.workdriveFileId;

    const preview = await fetch(`${seed.baseUrl}/api/v1/workspace/storage/migrate`, {
      headers: authHeaders(seed),
    });
    expect(preview.status).toBe(200);
    const previewBody = await preview.json();
    expect(previewBody.data.candidate_count).toBeGreaterThanOrEqual(1);
    expect(previewBody.data.can_start).toBe(true);

    const started = await fetch(`${seed.baseUrl}/api/v1/workspace/storage/migrate`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ delete_source: false }),
    });
    expect([200, 201]).toContain(started.status);
    const again = await fetch(`${seed.baseUrl}/api/v1/workspace/storage/migrate`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({}),
    });
    expect(again.status).toBe(409);

    expect((await tick()).done).toBeGreaterThanOrEqual(1);
    const moved = await getPrisma().mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
    expect(moved.storageProvider).toBe('OMA_INTERNAL');
    expect(moved.storagePath).toMatch(new RegExp(`tenants/${seed.tenantId}`));
    expect(moved.workdriveFileId).not.toBe(originalId);
    expect(wd.files.get(originalId)?.trashed).toBeFalsy();

    const status = await (
      await fetch(`${seed.baseUrl}/api/v1/workspace/storage/migrate`, {
        headers: authHeaders(seed),
      })
    ).json();
    expect(status.data.migration?.status).toBe('DONE');
    expect(status.data.migration?.completed).toBeGreaterThanOrEqual(1);

    const extra = await upload(PNG, 'byos-cancel.png');
    expect(extra.status).toBe(201);
    const extraId = (await extra.json()).data.id as string;
    const start2 = await fetch(`${seed.baseUrl}/api/v1/workspace/storage/migrate`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({}),
    });
    expect([200, 201]).toContain(start2.status);
    const cancel = await fetch(`${seed.baseUrl}/api/v1/workspace/storage/migrate/cancel`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({}),
    });
    expect([200, 201]).toContain(cancel.status);
    const cancelledJob = await getPrisma().storageBackupJob.findFirstOrThrow({
      where: { mediaAssetId: extraId, kind: 'MIGRATE' },
    });
    expect(cancelledJob.status).toBe('SKIPPED');
    await tick();
    const stillByos = await getPrisma().mediaAsset.findUniqueOrThrow({ where: { id: extraId } });
    expect(stillByos.storageProvider).toBe('USER_WORKDRIVE');

    await getPrisma().mediaAsset.update({
      where: { id: extraId },
      data: { size: 9_000_000_000_000n },
    });
    const blocked = await fetch(`${seed.baseUrl}/api/v1/workspace/storage/migrate`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({}),
    });
    expect([402, 409]).toContain(blocked.status);
    const blockedBody = await blocked.json();
    expect(JSON.stringify(blockedBody)).toMatch(/storage_migrate_quota|storage_quota/);

    const member = await seedMemberWithoutBrandCaps(seed);
    const headers = {
      'content-type': 'application/json',
      cookie: cookieHeader(member.cookies),
      'x-csrf-token': member.csrf,
    };
    const forbidden = await fetch(`${seed.baseUrl}/api/v1/workspace/storage/migrate`, { headers });
    expect(forbidden.status).toBe(403);

    await getPrisma().workspaceStorageSetting.update({
      where: { tenantId: seed.tenantId },
      data: { mode: 'SYNC_BACKUP' },
    });
  });

  it('reconciles orphans under tenants/ only and records quota drift for admins', async () => {
    wd.setRejectDeletes(null);
    const orphanFolder = [...wd.folders.values()].find((f) =>
      wd.pathOf(f.id).startsWith(`tenants/${seed.tenantId}`),
    );
    expect(orphanFolder).toBeTruthy();
    const old = new Date(Date.now() - 10 * 24 * 60 * 60_000);
    const orphanId = 'orphan-old-file';
    wd.files.set(orphanId, {
      id: orphanId,
      folderId: orphanFolder!.id,
      name: 'stray.bin',
      mimeType: 'application/octet-stream',
      size: 12,
      sha256: '0'.repeat(64),
      createdAt: old,
      updatedAt: old,
    });
    const youngId = 'orphan-young-file';
    wd.files.set(youngId, {
      id: youngId,
      folderId: orphanFolder!.id,
      name: 'new-stray.bin',
      mimeType: 'application/octet-stream',
      size: 4,
      sha256: '1'.repeat(64),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const outsideId = 'outside-root-file';
    wd.files.set(outsideId, {
      id: outsideId,
      folderId: wd.rootId,
      name: 'not-in-tenants.bin',
      mimeType: 'application/octet-stream',
      size: 8,
      sha256: '2'.repeat(64),
      createdAt: old,
      updatedAt: old,
    });

    const dry = await runOrphanCleanupTick({
      masterConfig: () => ({ baseUrl: wd.baseUrl, apiKey: KEY }),
      dryRun: true,
      graceMs: 7 * 24 * 60 * 60_000,
    });
    expect(dry.orphans_seen).toBeGreaterThanOrEqual(1);
    expect(dry.trashed).toBe(0);
    expect(wd.files.get(orphanId)?.trashed).toBeFalsy();

    const live = await runOrphanCleanupTick({
      masterConfig: () => ({ baseUrl: wd.baseUrl, apiKey: KEY }),
      dryRun: false,
      graceMs: 7 * 24 * 60 * 60_000,
    });
    expect(live.trashed).toBeGreaterThanOrEqual(1);
    expect(wd.files.get(orphanId)?.trashed).toBe(true);
    expect(wd.files.get(youngId)?.trashed).toBeFalsy();
    expect(wd.files.get(outsideId)?.trashed).toBeFalsy();
    expect(live.skipped_young).toBeGreaterThanOrEqual(1);

    const missingUp = await upload(PNG, 'will-go-missing.png');
    expect(missingUp.status).toBe(201);
    const missingId = (await missingUp.json()).data.id as string;
    const missingAsset = await getPrisma().mediaAsset.findUniqueOrThrow({
      where: { id: missingId },
    });
    const remote = wd.files.get(missingAsset.workdriveFileId);
    if (remote) remote.trashed = true;
    const marked = await runOrphanCleanupTick({
      masterConfig: () => ({ baseUrl: wd.baseUrl, apiKey: KEY }),
      dryRun: true,
    });
    expect(marked.marked_missing).toBeGreaterThanOrEqual(1);
    const nowMissing = await getPrisma().mediaAsset.findUniqueOrThrow({ where: { id: missingId } });
    expect(nowMissing.status).toBe('MISSING');

    const rec = await runQuotaReconcileTick({
      masterConfig: () => ({ baseUrl: wd.baseUrl, apiKey: KEY }),
    });
    expect(rec.tenants_scanned).toBeGreaterThanOrEqual(1);
    expect(rec.platform_used_bytes).not.toBeNull();
    const storage = await (
      await fetch(`${seed.baseUrl}/api/v1/workspace/storage`, { headers: authHeaders(seed) })
    ).json();
    expect(storage.data.last_quota_reconcile?.at).toBeTruthy();
    expect(storage.data.last_quota_reconcile.oma_internal_bytes).toBe(rec.oma_internal_bytes);
  });
});
