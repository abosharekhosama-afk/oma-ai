import { WorkDriveError } from './client';
import { brandFolderSlug, isMediaKind, mediaFolderSegments } from './layout';

export type BackupPauseReason = 'quota_exceeded' | 'key_revoked';

export function storageBackupConfig(env: NodeJS.ProcessEnv = process.env) {
  const num = (key: string, fallback: number) => {
    const n = Number(env[key]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    batchSize: Math.min(100, num('STORAGE_BACKUP_BATCH_SIZE', 10)),
    concurrency: Math.min(8, num('STORAGE_BACKUP_CONCURRENCY', 2)),
    maxAttempts: Math.min(20, num('STORAGE_BACKUP_MAX_ATTEMPTS', 8)),
    backoffMs: num('STORAGE_BACKUP_BACKOFF_MS', 30_000),
    maxBackoffMs: num('STORAGE_BACKUP_MAX_BACKOFF_MS', 60 * 60_000),
    tickMs: num('STORAGE_BACKUP_TICK_MS', 15_000),
    staleRunningMs: num('STORAGE_BACKUP_STALE_RUNNING_MS', 15 * 60_000),
  };
}

/** Exponential backoff: base * 2^(attempts-1), capped. attempts is the count after this failure. */
export function backupBackoffMs(attempts: number, baseMs = 30_000, capMs = 60 * 60_000) {
  const exp = Math.max(0, attempts - 1);
  return Math.min(capMs, baseMs * 2 ** exp);
}

export function classifyBackupError(e: unknown): {
  retryable: boolean;
  pauseReason?: BackupPauseReason;
  message: string;
  skip?: boolean;
} {
  if (e instanceof WorkDriveError) {
    if (e.code === 'quota_exceeded') {
      return {
        retryable: false,
        pauseReason: 'quota_exceeded',
        message: e.message,
      };
    }
    if (e.code === 'unauthorized' || e.code === 'forbidden') {
      return { retryable: false, pauseReason: 'key_revoked', message: e.message };
    }
    if (e.code === 'not_found') {
      return { retryable: false, skip: true, message: e.message };
    }
    return { retryable: true, message: e.message };
  }
  return { retryable: true, message: e instanceof Error ? e.message : String(e) };
}

/** Destination folder on the customer's WorkDrive: `OMA/{brand}/{kind}`. */
export function replicaFolderSegments(input: {
  brandName?: string | null;
  brandId?: string | null;
  kind: string;
  rootFolderName?: string | null;
  userId?: string;
}): string[] {
  if (input.kind === 'avatars') {
    const root = input.rootFolderName?.trim().toLowerCase();
    return [...(root === 'oma' ? [] : ['OMA']), 'avatars', input.userId || 'user'];
  }
  const kind = isMediaKind(input.kind) ? input.kind : 'posts';
  return mediaFolderSegments({
    brandSlug: brandFolderSlug(
      input.brandName || 'brand',
      (input.brandId || 'workspace').slice(-8).toLowerCase(),
    ),
    kind,
    rootFolderName: input.rootFolderName,
  });
}
