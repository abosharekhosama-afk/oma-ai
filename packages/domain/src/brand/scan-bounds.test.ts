import { describe, expect, it } from 'vitest';
import { clampScanMaxPages, scanMaxPagesCap } from './scan-bounds';

describe('scan-bounds', () => {
  it('defaults cap to 250', () => {
    expect(scanMaxPagesCap({})).toBe(250);
  });

  it('clamps requested pages to cap', () => {
    expect(clampScanMaxPages(500, { BRAND_MAX_PAGES: '50', BRAND_SCAN_MAX_PAGES_CAP: '120' })).toBe(
      120,
    );
  });
});
