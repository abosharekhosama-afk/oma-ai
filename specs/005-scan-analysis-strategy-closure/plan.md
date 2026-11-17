# Implementation Plan: Scan, Analysis & Strategy Operational Closure

**Branch**: `005-scan-analysis-strategy-closure` (plan artifacts); implement branches `cursor/*-f9b2` off `004-oma-complete-product-demo`
**Date**: 2026-11-17
**Spec**: [`spec.md`](./spec.md)
**Status**: `APPROVED FOR TASK DECOMPOSITION` — plan + tasks for **`IMPLEMENT_005`** when Owner authorizes; **no product code** in this commit unless later implement stage

---

## Summary

Close the **operational** gap chain:

`live scan (Worker)` → `extraction + catalog persistence` → `optional brand analysis (AI)` → **catalog in approved profile** → **approved linked strategy** → **plan-requests with catalog anchors`

without Planable visual work and without Phase BG vendor packs (Semrush/Smartly APIs).

---

## Technical context

| Area | Choice |
| ---- | ------ |
| Stack | Existing DEC-014 monolith; reuse `ingestion`, `analysis`, `catalog` workers |
| Crawl | `createWebsiteConnector()` / live connector on Worker (already on `004`) |
| AI | `isAiLiveEnabled` + `runBrandProfileAnalysis`; proposals via existing ai layer |
| Profile | `ProfileVersion.sectionsJson.catalog` + approve API in `apps/api/src/intelligence` |
| Strategy | `StrategyPlanRequestsService.loadCatalogOfferings` + extend per `DP-005-003` |
| Tests | Vitest integration + one Playwright or API journey on **live crawl** in CI with guard env |

---

## Constitution check

| Principle | Compliance |
| --------- | ---------- |
| Tenant isolation | All new reads scoped `tenantWhere`; fallback scan must be same `brandId` |
| AI proposes; humans decide | No auto-approve; analysis remains proposals |
| Versions immutable | Catalog sync on approve copies forward; approved rows not mutated in place |
| Traceability | Audit on catalog refresh, fallback usage, plan commit |
| DEC-016 | No **new** vendor SDKs; configured OpenAI/live crawl allowed as **ops**, not DEC closure |

**Gate:** Pass for provider-neutral operational closure.

---

## Gap → workstream map (from 2026-11-17 report)

| Gap | Workstream | Phase |
| --- | ---------- | ----- |
| Worker+Redis not deployed | **WS-OPS** | 0 |
| Scan stalls / honesty | **WS-SCAN-OBS** | 1 |
| Media/catalog incomplete | **WS-EXTRACT** (done partially; regression + reimport UX/API) | 1 |
| AI NOT_CONFIGURED | **WS-AI** (env + apply proposals completeness) | 2 |
| Empty profile catalog → empty plan | **WS-CATALOG-SYNC** | 3 |
| Strategy linkage | **WS-STRATEGY-LINK** (gates + plan preview tests) | 3 |
| No end-to-end proof | **WS-PROOF** | 4 |
| Semrush live | **Out of scope** (manual 003 fields) | — |
| WorkDrive generate | **Optional** per `DP-005-002` B | 5 |

---

## Phase breakdown

### Phase 0 — Ops baseline (WS-OPS)

**Outcome:** Documented + verifiable minimum deployment for closure.

Deliverables:

- `quickstart.md` env matrix: `REDIS_URL`, Worker process, `BRAND_WEBSITE_CONNECTOR=live`, crawl limits, `AI_LIVE_ENABLED`, keys.
- Health probe: API reports `worker_reachable` / queue lag (or honest “unknown” with timeout).
- Runbook: Vercel web-only vs full stack.

**Exit:** Operator can confirm Worker consumes `ingestion` jobs within 2 minutes of scan start.

---

### Phase 1 — Scan & extraction hardening (WS-SCAN-OBS, WS-EXTRACT)

**Outcome:** Predictable scan completion and discovery truth.

Deliverables:

- Scan detail API fields: `js_render_*`, media import counts, connector `LIVE|FIXTURE|NOT_CONFIGURED`.
- Stale job detection: if `RUNNING` > N minutes without heartbeat, surface `SCAN_STALLED` (read-only flag).
- Regression tests: `persistCatalogObservations`, reimport idempotency, capabilities on generate/reimport.
- Optional: `POST .../scans/:id/catalog-backfill` (tenant-scoped) to rebuild observations from discovery for latest scan.

**Exit:** US-SAS-01, US-SAS-02 acceptance scenarios pass on proof URL.

---

### Phase 2 — Analysis closure (WS-AI)

**Outcome:** Configured AI path is end-to-end; unconfigured path remains manual.

Deliverables:

- Verify `enqueueBrandAnalysis` once per scan/draft (idempotency test).
- Contract: brand analysis proposals cover minimum field set (`brand-analysis` contract): overview, tone, audiences, messaging, catalog hints where evidence exists.
- API/UI-agnostic: `GET profile version` exposes `analysis_job_status` + `pending_proposal_count`.
- Document proposal apply/reject for all contract fields (regression if any field stuck).

**Exit:** US-SAS-03; with AI off, manual approve still passes.

---

### Phase 3 — Catalog sync & strategy linkage (WS-CATALOG-SYNC, WS-STRATEGY-LINK)

**Outcome:** Plan-requests see real catalog.

Deliverables ( **`DP-005-001` B** ):

- Domain: `buildCatalogSectionsFromDiscovery(rows)` → `sectionsJson.catalog` shape with `product_id`, `primary_media_view_url` when media exists.
- API: `POST .../profiles/:versionId/catalog/refresh-from-scan` (draft only).
- API: extend approve profile to invoke catalog materialization if owner confirms (or auto when catalog empty and scan exists — document in OpenAPI).
- **`DP-005-003` A:** `loadCatalogOfferings` fallback from latest scan via `catalogOfferingsFromDiscoveryRows` + honesty metadata.

Deliverables (linkage):

- Integration test: approved profile + strategy → preview `catalog_offerings_count > 0`.
- Integration test: submit strategy without linked approved profile → 403/409 stable code.

**Exit:** US-SAS-04, US-SAS-05; SC-SAS-002.

---

### Phase 4 — Proof & certification (WS-PROOF)

**Outcome:** `SCAN_ANALYSIS_STRATEGY_OPS_CLOSURE: VERIFIED`.

Deliverables:

- `tests/integration/scan-analysis-strategy-closure.integration.test.ts` (or e2e) using live connector against allowlisted host (e.g. `tests/fixtures/websites` served publicly in CI OR owner-approved URL env).
- Artifact: `artifacts/closure-005/evidence.json` with scan id, profile version id, strategy version id, request ids.
- Update `specs/005-.../checklists/requirements.md` with pass/fail.

**Exit:** SC-SAS-001–003.

---

### Phase 5 — Optional (WS-WORKDRIVE-GEN)

Only if Owner selects `DP-005-002` B:

- Proof `catalog.generate` after profile approve with WorkDrive CONNECTED.

---

## Key files (implement touch map)

| Domain | Paths |
| ------ | ----- |
| Scan / jobs | `apps/worker/src/processors/ingestion.processor.ts`, `apps/api/src/brand/scan.service.ts` |
| Extraction | `apps/worker/src/brand/extraction.service.ts`, `catalog-reimport.ts` |
| Analysis | `apps/worker/src/brand/brand-analysis.service.ts`, `apps/worker/src/processors/analysis.processor.ts` |
| Profile | `apps/api/src/intelligence/profile.service.ts`, `profile-draft.service.ts` (worker) |
| Catalog offerings | `packages/domain/src/brand/catalog-offerings.ts`, `strategy-plan-requests.service.ts` |
| Guards | `apps/api/src/common/guards/capabilities.guard.ts` |

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| CI flaky live crawl | Allowlist host + short max pages; optional job only on `main`/`004` |
| Approved profile mutation | Only **new** approved version or approve-time copy; never PATCH approved catalog |
| Fallback hides bad data | `catalog_source` + audit + UI honesty string (functional; UI later) |
| Worker not on Vercel | Phase 0 runbook; block “closure verified” without Worker evidence |

---

## Out of scope (explicit)

- Scan/analysis visual redesign.
- Phase BG T200–T208 formal DEC-004/007 owner packs (can run in parallel if Owner wants).
- Semrush/Smartly live adapters.
- Social publish / paid activation.

---

## Next step

Owner confirms `DP-005-001`–`003` (or defaults), then authorize **`IMPLEMENT_005`** executing [`tasks.md`](./tasks.md) Phases 0–4 in order.