# Scan → Brand intelligence → Strategy (reference-aligned)

**Jasper (Brand IQ):** content model only — governed brand context, sectioned intelligence, AI proposes; humans approve.  
**Planable:** shell and workflow chrome only (DEC-017).  
**OMA journey:** `docs/OMA_PRODUCT_JOURNEY_AND_AI_MAP.md`

## Target pipeline

1. **Scan** — live crawl + optional JS render (`docs/brand-website-scanning.md`).
2. **Discovery** — pages, products/services with evidence.
3. **Profile** — review insights, approve immutable version.
4. **Strategy** — foundation + organic/paid tracks, evidence links.
5. **AI propose** — `POST .../ai/propose` fills empty draft fields only after accept.
6. **Approve strategy** → plan-to-requests (pillars + **catalog product/service** lines) → tasks → content.

## What is implemented on `004`

| Stage                                     | Status                                                                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Scan static + JS render (`auto`/`always`) | Implemented (Worker + Chromium required)                                                                                           |
| Product/service extraction                | HTML/JSON-LD/heuristic + rendered DOM                                                                                              |
| Brand profile + evidence                  | Feature 002                                                                                                                        |
| Strategy organic/paid                     | Feature 003                                                                                                                        |
| AI strategy propose API                   | Implemented (`oma.strategy_propose` prompt)                                                                                        |
| AI strategy assistant UI                  | Overview, foundation, organic, paid, review                                                                                        |
| Discovery → profile catalog merge         | Discovery products UI, merge API, bulk accept catalog insights                                                                     |
| Live AI                                   | **API + Worker** must share live flags/keys; UI polls `/api/v1/ai/status` and offers **Re-run analysis** when auto-enqueue skipped |
| Pipeline chrome                           | Scan page + profile show intelligence stage; `STRATEGY_AI_MODE` surfaced on strategy assistant                                     |
| Scan → content outlook                    | `GET …/scans/:id` returns `content_outlook`; plan preview adds `organic:catalog:*` / `paid:catalog:*` request drafts from catalog  |

## Operations checklist (Brp / production demo)

**Worker:** `BRAND_WEBSITE_CONNECTOR=live`, `BRAND_SCANNER_JS_RENDER_MODE=auto`, Chromium installed, `GEMINI_API_KEY` (or configured provider) for profile analysis.

**API:** `AI_LIVE_ENABLED=true`, `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `STRATEGY_AI_MODE=live`.

## Next engineering waves (not all done)

- Stronger catalog extraction (API/feed hooks after DEC-004 product decision).
- Discovery → profile catalog merge UI (bulk accept observations). **Done** on `004` (wave 2).
- Strategy AI: per-section accept (not whole package accept only).
- E2E: scan → approve profile → AI propose → approve strategy → commit requests.
