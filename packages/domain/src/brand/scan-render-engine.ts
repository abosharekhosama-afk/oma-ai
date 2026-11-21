import { resolveJsRenderMode, type JsRenderMode } from './js-render-heuristic';

export type ScanRenderEngine = 'scrape-first' | 'legacy-js-auto';

const VALID_ENGINES = new Set<ScanRenderEngine>(['scrape-first', 'legacy-js-auto']);

/**
 * Default scan path is HTTP scrape only (no Playwright on the worker).
 * Opt into prior Chromium behaviour with `legacy-js-auto`.
 */
export function resolveScanRenderEngine(env: NodeJS.ProcessEnv = process.env): ScanRenderEngine {
  const raw = env.BRAND_SCAN_ENGINE?.trim().toLowerCase();
  if (raw && VALID_ENGINES.has(raw as ScanRenderEngine)) {
    return raw as ScanRenderEngine;
  }
  return 'scrape-first';
}

/** JS render mode actually used for a scan after applying the scan engine policy. */
export function resolveEffectiveJsRenderMode(env: NodeJS.ProcessEnv = process.env): JsRenderMode {
  if (resolveScanRenderEngine(env) === 'scrape-first') {
    return 'off';
  }
  return resolveJsRenderMode(env.BRAND_SCANNER_JS_RENDER_MODE);
}

export function scanEngineCoverageLabel(engine: ScanRenderEngine): 'SCRAPE' | 'LEGACY_JS' {
  return engine === 'scrape-first' ? 'SCRAPE' : 'LEGACY_JS';
}