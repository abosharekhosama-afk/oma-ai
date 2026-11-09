import { getPrisma, hydratePlan } from '@oma/db';
import { DomainError, newId } from '@oma/domain';
import { billingService } from '../billing/billing.service';

export async function migrationStatus(tenantId: string) {
  const prisma = getPrisma();
  const migration = await prisma.storageMigration.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  const candidates = await prisma.mediaAsset.aggregate({
    where: { tenantId, storageProvider: 'USER_WORKDRIVE', status: 'READY' },
    _count: { _all: true },
    _sum: { size: true },
  });
  const usage = await billingService.usage(tenantId);
  const plan = await billingService.getPlanCode(tenantId);
  const limits = (await hydratePlan(plan)).limits.storage_bytes ?? null;
  const candidateBytes = Number(candidates._sum.size ?? 0n);
  const wouldExceed = limits != null && usage.storage_bytes + candidateBytes > limits;
  const active = migration && ['PENDING', 'RUNNING'].includes(migration.status) ? migration : null;
  return {
    data: {
      migration: migration
        ? {
            id: migration.id,
            status: migration.status,
            total: migration.total,
            completed: migration.completed,
            failed: migration.failed,
            skipped: migration.skipped,
            delete_source: migration.deleteSource,
            last_error: migration.lastError,
            started_at: migration.startedAt?.toISOString() ?? null,
            finished_at: migration.finishedAt?.toISOString() ?? null,
          }
        : null,
      candidate_count: candidates._count._all,
      candidate_bytes: candidateBytes,
      used_bytes: usage.storage_bytes,
      limit_bytes: limits,
      can_start: !active && candidates._count._all > 0 && !wouldExceed,
      quota_blocked: wouldExceed,
    },
  };
}

export async function startMigration(tenantId: string, userId: string, body: unknown) {
  const deleteSource = Boolean((body as { delete_source?: unknown } | null)?.delete_source);
  const prisma = getPrisma();
  const active = await prisma.storageMigration.findFirst({
    where: { tenantId, status: { in: ['PENDING', 'RUNNING'] } },
  });
  if (active) {
    throw new DomainError(
      'CONFLICT_STATE',
      'A storage migration is already running',
      409,
      'errors.storage_migrate_in_progress',
    );
  }
  const conn = await prisma.workDriveConnection.findUnique({ where: { tenantId } });
  if (!conn || conn.status !== 'CONNECTED') {
    throw new DomainError(
      'CONFLICT_STATE',
      'Connect WorkDrive before migrating files',
      409,
      'errors.storage_mode_byos_required',
    );
  }
  const assets = await prisma.mediaAsset.findMany({
    where: { tenantId, storageProvider: 'USER_WORKDRIVE', status: 'READY' },
    select: { id: true, size: true },
  });
  if (!assets.length) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'There are no WorkDrive files to migrate',
      400,
      'errors.storage_migrate_none',
    );
  }
  const adding = assets.reduce((n, a) => n + Number(a.size), 0);
  try {
    await billingService.assertWithinLimit(tenantId, 'storage_bytes', { adding });
  } catch (e) {
    if (e instanceof DomainError) {
      throw new DomainError(e.code, e.message, e.status, 'errors.storage_migrate_quota', e.details);
    }
    throw e;
  }
  const now = new Date();
  await prisma.storageMigration.create({
    data: {
      id: newId(),
      tenantId,
      status: 'RUNNING',
      deleteSource,
      total: assets.length,
      startedBy: userId,
      startedAt: now,
    },
  });
  for (const asset of assets) {
    await prisma.storageBackupJob.upsert({
      where: {
        mediaAssetId_workdriveConnectionId_kind: {
          mediaAssetId: asset.id,
          workdriveConnectionId: conn.id,
          kind: 'MIGRATE',
        },
      },
      create: {
        id: newId(),
        tenantId,
        mediaAssetId: asset.id,
        workdriveConnectionId: conn.id,
        kind: 'MIGRATE',
        status: 'PENDING',
        attempts: 0,
        nextAttemptAt: now,
      },
      update: {
        status: 'PENDING',
        nextAttemptAt: now,
        finishedAt: null,
        lastError: null,
        attempts: 0,
      },
    });
  }
  return migrationStatus(tenantId);
}

export async function cancelMigration(tenantId: string) {
  const prisma = getPrisma();
  const active = await prisma.storageMigration.findFirst({
    where: { tenantId, status: { in: ['PENDING', 'RUNNING'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!active) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'No storage migration is running',
      400,
      'errors.storage_migrate_none',
    );
  }
  const now = new Date();
  await prisma.storageMigration.update({
    where: { id: active.id },
    data: { status: 'CANCELLED', finishedAt: now },
  });
  await prisma.storageBackupJob.updateMany({
    where: { tenantId, kind: 'MIGRATE', status: { in: ['PENDING', 'RUNNING'] } },
    data: { status: 'SKIPPED', lastError: 'Migration cancelled', finishedAt: now },
  });
  return migrationStatus(tenantId);
}
