import { describe, expect, it } from 'vitest';
import { isScanCancelledError, SCAN_CANCELLED_MESSAGE } from './scan-abort';

describe('scan abort', () => {
  it('detects cooperative cancel errors', () => {
    expect(isScanCancelledError(new Error(SCAN_CANCELLED_MESSAGE))).toBe(true);
    expect(isScanCancelledError(new Error('other'))).toBe(false);
  });
});