# Tasks: Brand Website Intelligence

**Input**: Design documents from `/Users/burhanbakri/Downloads/oma-ai/specs/002-brand-website-intelligence/`
**Baseline plan commit**: `ff8f6de` (`APPROVED FOR TASK DECOMPOSITION`)
**Clarifications**: `97c9218` (DP-001–DP-005; `SR-002-004-MODE`; `SR-002-007-AI`)
**Mode**: `IMPLEMENT_PROVIDER_NEUTRAL_CORE` — T001–T159 complete; Phase BG remains blocked
**Tests**: **Mandatory**. Write failing tests before or with the code they prove. Real Postgres + Redis/BullMQ + local website fixtures. No public-internet crawl in CI. No internal mocks as proof of production DB/queue paths.

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Parallel-safe (different files; no incomplete dependency on unfinished sibling)
- **[US1]`–`[US6]**: Map to `US-BWI-01`–`US-BWI-06`
- Every task includes exact absolute paths under `/Users/burhanbakri/Downloads/oma-ai/`
- No task is marked complete in this stage

## User story mapping

| Label | Spec story                                     | Priority | Primary contracts / quickstart                              |
| ----- | ---------------------------------------------- | -------- | ----------------------------------------------------------- |
| US1   | US-BWI-01 Create Brand + connect website       | P1       | `brand-workspace-api.md`, Q-BWI-01                          |
| US2   | US-BWI-02 Safe async scan + progress           | P1       | `website-scan-api.md`, `ingestion-ai-ports.md`, Q-BWI-04/06 |
| US3   | US-BWI-03 Review pages/products/evidence       | P1       | `discovery-profile-api.md`, Q-BWI-01                        |
| US4   | US-BWI-04 Profile draft, human review, approve | P1       | `discovery-profile-api.md`, Q-BWI-02/03                     |
| US5   | US-BWI-05 Rescan, compare, protect Approved    | P2       | Q-BWI-07/08                                                 |
| US6   | US-BWI-06 Archive brand safely                 | P3       | `brand-workspace-api.md`                                    |

## Architecture constraints (non-negotiable)

- Extend existing modular monolith only (`apps/api`, `apps/worker`, `apps/web`, `packages/*`)
- Wire services via `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/container.ts` + controllers in `AppModule` (no Nest feature-module sprawl; no new microservice)
- Reuse Foundation `JobRun` / outbox / `job_run_id` Bull correlation (mail pattern)
- Default production adapters remain refusing; fixture/test adapters **tests/local only**
- Do **not** claim `PRODUCTION LIVE-INTEGRATION READY` or `LIVE-INTEGRATION READY` while live crawl/AI blocked

## Readiness labels

| Label                        | Meaning                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `PROVIDER-NEUTRAL CORE DONE` | Phases 1–10 green with fixture/refusing adapters; blocked section still open        |
| `LIVE-INTEGRATION READY`     | Blocked live adapters completed after DEC close — **not authorized by these tasks** |
| `PRODUCTION LAUNCH READY`    | Ops/legal/retention/hosting beyond this feature — **out of scope**                  |

---

## Decision Gates (blocked work — NOT part of provider-neutral DoD)

| Gate                                     | Blocks                                   | Allowed in core                                      | Forbidden                             |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------------------- | ------------------------------------- |
| `BLOCKED_BY_DEC-004` / `SR-002-004-MODE` | Live website crawl adapter               | `WebsiteConnectorPort` + fixture/refusing            | Production crawl vendor; commerce SoT |
| `BLOCKED_BY_DEC-007` / `SR-002-007-AI`   | Live AI adapter                          | `AiProviderPort` + refusing + test double            | AI SDK/keys/third-party               |
| `BLOCKED_BY_DEC-003`                     | Full snapshots / binary asset store      | Excerpts/hashes/URLs                                 | Object storage full HTML              |
| `DEC-008`/`009`/`012`                    | Final agency/approval/retention products | Interim multi-brand + single approver + soft archive | Closing those DECs                    |

Blocked tasks live in **Phase BG** at the end and stay `[ ]`.

---

## Phase 1 — Setup & Foundation sync

**Purpose**: Capability catalog, domain folders, fixtures, env validation — no parallel tenancy/auth/queue

- [x] T001 Add brand capability codes (`brand.create`, `brand.read`, `brand.archive`, `brand.website.connect`, `brand.scan.control`, `brand.discovery.review`, `brand.insight.edit`, `brand.insight.decide`, `brand.version.approve`) to `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/authz/capabilities.ts` and extend `SYSTEM_PROFILES` for `COMPANY_OWNER` (and document MEMBER remains deny-by-default)
- [x] T002 [P] Add unit tests for brand capability helpers in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/authz/brand-capabilities.test.ts`
- [x] T003 Create domain package folders and barrel exports in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/index.ts` (states, URL safety stubs export surface only)
- [x] T004 Create API domain folders (empty barrels) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/brand/.gitkeep`, `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/discovery/.gitkeep`, `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/intelligence/.gitkeep`
- [x] T005 [P] Create worker processor stubs (throw `not implemented`) in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/ingestion.processor.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/analysis.processor.ts`
- [x] T006 [P] Add local deterministic website fixture tree in `/Users/burhanbakri/Downloads/oma-ai/tests/fixtures/websites/acme/index.html` plus product/about pages under `/Users/burhanbakri/Downloads/oma-ai/tests/fixtures/websites/acme/`
- [x] T007 [P] Add fixture HTTP server helper (loopback only) in `/Users/burhanbakri/Downloads/oma-ai/tests/helpers/website-fixture-server.ts`
- [x] T008 [P] Add shared brand test helpers (login, tenant seed, capability grant) in `/Users/burhanbakri/Downloads/oma-ai/tests/helpers/brand-test.ts`
- [x] T009 Document brand-related env knobs without secrets (crawl budgets, fixture mode flag) in `/Users/burhanbakri/Downloads/oma-ai/packages/config/src/env.ts` and `/Users/burhanbakri/Downloads/oma-ai/.env.example`
- [x] T010 [P] Add CI note/comment forbidding public crawl egress in `/Users/burhanbakri/Downloads/oma-ai/.github/workflows/ci.yml` (fixture-only brand jobs; no vendor secrets)
- [x] T011 Assert documentation that no second tenant/auth/queue system is introduced in `/Users/burhanbakri/Downloads/oma-ai/specs/002-brand-website-intelligence/plan.md` Decision Gates (sync note only if drift found)

**Checkpoint**: Capabilities + fixtures + folders exist; refusing ports untouched as production default; no Prisma brand models yet.

---

## Phase 2 — Data model & migrations

**Purpose**: Tenant-scoped Prisma models + migration from clean DB; constraints; concurrency; immutability hooks documented in schema comments

**⚠️ CRITICAL**: User-story API work waits until migration applies cleanly on empty DB

- [x] T012 Write failing Prisma/schema expectation tests for brand entities in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/brand-schema.integration.test.ts`
- [x] T013 Add `BrandWorkspace` model (tenantId, status, version, currentApprovedProfileVersionId) in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T014 Add `WebsiteSource` model (tenantId, brandId, normalizedUrl, attestation, sourceRevision, validationStatus) in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T015 Add `ScanAttempt` model with unique `idempotencyKey`, unique `jobRunId`, status, progress, coverageJson, aiAvailability, parentAttemptId in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T016 Add `DiscoveredPage` with unique `(scanAttemptId, canonicalHash)` in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T017 Add `ExtractedObservation` (fieldKey, discoveryTier, infoState, evidenceId, profileVersionId) in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T018 Add `EvidenceExcerpt` (excerptText bound, contentHash, extractionMethod, urls, fetchedAt) — **no blob storage ref required** — in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T019 Add `DiscoveredProductService` (+ optional parent for variants) with per-attempt dedupeKey in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T020 Add `ProfileVersion` (status, rowVersion, coverageSnapshotJson, aiAvailability, scanAttemptId) in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T021 Add `ProfileSection` storage (JSON document on ProfileVersion **or** child model — pick one documented in schema comments) in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T022 Add `InsightClaim` (infoState, reviewStatus, discoveryTier, evidenceId, rowVersion) in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T023 Add `HumanEdit` and `ReviewDecision` append-only models in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T024 Add `ApprovalRecord` unique on `profileVersionId` with incompleteness ack fields in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T025 Add indexes `(tenantId, status, updatedAt)` on BrandWorkspace and `(tenantId, brandId, createdAt)` on ScanAttempt in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T026 Generate migration under `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/migrations/` with documented rollback/down notes in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/migrations/<timestamp>_brand_website_intelligence/migration.sql` (and README sibling if project pattern uses it)
- [x] T027 Prove migration applies on clean database in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/brand-migration-clean.integration.test.ts`
- [x] T028 [P] Add domain state enums/guards for Brand/Scan/Profile/Insight in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/states.ts` and tests in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/states.test.ts`
- [x] T029 [P] Document late-result / Approved immutability application rules in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/immutability.ts` with unit tests in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/immutability.test.ts`

**Checkpoint**: Clean migrate green; T012 green; no live crawl/AI.

---

## Phase 3 — Brand Workspace journey (US1 core)

**Goal**: Create/list/read/update/archive Brand under Foundation tenant
**Independent Test**: Contract + integration prove tenant isolation and capability deny

### Tests (write first; must fail)

- [x] T030 [P] [US1] Contract tests for brand list/create/read/patch/archive in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/brand-workspace.contract.test.ts` per `contracts/brand-workspace-api.md`
- [x] T031 [P] [US1] Integration tests for brand CRUD + archive cancel-active policy stub in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/brand-workspace.integration.test.ts`
- [x] T032 [P] [US1] Security tests for cross-tenant brand denial in `/Users/burhanbakri/Downloads/oma-ai/tests/security/brand-tenant-isolation.security.test.ts`
- [x] T033 [P] [US1] Capability matrix tests (missing `brand.create`/`brand.read`/`brand.archive`) in `/Users/burhanbakri/Downloads/oma-ai/tests/security/brand-capabilities.security.test.ts`

### Implementation

- [x] T034 [US1] Implement `BrandService` create/list/get/patch/archive with `tenantWhere` + optimistic `version` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/brand/brand.service.ts`
- [x] T035 [US1] Implement `BrandController` routes under `/api/v1/brands` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/brand/brand.controller.ts`
- [x] T036 [US1] Register brand routes in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts` and wire controller in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/app.module.ts` + export service from `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/container.ts`
- [x] T037 [US1] Emit audit events `brand.created` / `brand.updated` / `brand.archived` via existing AuditService from `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/brand/brand.service.ts`
- [x] T038 [US1] Add brand list/create pages with empty/loading/error/permission states in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/page.tsx` and `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/new/page.tsx`
- [x] T039 [US1] Add brand detail page shell in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/page.tsx`
- [x] T040 [US1] Add Intelligence nav item filtered by `brand.read` in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/layout.tsx`
- [x] T041 [P] [US1] Add EN/AR message keys for brand surfaces in `/Users/burhanbakri/Downloads/oma-ai/packages/i18n/messages/en.json` and `/Users/burhanbakri/Downloads/oma-ai/packages/i18n/messages/ar.json`

**Checkpoint**: Brand CRUD + isolation + capability tests green; UI list/create usable in EN/AR.

---

## Phase 4 — Connect website & URL security (US1)

**Goal**: Public HTTPS connect with attestation; SSRF/DNS/redirect protections at connect-time and crawl-time helpers

### Tests (write first)

- [x] T042 [P] [US1] Unit tests for URL normalize/HTTPS-only/credential strip in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/url-normalize.test.ts`
- [x] T043 [P] [US1] Unit/security tests for SSRF host policy (localhost, private, link-local, metadata) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/ssrf-policy.test.ts`
- [x] T044 [P] [US1] Unit tests for redirect revalidation helpers in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/redirect-safety.test.ts`
- [x] T045 [P] [US1] Contract tests for `POST/GET .../website` in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/brand-website.contract.test.ts`
- [x] T046 [P] [US1] Integration tests for attestation-required connect + sourceRevision increment without mutating Approved pointer in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/brand-website-connect.integration.test.ts`
- [x] T047 [P] [US1] Security tests for URL credentials, non-HTTPS, unsupported ports/protocols in `/Users/burhanbakri/Downloads/oma-ai/tests/security/brand-url-safety.security.test.ts`

### Implementation

- [x] T048 [US1] Implement URL normalize + SSRF policy pure functions in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/url-normalize.ts` and `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/ssrf-policy.ts`
- [x] T049 [US1] Implement redirect safety helper (re-check every hop) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/redirect-safety.ts`
- [x] T050 [US1] Implement `WebsiteSourceService` connect/replace with attestation audit in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/brand/website-source.service.ts`
- [x] T051 [US1] Add website endpoints in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/brand/website.controller.ts` and capability map entries in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts`
- [x] T052 [US1] Call `WebsiteConnectorPort.validateSource` after policy checks; keep production default refusing; wire fixture mode only via test/DI in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/brand/website-source.service.ts`
- [x] T053 [US1] Add connect-website UI with attestation checkbox in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/connect/page.tsx`
- [x] T054 [US1] Add rate-limit tightening for website connect in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/rate-limit.guard.ts` (or brand-specific guard file `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/brand/brand-rate-limit.ts`)
- [x] T055 [P] [US1] Extend OpenAPI for brand/website routes via `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/generate-openapi.ts` (write gated) and `/Users/burhanbakri/Downloads/oma-ai/packages/api-client/openapi.json` when generated

**Checkpoint**: Connect HTTPS fixture/host policy tests green; Approved versions never mutated by replace URL.

---

## Phase 5 — Scan orchestration (US2)

**Goal**: ScanAttempt state machine, BullMQ `ingestion` queue, deterministic JobRun correlation, cancel/retry, mid-flight reauthz
**Independent Test**: Q-BWI-04/06 patterns with real Redis/Postgres

### Tests (write first)

- [x] T056 [P] [US2] Contract tests for start/status/list/cancel/retry in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/website-scan.contract.test.ts`
- [x] T057 [P] [US2] Integration tests for idempotent start + ≤1 non-terminal attempt per brand in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/scan-idempotency.integration.test.ts`
- [x] T058 [P] [US2] Worker tests for JobRun correlation via `job_run_id` only in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/scan-job-correlation.integration.test.ts`
- [x] T059 [P] [US2] Worker tests for cancel, retry (new attempt), backoff/dead-letter handling in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/scan-cancel-retry.integration.test.ts`
- [x] T060 [P] [US2] Security/integration test: membership suspend mid-job → `PERMISSION_DENIED` fail-closed in `/Users/burhanbakri/Downloads/oma-ai/tests/security/scan-midflight-reauthz.security.test.ts`
- [x] T061 [P] [US2] Integration test: worker restart recovery does not duplicate successful writes in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/scan-worker-recovery.integration.test.ts`
- [x] T062 [P] [US2] Unit tests for ScanAttempt transitions in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/scan-transitions.test.ts`

### Implementation

- [x] T063 [US2] Implement scan state transition guards in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/scan-transitions.ts`
- [x] T064 [US2] Implement `ScanService` start/cancel/retry creating ScanAttempt + JobRun + Outbox in one TX and emit audits `brand.scan.started` / `brand.scan.cancelled` / `brand.scan.retried` via AuditService in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/brand/scan.service.ts`
- [x] T065 [US2] Implement `ScanController` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/brand/scan.controller.ts` and register capabilities in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts`
- [x] T066 [US2] Define ingestion job payload type (snake_case `job_run_id`) in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/ingestion-job-payload.ts`
- [x] T067 [US2] Implement `ingestion.processor.ts` load-by-`job_run_id`, reauthz, progress updates, cancel honor in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/ingestion.processor.ts`
- [x] T068 [US2] Register `ingestion` (+ later `analysis`) queues in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/worker.module.ts` and outbox publish path reuse in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/outbox.publisher.ts`
- [x] T069 [US2] Implement deterministic fixture `WebsiteConnectorPort` adapter for tests/local only in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/fixture-website-connector.ts` (keep `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/refusing-adapters.ts` as production default)
- [x] T070 [US2] Wire worker DI to choose fixture vs refusing via env flag documented in `/Users/burhanbakri/Downloads/oma-ai/packages/config/src/env.ts` (default refusing; fixture allowed only non-prod/test)
- [x] T071 [US2] Persist progress_percent / page counters / coverageJson during crawl in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/ingestion.processor.ts`
- [x] T072 [US2] Enforce per-tenant crawl concurrency / budgets in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/ingestion.processor.ts` and `/Users/burhanbakri/Downloads/oma-ai/packages/config/src/env.ts`
- [x] T073 [US2] Add scan setup/confirmation UI showing crawl bounds (max pages/depth/duration) before start in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/scans/new/page.tsx`
- [x] T074 [US2] Add scan progress UI with Partial/failure/retry controls and live progress a11y in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/scans/[scanId]/page.tsx`
- [x] T075 [P] [US2] Structured logs with correlation_id/tenant/brand/scan/job_run plus mid-flight audit `brand.scan.permission_denied_midflight` in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/ingestion.processor.ts`

**Checkpoint**: Scan start→progress→cancel/retry green on real Redis/Postgres; mid-flight reauthz green; **no live crawl vendor**.

---

## Phase 6 — Extraction & evidence (US3)

**Goal**: Canonicalization, structured extraction, discovery tiers, evidence excerpts (no full snapshots)

### Tests (write first)

- [x] T076 [P] [US3] Unit tests for canonical URL hash/dedupe in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/canonical-url.test.ts`
- [x] T077 [P] [US3] Unit tests for HTML/JSON-LD/OG extraction + Unknown handling in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/extractors.test.ts`
- [x] T078 [P] [US3] Unit tests for discovery tier classification in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/discovery-tiers.test.ts`
- [x] T079 [P] [US3] Integration tests for pages/products/evidence persistence tenant-scoped in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/discovery-extract.integration.test.ts`
- [x] T080 [P] [US3] Contract tests for pages/products/evidence list/get in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/discovery-profile-read.contract.test.ts`
- [x] T081 [P] [US3] Security tests: oversized/slow/invalid content-type rejected in `/Users/burhanbakri/Downloads/oma-ai/tests/security/crawl-content-limits.security.test.ts`
- [x] T082 [P] [US3] Security tests: DNS rebinding + redirect-to-private denied during fetch loop in `/Users/burhanbakri/Downloads/oma-ai/tests/security/ssrf-redirect-chain.security.test.ts`
- [x] T083 [P] [US3] Assert no full HTML snapshot columns/blobs introduced in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/evidence-excerpt-bounds.unit.test.ts`

### Implementation

- [x] T084 [US3] Implement canonical URL + content hash helpers in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/canonical-url.ts`
- [x] T085 [US3] Implement extractors (meta, JSON-LD, OG, heuristics) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/extractors.ts`
- [x] T086 [US3] Implement discovery tier map constants in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/discovery-tiers.ts`
- [x] T087 [US3] Persist DiscoveredPage / Observation / EvidenceExcerpt / ProductService in ingestion processor `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/ingestion.processor.ts` (or extract module `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/brand/extraction.service.ts`)
- [x] T088 [US3] Enforce robots/skip/limit reasons on pages in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/brand/robots-policy.ts`
- [x] T089 [US3] Implement discovery read APIs in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/discovery/discovery.controller.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/discovery/discovery.service.ts`
- [x] T090 [US3] Implement evidence get with re-authz in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/discovery/evidence.service.ts`
- [x] T091 [US3] Add discovered pages UI in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/discovery/pages/page.tsx`
- [x] T092 [US3] Add products/services catalog UI in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/discovery/products/page.tsx`
- [x] T093 [US3] Add Evidence side panel component in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/brand/evidence-side-panel.tsx`

**Checkpoint**: Fixture crawl yields reviewable pages/products/evidence; SSRF redirect tests green; DEC-003 gate holds (excerpts only).

---

## Phase 7 — Profile versioning & AI-unavailable manual path (US4/US5)

**Goal**: Draft from observations; refusing AI → Partial + manual; insight decide; late→Draft; immutable Approved
**Independent Test**: Q-BWI-03, Q-BWI-07, Q-BWI-08

### Tests (write first)

- [x] T094 [P] [US4] Contract tests for profile get/patch/history/compare/insight accept-reject in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/discovery-profile-write.contract.test.ts`
- [x] T095 [P] [US4] Integration: AI not configured → Partial + manual profile approvable path prep in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/ai-unavailable-manual.integration.test.ts`
- [x] T096 [P] [US4] Integration: concurrent edit → `409 CONFLICT_VERSION` in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/profile-concurrency.integration.test.ts`
- [x] T097 [P] [US5] Integration: late result after Approved does not mutate Approved in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/late-result-immutability.integration.test.ts`
- [x] T098 [P] [US5] Integration: rescan creates new Draft; Approved unchanged in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/rescan-new-draft.integration.test.ts`
- [x] T099 [P] [US4] Unit tests for info_state taxonomy transitions in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/info-state.test.ts`
- [x] T100 [P] [US4] Security: Insight decide cannot call whole-version reject endpoint (403) in `/Users/burhanbakri/Downloads/oma-ai/tests/security/insight-vs-version-capability.security.test.ts`

### Implementation

- [x] T101 [US4] Create ProfileVersion Draft from observations after extract (skip analysis when AI refusing) in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/brand/profile-draft.service.ts`
- [x] T102 [US4] Implement analysis processor that catches `AiProviderNotConfiguredError` and sets `ai_availability` without failing usable Partial journeys in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/analysis.processor.ts`
- [x] T103 [US4] Keep production `refusingAiProvider` wired in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/container.ts` / worker DI; add **test-only** double in `/Users/burhanbakri/Downloads/oma-ai/tests/helpers/ai-test-double.ts`
- [x] T104 [US4] Implement `ProfileService` get/patch/history/compare in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/intelligence/profile.service.ts`
- [x] T105 [US4] Implement insight accept/reject/edit endpoints in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/intelligence/insight.service.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/intelligence/profile.controller.ts`
- [x] T106 [US4] Register intelligence routes + capabilities in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/app.module.ts`
- [x] T107 [US4] Enforce Approved immutability + late-result → new Draft only in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/brand/late-result.service.ts`
- [x] T108 [US4] Add Brand Intelligence editor UI in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/profiles/[versionId]/page.tsx`
- [x] T109 [US4] Add AI-unavailable banner + manual field completion UX in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/brand/ai-unavailable-banner.tsx`
- [x] T110 [US4] Add insight decision controls (item-level only) in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/brand/insight-decision-controls.tsx`
- [x] T111 [US5] Add version comparison UI in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/profiles/[versionId]/compare/page.tsx`
- [x] T112 [P] [US4] Audit HumanEdit and insight decisions via AuditService in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/intelligence/insight.service.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/intelligence/profile.service.ts`

**Checkpoint**: Manual path works with refusing AI; late/rescan immutability green; no AI SDK.

---

## Phase 8 — Partial approval & version reject (US4)

**Goal**: Eligibility gate, incompleteness disclosure, explicit confirm, Version approve capability, whole-version reject
**Independent Test**: Q-BWI-02, Q-BWI-09

### Tests (write first)

- [x] T113 [P] [US4] Unit tests for approval eligibility evaluator (FR-BWI-029a/c) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/approval-eligibility.test.ts`
- [x] T114 [P] [US4] Contract tests for approve/reject + `422 APPROVAL_INELIGIBLE` in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/profile-approval.contract.test.ts`
- [x] T115 [P] [US4] Integration: Partial without `acknowledge_incomplete` denied; with ack + audit succeeds in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/partial-approval.integration.test.ts`
- [x] T116 [P] [US4] Integration: Cancelled / Failed-insufficient / ineligible cannot approve in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/approval-denials.integration.test.ts`
- [x] T117 [P] [US4] Integration: ApprovalRecord unique + Approved freeze in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/immutable-approval.integration.test.ts`
- [x] T118 [P] [US4] Security: whole-version reject requires `brand.version.approve` not insight.decide in `/Users/burhanbakri/Downloads/oma-ai/tests/security/version-reject-capability.security.test.ts`

### Implementation

- [x] T119 [US4] Implement eligibility evaluator + coverage summary builder in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/brand/approval-eligibility.ts`
- [x] T120 [US4] Implement approve/reject commands with CAS + ApprovalRecord in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/intelligence/approval.service.ts`
- [x] T121 [US4] Wire approve/reject routes on `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/intelligence/profile.controller.ts`
- [x] T122 [US4] Audit `brand.profile.approved` including incompleteness warnings JSON (`FR-BWI-029d`) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/intelligence/approval.service.ts`
- [x] T123 [US4] Add Approval summary UI with incompleteness banner + explicit confirm in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/brand/approval-summary.tsx`
- [x] T124 [US4] Promote Draft→Needs review transition API/UI before approve in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/intelligence/profile.service.ts` and editor page
- [x] T125 [US6] Implement archive brand cancels non-terminal scans then archives in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/brand/brand.service.ts` with tests in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/brand-archive.integration.test.ts`

**Checkpoint**: Partial→disclosure→confirm→approve green; Cancelled never approves; capability split enforced.

---

## Phase 9 — UX architecture & accessibility (cross-story)

**Purpose**: Complete Intelligence workspace surfaces; DEC-013 pattern roles; EN/AR/RTL; a11y; responsive

- [x] T126 [P] Reuse/extend existing OMA tokens only in `/Users/burhanbakri/Downloads/oma-ai/packages/ui/src/tokens.css` (no competing visual system; no new base design system beyond feature needs)
- [x] T127 [P] Add shared brand layout chrome (density/panels) in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/brand/brand-workspace-shell.tsx` (Linear-style density/progress/panels adaptation)
- [x] T128 [P] Evidence clarity patterns (Semrush-style) in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/brand/evidence-clarity.tsx`
- [x] T129 [P] Brand profile section organization (Jasper Brand IQ-style) in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/brand/profile-sections.tsx`
- [x] T130 [P] Review collaboration cues (Planable-style) in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/brand/review-collaboration.tsx` — Gap `G-016`; E2E `brand-review-permission.e2e.ts` proves note + history survive refresh and relogin
- [x] T131 Ensure all brand routes support loading/empty/error/permission-denied in pages under `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/` — Gap `G-018`; E2E invited member without `brand.read` sees Permission denied on brand overview
- [x] T132 [P] Keyboard navigation + focus management for evidence drawer and approval dialog in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/brand/`
- [x] T133 [P] Screen reader labels for scan progress live region in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/scans/[scanId]/page.tsx`
- [x] T134 [P] Respect `prefers-reduced-motion` using `/Users/burhanbakri/Downloads/oma-ai/packages/ui/src/motion.css`
- [x] T135 [P] Responsive checks (desktop/tablet/mobile) documented via Playwright viewport tests in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-responsive.e2e.ts`
- [x] T136 [P] Complete EN/AR strings for remaining brand UX in `/Users/burhanbakri/Downloads/oma-ai/packages/i18n/messages/en.json` and `/Users/burhanbakri/Downloads/oma-ai/packages/i18n/messages/ar.json` — **REOPENED** Finding `FC-003` / Gap `G-010`: `brand.profile.section.evidence_refs` (and the `t() || key` fallback) leaks a raw key as a section heading.
- [x] T137 Verify RTL layout for brand list, progress, evidence, approval in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-i18n-rtl.e2e.ts`
- [x] T138 [P] Visual overflow/console-error smoke assertions in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-ui-smoke.e2e.ts`

**Checkpoint**: All FR-BWI-032 surfaces present; SC-BWI-006 covered by E2E tasks below.

---

## Phase 10 — Ops, CI, Playwright journeys, DoD

### Playwright E2E (mandatory; fixture site + real Postgres/Redis/worker)

- [x] T139 [P] E2E Q-BWI-01 Create→Connect fixture→Scan→Review→Approve in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-01-approve.e2e.ts`
- [x] T140 [P] E2E Q-BWI-02 Partial→Disclosure→Confirm→Approve in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-02-partial-approve.e2e.ts`
- [x] T141 [P] E2E Q-BWI-03 AI not configured→Manual→Approve in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-03-manual.e2e.ts`
- [x] T142 [P] E2E Q-BWI-04 Cancel→Retry in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-04-cancel-retry.e2e.ts`
- [x] T143 [P] E2E Q-BWI-05 Cross-tenant denial in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-05-cross-tenant.e2e.ts`
- [x] T144 E2E Q-BWI-06 Membership suspended mid-job in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-06-midflight.e2e.ts`
- [x] T145 [P] E2E Q-BWI-07 Approved→Rescan→New Draft in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-07-rescan.e2e.ts`
- [x] T146 [P] E2E Q-BWI-08 Late result does not change Approved in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-08-late-result.e2e.ts`
- [x] T147 [P] E2E Q-BWI-09 Whole-version Reject vs item Insight decide in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-09-reject-scope.e2e.ts`
- [x] T148 [P] E2E Q-BWI-12 EN/AR RTL responsive a11y critical path in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-12-a11y-i18n.e2e.ts`
- [x] T149 [P] E2E Q-BWI-10 concurrent edit → `409 CONFLICT_VERSION` (UI or API journey) in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-10-concurrency.e2e.ts`
- [x] T150 [P] E2E Q-BWI-11 SSRF/private redirect/credential URL denied in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-11-ssrf.e2e.ts`
- [x] T151 [P] E2E Q-BWI-13 capability deny-by-default matrix for brand.* in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-13-capabilities.e2e.ts`

### Ops / quality

- [x] T152 Add brand crawl metrics/log fields documentation in `/Users/burhanbakri/Downloads/oma-ai/packages/observability/src/brand-metrics.ts`
- [x] T153 [P] Health/readiness remains truthful with Redis/DB; optional queue lag note in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/health/health.controller.ts`
- [x] T154 Soft archive/retention boundary hooks (no market-specific hard delete until DEC-012) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/brand/retention-hooks.ts`
- [x] T155 Wire brand E2E jobs into `/Users/burhanbakri/Downloads/oma-ai/.github/workflows/ci.yml` with fixture server; forbid public egress
- [x] T156 Update `/Users/burhanbakri/Downloads/oma-ai/specs/002-brand-website-intelligence/quickstart.md` with exact local commands after implement
- [x] T157 Spec sync: update durable behavior notes in `/Users/burhanbakri/Downloads/oma-ai/specs/002-brand-website-intelligence/spec.md` only for implemented truth (post-implement)
- [x] T158 Final provider-neutral Definition of Done checklist pass recorded in `/Users/burhanbakri/Downloads/oma-ai/specs/002-brand-website-intelligence/checklists/requirements.md`
- [x] T159 Secret scan + ensure no AI/crawl vendor credentials added in `/Users/burhanbakri/Downloads/oma-ai/.env.example` and `/Users/burhanbakri/Downloads/oma-ai/.github/workflows/ci.yml`

**Checkpoint**: All Q-BWI E2E green → may claim **`PROVIDER-NEUTRAL CORE DONE`** only. Never claim live-integration/production launch ready.

---

## Phase GM — Gap-matrix follow-ups (opened by REFERENCE_TO_OMA_GAP_MATRIX_ONLY)

Opened from runtime comparison against the reference evidence baseline at `1a7453c`. Implementation
authorized under `IMPLEMENT_REFERENCE_GAPS_002` after `DEC-015: RESOLVED — OPTION A` (2026-09-04).
`T200`–`T208` remain untouched and blocked. Close Phase GM tasks only with browser/API/DB evidence.

- [x] T160 Implement Company Onboarding (create company + join by invitation) per `DEC-015` Option A / `FR-010a` across Foundation identity + `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/onboarding/page.tsx` (new) and existing `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/tenant/tenant.service.ts` — Gap `G-001`/`G-002`; Finding `FC-001`; E2E: register → usable `/app/brands` by clicking only
- [x] T161 [P] Make the company selector searchable and disambiguated in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/shell/tenant-switcher.tsx` — Gap `G-003`; E2E: a user with many memberships finds a named company by typing
- [x] T162 [P] Isolate E2E tenant residue from the human demo account (cleanup hook or dedicated owner) in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/helpers/brand-api.ts` and wire `/Users/burhanbakri/Downloads/oma-ai/artifacts/prune-e2e-memberships.ts` or equivalent into the E2E lifecycle — Gap `G-005`; Finding `FC-002`
- [x] T163 E2E journey without API shortcuts: login form → company selector → create brand form → overview, in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-ui-entry.e2e.ts` (new) — Gaps `G-001`/`G-003`; Finding `FC-002`; Foundation `FR-002`; must not use `installOwnerSession` cookie injection or `apiPost` for brand create
- [x] T164 [P] E2E insight accept/reject through the UI using test-seeded `AI_INFERRED` insights (permitted by `FR-BWI-028a`; no live AI vendor) in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-insight-decisions.e2e.ts` — Gap `G-011`; also fixed insight decide to send insight `row_version`
- [x] T165 [P] E2E whole-version reject through the UI in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-09-reject-scope.e2e.ts` — Gap `G-014`; clicks `Reject version`; DB status `REJECTED`
- [x] T166 [P] E2E rescan-after-approval creates a new Draft and leaves Approved untouched, driven by UI Retry/Start scan, in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-07-rescan.e2e.ts` — Gap `G-008`
- [x] T167 after T168 Surface tenant-scoped notifications with deep links in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/shell/` consuming `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/notifications/notifications.controller.ts` — Gap `G-017`; E2E cross-tenant non-delivery
- [x] T168 Invitation and membership administration UI over `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/tenant/membership.controller.ts` under `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/` — Gap `G-018`; Finding `FC-005`; unlocks permission-denied proof for T131
- [x] T169 [P] Coverage subset disclosure on brand overview via `coverage-disclosure.tsx` — Gap `G-009`; E2E `brand-coverage-absence.e2e.ts`
- [x] T170 [P] Unknown-versus-missing field distinction in `profile-sections.tsx` (`data-absence`) — Gap `G-012`; E2E `brand-coverage-absence.e2e.ts`
- [x] T171 [P] Keyboard reachability of critical Brand Intelligence actions against `NFR-BWI-005` in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/brand-q-bwi-12-a11y-i18n.e2e.ts` — Gap `G-022`
- [x] T172 [P] Motion measurement recorded in `/Users/burhanbakri/Downloads/oma-ai/specs/002-brand-website-intelligence/gap-matrix/motion-measurement-t172.md` — Gap `G-023`; calm / `INTENTIONAL_DIFFERENCE`, not Linear L10 MATCH
- [x] T173 Record and sync the G-024 product choice: unauthenticated `/` remains a public landing with CTAs to login/register (no forced redirect); document in `/Users/burhanbakri/Downloads/oma-ai/specs/001-oma-ai-product-foundation/spec.md` and mark Gap `G-024` — documentation/sync only unless UX later requires change

## Phase BG — Blocked tasks (stay `[ ]`; not in provider-neutral DoD)

- [ ] T200 `BLOCKED_BY_DEC-004` Implement production live public-fetch `WebsiteConnectorPort` adapter in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/live-website-connector.ts` and wire non-test DI in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/worker.module.ts` — **forbidden until DEC-004 / authorized crawl decision**
- [ ] T201 `BLOCKED_BY_DEC-004` Enable production crawl mode env + observability for live egress in `/Users/burhanbakri/Downloads/oma-ai/packages/config/src/env.ts` — **blocked**
- [ ] T202 `BLOCKED_BY_DEC-007` Implement live `AiProviderPort` adapter with SDK/credentials in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/live-ai-provider.ts` and wire DI in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/worker.module.ts` — **forbidden until DEC-007**
- [ ] T203 `BLOCKED_BY_DEC-007` Production AI region/retention/cost policy wiring in `/Users/burhanbakri/Downloads/oma-ai/packages/config/src/env.ts` and `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/ai-provider.port.ts` — **blocked**
- [ ] T204 `BLOCKED_BY_DEC-003` Full-page HTML snapshot / binary asset object storage persistence in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma` and `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/object-storage.port.ts` — **forbidden until DEC-003**
- [ ] T205 `BLOCKED_BY_DEC-003` WorkDrive duplicate bytes for brand evidence in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/workdrive.port.ts` — **blocked**
- [ ] T206 External notification/email productization for brand events beyond Foundation `MailProviderPort` in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/mail-provider.port.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/mail/` — gate with Foundation ESP decision; keep `[ ]` until authorized
- [ ] T207 Hosting/CDN/analytics provider-specific brand wiring in `/Users/burhanbakri/Downloads/oma-ai/infra/` and `/Users/burhanbakri/Downloads/oma-ai/apps/web/` — blocked on hosting/ops decisions outside 002 core
- [ ] T208 Commerce/store connector path — permanently out of 002 (`SR-002-004-MODE`); path: N/A — do not create files

---

## Dependencies & execution order

### Phase dependencies

1. Phase 1 → Phase 2 (schema) **blocks** story APIs
2. Phase 3 (Brand) → Phase 4 (Connect) → Phase 5 (Scan) → Phase 6 (Extract) → Phase 7 (Profile) → Phase 8 (Approve)
3. Phase 9 can start UI shells after Phase 3; finishes after Phase 8 surfaces exist
4. Phase 10 E2E after Phases 5–8
5. Phase BG never required for `PROVIDER-NEUTRAL CORE DONE`

### Story dependencies

- **US1**: Phases 3–4
- **US2**: Phase 5 (needs US1 website)
- **US3**: Phase 6 (needs US2 scan)
- **US4**: Phases 7–8 (needs US3 observations)
- **US5**: Phase 7 late/rescan + E2E T145–T146
- **US6**: T125 archive (+ brand tests)

### Parallel opportunities

- Phase 1: T002, T005–T010
- Phase 2 tests T012 with later T028–T029 after models
- Within each phase: all `[P]` test files in parallel before implementation
- Phase 9 component files T126–T130, T132–T136 in parallel
- E2E T139–T143, T145–T151 in parallel after core green (T144 sequential mid-flight latch)

### Within each story

Failing tests → schema/domain → services → API → worker → UI → E2E proof

---

## Coverage map

### Requirements

| IDs                        | Tasks                                                   |
| -------------------------- | ------------------------------------------------------- |
| FR-BWI-001–005             | T001, T030–T041, T032–T033                              |
| FR-BWI-006–013, 006a, 012a | T042–T055, T069–T070, T200–T201 blocked                 |
| FR-BWI-014–019             | T056–T075                                               |
| FR-BWI-020–025, 020a–c     | T076–T093                                               |
| FR-BWI-026–028b            | T094–T112, T202–T203 blocked                            |
| FR-BWI-029–031, 029a–d     | T113–T125                                               |
| FR-BWI-032–035             | T038–T041, T073–T074, T091–T093, T108–T111, T126–T138   |
| FR-BWI-036–037             | T120–T122, Phase BG / out-of-scope notes                |
| NFR-BWI-001–008            | Security/integration/E2E tasks across phases; T149–T152 |

### Success criteria

| SC         | Tasks                                          |
| ---------- | ---------------------------------------------- |
| SC-BWI-001 | T139, T141                                     |
| SC-BWI-002 | T113–T122, T139                                |
| SC-BWI-003 | T032, T143                                     |
| SC-BWI-004 | T060, T144                                     |
| SC-BWI-005 | T097–T098, T145–T146                           |
| SC-BWI-006 | T135–T137, T148                                |
| SC-BWI-007 | T057, T142                                     |
| SC-BWI-008 | T115–T116, T140                                |
| SC-BWI-009 | T100, T118, T147                               |
| SC-BWI-010 | Phase BG; fixture-only T069; no commerce tasks |

### Contracts

| Contract                   | Tasks                                         |
| -------------------------- | --------------------------------------------- |
| `brand-workspace-api.md`   | T030–T041, T125                               |
| `website-scan-api.md`      | T056–T075                                     |
| `discovery-profile-api.md` | T080, T089–T093, T094–T124                    |
| `ingestion-ai-ports.md`    | T052, T069–T070, T102–T103, T200–T203 blocked |
| `brand-capabilities.md`    | T001–T002, T036, T051, T065, T106             |

### Quickstart / E2E

| Journey  | Task                       |
| -------- | -------------------------- |
| Q-BWI-01 | T139                       |
| Q-BWI-02 | T140                       |
| Q-BWI-03 | T141                       |
| Q-BWI-04 | T142                       |
| Q-BWI-05 | T143                       |
| Q-BWI-06 | T144                       |
| Q-BWI-07 | T145                       |
| Q-BWI-08 | T146                       |
| Q-BWI-09 | T147                       |
| Q-BWI-10 | T149 (also T096)           |
| Q-BWI-11 | T150 (also T043/T047/T082) |
| Q-BWI-12 | T148                       |
| Q-BWI-13 | T151 (also T033)           |

### Decision gates

| Gate                      | Core tasks                        | Blocked tasks              |
| ------------------------- | --------------------------------- | -------------------------- |
| DEC-004 / SR-002-004-MODE | Fixture/refusing T069–T070        | T200–T201, T208            |
| DEC-007 / SR-002-007-AI   | Refusing + manual T102–T103, T141 | T202–T203                  |
| DEC-003                   | Excerpts T018, T083, T087         | T204–T205                  |
| DEC-012                   | Soft hooks T151                   | hard delete productization |

---

## MVP / provider-neutral core boundary

**MVP (minimum coherent demo):** Phases 1–4 + scan/extract/profile/approve happy path with fixture connector + refusing AI (subset: through T124 + T139/T141).

**`PROVIDER-NEUTRAL CORE DONE`:** Phases 1–10 complete; Phase BG still open; all Q-BWI E2E green; no live vendors.

**Not authorized by this file:** `LIVE-INTEGRATION READY`, `PRODUCTION LAUNCH READY`, `PRODUCTION LIVE-INTEGRATION READY`.

---

## Definition of Done (prevents false completion)

A task/story is **not done** unless:

1. Real user action → API → server authz → Postgres (and Redis/BullMQ when async) → response → UI → refresh/re-login shows persisted result
2. Negatives covered: capability deny, cross-tenant deny, SSRF/redirect, idempotency, mid-flight reauthz, late-result immutability, Partial ack required
3. Applicable automated tests green with **real** Postgres/Redis and **local fixture** website — not public sites; not mocks-only for DB/queue paths
4. No secrets; no live crawl/AI SDKs; DEC-003–012 remain open
5. Spec/plan/contracts/tasks agree after durable changes
6. Blocked Phase BG tasks remain `[ ]` and are excluded from provider-neutral DoD

### Security / tenant isolation gate

If brand tenant isolation or SSRF suites fail → **stop**; do not start next phase.

### Spec sync gate

If implement discovers behavior not in spec/plan/contracts → update smallest artifact before continuing.

---

## Constitution check (TASKS_ONLY)

| Principle                     | Tasks compliance                                        |
| ----------------------------- | ------------------------------------------------------- |
| Product truth first           | Tasks trace FR/SC/US; no inventing live vendors         |
| One SoT / no parallel tenancy | Extend Foundation tenant; Brand Intelligence alias only |
| Tenant isolation              | Explicit security tasks every phase                     |
| AI proposes / humans decide   | Manual path mandatory; live AI blocked                  |
| Traceability                  | Evidence→insight→version→approval tasks                 |
| Explicit state machines       | Domain states + transition tasks                        |
| Versions integrity            | Immutability + late-result tasks                        |
| Explicit integrations         | Ports + fixture/refusing only                           |
| Bilingual accessible UX       | Phase 9 + T148                                          |
| Completion is evidence        | Phase 10 E2E mapping                                    |
| Controlled cost               | No premium vendor tasks in core                         |
| Specs evolve                  | T154 sync                                               |

**Implementation status**: `IMPLEMENT_REFERENCE_GAPS_002` proofs complete for unblocked gaps. `DEC-015: RESOLVED — OPTION A`. Phase GM T160–T173 + T130/T131/T136 closed with evidence; Phase BG T200–T208 remain blocked. Target: `VISIBLE_PRODUCT_BASELINE_002: VERIFIED` after full gates. `AUTHENTICATED REFERENCE PARITY: PARTIAL`; `LIVE-INTEGRATION READY: NO`; `PRODUCTION LAUNCH READY: NO`; `USER ACCEPTANCE: PENDING`.

**Next step**: merge-readiness review only — not `/speckit-implement`. No merge is performed at this stage.

### Phase VP — Visible product recovery (completed outside T001–T159)

`VISIBLE_PRODUCT_RECOVERY_AND_PUBLIC_REFERENCE_PASS` turned the provider-neutral core into a navigable product. It changed no domain rule and closed no decision.

| Item | Outcome                                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VP01 | Global shell rebuilt: grouped sidebar, active route state, language switcher, localized tenant selector and sign-out                                                                              |
| VP02 | `/app` placeholder replaced with a real workspace landing that reaches Brand Intelligence through navigation                                                                                      |
| VP03 | Landing, login, and register localized; `LocaleProvider` added, removing an Arabic hydration mismatch                                                                                             |
| VP04 | `/auth/me`, `CapabilitiesGuard`, and `TenantContextService` union capabilities across duplicate ACTIVE membership rows                                                                            |
| VP05 | `pnpm db:seed:demo` — idempotent, non-production demo tenant with evidence-backed fixture brands                                                                                                  |
| VP06 | `ScanAttempt.connectorMode` records the connector at execution time; scan, brand, discovery, and evidence surfaces disclose it (`FR-BWI-019a`)                                                    |
| VP12 | Capability union across duplicate ACTIVE membership rows covered by integration tests; demo seed refuses non-local databases and is idempotency-tested                                            |
| VP07 | RTL URL isolation (`.oma-ltr`) and localized evidence panel labels                                                                                                                                |
| VP08 | [`reference-matrix.md`](./reference-matrix.md) records public-source reference study                                                                                                              |
| VP09 | Brand intelligence editor renders every profile section as labelled fields; the raw JSON dump is gone                                                                                             |
| VP10 | Info state, discovery tier, blocking reasons, and known field keys are localized instead of leaking enum codes                                                                                    |
| VP11 | Empty state for pending AI insights; mobile shell no longer stretches a blank band under the navigation                                                                                           |
| VP13 | `/app/brands/[brandId]/profiles` version index plus an `Intelligence` workspace tab, so an intelligence version is reachable by clicking alone and version history is visible before any approval |
| VP14 | Brand list search over `GET /brands?q=`, with its own no-results state, and an approved-version marker per brand                                                                                  |
| VP15 | `TENANT_REQUIRED` renders as select-a-company guidance instead of a raw error; login activates the sole tenant when a user belongs to exactly one                                                 |
| VP16 | `db:seed:demo` loads the workspace `.env` itself, so the documented demo command works on a fresh checkout                                                                                        |

Status after Phase VP + Gap Matrix: `VISIBLE PRODUCT BASELINE: CONDITIONAL` — navigable when an active company exists, but self-registration cannot obtain a company (`G-001`) and the shared owner account's switcher is polluted (`G-003`/`G-005`). `AUTHENTICATED_REFERENCE_PARITY: PARTIAL`, `LIVE-INTEGRATION READY: NO`, `PRODUCTION LAUNCH READY: NO`, `USER ACCEPTANCE: PENDING`. See `gap-matrix/`.

---

## Notes

- Status: `PROVIDER-NEUTRAL CORE DONE` — `LIVE-INTEGRATION READY: NO`, `PRODUCTION LAUNCH READY: NO`
- T001–T159: all closed including T130/T131/T136. Phase GM T160–T173 closed with evidence. Phase BG T200–T208 remain `[ ]` (9 blocked). `DEC-015: RESOLVED — OPTION A` (2026-09-04). `AUTHENTICATED REFERENCE PARITY: PARTIAL`; `LIVE-INTEGRATION READY: NO`; `PRODUCTION LAUNCH READY: NO`; `USER ACCEPTANCE: PENDING`.
- `[P]` = parallel-safe file isolation
- Do not mark Phase BG complete without closed decisions + explicit implement authorization
- `DEC-003`–`DEC-012` stay open; Phase BG unblocks only after the owning decision closes
