# Tasks: Strategy — Organic & Paid Plans

**Input**: Design documents from `/Users/burhanbakri/Downloads/oma-ai/specs/003-strategy-organic-paid-plans/`
**Baseline plan commit**: `436a7f5` (`APPROVED FOR TASK DECOMPOSITION`)
**Owner decisions (closed — do not reopen)**: `DP-003-001` **B**, `DP-003-002` **A**, `DP-003-003` **B**; `DEC-016` provider-neutral
**Mode**: `IMPLEMENT_READINESS_003` — tasks authored; all checkboxes remain open until `IMPLEMENT_003`
**Tests**: **Mandatory**. Write failing tests before or with the code they prove. Real Postgres. Reuse Foundation Redis/outbox worker only. No live AI/ads/analytics/keyword/social calls in CI. No internal mocks as sole proof of production DB paths.

**Prerequisites**: `plan.md` @ `436a7f5`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` PJ-01–09

**Task counts**: **CORE** = **189** (T001–T188 + T096a); **BG deferred** = **10** (T300–T309); **TOTAL** = **199**

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Parallel-safe (different files; no incomplete dependency on unfinished sibling)
- **[US1]`–`[US12]**: Map to `US-SOP-01`–`US-SOP-12`
- Every task includes exact absolute path(s) under `/Users/burhanbakri/Downloads/oma-ai/`
- Every task is unchecked `- [ ]` in this stage
- One responsibility + verifiable outcome per task

## User story mapping

| Label | Spec story                                            | Priority | Primary contracts / quickstart  |
| ----- | ----------------------------------------------------- | -------- | ------------------------------- |
| US1   | US-SOP-01 Open Strategy Workspace                     | P1       | `strategy-api.md`, PJ-05        |
| US2   | US-SOP-02 Create manual strategy + link Brand Profile | P1       | `strategy-api.md`, PJ-01        |
| US3   | US-SOP-03 Author strategy core                        | P1       | `strategy-api.md`, PJ-01        |
| US4   | US-SOP-04 Competitors, pillars, channels, funnel      | P1       | `strategy-api.md`, PJ-01        |
| US5   | US-SOP-05 Organic track                               | P1       | `strategy-api.md`, PJ-02        |
| US6   | US-SOP-06 Paid planning-only track                    | P1       | `strategy-api.md`, PJ-07        |
| US7   | US-SOP-07 Risks, evidence, unknowns                   | P1       | `strategy-api.md`, PJ-09        |
| US8   | US-SOP-08 Human package review                        | P1       | `strategy-review-api.md`, PJ-02 |
| US9   | US-SOP-09 Versions, compare, revise, archive          | P2       | `strategy-api.md`, PJ-04        |
| US10  | US-SOP-10 Manual complete journey when AI unavailable | P1       | `strategy-ports.md`, PJ-02      |
| US11  | US-SOP-11 EN/AR, RTL, responsive, a11y                | P2       | web surfaces, PJ-08             |
| US12  | US-SOP-12 Brand current approved strategy pointer     | P2       | `strategy-api.md`, PJ-03        |

## Architecture constraints (non-negotiable)

- Extend existing modular monolith only (`apps/api`, `apps/worker`, `apps/web`, `packages/*`)
- Wire services via `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/container.ts` + controllers in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/app.module.ts` (same pattern as brand) — **no Nest feature-module sprawl**, no new microservice
- Capabilities in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/authz/capabilities.ts` + `routeRequirements` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts`
- Domain: `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/strategy/`
- API: `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/`
- Web: `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/strategies/...`
- Prisma: `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- Reuse Feature 002 `BrandWorkspace`, `ProfileVersion`, `EvidenceExcerpt` — **never mutate** profile SoT
- Reuse Foundation `AuditEvent`, `OutboxEvent`, `Notification`, `IdempotencyRecord`
- No new vendor SDKs; refusing `AiProviderPort` only (`DEC-016`)
- Out of scope: calendar, Kanban, creative upload, publishing, live spend

## Readiness labels

| Label                        | Meaning                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `IMPLEMENT_READINESS_003`    | This file complete; ready for `IMPLEMENT_003` authorization        |
| `PROVIDER-NEUTRAL CORE DONE` | Phases 1–16 green with refusing AI; Phase BG still open            |
| `LIVE-INTEGRATION READY`     | Phase BG after DEC close — **not authorized by these tasks**       |
| `PRODUCTION LAUNCH READY`    | Ops/legal/retention/hosting beyond this feature — **out of scope** |

---

## Decision Gates (blocked work — NOT part of provider-neutral DoD)

| Gate                         | Status         | Allowed in core                                                   | Forbidden in core                                     |
| ---------------------------- | -------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| `DP-003-001` B               | OWNER_APPROVED | Draft w/o profile + warning; review/approve require Approved link | Evidence-backed claim without linkage                 |
| `DP-003-002` A               | OWNER_APPROVED | One package approve (foundation + enabled tracks)                 | Separate Organic/Paid approve; AI approve             |
| `DP-003-003` B               | OWNER_APPROVED | Explicit Brand `currentApprovedStrategyId` + §8.4 clears          | Auto-current on approve; pointer superseding versions |
| `DEC-016` / `SR-003-016-EXT` | RESOLVED       | Refusing ports; planning-only Paid; manual journey complete       | Live AI/ads/social/analytics/keyword SDKs             |
| `DEC-007`                    | Deferred       | Honesty UI + refusing `AiProviderPort`                            | Live AI SDK/keys/models                               |
| `DEC-006`                    | Deferred       | Paid planning fields only                                         | Ad account / live spend                               |
| `DEC-003`                    | Deferred       | Evidence links to 002 excerpts only                               | New object-storage for strategy binaries              |
| `DEC-004`                    | Deferred       | No crawl in 003                                                   | Website connector wiring in 003                       |
| US-003+                      | Out of scope   | Stable IDs for future briefs/tasks only                           | Calendar/Kanban/creative/publish                      |

Blocked tasks live in **Phase BG** (T300+) and stay `[ ]`.

---

## Phase 1 — Foundation integration & strategy module setup

**Purpose**: Capability catalog, domain/API folders, test helpers, wiring stubs — no parallel tenancy/auth; no Prisma strategy models yet.

- [x] T001 Add strategy capability codes (`strategy.read`, `strategy.create`, `strategy.edit`, `strategy.organic.edit`, `strategy.paid.edit`, `strategy.evidence.link`, `strategy.comment`, `strategy.submit`, `strategy.approve`, `strategy.archive`, `strategy.compare`, `strategy.set_current`) to `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/authz/capabilities.ts` and extend `SYSTEM_PROFILES` so `COMPANY_OWNER` receives all `strategy.*` (MEMBER remains deny-by-default)
- [x] T002 [P] Add unit tests for strategy capability helpers and approve≠set_current separation in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/strategy-capabilities.test.ts`
- [x] T003 Create domain package folders and barrel exports in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/strategy/index.ts`
- [x] T004 Create API strategy folders (services/controllers stubs only) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/.gitkeep`
- [x] T005 [P] Add shared strategy test helpers (login, tenant/brand seed, capability grant, Approved profile fixture link) in `/Users/burhanbakri/Downloads/oma-ai/tests/helpers/strategy-test.ts` reusing patterns from `/Users/burhanbakri/Downloads/oma-ai/tests/helpers/brand-test.ts`
- [x] T006 [P] Add strategy fixture seed data (realistic review package: foundation + Organic enabled + Paid disabled+rationale) in `/Users/burhanbakri/Downloads/oma-ai/tests/fixtures/strategy/acme-strategy-review.json`
- [x] T007 Document strategy-related env knobs without secrets (AI refuse mode flag only; no vendor keys) in `/Users/burhanbakri/Downloads/oma-ai/packages/config/src/env.ts` and `/Users/burhanbakri/Downloads/oma-ai/.env.example`
- [ ] T008 Assert documentation that no second tenant/auth/queue/ACL system is introduced and wiring is container+AppModule (not Nest feature-module sprawl) in `/Users/burhanbakri/Downloads/oma-ai/specs/003-strategy-organic-paid-plans/plan.md` Decision Gates sync note only if drift found

**Checkpoint**: Capabilities + helpers + folders exist; refusing AI ports untouched as production default; no Prisma strategy models yet.

---

## Phase 2 — Prisma schema and migrations

**Purpose**: Tenant-scoped Prisma models + migration from clean DB; Brand pointer; constraints; immutability notes in schema comments.

**⚠️ CRITICAL**: User-story API work waits until migration applies cleanly on empty DB.

- [x] T009 Write failing Prisma/schema expectation tests for strategy entities in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-schema.integration.test.ts`
- [x] T010 Extend `BrandWorkspace` with nullable `currentApprovedStrategyId` (logical FK same tenant/brand) without breaking Feature 002 fields in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T011 Add `Strategy` model (`tenantId`, `brandId`, `name`, `status`, `originStrategyId`, `version`, archive timestamps) in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T012 Add `StrategyVersion` model (status, `rowVersion`, `versionNumber`, profile link fields, track enablement + rationales, `foundationJson`, `aiAvailability`, immutability comment) in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T013 Add `StrategyOrganicTrack` 1:1 version model in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T014 Add `StrategyPaidTrack` 1:1 version model (**no** external account/pixel/provider campaign ids) in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T015 Add `StrategyAudience` model with `infoClass` in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T016 Add `StrategyCompetitorReference` model (manual provenance; no fetch required) in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T017 Add `StrategyKpi` model (`appliesTo` STRATEGY|ORGANIC|PAID) in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T018 Add `StrategyRiskAssumptionDependency` model in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T019 Add `StrategyEvidenceLink` model (logical refs to 002 `EvidenceExcerpt` / profile field keys only) in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T020 Add `StrategyComment`, `StrategyReviewDecision`, unique `StrategyApprovalRecord`, and optional append-only `StrategyHumanEdit` models in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T021 Add indexes `(tenantId, brandId, updatedAt)` / `(tenantId, brandId, status)` on Strategy and unique `(strategyId, versionNumber)` on StrategyVersion in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [x] T022 Generate migration under `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/migrations/` with rollback notes in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/migrations/<timestamp>_strategy_organic_paid_plans/migration.sql`
- [x] T023 Prove migration applies on clean database in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-migration-clean.integration.test.ts`

**Checkpoint**: Clean migrate green; T009 green; Feature 002 profile tables unchanged as SoT; no live AI/ads.

---

## Phase 3 — Strategy/domain state machines

**Purpose**: Pure domain transitions, package eligibility, pointer rules, immutability — unit-tested before services.

- [x] T024 [P] Implement Strategy container status enums/guards (`ACTIVE`→`ARCHIVED`) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/strategy/states.ts` with tests in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/states.test.ts`
- [x] T025 [P] Implement StrategyVersion transition table (create→DRAFT, submit, approve/reject/request-changes, revise, supersede, archive) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/strategy/version-transitions.ts` with tests in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/version-transitions.test.ts`
- [x] T026 [P] Implement package eligibility guards (Approved profile linked; ≥1 track enabled; disabled rationales; required fields; unknowns acknowledgment hooks) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/strategy/package-eligibility.ts` with tests in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/package-eligibility.test.ts`
- [x] T027 [P] Implement track enablement rules (Draft-only toggle; rationale required when disabled at submit) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/strategy/track-enablement.ts` with tests in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/track-enablement.test.ts`
- [x] T028 [P] Implement Brand current-pointer eligibility + §8.4 clear rules (never auto-select replacement) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/strategy/current-pointer.ts` with tests in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/current-pointer.test.ts`
- [x] T029 [P] Implement immutability helpers (IN_REVIEW/APPROVED/SUPERSEDED/REJECTED/CHANGES_REQUESTED/ARCHIVED freeze; Draft-only PATCH) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/strategy/immutability.ts` with tests in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/immutability.test.ts`
- [x] T030 [P] Implement `infoClass` validators (`BRAND_LINKED`|`USER_AUTHORED`|`ASSUMPTION`|`UNKNOWN`|`RECOMMENDATION`|`AI_PROPOSAL`) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/strategy/info-class.ts` with tests in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/info-class.test.ts`
- [x] T031 [US10] Document refusing-AI honesty helpers (`NOT_CONFIGURED`/`UNAVAILABLE`/`REFUSED`; never fabricate proposals) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/strategy/ai-honesty.ts` with tests in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/ai-honesty.test.ts`
- [x] T032 Assert domain package exports all transition/eligibility helpers from `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/strategy/index.ts`

**Checkpoint**: Domain unit suite green for transitions, DP-003 gates, pointer §8.4, immutability, infoClass.

---

## Phase 4 — Strategy CRUD and Brand/Profile linkage

**Goal**: Create/list/read/patch/archive Strategy; DP-003-001 B draft-without-profile + link Approved profile; tenant isolation.
**Independent Test**: Contract + integration + security prove CRUD, warning state, submit blocked without link.

### Tests (write first; must fail)

- [ ] T033 [P] [US1] Contract tests for strategy list/create/read/patch/archive per `contracts/strategy-api.md` in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-workspace.contract.test.ts`
- [x] T034 [P] [US1] Integration tests for strategy CRUD under Brand + soft archive in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-workspace.integration.test.ts`
- [x] T035 [P] [US1] Security tests for cross-tenant strategy denial without existence leak in `/Users/burhanbakri/Downloads/oma-ai/tests/security/strategy-tenant-isolation.security.test.ts`
- [x] T036 [P] [US1] Capability matrix tests (missing `strategy.read`/`create`/`edit`/`archive`) in `/Users/burhanbakri/Downloads/oma-ai/tests/security/strategy-capabilities.security.test.ts`
- [x] T037 [P] [US2] Integration tests: Draft create **without** Approved profile succeeds; missing-source / not evidence-backed; link Draft profile as `draft_aid` never satisfies gate in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-profile-gate.integration.test.ts`
- [ ] T038 [P] [US2] Contract tests for `POST .../link-profile` (`approved` vs `draft_aid`) in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-profile-link.contract.test.ts`

### Implementation

- [x] T039 [US1] Implement `StrategyService` create/list/get/patch/archive with `tenantWhere` + optimistic `version` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy.service.ts`
- [x] T040 [US1] Implement `StrategyController` routes under `/api/v1/brands/:brandId/strategies` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy.controller.ts`
- [x] T041 [US1] Register strategy route capabilities in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts`, wire controller in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/app.module.ts`, and export services from `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/container.ts`
- [x] T042 [US2] Implement create initial `DRAFT` StrategyVersion on strategy create (profile link optional) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-version.service.ts`
- [x] T043 [US2] Implement `link-profile` command: store immutable Approved `ProfileVersion` id; re-check tenant/brand + APPROVED status; never mutate 002 profile SoT in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-version.service.ts`
- [x] T044 [US2] Persist missing-source / evidence-backed flags from linkage state for API responses in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-version.service.ts`
- [x] T045 [US2] Emit audit `strategy.created` and `strategy.profile_linked` via existing AuditService from `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy.service.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-version.service.ts`
- [x] T046 [US1] Prove Feature 002 `ProfileVersion` / `EvidenceExcerpt` rows are never updated by strategy commands in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-no-profile-mutation.integration.test.ts`
- [x] T047 [P] [US1] Extend OpenAPI for strategy routes via `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/generate-openapi.ts` (write gated) and `/Users/burhanbakri/Downloads/oma-ai/packages/api-client/openapi.json` when generated
- [ ] T048 [US2] Integration test: Feature 002 later approves newer profile → strategy linked version unchanged until human retargets on new Draft in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-profile-link-immutability.integration.test.ts`

**Checkpoint**: Strategy CRUD + isolation + DP-003-001 B linkage tests green; profile SoT untouched.

---

## Phase 5 — Strategy foundation editor

**Goal**: Patch Draft `foundationJson` (goals, positioning, messages, pillars, channels, funnel, formats, cadence, horizon) with concurrency + infoClass.
**Independent Test**: Persist core fields; stale `rowVersion` → CONFLICT; frozen versions reject PATCH.

### Tests (write first)

- [x] T049 [P] [US3] Contract tests for `PATCH .../versions/:versionId` foundation fields in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-foundation.contract.test.ts`
- [x] T050 [P] [US3] Integration tests for foundation persist + optimistic concurrency CONFLICT in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-foundation.integration.test.ts`
- [ ] T051 [P] [US3] Unit/integration tests: material statements require `infoClass`; UNKNOWN stays UNKNOWN in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/foundation-info-class.test.ts`

### Implementation

- [x] T052 [US3] Implement Draft-only foundation PATCH with `rowVersion` bump in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-version.service.ts`
- [x] T053 [US3] Reject PATCH on non-Draft versions with actionable error directing to revise in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-version.service.ts`
- [x] T054 [US3] Validate foundationJson schema (goals, audiences refs, positioning, keyMessages, constraints, marketLocale, shared objectives, funnel, formats, cadence, timeHorizon, pillars, channels) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/dto/foundation.dto.ts`
- [x] T055 [US4] Persist shared pillars/channels/funnel/formats/horizon as planning labels only (no calendar entities) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-version.service.ts`
- [x] T056 [US3] Optional append-only `StrategyHumanEdit` write for Draft field changes (requires T020 model) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-human-edit.service.ts`
- [ ] T057 [P] [US3] Idempotency optional path for foundation PATCH via Foundation `IdempotencyRecord` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-version.service.ts`

**Checkpoint**: Foundation edit + concurrency green; no calendar/Kanban side effects.

---

## Phase 6 — Audience, competitor, evidence and provenance

**Goal**: Structured children + evidence links with re-auth; manual competitor provenance; gaps/unknowns.
**Independent Test**: CRUD children; evidence open re-checks tenant/brand; no external competitor API.

### Tests (write first)

- [ ] T058 [P] [US3] Contract tests for audiences CRUD in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-audiences.contract.test.ts`
- [ ] T059 [P] [US4] Contract tests for competitors CRUD (manual URL/note/capturedAt/uncertainty) in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-competitors.contract.test.ts`
- [ ] T060 [P] [US7] Contract tests for KPIs + gaps (risks/assumptions/dependencies/unknowns) in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-kpis-gaps.contract.test.ts`
- [ ] T061 [P] [US7] Contract tests for evidence-links GET/POST/DELETE in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-evidence-links.contract.test.ts`
- [ ] T062 [P] [US7] Security/integration: evidence open re-authorizes tenant/brand; cross-tenant excerpt deny in `/Users/burhanbakri/Downloads/oma-ai/tests/security/strategy-evidence-reauth.security.test.ts`
- [ ] T063 [P] [US4] Assert zero outbound competitor/keyword HTTP from competitor create path in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-competitor-no-egress.integration.test.ts`

### Implementation

- [ ] T064 [US3] Implement audiences CRUD service/controller endpoints in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-audience.service.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy.controller.ts`
- [ ] T065 [US4] Implement competitors CRUD with provenance fields only (no fetch) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-competitor.service.ts`
- [ ] T066 [US7] Implement KPIs CRUD with `appliesTo` STRATEGY|ORGANIC|PAID in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-kpi.service.ts`
- [ ] T067 [US7] Implement gaps CRUD (RISK|ASSUMPTION|DEPENDENCY|UNKNOWN) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-gap.service.ts`
- [ ] T068 [US7] Implement evidence-link attach/detach storing 002 ids only; never mutate excerpts in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-evidence.service.ts`
- [ ] T069 [US7] Implement evidence open/read path that re-checks tenant/brand + capability before returning excerpt body in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-evidence.service.ts`
- [ ] T070 [US7] Register evidence/audience/competitor/kpi/gap routeRequirements in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts`
- [ ] T071 [US7] Emit audit for evidence link changes via AuditService in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-evidence.service.ts`

**Checkpoint**: Children + evidence re-auth green; no competitor API egress; profile SoT untouched.

---

## Phase 7 — Organic track

**Goal**: Distinct Organic track enablement + fields; Paid may stay disabled with rationale.
**Independent Test**: Organic-only package editable; both-disabled blocks submit eligibility (domain + API).

### Tests (write first)

- [ ] T072 [P] [US5] Contract tests for `PATCH .../organic` and `POST .../tracks/enablement` in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-organic.contract.test.ts`
- [ ] T073 [P] [US5] Integration tests: Organic enabled fields persist; Paid disabled requires rationale at submit gate in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-organic.integration.test.ts`
- [ ] T074 [P] [US5] Unit/integration: both tracks disabled → submit eligibility fail in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/organic-paid-enablement-gate.test.ts`

### Implementation

- [ ] T075 [US5] Implement track enablement command (`organicEnabled`/`paidEnabled` + rationales) Draft-only in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-plan-track.service.ts`
- [ ] T076 [US5] Implement Organic track PATCH (pillars, frequency, channels, community/growth goals, KPIs, formats, funnel, message/CTA, owner labels, dependencies) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-plan-track.service.ts`
- [ ] T077 [US5] Ensure Organic and Paid remain separate resources (never one undifferentiated list in storage or DTO) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/dto/tracks.dto.ts`
- [ ] T078 [US5] Emit audit `strategy.track_enablement_changed` via AuditService in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-plan-track.service.ts`
- [ ] T079 [US5] Register organic.edit / enablement capabilities in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts`
- [ ] T080 [P] [US5] Idempotency for enablement mutations via `IdempotencyRecord` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-plan-track.service.ts`

**Checkpoint**: Organic track green; enablement + rationale rules enforced.

---

## Phase 8 — Paid planning-only track

**Goal**: Paid planning fields with honesty labels; zero ad-platform egress; no ad-account UI/API.
**Independent Test**: Budget persists as planning; suite asserts zero ad outbound calls.

### Tests (write first)

- [ ] T081 [P] [US6] Contract tests for `PATCH .../paid` planning fields in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-paid.contract.test.ts`
- [ ] T082 [P] [US6] Integration tests for budget/allocation/objectives/KPIs + reject negative/invalid budget in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-paid.integration.test.ts`
- [ ] T083 [P] [US6] Security/egress test: Paid save triggers **zero** ad-platform outbound HTTP in `/Users/burhanbakri/Downloads/oma-ai/tests/security/strategy-paid-no-ad-egress.security.test.ts`
- [ ] T084 [P] [US6] Assert Paid DTOs reject external account/pixel/provider campaign ids in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/paid-planning-boundary.test.ts`

### Implementation

- [ ] T085 [US6] Implement Paid track PATCH (objectives, funnel, audiences, offer/angle, formats, placements, budgetAmount/Currency, allocation, expectedKpis, schedule window as planning labels, landingDestination, approvalNotes) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-plan-track.service.ts`
- [ ] T086 [US6] Enforce planning-only response markers (`planningBudget: true`, not live spend) on Paid read DTOs in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/dto/paid-track.dto.ts`
- [ ] T087 [US6] Register `strategy.paid.edit` routeRequirements in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts`
- [ ] T088 [US6] Keep production `PaidMediaConnectorPort` unused/refusing; do not wire live paid connector from strategy services in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-plan-track.service.ts`
- [ ] T089 [US10] Surface deferred ad-platform honesty error code for any accidental connect attempt path documentation in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/strategy/integration-honesty.ts` with tests in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/integration-honesty.test.ts`
- [ ] T090 [US6] Approve path must not call any paid-media adapter (assert in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-approve-no-paid-mutation.integration.test.ts`)

**Checkpoint**: Paid planning green; SC-SOP-006 egress assert green; DEC-006 remains deferred.

---

## Phase 9 — Review and package approval

**Goal**: Submit → comment/request-changes/reject/**one package approve** (DP-003-002 A); AI cannot approve; profile gate enforced.
**Independent Test**: Organic enabled + Paid disabled+rationale → one approve; no separate track approve; AI propose refuses.

### Tests (write first)

- [ ] T091 [P] [US8] Contract tests for submit/request-changes/reject/approve/comments/decisions/approval per `contracts/strategy-review-api.md` in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-review.contract.test.ts`
- [ ] T092 [P] [US2] Integration: submit **blocked** without linked Approved profile with clear reason (DP-003-001 B) in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-submit-profile-gate.integration.test.ts`
- [ ] T093 [P] [US8] Integration: package approve writes unique `StrategyApprovalRecord`; supersedes prior approved version of **same** strategy; does **not** set Brand current (DP-003-002 A / DP-003-003 B) in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-package-approve.integration.test.ts`
- [ ] T094 [P] [US8] Integration: disabled track remains disabled+rationale after package approve; no separate Paid approve endpoint required in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-package-disabled-track.integration.test.ts`
- [ ] T095 [P] [US8] Security: missing `strategy.approve` cannot package approve; AI/system principal cannot approve in `/Users/burhanbakri/Downloads/oma-ai/tests/security/strategy-approve-authz.security.test.ts`
- [ ] T096 [P] [US8] Idempotency: duplicate approve same key → exactly one approval record / one transition in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-approve-idempotency.integration.test.ts`
- [x] T096a [P] [US8] Idempotency: duplicate submit same key → exactly one `IN_REVIEW` transition / one decision row in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-submit-idempotency.integration.test.ts`
- [ ] T097 [P] [US10] Contract/integration: `POST .../ai/propose` refuses with `AI_NOT_CONFIGURED`/`AI_REFUSED` and creates no fake content in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-ai-propose.contract.test.ts`
- [ ] T098 [P] [US8] Integration: approve still requires valid Approved profile linkage at decision time in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-approve-profile-revalidate.integration.test.ts`

### Implementation

- [ ] T099 [US8] Implement `StrategyReviewService` submit (`DRAFT`→`IN_REVIEW`) using package-eligibility domain guards in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-review.service.ts`
- [x] T100 [US8] Implement request-changes / reject transitions + `StrategyReviewDecision` rows in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-review.service.ts`
- [x] T101 [US8] Implement package approve: freeze version `APPROVED`, snapshot linked profile + track enablement into `StrategyApprovalRecord`, supersede prior approved same strategy, **never** set `currentApprovedStrategyId` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-review.service.ts`
- [x] T102 [US8] Enforce human-only approve (deny AI/system actors explicitly) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-review.service.ts`
- [x] T103 [US8] Implement review controller endpoints under version path in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-review.controller.ts`
- [x] T104 [US8] Wire review controller in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/app.module.ts` + `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/container.ts` and capabilities in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts`
- [x] T105 [US10] Implement `POST .../ai/propose` calling refusing `AiProviderPort` only (no SDK) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-ai.controller.ts`; register controller in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/app.module.ts` and wire any helpers via `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/container.ts`; add route capability in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts`
- [x] T106 [US8] Single DB transaction for submit/approve: version status + decision/approval + audit + outbox row in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-review.service.ts`
- [x] T107 [US8] Optimistic concurrency: stale `rowVersion` on submit/approve → CONFLICT without applying in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-review.service.ts`
- [x] T108 [US2] Block submit when both tracks disabled or disabled track missing rationale in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-review.service.ts`

**Checkpoint**: Package approve + profile gate + AI refuse + idempotency green; Brand current unchanged on approve.

---

## Phase 10 — Immutable versions, revise/clone and comparison

**Goal**: History; revise/from-approved/clone; compare; archive; no in-place edit of approved.
**Independent Test**: Approve v1→revise→approve v2→v1 SUPERSEDED; compare shows diffs; clone never inherits approval/current.

### Tests (write first)

- [x] T109 [P] [US9] Contract tests for versions list/get, revise, from-approved, clone, compare in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-versions.contract.test.ts`
- [x] T110 [P] [US9] Integration: edit approved → rejected; revise creates new Draft with next versionNumber and no approval inheritance in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-revise.integration.test.ts`
- [x] T111 [P] [US9] Integration: approve newer version supersedes prior within same strategy only; other strategies untouched in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-supersede.integration.test.ts`
- [x] T112 [P] [US9] Integration: clone to new Strategy via `originStrategyId`; never inherits approval or Brand current in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-clone.integration.test.ts`
- [x] T113 [P] [US9] Integration/contract: compare returns foundation + Organic + Paid field diffs in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-compare.integration.test.ts`

### Implementation

- [x] T114 [US9] Implement versions list/get full package read in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-version.service.ts`
- [x] T115 [US9] Implement `revise` and `from-approved` creating new Draft copy (tracks + children) without mutating source in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-version.service.ts`
- [x] T116 [US9] Implement `clone` to new Strategy + Draft with lineage in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy.service.ts`
- [x] T117 [US9] Implement read-only compare projection API in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-compare.service.ts`
- [x] T118 [US9] Implement archive strategy command clearing Brand current if pointer matches (delegate clear to pointer rules) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy.service.ts`
- [ ] T119 [US9] Preserve comments/decisions readable across revisions (history queries) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-review.service.ts`
- [x] T120 [US9] Register compare/archive/revise/clone capabilities in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts`

**Checkpoint**: Immutability + revise/clone/compare/archive green; SC-SOP-007 covered.

---

## Phase 11 — Multiple approved strategies and current pointer

**Goal**: DP-003-003 B explicit Brand `currentApprovedStrategyId`; set/clear; concurrency; never auto-select.
**Independent Test**: Approve A+B without auto-current; set B; A remains APPROVED; archive B clears pointer.

### Tests (write first)

- [x] T121 [P] [US12] Contract tests for GET/POST `/api/v1/brands/:brandId/current-strategy` in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-current.contract.test.ts`
- [x] T122 [P] [US12] Integration: approve does not set current; set-current requires non-superseded APPROVED same brand; A stays APPROVED when B becomes current in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-current-pointer.integration.test.ts`
- [x] T123 [P] [US12] Integration: archive current strategy clears pointer; never auto-picks another (§8.4) in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-current-clear.integration.test.ts`
- [x] T124 [P] [US12] Security: cross-tenant set-current deny without leak; missing `strategy.set_current` deny; AI cannot set-current in `/Users/burhanbakri/Downloads/oma-ai/tests/security/strategy-current-authz.security.test.ts`
- [x] T125 [P] [US12] Integration: stale `brandVersion` set-current → CONFLICT; duplicate idempotency key → one pointer change in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-current-concurrency.integration.test.ts`
- [x] T126 [P] [US8] Prove `strategy.approve` does **not** imply `strategy.set_current` in capability separation test `/Users/burhanbakri/Downloads/oma-ai/tests/security/strategy-approve-vs-set-current.security.test.ts`

### Implementation

- [x] T127 [US12] Implement `StrategyCurrentService` set/clear with BrandWorkspace optimistic `version` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-current.service.ts`
- [x] T128 [US12] Implement current-strategy controller routes on brand path in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-current.controller.ts`
- [x] T129 [US12] Wire current controller in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/app.module.ts` + `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/container.ts` and `strategy.set_current` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts`
- [x] T130 [US12] Single TX: validate eligibility → bump brand version → set/clear pointer → audit → outbox `strategy.current_changed` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-current.service.ts`
- [x] T131 [US12] Emit audit `strategy.current_set` / `strategy.current_cleared` via AuditService in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-current.service.ts`

**Checkpoint**: Multi-approved + pointer SC-SOP-013 green; no auto-current.

---

## Phase 12 — Comments, audit, outbox and notifications

**Goal**: Comments; decision history; Foundation audit/outbox/notification reuse; deep-link re-auth.
**Independent Test**: Submit/approve/comment/current emit outbox; notifications resolve by capability; deep links re-authorize.

### Tests (write first)

- [ ] T132 [P] [US8] Contract tests for comments GET/POST in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/strategy-comments.contract.test.ts`
- [ ] T133 [P] [US8] Integration: review decisions list includes SUBMIT/APPROVE_PACKAGE/REJECT/REQUEST_CHANGES in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-review-decisions.integration.test.ts`
- [ ] T134 [P] [US8] Integration: submit/approve/current emit OutboxEvent types from review contract in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-outbox.integration.test.ts`
- [ ] T135 [P] [US8] Integration/security: notification recipients filtered by membership+capability; lost membership fail-closed in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-notifications.integration.test.ts`
- [ ] T136 [P] [US8] Audit coverage test for required event types (`strategy.created`, `profile_linked`, `submitted`, `approved_package`, `rejected`, `changes_requested`, `archived`, `version_superseded`, `current_set`, `current_cleared`, `track_enablement_changed`) in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-audit.integration.test.ts`

### Implementation

- [x] T137 [US8] Implement comments create/list with optional `anchorPath` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-comment.service.ts`
- [x] T138 [US8] Emit outbox `strategy.submitted` / `strategy.comment_added` / `strategy.changes_requested` / `strategy.approved` / `strategy.rejected` / `strategy.current_changed` using Foundation OutboxEvent in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-review.service.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-current.service.ts`
- [ ] T139 [US8] Ensure existing worker outbox publisher delivers strategy notifications without new strategy queue in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/outbox.publisher.ts` (extend event type allowlist only if required)
- [ ] T140 [US8] Deep-link payloads re-authorize tenant/brand/strategy on open (document + server check) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-notification.util.ts`
- [x] T141 [US8] Register `strategy.comment` capability routes in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts`
- [ ] T142 [P] [US8] Structured logs with correlation_id/tenant/brand/strategy/version on review commands in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-review.service.ts`

**Checkpoint**: Comments + audit + outbox + notifications green; no parallel notification system.

---

## Phase 13 — Next.js product surfaces and navigation

**Goal**: Strategy Workspace under Brand; canvas editors; review; versions; honesty banners; empty/loading/error/permission states.
**Independent Test**: Visible nav reaches list→create→edit→organic→paid→evidence→review→versions without API-only shortcuts for claimed UI journeys.

### Tests (write first / alongside)

- [ ] T143 [P] [US1] Component/route smoke tests for strategies list empty/loading/error/permission states in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/web-strategies-list.test.tsx`
- [ ] T144 [P] [US10] Unit test: AI unavailable + Paid planning-only banners render honesty copy in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/web-honesty-banners.test.tsx`

### Implementation

- [x] T145 [US1] Add Strategy Workspace list page with current badge + empty state in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/strategies/page.tsx`
- [x] T146 [US2] Add create strategy page (Draft allowed without Approved profile; warning) in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/strategies/new/page.tsx`
- [x] T147 [US2] Add strategy overview page with missing-profile warning / not evidence-backed state + link-profile UI in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]/page.tsx`
- [x] T148 [US3] Add foundation editor (Strategy canvas archetype; Jasper+Linear density adaptation; original OMA tokens) in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]/edit/page.tsx`
- [x] T149 [US5] Add Organic track editor page (distinct from Paid) in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]/organic/page.tsx`
- [x] T150 [US6] Add Paid planning editor with **Planning budget — not live ad spend** banner and not-connected ad honesty in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]/paid/page.tsx`
- [x] T151 [US7] Add evidence links panel page in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]/evidence/page.tsx`
- [x] T152 [US8] Add review page (submit/comments/request-changes/reject/package approve; no separate track approve) in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]/review/page.tsx`
- [x] T153 [US9] Add versions history + compare pages in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]/versions/page.tsx` and `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]/versions/compare/page.tsx`
- [ ] T154 [US12] Add set/clear current controls (capability-gated; approve does not auto-set) on overview in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/strategy/current-strategy-controls.tsx`
- [x] T155 [US1] Add Brand workspace Strategy nav/tab entry filtered by `strategy.read` in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/page.tsx` (and shell nav helper if present under `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/`)
- [ ] T156 [US10] Add shared honesty banners (AI not configured; integrations deferred) in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/strategy/honesty-banners.tsx`
- [ ] T157 [US8] Add conflict/stale-version UX for CONCURRENCY failures in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/strategy/conflict-banner.tsx`
- [ ] T158 [US2] Disable submit CTA with clear reason when Approved profile missing or tracks invalid in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/strategy/submit-eligibility.tsx`

**Checkpoint**: Navigable Strategy Workspace under Brand; Organic≠Paid panels; honesty states visible.

---

## Phase 14 — EN/AR, RTL, responsive and accessibility

**Goal**: Bilingual strategy surfaces; RTL; keyboard primary actions; responsive Organic/Paid reachability.
**Independent Test**: AR+RTL review path; keyboard submit/approve; states localized without leaking enums only.

- [x] T159 [P] [US11] Add EN/AR message keys for strategy surfaces in `/Users/burhanbakri/Downloads/oma-ai/packages/i18n/messages/en.json` and `/Users/burhanbakri/Downloads/oma-ai/packages/i18n/messages/ar.json`
- [ ] T160 [US11] Ensure strategy pages respect locale/dir and RTL layout mirrors in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(app)/app/brands/[brandId]/strategies/`
- [ ] T161 [US11] Keep Organic and Paid separately reachable on narrow viewports (no collapsed single ambiguous list) in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/strategy/track-tabs.tsx`
- [ ] T162 [US11] Keyboard access to primary create/edit/submit/approve actions + focus management on dialogs in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/strategy/`
- [ ] T163 [US11] Screen-reader labels for status badges (canonical codes English; labels localized) in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/strategy/status-badge.tsx`
- [ ] T164 [US11] Honor `prefers-reduced-motion` for strategy canvas transitions in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/strategy/`
- [ ] T165 [P] [US11] Unit/a11y smoke for empty/loading/error/permission-denied copy in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/web-a11y-states.test.tsx`
- [ ] T166 [US11] Responsive check notes for strategy canvas at 1440/1024/390 documented for Phase 16 visual pass in `/Users/burhanbakri/Downloads/oma-ai/specs/003-strategy-organic-paid-plans/checklists/requirements.md` (sync checklist item only)

**Checkpoint**: EN/AR + RTL + keyboard primary path ready for PJ-08 E2E.

---

## Phase 15 — Test data and complete manual/no-AI journeys (PJ-01–09 E2E)

**Goal**: Playwright E2E proves quickstart PJ-01–09 with **visible** UI navigation/actions.
**False-completion rules (mandatory)**:

1. E2E must drive **visible** navigation and user actions (clicks/keyboard) — not hidden DOM hacks for the claimed journey.
2. **No** `page.evaluate` (or equivalent) to activate tenant/session as a substitute for the product login/tenant UX when claiming UI journey completion.
3. **No** API shortcut replacing a claimed UI journey (API helpers allowed only to seed prerequisites, not to skip the journey under test).
4. **No** `test.skip` / conditional pass for missing seed credentials — fix seed/helpers instead.
5. Use **realistic** strategy review fixture data (foundation + tracks + rationales), not empty stubs that cannot exercise review.

### E2E / proof tasks

- [x] T167 [US2] E2E PJ-01: manual create without profile → warning → submit blocked → link Approved → submit succeeds in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/strategy-pj01-profile-gate.e2e.ts`
- [ ] T168 [US8] E2E PJ-02: Organic enabled + Paid disabled+rationale → package approve once; AI propose refuses; AI cannot approve in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/strategy-pj02-package-approve.e2e.ts`
- [ ] T169 [US12] E2E PJ-03: multi-approved + set-current + archive clears pointer without auto-select + cross-tenant deny in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/strategy-pj03-current-pointer.e2e.ts`
- [ ] T170 [US9] E2E PJ-04: immutability + revise + supersede; Brand current unchanged unless set-current in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/strategy-pj04-revise-immutability.e2e.ts`
- [ ] T171 [US1] E2E PJ-05: tenant isolation + capability deny for approve/set-current via visible UI in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/strategy-pj05-tenant-capability.e2e.ts`
- [ ] T172 [US8] E2E PJ-06: stale rowVersion conflict + duplicate approve idempotency (UI + observed single decision) in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/strategy-pj06-concurrency-idempotency.e2e.ts`
- [ ] T173 [US6] E2E PJ-07: Paid planning honesty label visible; test harness asserts zero ad-platform outbound in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/strategy-pj07-paid-planning.e2e.ts`
- [ ] T174 [US11] E2E PJ-08: EN/AR RTL + keyboard submit/approve path (required in CI, not optional) in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/strategy-pj08-i18n-a11y.e2e.ts`
- [ ] T175 [US7] E2E/integration PJ-09: linked evidence open re-checks tenant/brand authorization in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/strategy-pj09-evidence-reauth.e2e.ts`
- [ ] T176 Extend demo/seed helper for strategy fixtures without secrets in `/Users/burhanbakri/Downloads/oma-ai/tests/helpers/strategy-test.ts` (and demo seed script under `/Users/burhanbakri/Downloads/oma-ai/packages/db/` only if existing seed pattern requires it)
- [ ] T177 Assert CI strategy jobs forbid public AI/ad egress and do not skip on missing credentials in `/Users/burhanbakri/Downloads/oma-ai/.github/workflows/ci.yml`
- [ ] T178 Document false-completion audit checklist results for PJ-01–09 (visible UI, no evaluate tenant activation, no API shortcut for claimed journeys, realistic fixtures) in `/Users/burhanbakri/Downloads/oma-ai/specs/003-strategy-organic-paid-plans/checklists/requirements.md`

**Checkpoint**: PJ-01–09 green under false-completion rules; manual/no-AI journey complete.

---

## Phase 16 — Observability, quality, visual inspection, false-completion audits, certification prep

**Purpose**: Correlate logs; visual QA at 1440/1024/390; console/network/hydration clean; false-completion audits; provider-neutral certification prep — **not** live integration.

- [ ] T179 Add structured strategy correlation fields to API logs (tenant/brand/strategy/version/action) verified in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/strategy-observability.integration.test.ts`
- [ ] T180 Quality gate: run real lint/typecheck/unit/integration/security/contract/e2e commands that apply; record exact outcomes in `/Users/burhanbakri/Downloads/oma-ai/specs/003-strategy-organic-paid-plans/checklists/requirements.md`
- [ ] T181 Visual inspection pass at **1440 / 1024 / 390** for list, canvas, Organic, Paid, review (checklist or screenshot evidence) in `/Users/burhanbakri/Downloads/oma-ai/specs/003-strategy-organic-paid-plans/checklists/requirements.md`
- [ ] T182 Browser console/network/hydration audit on primary strategy routes (no unexpected errors; no vendor calls) documented in `/Users/burhanbakri/Downloads/oma-ai/specs/003-strategy-organic-paid-plans/checklists/requirements.md`
- [ ] T183 False-completion audit: re-verify Phase 15 rules against E2E sources (visible UI; no `page.evaluate` tenant activation; no API shortcut for claimed UI journeys; no credential skips; realistic fixtures) in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/strategy-*.e2e.ts`
- [ ] T184 Spec sync after durable implement discoveries (smallest artifact only) under `/Users/burhanbakri/Downloads/oma-ai/specs/003-strategy-organic-paid-plans/`
- [ ] T185 Provider-neutral certification prep checklist (`PROVIDER-NEUTRAL CORE DONE`; Phase BG still open; `LIVE-INTEGRATION READY: NO`) in `/Users/burhanbakri/Downloads/oma-ai/specs/003-strategy-organic-paid-plans/checklists/requirements.md`
- [ ] T186 Scope-boundary test forbidding calendar/Kanban/creative/publish/ad-account product surfaces in `/Users/burhanbakri/Downloads/oma-ai/tests/unit/strategy/scope-boundary.test.ts`
- [ ] T187 OpenAPI ↔ contracts alignment check after implement for `/Users/burhanbakri/Downloads/oma-ai/packages/api-client/openapi.json` vs `/Users/burhanbakri/Downloads/oma-ai/specs/003-strategy-organic-paid-plans/contracts/`
- [ ] T188 Final parent evidence-report checklist fields (scope, files, checks, decisions, gaps) in `/Users/burhanbakri/Downloads/oma-ai/specs/003-strategy-organic-paid-plans/checklists/requirements.md`

**Checkpoint**: Provider-neutral quality evidence ready; Phase BG still `[ ]`; no live vendors.

---

## Phase BG — Deferred under DEC-016 (NOT part of DoD)

**Status**: Stay `[ ]`. Excluded from provider-neutral Definition of Done. Unblock only after owning DECs + explicit final-integration authorization.

- [ ] T300 [BG] Live `AiProviderPort` adapter wiring + model/policy selection for strategy propose (blocked by `DEC-007`) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/strategy-ai.controller.ts`
- [ ] T301 [BG] Live competitor / keyword research API adapter (blocked by final integration / `DEC-016`) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/` — do not add SDKs in core
- [ ] T302 [BG] Ad-platform account connection + live spend/activation adapter (blocked by `DEC-006`) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/strategy/` — Paid budgets remain planning-only until authorized
- [ ] T303 [BG] Social publishing / scheduling connector for strategy channels (blocked by `DEC-016`) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/`
- [ ] T304 [BG] External analytics import into strategy KPIs (blocked by `DEC-016`) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/`
- [ ] T305 [BG] Provider object-storage / CDN for strategy binary artifacts (blocked by `DEC-003`) in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/`
- [ ] T306 [BG] Production AI SDK/credentials/env wiring for strategy (blocked by `DEC-007`) in `/Users/burhanbakri/Downloads/oma-ai/packages/config/src/env.ts` and `/Users/burhanbakri/Downloads/oma-ai/.env.example` — secrets never committed
- [ ] T307 [BG] Live keyword/competitor crawl jobs via BullMQ (blocked by `DEC-016`) in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/`
- [ ] T308 [BG] Reconcile deferred integration honesty banners with live connection states after adapters land in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/strategy/`
- [ ] T309 [BG] Hard-delete / legal retention productization for strategy archives (blocked by `DEC-012`) documented against `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`

## Phase dependency map

| Phase | Depends on                         | Unlocks                                    |
| ----- | ---------------------------------- | ------------------------------------------ |
| 1     | Foundation + Feature 002 available | Capabilities, helpers, folders             |
| 2     | Phase 1                            | All persistence work                       |
| 3     | Phase 1 (domain only)              | Service guards for later phases            |
| 4     | Phases 2–3                         | CRUD + profile link                        |
| 5     | Phase 4                            | Foundation editor                          |
| 6     | Phase 4                            | Audiences/competitors/evidence/gaps        |
| 7     | Phases 4–5                         | Organic track                              |
| 8     | Phases 4–5                         | Paid planning track                        |
| 9     | Phases 5–8                         | Submit + package approve                   |
| 10    | Phase 9                            | Revise/clone/compare/archive               |
| 11    | Phase 9                            | Current pointer                            |
| 12    | Phases 9–11                        | Comments/audit/outbox/notifications polish |
| 13    | API Phases 4–12                    | Web surfaces                               |
| 14    | Phase 13                           | i18n/a11y                                  |
| 15    | Phases 13–14 + API green           | PJ-01–09 E2E                               |
| 16    | Phase 15                           | Certification prep                         |
| BG    | Closed DECs + auth                 | Live integrations — **excluded from DoD**  |

Phases 5–8 may proceed in parallel after Phase 4 for different files (`[P]` where marked). Phase 3 may run parallel to Phase 2 for domain-only files.

---

## User stories → task ranges

| Story     | Label | Primary task ranges                                     |
| --------- | ----- | ------------------------------------------------------- |
| US-SOP-01 | US1   | T033–T036, T039–T041, T143, T145, T155, T171            |
| US-SOP-02 | US2   | T037–T038, T042–T048, T092, T108, T146–T147, T158, T167 |
| US-SOP-03 | US3   | T049–T057, T058, T064, T148                             |
| US-SOP-04 | US4   | T055, T059, T063, T065                                  |
| US-SOP-05 | US5   | T072–T080, T149                                         |
| US-SOP-06 | US6   | T081–T090, T150, T173                                   |
| US-SOP-07 | US7   | T060–T062, T066–T071, T151, T175                        |
| US-SOP-08 | US8   | T091–T108, T126, T132–T142, T152, T157, T168, T172      |
| US-SOP-09 | US9   | T109–T120, T153, T170                                   |
| US-SOP-10 | US10  | T031, T089, T097, T105, T144, T156, T168                |
| US-SOP-11 | US11  | T159–T166, T174                                         |
| US-SOP-12 | US12  | T121–T131, T154, T169                                   |

---

## Requirements FR-SOP / SC-SOP coverage

| Requirement IDs | Covered by (representative)                         |
| --------------- | --------------------------------------------------- |
| FR-SOP-001–005  | T033–T036, T039–T041, T171                          |
| FR-SOP-010–013  | T037–T038, T042–T048, T092, T098, T147, T158, T167  |
| FR-SOP-014–015  | T049–T057, T058–T059, T064–T065                     |
| FR-SOP-020–026  | T072–T090, T149–T150, T186                          |
| FR-SOP-030–032  | T060–T071, T151, T175                               |
| FR-SOP-033–035  | T031, T089, T097, T102, T105, T144, T156, T168      |
| FR-SOP-040–049  | T024–T029, T091–T120, T152–T153                     |
| FR-SOP-050–053  | T050, T057, T080, T096, T107, T125, T132–T142, T172 |
| FR-SOP-060–063  | T145–T166, T174, T181                               |
| FR-SOP-070–077  | T028, T101, T118, T121–T131, T154, T169             |
| SC-SOP-001      | T167, T168 (manual journey)                         |
| SC-SOP-002      | T093, T101, T110                                    |
| SC-SOP-003      | T072–T090, T149–T150                                |
| SC-SOP-004      | T035, T124, T171                                    |
| SC-SOP-005      | T097, T105, T168                                    |
| SC-SOP-006      | T083, T090, T173                                    |
| SC-SOP-007      | T113, T117, T153                                    |
| SC-SOP-008      | T159–T166, T174                                     |
| SC-SOP-009      | T062, T069, T175                                    |
| SC-SOP-010      | T096, T172                                          |
| SC-SOP-011      | T037, T092, T167                                    |
| SC-SOP-012      | T093–T094, T101, T168                               |
| SC-SOP-013      | T122–T123, T169                                     |
| NFR-SOP-001–004 | T035–T036, T007, T136, T179–T180                    |

---

## Contracts coverage

| Contract                   | Tasks                                                                        |
| -------------------------- | ---------------------------------------------------------------------------- |
| `strategy-api.md`          | T033–T048, T049–T057, T058–T071, T072–T090, T109–T120, T121–T131, T047, T187 |
| `strategy-review-api.md`   | T091–T108, T132–T142, T168                                                   |
| `strategy-capabilities.md` | T001–T002, T041, T070, T079, T087, T104, T120, T129, T141, T126              |
| `strategy-ports.md`        | T031, T089, T097, T105, T144, T156, T300–T307 (BG)                           |

---

## Quickstart PJ mapping

| Journey | Task                         |
| ------- | ---------------------------- |
| PJ-01   | T167 (also T037, T092)       |
| PJ-02   | T168 (also T093–T094, T097)  |
| PJ-03   | T169 (also T121–T125)        |
| PJ-04   | T170 (also T109–T115)        |
| PJ-05   | T171 (also T035–T036, T124)  |
| PJ-06   | T172 (also T096, T107, T125) |
| PJ-07   | T173 (also T083, T086)       |
| PJ-08   | T174 (also T159–T166)        |
| PJ-09   | T175 (also T062, T069)       |

---

## Decision gates

| Gate                     | Core tasks                                               | Blocked / BG                     |
| ------------------------ | -------------------------------------------------------- | -------------------------------- |
| DP-003-001 B             | T037–T038, T042–T044, T092, T098, T108, T147, T158, T167 | —                                |
| DP-003-002 A             | T026, T091–T094, T101, T152, T168                        | Separate track approve forbidden |
| DP-003-003 B             | T028, T101, T118, T121–T131, T154, T169                  | Auto-current forbidden           |
| DEC-016 / SR-003-016-EXT | T007, T031, T083, T089, T097, T105, T156, T177, T186     | T300–T307                        |
| DEC-007                  | Refusing AI only (T097, T105)                            | T300, T306                       |
| DEC-006                  | Paid planning only (T081–T090)                           | T302                             |
| DEC-003                  | Evidence links to 002 only (T019, T068)                  | T305                             |
| DEC-004                  | No crawl in 003                                          | — (002 owns)                     |
| DEC-012                  | Soft archive (T118)                                      | T309                             |
| US-003+                  | IDs only; T186 forbids calendar/Kanban/creative/publish  | —                                |

---

## Provider-neutral Definition of Done

A task/story is **not done** unless:

1. Real user action → API → server authz → Postgres (and Foundation outbox worker when notifying) → response → UI → refresh/re-login shows persisted result
2. Negatives covered: capability deny, cross-tenant deny, profile gate, package eligibility, immutability, pointer §8.4, concurrency CONFLICT, idempotency, AI cannot approve/set-current
3. Applicable automated tests green with **real** Postgres; fixture/refusing adapters only — not mocks-only for DB paths
4. No secrets; no live AI/ads/analytics/keyword/social SDKs; Owner DPs remain as approved options
5. Spec/plan/contracts/tasks agree after durable changes
6. Phase BG tasks remain `[ ]` and are **excluded** from provider-neutral DoD
7. E2E false-completion rules from Phase 15 hold (visible UI; no `page.evaluate` tenant activation; no API shortcut for claimed UI journeys; no credential skips; realistic fixtures)

### Security / tenant isolation gate

If strategy tenant isolation or capability suites fail → **stop**; do not start next phase.

### Spec sync gate

If implement discovers behavior not in spec/plan/contracts → update smallest artifact before continuing (`T184`).

---

## External-integration boundary

| Integration                      | Core 003                               | Phase BG               |
| -------------------------------- | -------------------------------------- | ---------------------- |
| AI propose                       | Refusing `AiProviderPort` honesty only | Live adapter T300/T306 |
| Competitor/keyword APIs          | Manual notes only                      | T301                   |
| Ad platforms / spend             | Planning fields only; zero egress      | T302                   |
| Social publishing                | Channel labels only                    | T303                   |
| External analytics               | Manual KPIs only                       | T304                   |
| Object storage                   | Not required                           | T305                   |
| Website crawl                    | Not used (Feature 002)                 | —                      |
| Calendar/Kanban/creative/publish | **Out of scope**                       | Not authorized here    |

Do **not** claim `LIVE-INTEGRATION READY` or `PRODUCTION LAUNCH READY` from this file.

---

## Constitution check (TASKS_ONLY)

| Principle                     | Tasks compliance                                              |
| ----------------------------- | ------------------------------------------------------------- |
| Product truth first           | Tasks trace FR/SC/US + Owner DPs; no inventing live vendors   |
| One SoT / no parallel tenancy | Extend Foundation + Brand Workspace; Strategy owns plans only |
| Tenant isolation              | Explicit security tasks (T035, T062, T124, T171)              |
| AI proposes / humans decide   | Manual path mandatory; AI cannot approve/set-current          |
| Traceability                  | Profile/evidence links → version → tracks → approval          |
| Explicit state machines       | Phase 3 + review transitions                                  |
| Versions integrity            | Immutability + revise/supersede tasks                         |
| Explicit integrations         | Ports + refusing only; BG deferred                            |
| Bilingual accessible UX       | Phase 14 + PJ-08                                              |
| Completion is evidence        | Phase 15–16 + PJ mapping                                      |
| Controlled cost               | No premium vendor tasks in core                               |
| Specs evolve                  | T184 sync                                                     |
| Independent design            | Strategy canvas OMA adaptation tasks (T148)                   |

---

## MVP / provider-neutral core boundary

**MVP (minimum coherent demo):** Phases 1–4 + foundation + one track + package approve + current pointer happy path with refusing AI (subset through T108 + T131 + T167/T168).

**`PROVIDER-NEUTRAL CORE DONE`:** Phases 1–16 complete; Phase BG still open; all PJ-01–09 E2E green; no live vendors.

**Not authorized by this file:** `LIVE-INTEGRATION READY`, `PRODUCTION LAUNCH READY`, calendar/Kanban/creative/publish.

---

## Notes

- Status: `IMPLEMENT_READINESS_003` **READY** — all T001–T188 (+ T096a) and T300–T309 remain `[ ]`
- Next permitted stage: **`IMPLEMENT_003`** (after explicit implement authorization)
- Baseline plan: `436a7f5` — do not reopen DP-003-001/002/003 or DEC-016 in implement
- Wiring: `container.ts` + `AppModule` controllers (brand pattern) — **no** Nest feature-module sprawl
- Reuse BrandWorkspace / ProfileVersion / EvidenceExcerpt (read/link only); AuditEvent / OutboxEvent / Notification / IdempotencyRecord
- No calendar, Kanban, creative upload, or publishing in 003
- `[P]` = parallel-safe file isolation only
- Do not mark Phase BG complete without closed decisions + explicit final-integration authorization
- Phase BG Owner policy: `DEC-016` **PRODUCT-FIRST / EXTERNAL-INTEGRATIONS-LAST** — T300–T309 stay `[ ]` and are excluded from Feature 003 completion
