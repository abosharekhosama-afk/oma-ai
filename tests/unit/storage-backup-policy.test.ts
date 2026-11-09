import { describe, expect, it } from 'vitest';
import {
  backupBackoffMs,
  classifyBackupError,
  replicaFolderSegments,
  WorkDriveError,
} from '@oma/domain';

describe('storage backup policy', () => {
  it('uses exponential backoff and caps the wait', () => {
    expect(backupBackoffMs(1, 30_000, 3_600_000)).toBe(30_000);
    expect(backupBackoffMs(2, 30_000, 3_600_000)).toBe(60_000);
    expect(backupBackoffMs(3, 30_000, 3_600_000)).toBe(120_000);
    expect(backupBackoffMs(20, 30_000, 3_600_000)).toBe(3_600_000);
  });

  it('treats quota and auth failures as non-retryable pauses', () => {
    const quota = classifyBackupError(
      new WorkDriveError('quota_exceeded', 'Storage quota exceeded', 403),
    );
    expect(quota).toMatchObject({ retryable: false, pauseReason: 'quota_exceeded' });
    const auth = classifyBackupError(new WorkDriveError('unauthorized', 'revoked', 401));
    expect(auth).toMatchObject({ retryable: false, pauseReason: 'key_revoked' });
    const forbidden = classifyBackupError(new WorkDriveError('forbidden', 'no access', 403));
    expect(forbidden).toMatchObject({ retryable: false, pauseReason: 'key_revoked' });
    const busy = classifyBackupError(new WorkDriveError('rate_limited', 'slow down', 429));
    expect(busy.retryable).toBe(true);
    const missing = classifyBackupError(new WorkDriveError('not_found', 'gone', 404));
    expect(missing.skip).toBe(true);
  });

  it('copies replicas into OMA/{brand}/{kind}', () => {
    expect(
      replicaFolderSegments({
        brandName: 'Lumen Coffee',
        brandId: 'brand0123456789',
        kind: 'posts',
        rootFolderName: 'Documents',
      }),
    ).toEqual(['OMA', 'lumen-coffee', 'posts']);
    expect(
      replicaFolderSegments({
        brandName: 'Lumen Coffee',
        brandId: 'brand0123456789',
        kind: 'posts',
        rootFolderName: 'OMA',
      }),
    ).toEqual(['lumen-coffee', 'posts']);
  });
});
