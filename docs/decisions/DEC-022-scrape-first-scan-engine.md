# DEC-022 — Scrape-first brand website scan engine

**Status:** APPROVED (implementation branch `cursor/scrape-first-scan-f9b2`)  
**Scope:** Brand website public crawl (002); API routes unchanged.

## Decision

1. Default scan engine is **`scrape-first`**: HTTP connector + DOM/JSON-LD + platform catalog + embedded hydration JSON parsing.
2. **Playwright/Chromium is not the default** and is disabled when `BRAND_SCAN_ENGINE=scrape-first`, even if `BRAND_SCANNER_JS_RENDER_MODE=auto|always`.
3. Prior behaviour remains behind **`BRAND_SCAN_ENGINE=legacy-js-auto`** and the existing `BRAND_SCANNER_JS_RENDER_*` variables.
4. Scan coverage JSON gains `scan_engine: "SCRAPE" | "LEGACY_JS"`; `js_render_*` counters stay for diagnostics.

## Rationale

Worker memory and operability on small Render instances; owner priority for full-site scrape over headless browsers.

## Non-goals

- New public API paths.
- Third-party crawl vendors (still governed by `DEC-004`).
