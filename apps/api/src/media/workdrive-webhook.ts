import { getPrisma } from '@oma/db';
import {
  DomainError,
  parseWorkDriveWebhookPayload,
  verifyWorkDriveWebhookSignature,
  webhookActionFor,
  webhookTimestampFresh,
  workDriveWebhookSecret,
  workDriveWebhookToleranceSec,
} from '@oma/domain';

export async function handleInboundWorkDriveWebhook(input: {
  rawBody: Buffer | string;
  signature?: string;
  timestamp?: string;
  eventHeader?: string;
  now?: Date;
}) {
  const secret = workDriveWebhookSecret();
  if (!secret) {
    throw new DomainError(
      'PROVIDER_NOT_CONFIGURED',
      'WorkDrive webhook secret is not configured',
      503,
      'errors.workdrive_not_enabled',
    );
  }
  const raw = typeof input.rawBody === 'string' ? input.rawBody : input.rawBody.toString('utf8');
  const ts = input.timestamp ?? '';
  if (!verifyWorkDriveWebhookSignature(secret, ts, raw, input.signature ?? '')) {
    throw new DomainError(
      'PERMISSION_DENIED',
      'Invalid WorkDrive webhook signature',
      401,
      'errors.permission_denied',
    );
  }
  if (
    !webhookTimestampFresh(ts, (input.now ?? new Date()).getTime(), workDriveWebhookToleranceSec())
  ) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'WorkDrive webhook timestamp is outside the allowed window',
      400,
      'errors.validation_failed',
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Invalid webhook payload',
      400,
      'errors.validation_failed',
    );
  }
  const event = parseWorkDriveWebhookPayload(body, input.eventHeader);
  if (!event) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Invalid webhook payload',
      400,
      'errors.validation_failed',
    );
  }
  const prisma = getPrisma();
  try {
    await prisma.workDriveWebhookEvent.create({
      data: { eventId: event.eventId, eventType: event.type },
    });
  } catch {
    return { data: { ok: true, replayed: true, event_id: event.eventId } };
  }
  await applyWebhookAction(event, input.now ?? new Date());
  return { data: { ok: true, replayed: false, event_id: event.eventId } };
}

async function applyWebhookAction(
  event: NonNullable<ReturnType<typeof parseWorkDriveWebhookPayload>>,
  now: Date,
) {
  const prisma = getPrisma();
  const action = webhookActionFor(event);
  if (action.type === 'mark_missing') {
    const assets = await prisma.mediaAsset.findMany({
      where: { OR: [{ workdriveFileId: action.fileId }, { replicaFileId: action.fileId }] },
    });
    for (const asset of assets) {
      if (asset.workdriveFileId === action.fileId) {
        await prisma.mediaAsset.update({
          where: { id: asset.id },
          data: { status: 'MISSING', missingSince: now, lastCheckedAt: now },
        });
      }
      if (asset.replicaFileId === action.fileId) {
        await prisma.mediaAsset.update({
          where: { id: asset.id },
          data: { replicaStatus: 'missing', lastCheckedAt: now },
        });
      }
    }
    return;
  }
  if (action.type === 'mark_restored') {
    const assets = await prisma.mediaAsset.findMany({
      where: { OR: [{ workdriveFileId: action.fileId }, { replicaFileId: action.fileId }] },
    });
    for (const asset of assets) {
      const data: Record<string, unknown> = { lastCheckedAt: now };
      if (asset.workdriveFileId === action.fileId) {
        data.status = 'READY';
        data.missingSince = null;
      }
      if (asset.replicaFileId === action.fileId) data.replicaStatus = 'ready';
      await prisma.mediaAsset.update({ where: { id: asset.id }, data });
    }
    return;
  }
  if (action.type === 'key_revoked') {
    const settings = await prisma.workspaceStorageSetting.findMany({
      where: { platformKeyId: action.keyId },
    });
    const conns = action.prefix
      ? await prisma.workDriveConnection.findMany({ where: { keyPrefix: action.prefix } })
      : [];
    const tenantIds = new Set([
      ...settings.map((s) => s.tenantId),
      ...conns.map((c) => c.tenantId),
    ]);
    for (const tenantId of tenantIds) {
      await prisma.workspaceStorageSetting.upsert({
        where: { tenantId },
        create: {
          tenantId,
          backupPausedAt: now,
          backupPausedReason: 'key_revoked',
        },
        update: { backupPausedAt: now, backupPausedReason: 'key_revoked' },
      });
    }
    if (conns.length) {
      await prisma.workDriveConnection.updateMany({
        where: { id: { in: conns.map((c) => c.id) } },
        data: {
          status: 'ERROR',
          lastError: 'WorkDrive integration key was revoked',
          lastCheckedAt: now,
        },
      });
    }
    return;
  }
  if (action.type === 'quota_exceeded') {
    await prisma.workspaceStorageSetting.updateMany({
      where: { backupPausedAt: null },
      data: { backupPausedAt: now, backupPausedReason: 'quota_exceeded' },
    });
    await prisma.workDriveConnection.updateMany({
      where: { status: 'CONNECTED' },
      data: {
        status: 'ERROR',
        lastError: 'WorkDrive storage quota exceeded',
        lastCheckedAt: now,
      },
    });
  }
}
