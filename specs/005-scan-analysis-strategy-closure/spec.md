# Feature Specification: Scan, Analysis & Strategy Operational Closure

**Feature Branch**: `005-scan-analysis-strategy-closure`
**Created**: 2026-11-17
**Status**: `SPEC_READY_FOR_PLAN` — provider-neutral **operational closure** for Features 002 + 003; **excludes** Planable visual rebuild and Phase BG live vendor packs unless Owner explicitly expands scope
**Input**: Owner request to close scan → extraction → analysis → approved profile → approved strategy → plan requests journeys and gaps from the 2026-11-17 gap report (excluding general UI design acceptance work)
**Parent baselines**: `specs/002-brand-website-intelligence/spec.md`, `specs/003-strategy-organic-paid-plans/spec.md`, `docs/OMA_PRODUCT_JOURNEY_AND_AI_MAP.md`, Arabic reference doc §9–10 (functional closure, not external API parity)
**Sequencing**: `docs/PRODUCT_DELIVERY_SEQUENCING.md` (`DEC-016`) — live crawl/AI **when configured** on deployed Worker is in scope for **closure**; new third-party adapters (Semrush, Smartly, ad platforms) remain **out of scope** unless tagged Phase BG.

## Clarifications

### Session 2026-11-17

- Q: Does this slice redesign Planable surfaces? → A: **No.** Owner accepts most product UI; scan/analysis UI may improve later — this feature closes **behavior, data, jobs, APIs, and linkage** first.
- Q: Is Semrush/Smartly API required for closure? → A: **No** for CORE closure. Manual competitor/gap fields in 003 remain the complete path; live keyword APIs stay Phase BG (`T301`, `T307`).
- Q: What defines “closed” for this feature? → A: One **proof journey** on a **real public HTTPS site** with Worker+Redis: scan completes → discoveries + media → optional AI analysis applied as proposals → human-approved profile → strategy linked & approved → plan-requests preview shows **non-zero catalog offerings** when scan found products → at least one work request created with catalog anchors.
- Q: Must WorkDrive be connected? → A: **Only** for catalog creative generate (`catalog.generate`); scan/analysis/strategy closure does **not** require WorkDrive unless Owner includes generate in the proof journey.

### Slice resolutions

| ID | Affirms | Does not close |
| ---- | ------- | -------------- |
| `SR-005-CLOSURE` | End-to-end operational closure 002→003 on configured ops stack | `PRODUCTION_LAUNCH_READY`, full Semrush/Smartly |
| `SR-005-NO-VISUAL` | Functional/API/job closure; scan/analysis UI not a DoD gate | DEC-017 owner visual acceptance |
| `SR-005-LIVE-OPS` | Live website connector + configured AI on Worker is valid for closure demos | Mandatory vendor selection for DEC-004/007 |
| `SR-005-CATALOG-SYNC` | Approved profile catalog must reflect discovery truth for plan-requests | Re-open Feature 002 SoT model |

### Owner decision packets (required before implement)

| Packet | Question | Options (default if silent) |
| ------ | -------- | ---------------------------- |
| `DP-005-001` | When to materialize `sectionsJson.catalog` from `discoveredProductService` | **B (default):** On **profile version approve** + explicit **“Refresh catalog from latest scan”** command on draft; not silent overwrite of approved versions |
| `DP-005-002` | Closure tier for sign-off | **A (default):** **OPS_CLOSURE** — configured Worker+Redis+live crawl+optional AI; **B:** adds catalog.generate + WorkDrive in proof journey |
| `DP-005-003` | Fallback catalog for plan-requests | **A (default):** If approved profile `catalog` empty, API may read **latest succeeded/partial scan** for same brand (read-only, tenant-scoped) with honesty flag `catalog_source: discovery_fallback` |

---

## 1. Problem statement

Features 002 and 003 are **provider-neutral complete** in code, but owners still experience **broken chains**: scans without Worker, partial extractions without reimport, AI analysis not applied to profile fields, empty `catalog` in approved profiles, plan-requests with zero offerings, and strategy drafts without enforced profile linkage. Visual work on scan/analysis is separate; **operational closure** is missing.

## 2. Product outcome

An authorized brand owner on a **deployed ops stack** (API + Worker + Redis + live crawl) can:

1. Run a scan on their public site and reach `SUCCEEDED` or `PARTIAL` with explainable coverage.
2. See products/services with media (after scan or **reimport media**).
3. Receive a profile draft; optionally run **brand analysis** when AI is configured; **accept/reject/edit** proposals with provenance.
4. **Approve** a profile version whose **catalog section** reflects discovery (per `DP-005-001`).
5. Create/link strategy, submit, and **approve** package with linked approved profile.
6. **Preview and commit** plan→work requests with **catalog-anchored** rows when products exist.

**Required end state label:** `SCAN_ANALYSIS_STRATEGY_OPS_CLOSURE: VERIFIED` (see `quickstart.md`).

## 3. Personas and capabilities

Reuses 002 + 003 capabilities only (no new capability codes unless implement proves a gap). Server-authoritative checks unchanged.

## 4. Prioritized user stories

### US-SAS-01 — Deployed scan completes with honest status (Priority: P1)

**Independent Test**: Start scan on permitted public URL; progress reaches terminal state; coverage JSON explains pages/products/media counts.

**Acceptance Scenarios**:

1. **Given** Worker+Redis running and live connector enabled, **When** scan starts, **Then** job runs on `ingestion` queue and `scanAttempt` ends `SUCCEEDED` or `PARTIAL` with `pagesFetched > 0` for a normal site.
2. **Given** Worker absent, **When** scan starts, **Then** UI/API shows **not running / queue stalled** honesty within SLA (no infinite “running”).
3. **Given** SPA catalog with lazy images, **When** JS-render mode is `auto` or `on`, **Then** coverage records `js_render` stats and product media import attempts are visible in scan summary.

---

### US-SAS-02 — Discovery catalog truth and media recovery (Priority: P1)

**Independent Test**: After scan, discovery lists products with fields; reimport improves media without new crawl.

**Acceptance Scenarios**:

1. **Given** a completed scan, **When** user opens discovery products, **Then** name/description/price/SKU/availability/media match persisted rows.
2. **Given** older scan lacking media, **When** user triggers **reimport media** for scan, **Then** worker `catalog.reimport` runs and media rows increase idempotently.
3. **Given** duplicate product candidates, **When** reviewer merges in discovery (existing 002), **Then** plan source keys remain stable or migrate per audit rule (documented in plan).

---

### US-SAS-03 — Brand analysis proposals → profile approval (Priority: P1)

**Independent Test**: With `AI_LIVE_ENABLED`, analysis job completes; user applies proposals; approves profile.

**Acceptance Scenarios**:

1. **Given** AI configured, **When** scan completes, **Then** `analysis` job enqueues once per scan/profile draft (idempotent).
2. **Given** analysis proposals exist, **When** user accepts a field proposal, **Then** insight/profile field updates with **AI provenance** and remains editable until version approve.
3. **Given** AI not configured, **When** user completes profile manually from observations, **Then** journey still reaches approved profile without AI errors blocking scan success.

---

### US-SAS-04 — Catalog sync into approved profile (Priority: P1)

**Independent Test**: Approve profile; `sectionsJson.catalog` contains products from scan; plan-requests `catalog_offerings_count > 0`.

**Acceptance Scenarios**:

1. **Given** discovery has products, **When** user approves profile version (`DP-005-001` B), **Then** approved `sectionsJson.catalog.products` lists items with names/descriptions/prices and optional `product_id` / media view hints.
2. **Given** draft profile, **When** user runs **refresh catalog from scan**, **Then** draft catalog updates from latest eligible scan without mutating an already-approved version.
3. **Given** approved profile catalog empty but scan had products (`DP-005-003` A), **When** plan-requests preview runs, **Then** API returns offerings with `catalog_source: discovery_fallback` and audit entry.

---

### US-SAS-05 — Strategy linkage and plan requests (Priority: P1)

**Independent Test**: Approved profile → strategy approve → preview/commit plan requests with catalog anchors.

**Acceptance Scenarios**:

1. **Given** strategy in review, **When** linked profile is not approved, **Then** submit/approve denied with stable error code.
2. **Given** approved strategy linked to approved profile with catalog, **When** preview plan requests, **Then** `catalog_request_count > 0` for brands with products.
3. **Given** commit plan requests, **When** user confirms, **Then** `WorkRequest` rows exist with `plan_source_key` containing `:catalog:` and brief readiness fields populated.

---

### US-SAS-06 — Ops observability and backfill (Priority: P2)

**Independent Test**: Admin/owner sees failed queue jobs; bulk reimport available.

**Acceptance Scenarios**:

1. **Given** failed ingestion/analysis/catalog jobs, **When** owner opens brand scan detail, **Then** last job error code/detail surfaces (no PII).
2. **Given** brand with historical scans, **When** authorized **catalog backfill** runs, **Then** observations + draft refresh rules documented in plan execute without cross-tenant leakage.

---

## 5. Functional requirements

| ID | Requirement |
| ---- | ----------- |
| FR-SAS-001 | System MUST document and validate **minimum ops env** for closure (Worker, Redis, crawl, optional AI) in `quickstart.md`. |
| FR-SAS-002 | Scan API MUST surface **connector mode** (`LIVE`/`FIXTURE`/`NOT_CONFIGURED`) and **job staleness** when Worker unreachable. |
| FR-SAS-003 | Extraction MUST persist catalog rollup observations (`catalog.products` / `catalog.services`) when discovery rows exist (regression guard). |
| FR-SAS-004 | Profile approve command MUST support **catalog materialization** from discovery per `DP-005-001`. |
| FR-SAS-005 | Plan-requests MUST use approved profile catalog first; MAY use discovery fallback per `DP-005-003` with explicit `catalog_source`. |
| FR-SAS-006 | Brand analysis MUST remain **proposal-only**; no auto-approve; idempotent enqueue per scan/draft. |
| FR-SAS-007 | Reimport media MUST be retry-safe and tenant-scoped. |
| FR-SAS-008 | Closure proof journey MUST be automatable (integration or E2E) without fixture-only connector. |
| FR-SAS-009 | All new mutations MUST emit audit events and respect capability guards (regression tests). |
| FR-SAS-010 | Manual Semrush-equivalent fields (competitors, gaps) in 003 MUST remain usable without implying live Semrush data. |

## 6. Non-goals

- Planable pixel parity or scan/analysis visual redesign (separate track).
- New Semrush/Smartly/Meta SDK integrations.
- Commerce/login-gated crawl (`DEC-004` global).
- Replacing 002/003 specs or tenancy model.

## 7. Success criteria

| ID | Criterion |
| ---- | --------- |
| SC-SAS-001 | `quickstart.md` proof journey passes on CI or documented manual ops check list with evidence IDs. |
| SC-SAS-002 | `catalog_offerings_count > 0` in plan preview for seeded real-site proof brand. |
| SC-SAS-003 | Zero cross-tenant catalog/analysis leakage in new tests. |
| SC-SAS-004 | Owner signs `DP-005-001`–`003` or accepts defaults recorded in `decisions/`. |

## 8. Traceability

| Story | FRs | SCs |
| ----- | --- | --- |
| US-SAS-01 | FR-SAS-001,002 | SC-SAS-001 |
| US-SAS-02 | FR-SAS-003,007 | SC-SAS-001 |
| US-SAS-03 | FR-SAS-006 | SC-SAS-001 |
| US-SAS-04 | FR-SAS-004,005 | SC-SAS-002 |
| US-SAS-05 | FR-SAS-005,009 | SC-SAS-002 |
| US-SAS-06 | FR-SAS-002,007 | SC-SAS-003 |