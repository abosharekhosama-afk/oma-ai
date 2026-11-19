/** Cooperative cancel: worker throws this when the scan was cancelled in the API/UI. */
export const SCAN_CANCELLED_MESSAGE = 'scan_cancelled';

export function isScanCancelledError(error: unknown): boolean {
  return error instanceof Error && error.message === SCAN_CANCELLED_MESSAGE;
}