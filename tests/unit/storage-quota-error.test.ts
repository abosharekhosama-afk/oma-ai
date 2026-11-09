import { describe, expect, it } from 'vitest';
import { WorkDriveError } from '@oma/domain';
import { workDriveDomainError } from '../../apps/api/src/media/workdrive.service';

describe('WorkDrive quota errors', () => {
  it('maps 403 Storage quota exceeded to STORAGE_QUOTA_EXCEEDED', () => {
    const err = workDriveDomainError(
      new WorkDriveError('quota_exceeded', 'WorkDrive: Storage quota exceeded', 403),
    );
    expect(err.code).toBe('STORAGE_QUOTA_EXCEEDED');
    expect(err.status).toBe(403);
    expect(err.messageKey).toBe('errors.storage_quota_exceeded');
  });

  it('keeps a generic 403 as forbidden, not a quota error', () => {
    const err = workDriveDomainError(new WorkDriveError('forbidden', 'WorkDrive: Forbidden', 403));
    expect(err.code).toBe('WORKDRIVE_ERROR');
    expect(err.messageKey).toBe('errors.workdrive_forbidden');
  });
});
