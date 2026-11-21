import { describe, expect, it } from 'vitest';
import {
  resolveEffectiveJsRenderMode,
  resolveScanRenderEngine,
  scanEngineCoverageLabel,
} from './scan-render-engine';

describe('scan-render-engine', () => {
  it('defaults to scrape-first without Playwright', () => {
    expect(resolveScanRenderEngine({})).toBe('scrape-first');
    expect(resolveEffectiveJsRenderMode({ BRAND_SCANNER_JS_RENDER_MODE: 'always' })).toBe('off');
    expect(scanEngineCoverageLabel('scrape-first')).toBe('SCRAPE');
  });

  it('legacy-js-auto honors JS render mode', () => {
    const env = {
      BRAND_SCAN_ENGINE: 'legacy-js-auto',
      BRAND_SCANNER_JS_RENDER_MODE: 'auto',
    };
    expect(resolveScanRenderEngine(env)).toBe('legacy-js-auto');
    expect(resolveEffectiveJsRenderMode(env)).toBe('auto');
    expect(scanEngineCoverageLabel('legacy-js-auto')).toBe('LEGACY_JS');
  });
});