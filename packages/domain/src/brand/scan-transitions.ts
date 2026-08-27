import type { ScanAttemptStatus } from './states';
import { isTerminalScanStatus } from './states';

const ALLOWED_TRANSITIONS: Record<ScanAttemptStatus, ScanAttemptStatus[]> = {
  QUEUED: ['CRAWLING', 'CANCELLED', 'FAILED'],
  CRAWLING: ['EXTRACTING', 'CANCELLED', 'FAILED'],
  EXTRACTING: ['ANALYZING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'],
  ANALYZING: ['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'],
  SUCCEEDED: [],
  PARTIAL: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransitionScan(from: ScanAttemptStatus, to: ScanAttemptStatus): boolean {
  if (from === to) return true;
  if (isTerminalScanStatus(from)) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertScanTransition(from: ScanAttemptStatus, to: ScanAttemptStatus): void {
  if (!canTransitionScan(from, to)) {
    throw new Error(`invalid scan transition ${from} -> ${to}`);
  }
}

export const RETRYABLE_SCAN_STATUSES: readonly ScanAttemptStatus[] = [
  'FAILED',
  'PARTIAL',
  'CANCELLED',
];

export function canRetryScan(status: ScanAttemptStatus): boolean {
  return RETRYABLE_SCAN_STATUSES.includes(status);
}
