# Tasks: Scan, Analysis & Strategy Operational Closure

**Input**: [`spec.md`](./spec.md), [`plan.md`](./plan.md)
**Stage**: `TASKS_005` — execute only after Owner authorizes `IMPLEMENT_005`
**Branch policy**: implement on `cursor/<slice>-f9b2` → PR to `004-oma-complete-product-demo`

---

## Phase 0 — Ops baseline (WS-OPS)

**Goal:** Prove Worker+Redis+crawl can run before feature work.

- [x] T001 Document closure env matrix in `specs/005-scan-analysis-strategy-closure/quickstart.md` (Worker, Redis, `BRAND_WEBSITE_CONNECTOR`, AI vars, optional WorkDrive)
- [x] T002 Add API ops probe `GET /api/v1/platform/health/queues` (or extend existing health) returning ingestion/analysis/catalog queue depth + last consumer heartbeat (honest when unknown)
- [x] T003 Add runbook section in `quickstart.md`: Vercel-only vs API+Worker topology; link `docs/PRODUCTION_LOCK_WORK_OPS.md`
- [ ] T004 Manual proof checklist in `checklists/requirements.md`: scan job consumed < 2 min (`scripts/closure-005/ops-smoke.sh` + Worker sign-off)

**Checkpoint:** Operator sign-off on ops matrix (no code DoD without Worker).

---

## Phase 1 — Scan & extraction (WS-SCAN-OBS, WS-EXTRACT)

**Goal:** US-SAS-01, US-SAS-02.

- [x] T010 [P] Regression test: `persistCatalogObservations` creates `catalog.products` when discovery rows exist (`apps/worker` or domain tests)
- [x] T011 Extend scan read API DTO with `coverage` fields: `pages_js_rendered`, `product_media_imported`, `connector_mode` (OpenAPI sync)
- [x] T012 Implement stale scan detection: if `RUNNING` exceeds `BRAND_SCAN_STALE_MINUTES` (env, default 45), set read model flag `stalled: true` without mutating terminal state
- [x] T013 Contract test: scan progress transitions `QUEUED → CRAWLING → EXTRACTING → terminal`
- [x] T014 Verify `POST .../scans/:scanId/reimport-media` enqueues `catalog.reimport` and returns job id (integration)
- [x] T015 [P] Security: reimport/scan routes tenant-isolation tests (no cross-brand scan id)

**Checkpoint:** Live scan on proof URL reaches PARTIAL|SUCCEEDED with `pagesFetched > 0`.

---

## Phase 2 — Brand analysis (WS-AI)

**Goal:** US-SAS-03.

- [x] T020 Unit test: `enqueueBrandAnalysis` idempotent for same `scan_attempt_id` + `profile_version_id`
- [x] T021 Audit brand-analysis contract fields in `packages/domain/src/ai/contracts/brand-analysis.ts`; list gaps vs spec § Jasper-like sections in `research.md` (005)
- [x] T022 Implement missing proposal apply paths in `apps/api/src/intelligence` (or ai apply module) for any contract field without UI dependency
- [x] T023 Expose `analysis_job_status` + `ai_availability` on profile version GET (API only)
- [x] T024 Integration: scan with `AI_TEST_ADAPTER=1` in CI → analysis job SUCCEEDED → at least one proposal row exists

**Checkpoint:** With AI off, profile approve still works; with test adapter, proposals apply manually.

---

## Phase 3 — Catalog sync & strategy linkage (WS-CATALOG-SYNC, WS-STRATEGY-LINK)

**Goal:** US-SAS-04, US-SAS-05 (`DP-005-001` B, `DP-005-003` A defaults).

- [x] T030 Domain: `buildCatalogSectionsFromDiscovery()` in `packages/domain/src/brand/catalog-offerings.ts` (or sibling) producing `sections.catalog` with `product_id`, `primary_media_view_url`
- [x] T031 Unit tests: discovery rows → sections → `catalogOfferingsFromProfileSections` count > 0
- [x] T032 API `POST /api/v1/brands/:brandId/profiles/:versionId/catalog/refresh-from-scan` (draft only, capability `insight.edit` or `version.approve`)
- [x] T033 On profile approve: if `DP-005-001` B — require catalog refresh OR run materialization from latest eligible scan with audit `profile.catalog_materialized`
- [x] T034 Extend `StrategyPlanRequestsService.loadCatalogOfferings` with discovery fallback + `catalog_source` in preview/commit response
- [x] T035 Integration: seed scan products → approve profile with catalog → approve strategy → preview plan `catalog_offerings_count > 0`
- [x] T036 Integration: strategy submit without linked approved profile → stable 403/409 (`strategy-profile-gate.integration.test.ts`)
- [x] T037 Capabilities guard entries + unit tests for new routes
- [x] T038 OpenAPI sync for new profile catalog endpoints

**Checkpoint:** SC-SAS-002 green in CI.

---

## Phase 4 — End-to-end proof (WS-PROOF)

**Goal:** `SCAN_ANALYSIS_STRATEGY_OPS_CLOSURE: VERIFIED`.

- [x] T040 Add `tests/integration/scan-analysis-strategy-closure.integration.test.ts` (live connector allowlist host, bounded pages)
- [x] T041 [P] Optional Playwright `tests/e2e/scan-strategy-closure.e2e.ts` (skip without `CLOSURE_PROOF_URL` env)
- [x] T042 Write evidence template `artifacts/closure-005/README.md` + json schema for proof ids
- [ ] T043 Run full gate: `pnpm typecheck`, `pnpm test`, relevant worker build; record in checklist (automated in CI verify job; Owner sign-off for CHK010–011)
- [x] T044 Owner record `DP-005-001`–`003` decisions in `decisions/` (status OWNER_APPROVED)

**Checkpoint:** Checklist marks SC-SAS-001–003 passed.

---

## Phase 5 — Optional WorkDrive generate (WS-WORKDRIVE-GEN)

Only if Owner selects `DP-005-002` B.

- [ ] T050 E2E: approved profile → `catalog.generate` image → media row + WorkDrive asset (fixture or connected tenant)

---

## Phase BG — Deferred (do not implement in 005 CORE)

- [ ] T301 Live Semrush/Smartly adapters (Foundation `DEC-016`)
- [ ] T302 Formal DEC-004/007 owner packs + T200–T203 from Feature 002 Phase BG

---

## Dependency graph (summary)

```text
Phase 0 (T001–T004)
  → Phase 1 (T010–T015)
  → Phase 2 (T020–T024)
  → Phase 3 (T030–T038)  ← critical path for catalog/plan gap
  → Phase 4 (T040–T044)
Phase 5 optional after 4
```

---

## Suggested implement PR slicing

| PR  | Tasks           | Title                                      |
| --- | --------------- | ------------------------------------------ |
| 1   | T010–T015, T002 | Scan observability + extraction regression |
| 2   | T020–T024       | Analysis closure                           |
| 3   | T030–T038       | Catalog sync + plan-requests fallback      |
| 4   | T040–T044       | Integration proof + checklist              |
