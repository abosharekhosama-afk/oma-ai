import { isScanProgressStalled } from './scan-progress';
import { isTerminalScanStatus, type ScanAttemptStatus } from './states';

const RESUMABLE_SCAN_STATUSES = new Set<string>(['QUEUED', 'CRAWLING', 'EXTRACTING']);

/** Whether an in-flight scan may be re-queued to continue after worker loss or stall. */
export function canResumeScan(input: {
  status: ScanAttemptStatus | string;
  cancelRequestedAt?: Date | null;
  progressUpdatedAt?: Date | null;
  startedAt?: Date | null;
  jobRunStatus?: string | null;
  stallSeconds?: number;
  nowMs?: number;
}): boolean {
  if (input.cancelRequestedAt) return false;
  if (isTerminalScanStatus(input.status as ScanAttemptStatus)) return false;
  if (!RESUMABLE_SCAN_STATUSES.has(input.status)) return false;

  const heartbeat = input.progressUpdatedAt ?? input.startedAt ?? null;
  const stalled = isScanProgressStalled(input.status, heartbeat, {
    stallSeconds: input.stallSeconds,
    nowMs: input.nowMs,
  });
  if (stalled) return true;

  const jobStatus = input.jobRunStatus ?? '';
  if (jobStatus === 'FAILED' || jobStatus === 'DEAD') return true;
  return false;
}
