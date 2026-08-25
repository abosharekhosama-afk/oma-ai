# Tasks: OMA AI Platform Foundation

**Input**: Design documents from `/specs/001-oma-ai-product-foundation/`
**Baseline commit**: `9bf7525de72f76e79519f4cefce6f00a9951b691`
**Stack**: `APPROVED IMPLEMENTATION BASELINE` (`DEC-014`)
**Mode**: `TASKS_ONLY` — this file authorizes task *definitions* only; do not scaffold apps or install dependencies until `/speckit-implement` is explicitly started

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: **Mandatory** for this feature (user requirement). Write failing tests before or with the code they prove. Mocks/static pages alone never complete a journey.

**Organization**: Foundation journeys first (auth, tenant/authz, reliability, shell). Product slices US-001–US-010 from `spec.md` remain **Decision-Gated** and are not mandatory foundation execution paths.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependency)
- **[Story]**: Foundation story label `[US1]`–`[US4]` (see mapping below)
- Include exact file paths in every task

## Foundation story mapping

| Label | Foundation journey | Spec / contract / quickstart anchors |
| --- | --- | --- |
| US1 | OMA-owned auth & sessions | FR-001–010, `contracts/auth-session.md`, Q-01, Q-02 |
| US2 | Tenant, membership, capabilities | FR-001–010, `contracts/tenant-authorization.md`, Q-03–Q-06 |
| US3 | Audit, idempotency, outbox, workers | FR-009, NFR-007–010, `contracts/audit-events.md`, `jobs-outbox.md`, Q-07, Q-08, Q-10 |
| US4 | App shell, i18n, a11y, responsive | FR-115–124, DEC-013, Q-09 |

Product stories **US-001–US-010** in `spec.md` are deferred behind Decision Gates (not labeled as mandatory foundation `[USn]` tasks below).

## Path conventions (from `plan.md`)

```text
apps/web/          # Next.js
apps/api/          # NestJS HTTP
apps/worker/       # NestJS BullMQ worker
packages/domain/
packages/db/
packages/api-client/
packages/ui/
packages/i18n/
packages/observability/
packages/config/
infra/docker-compose.yml
tests/e2e/
tests/contract/
tests/security/
```

---

## Decision Gates (open `DEC-003`–`DEC-012`)

These gates **block** named later-slice work. Ports/interfaces without provider choice remain allowed in foundation phases.

| Gate ID | Decision | Blocks | Allowed now | Forbidden until resolved |
| --- | --- | --- | --- | --- |
| DG-003 | `DEC-003` | File/WorkDrive implementation | `ObjectStoragePort` / `WorkDrivePort` interfaces + `FileObjectRef` metadata | Choosing WorkDrive vs local bytes ownership; real sync |
| DG-004 | `DEC-004` | Website ingestion | `WebsiteConnectorPort` + job type stubs | Crawl/commerce connector implementation |
| DG-005 | `DEC-005` | Client commercial | No payment schema | Packages/quote/payment integration |
| DG-006 | `DEC-006` | Paid launch | `PaidMediaConnectorPort` interface | Meta create/launch/spend |
| DG-007 | `DEC-007` | Live AI | `AiProviderPort` + provenance stub | Selecting/wiring AI vendors |
| DG-008 | `DEC-008` | Multi-brand/agency | Tenant = single company workspace | Second company registry / agency model |
| DG-009 | `DEC-009` | Approval chains | Version-targeted approval command stub optional | Full approval topology product UX |
| DG-010 | `DEC-010` | Content types | Extensible type codes only | First-release content/channel catalog |
| DG-011 | `DEC-011` | Client progress map | Projection port stub | Client-visible state mapping |
| DG-012 | `DEC-012` | Retention/legal | Retention policy interface | Market-specific retention/billing rules |

**Security/tenant isolation gate:** If any security or cross-tenant isolation test fails, **stop** — do not start the next foundation phase.

**Spec sync gate:** If implementation discovers behavior not in `spec.md`/`plan.md`/`contracts/`, update the smallest authoritative artifact before continuing (do not silently diverge).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: pnpm monorepo, TypeScript, quality tooling, safe local env scaffolding (no product domain yet)

- [ ] T001 Create monorepo root manifests and workspace config in `/Users/burhanbakri/Downloads/oma-ai/package.json`, `/Users/burhanbakri/Downloads/oma-ai/pnpm-workspace.yaml`, and `/Users/burhanbakri/Downloads/oma-ai/.npmrc` matching `plan.md` apps/packages layout
- [ ] T002 [P] Add root TypeScript base config in `/Users/burhanbakri/Downloads/oma-ai/tsconfig.base.json` with `strict` true and path aliases for `@oma/*` packages
- [ ] T003 [P] Add ESLint flat config in `/Users/burhanbakri/Downloads/oma-ai/eslint.config.mjs` and Prettier config in `/Users/burhanbakri/Downloads/oma-ai/.prettierrc`
- [ ] T004 [P] Add Vitest workspace config in `/Users/burhanbakri/Downloads/oma-ai/vitest.workspace.ts` covering `apps/*` and `packages/*`
- [ ] T005 [P] Add Playwright config skeleton in `/Users/burhanbakri/Downloads/oma-ai/playwright.config.ts` with projects for EN and AR locales
- [ ] T006 Create empty app package scaffolds with READMEs only describing entrypoints in `/Users/burhanbakri/Downloads/oma-ai/apps/web/package.json`, `/Users/burhanbakri/Downloads/oma-ai/apps/api/package.json`, and `/Users/burhanbakri/Downloads/oma-ai/apps/worker/package.json` (scripts stubbed; frameworks wired in later tasks)
- [ ] T007 [P] Create shared package scaffolds in `/Users/burhanbakri/Downloads/oma-ai/packages/{domain,db,api-client,ui,i18n,observability,config}/package.json` with package names `@oma/*`
- [ ] T008 [P] Add Compose for Postgres + Redis only in `/Users/burhanbakri/Downloads/oma-ai/infra/docker-compose.yml` and `/Users/burhanbakri/Downloads/oma-ai/infra/README.md` (no cloud vendor choice)
- [ ] T009 [P] Add env schema and example without secrets in `/Users/burhanbakri/Downloads/oma-ai/packages/config/src/env.ts` and `/Users/burhanbakri/Downloads/oma-ai/.env.example`
- [ ] T010 [P] Add root `.gitignore` entries for `node_modules/`, `.env`, coverage, Playwright artifacts in `/Users/burhanbakri/Downloads/oma-ai/.gitignore` without ignoring required Spec Kit paths
- [ ] T011 Document local bootstrap commands in `/Users/burhanbakri/Downloads/oma-ai/README.md` (link to `specs/001-oma-ai-product-foundation/quickstart.md`; no production hosting)

**Checkpoint**: Workspace files exist; `pnpm` install is possible when implement starts; no domain logic yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB, API conventions, observability, security middleware shells — MUST complete before US1–US4 feature work

**⚠️ CRITICAL**: No user-story domain endpoints until this phase passes its checkpoint tests

- [ ] T012 Define Prisma schema foundations (User/Session/Tenant/Membership stubs deferred to stories) and generator config in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma`
- [ ] T013 Add Prisma client wrapper `PrismaService` pattern in `/Users/burhanbakri/Downloads/oma-ai/packages/db/src/prisma.service.ts` and export from `/Users/burhanbakri/Downloads/oma-ai/packages/db/src/index.ts`
- [ ] T014 [P] Implement ULID/UUIDv7 id helper in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ids.ts`
- [ ] T015 [P] Implement API error envelope types and mapper in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/errors.ts` per `contracts/api-conventions.md`
- [ ] T016 [P] Implement correlation-id utilities in `/Users/burhanbakri/Downloads/oma-ai/packages/observability/src/correlation.ts`
- [ ] T017 [P] Implement structured logger factory (pino) in `/Users/burhanbakri/Downloads/oma-ai/packages/observability/src/logger.ts`
- [ ] T018 Bootstrap NestJS API app module and main bootstrap in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/main.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/app.module.ts` with global ValidationPipe
- [ ] T019 [P] Add health controllers `GET /api/v1/health/live` and `GET /api/v1/health/ready` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/health/health.controller.ts`
- [ ] T020 [P] Add OpenAPI/Swagger setup for `/api/v1` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/openapi.ts`
- [ ] T021 Add global exception filter returning error envelope + correlation id in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/filters/domain-exception.filter.ts`
- [ ] T022 [P] Add request logging + correlation middleware in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/middleware/correlation.middleware.ts`
- [ ] T023 [P] Add rate-limit guard skeleton configurable via env in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/rate-limit.guard.ts`
- [ ] T024 Bootstrap NestJS worker app entry in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/main.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/worker.module.ts` with BullMQ root config
- [ ] T025 Bootstrap Next.js App Router shell entry in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/layout.tsx` and `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/page.tsx` with placeholder only (no fake product dashboards)
- [ ] T026 Configure Next.js rewrites proxy `/api/*` to API origin in `/Users/burhanbakri/Downloads/oma-ai/apps/web/next.config.ts` (same-origin topology)
- [ ] T027 Write failing contract test for health + error envelope shape in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/health-and-errors.contract.test.ts`
- [ ] T028 Write failing integration test that ready probe fails when DB is unreachable in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/health-ready.integration.test.ts`

**Checkpoint**: API boots; live/ready work; proxy path documented; foundational contract/integration tests green. **Do not proceed if health/security scaffolding tests fail.**

---

## Phase 3: User Story 1 — OMA Auth & Sessions (Priority: P1) 🎯 MVP

**Goal**: Independent OMA register/login/logout/session persistence without IMKAN SSO (`DEC-002`, `DEC-014`)

**Independent Test**: Q-01 and Q-02 in `quickstart.md` pass with real API + Postgres (refresh/re-login persistence)

### Tests for US1 (mandatory — write first; must fail before implementation)

- [ ] T029 [P] [US1] Contract tests for auth endpoints in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/auth-session.contract.test.ts` covering register/login/logout/me per `contracts/auth-session.md`
- [ ] T030 [P] [US1] Integration tests for session persistence and revoke in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/auth-session.integration.test.ts` (Q-01, Q-02)
- [ ] T031 [P] [US1] Security tests for CSRF rejection on state-changing requests without token in `/Users/burhanbakri/Downloads/oma-ai/tests/security/csrf.security.test.ts`
- [ ] T032 [P] [US1] Unit tests for password hashing and session token hashing in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/auth/password.test.ts` and `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/auth/session-token.test.ts`

### Implementation for US1

- [ ] T033 [US1] Add Prisma models `User` and `Session` in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma` and migration under `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/migrations/`
- [ ] T034 [US1] Implement password hashing helpers in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/auth/password.ts`
- [ ] T035 [US1] Implement session token issue/hash/verify helpers in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/auth/session-token.ts`
- [ ] T036 [US1] Implement `IdentityModule` services in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/identity/identity.service.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/identity/session.service.ts`
- [ ] T037 [US1] Implement auth controllers for register/login/logout/me/password-change in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/identity/auth.controller.ts`
- [ ] T038 [US1] Implement cookie session + CSRF double-submit (or synchronized token — pick one and document) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/identity/session-cookie.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/csrf.guard.ts`
- [ ] T039 [US1] Implement `AuthGuard` loading user from session cookie hash in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/auth.guard.ts`
- [ ] T040 [US1] Add account recovery request/confirm stubs with hashed tokens in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/identity/recovery.controller.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/identity/recovery.service.ts` (delivery via `MailProviderPort` console adapter only — no ESP vendor)
- [ ] T041 [US1] Add `MailProviderPort` interface and console adapter in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/mail-provider.port.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/mail/console-mail.adapter.ts`
- [ ] T042 [US1] Build auth screens login/register in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(auth)/login/page.tsx` and `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/(auth)/register/page.tsx` calling same-origin `/api/v1`
- [ ] T043 [US1] Add Playwright E2E for Q-01/Q-02 in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/auth-session.e2e.ts` including refresh persistence and negative logout reuse

**Checkpoint**: US1 independently demonstrable. **Security gate:** CSRF + session revoke tests must pass before US2.

---

## Phase 4: User Story 2 — Tenant, Membership, Capabilities (Priority: P1)

**Goal**: Server-authoritative tenant context, invitations, suspend/remove, capability profiles/catalog, bootstrap (`FR-001`–`010`)

**Independent Test**: Q-03–Q-06 pass; cross-tenant IDOR denied without existence leak

### Tests for US2 (mandatory — write first)

- [ ] T044 [P] [US2] Contract tests for tenant/membership/capability routes in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/tenant-authorization.contract.test.ts`
- [ ] T045 [P] [US2] Integration tests for invite/accept/suspend/remove in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/membership-lifecycle.integration.test.ts` (Q-03)
- [ ] T046 [P] [US2] Integration tests for authorized tenant switch and unauthorized switch denial in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/tenant-switch.integration.test.ts` (Q-04)
- [ ] T047 [P] [US2] Security tests for cross-tenant resource access in `/Users/burhanbakri/Downloads/oma-ai/tests/security/cross-tenant-isolation.security.test.ts` (Q-05)
- [ ] T048 [P] [US2] Unit tests for capability evaluation deny-by-default in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/authz/capabilities.test.ts` (Q-06)
- [ ] T049 [P] [US2] Integration tests for each foundation capability profile expansion in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/capability-profiles.integration.test.ts`

### Implementation for US2

- [ ] T050 [US2] Add Prisma models `Tenant`, `Membership`, `Invitation`, `CapabilityProfile`, `CapabilityGrant` in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma` + migration
- [ ] T051 [US2] Seed system capability catalog + default profiles in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/seed.ts` using codes from `plan.md`
- [ ] T052 [US2] Implement capability evaluator in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/authz/capabilities.ts`
- [ ] T053 [US2] Implement `TenantContext` resolver (session-only authority) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/tenant/tenant-context.service.ts`
- [ ] T054 [US2] Implement `CapabilitiesGuard` / `@RequireCapabilities()` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/guards/capabilities.guard.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/decorators/require-capabilities.decorator.ts`
- [ ] T055 [US2] Implement tenant create (`platform.tenant.create`) and active-tenant switch in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/tenant/tenant.controller.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/tenant/tenant.service.ts`
- [ ] T056 [US2] Implement invitations + membership suspend/remove in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/tenant/membership.controller.ts` and `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/tenant/membership.service.ts`
- [ ] T057 [US2] Implement capability assign/profile attach endpoints in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/tenant/capability.controller.ts`
- [ ] T058 [US2] Implement Platform Owner bootstrap CLI/script (non-self-serve) in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/bootstrap/bootstrap-platform-owner.ts` documenting ops steps in `/Users/burhanbakri/Downloads/oma-ai/infra/README.md`
- [ ] T059 [US2] Enforce tenant predicate helper for queries in `/Users/burhanbakri/Downloads/oma-ai/packages/db/src/tenant-scope.ts` and use it in membership/tenant repositories
- [ ] T060 [US2] Add web tenant switcher UI in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/shell/tenant-switcher.tsx` calling switch API only for authorized memberships
- [ ] T061 [US2] Add Playwright E2E for Q-03–Q-06 in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/tenant-authz.e2e.ts` including negative cross-tenant and capability denial

**Checkpoint**: US2 complete. **Isolation gate:** cross-tenant security suite must be green before US3.

---

## Phase 5: User Story 3 — Audit, Idempotency, Outbox, Workers (Priority: P1)

**Goal**: Privileged-action audit, idempotent commands, transactional outbox, BullMQ workers that re-authz tenant/capability

**Independent Test**: Q-07, Q-08, Q-10 pass with real Redis + Postgres

### Tests for US3 (mandatory — write first)

- [ ] T062 [P] [US3] Contract tests for audit list endpoint in `/Users/burhanbakri/Downloads/oma-ai/tests/contract/audit-events.contract.test.ts`
- [ ] T063 [P] [US3] Integration tests for idempotent invitation create in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/idempotency.integration.test.ts` (Q-07)
- [ ] T064 [P] [US3] Integration tests for outbox publish + worker success/retry/dead in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/outbox-worker.integration.test.ts` (Q-08)
- [ ] T065 [P] [US3] Security tests that worker rejects jobs when membership suspended mid-flight in `/Users/burhanbakri/Downloads/oma-ai/tests/security/worker-reauthz.security.test.ts`
- [ ] T066 [P] [US3] Integration tests for optimistic concurrency conflict `409 CONFLICT_VERSION` in `/Users/burhanbakri/Downloads/oma-ai/tests/integration/concurrency.integration.test.ts`
- [ ] T067 [P] [US3] Unit tests for outbox dispatcher state machine in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/jobs/outbox.test.ts`

### Implementation for US3

- [ ] T068 [US3] Add Prisma models `AuditEvent`, `IdempotencyRecord`, `OutboxEvent`, `JobRun`, `Notification` in `/Users/burhanbakri/Downloads/oma-ai/packages/db/prisma/schema.prisma` + migration
- [ ] T069 [US3] Implement append-only audit writer in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/audit/audit.service.ts` and `GET /api/v1/audit-events` in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/audit/audit.controller.ts`
- [ ] T070 [US3] Wire audit calls into login, tenant switch, membership, capability changes in the respective services under `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/`
- [ ] T071 [US3] Implement idempotency interceptor/middleware in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/common/interceptors/idempotency.interceptor.ts`
- [ ] T072 [US3] Implement transactional outbox writer helper in `/Users/burhanbakri/Downloads/oma-ai/packages/db/src/outbox.ts`
- [ ] T073 [US3] Implement outbox publisher processor in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/outbox.processor.ts`
- [ ] T074 [US3] Implement mail job processor using `MailProviderPort` with tenant/actor re-check in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/mail.processor.ts`
- [ ] T075 [US3] Implement notification materializer from outbox events in `/Users/burhanbakri/Downloads/oma-ai/apps/worker/src/processors/notification.processor.ts` and read API in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/notifications/notifications.controller.ts`
- [ ] T076 [US3] Implement job status read/cancel endpoints in `/Users/burhanbakri/Downloads/oma-ai/apps/api/src/jobs/jobs.controller.ts`
- [ ] T077 [US3] Add Playwright E2E covering invite→mail job→notification path and correlation header propagation in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/jobs-outbox.e2e.ts` (Q-08, Q-10)

**Checkpoint**: US3 complete; worker re-authz and idempotency proven.

---

## Phase 6: User Story 4 — App Shell, Design Tokens, EN/AR, A11y (Priority: P1)

**Goal**: Independent OMA shell under `DEC-013` with EN/AR, LTR/RTL, keyboard, reduced motion, responsive foundations (`FR-115`–`124`)

**Independent Test**: Q-09 passes; axe critical violations = 0 on auth + shell routes

### Tests for US4 (mandatory — write first)

- [ ] T078 [P] [US4] Unit tests for locale/dir resolution in `/Users/burhanbakri/Downloads/oma-ai/packages/i18n/src/locale.test.ts`
- [ ] T079 [P] [US4] Playwright a11y + keyboard smoke for login and shell in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/a11y-shell.e2e.ts`
- [ ] T080 [P] [US4] Playwright EN/AR + RTL/LTR shell tests in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/i18n-rtl.e2e.ts` (Q-09)
- [ ] T081 [P] [US4] Playwright responsive viewport smoke (mobile/desktop) in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/responsive-shell.e2e.ts`

### Implementation for US4

- [ ] T082 [P] [US4] Add design tokens CSS variables from design strategy working inputs in `/Users/burhanbakri/Downloads/oma-ai/packages/ui/src/tokens.css`
- [ ] T083 [P] [US4] Add EN/AR message catalogs in `/Users/burhanbakri/Downloads/oma-ai/packages/i18n/messages/en.json` and `/Users/burhanbakri/Downloads/oma-ai/packages/i18n/messages/ar.json`
- [ ] T084 [US4] Implement i18n provider + `dir` attribute wiring in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/app/layout.tsx` and `/Users/burhanbakri/Downloads/oma-ai/packages/i18n/src/index.ts`
- [ ] T085 [US4] Implement shell chrome (left rail capability-filtered, top context, endorsement “OMA AI by IMKAN”) in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/shell/app-shell.tsx`
- [ ] T086 [US4] Implement permission-denied and empty membership states in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/shell/permission-denied.tsx` and `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/components/shell/empty-membership.tsx`
- [ ] T087 [US4] Add reduced-motion CSS and motion tokens in `/Users/burhanbakri/Downloads/oma-ai/packages/ui/src/motion.css`
- [ ] T088 [US4] Ensure shell routes require auth and active tenant where needed in `/Users/burhanbakri/Downloads/oma-ai/apps/web/src/middleware.ts`

**Checkpoint**: US4 complete; Q-09 green. Visual system remains original (no reference pixel copying).

---

## Phase 7: Connector & AI Ports (Provider-Agnostic Only)

**Purpose**: Boundaries for later slices — **no provider selection**

- [ ] T089 [P] Add `AiProviderPort` and provenance types in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/ai-provider.port.ts` (DG-007)
- [ ] T090 [P] Add `ObjectStoragePort` and `WorkDrivePort` in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/object-storage.port.ts` and `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/workdrive.port.ts` (DG-003)
- [ ] T091 [P] Add `WebsiteConnectorPort` in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/website-connector.port.ts` (DG-004)
- [ ] T092 [P] Add `PaidMediaConnectorPort` in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/paid-media-connector.port.ts` (DG-006)
- [ ] T093 [P] Add retention policy interface stub in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/retention-policy.port.ts` (DG-012)
- [ ] T094 [P] Document ports in `/Users/burhanbakri/Downloads/oma-ai/specs/001-oma-ai-product-foundation/contracts/connector-ports.md` including `MailProviderPort` reference (no vendor)
- [ ] T095 [P] Unit tests asserting ports have no concrete vendor imports in `/Users/burhanbakri/Downloads/oma-ai/packages/domain/src/ports/ports.boundary.test.ts`

### Explicitly out of mandatory path (Decision-Gated — do not schedule as foundation MVP)

- [ ] T096 **BLOCKED by DG-004 (`DEC-004`)** — Website ingestion implementation for product US-001 (no task work until decision)
- [ ] T097 **BLOCKED by DG-003 (`DEC-003`)** — WorkDrive byte sync implementation
- [ ] T098 **BLOCKED by DG-007 (`DEC-007`)** — Live AI provider integration
- [ ] T099 **BLOCKED by DG-006 (`DEC-006`)** — Meta campaign launch/spend
- [ ] T100 **BLOCKED by DG-005 (`DEC-005`)** — Pricing/payment ledger
- [ ] T101 **BLOCKED by DG-008–DG-012** — Multi-brand, approval topology productization, content-type catalog, client progress map, retention policy productization

---

## Phase 8: Polish, Verification Matrix & Spec Sync

**Purpose**: Cross-cutting proof, docs, false-completion prevention

- [ ] T102 [P] Generate/update OpenAPI artifact committed or CI-produced at `/Users/burhanbakri/Downloads/oma-ai/packages/api-client/openapi.json` and typed client stub in `/Users/burhanbakri/Downloads/oma-ai/packages/api-client/src/index.ts`
- [ ] T103 Add backup/restore and rollback runbook notes (vendor-neutral) in `/Users/burhanbakri/Downloads/oma-ai/infra/ops-runbook.md`
- [ ] T104 [P] Add CI workflow skeleton running lint, typecheck, unit, integration, contract, security, e2e in `/Users/burhanbakri/Downloads/oma-ai/.github/workflows/ci.yml` (no cloud deploy)
- [ ] T105 Execute full `quickstart.md` scenario automation index in `/Users/burhanbakri/Downloads/oma-ai/tests/e2e/quickstart-index.e2e.ts` mapping Q-01–Q-10
- [ ] T106 Run false-completion audit checklist and record results in `/Users/burhanbakri/Downloads/oma-ai/specs/001-oma-ai-product-foundation/checklists/foundation-verification.md`
- [ ] T107 Spec sync: update `/Users/burhanbakri/Downloads/oma-ai/specs/001-oma-ai-product-foundation/plan.md` and `/Users/burhanbakri/Downloads/oma-ai/specs/001-oma-ai-product-foundation/data-model.md` with any durable deviations discovered during implementation
- [ ] T108 Confirm `DEC-003`–`DEC-012` remain open in `/Users/burhanbakri/Downloads/oma-ai/specs/001-oma-ai-product-foundation/spec.md` and no provider was selected in code review notes under `/Users/burhanbakri/Downloads/oma-ai/specs/001-oma-ai-product-foundation/checklists/foundation-verification.md`

**Final checkpoint**: Foundation MVP (US1–US4 + ports) verified with real persistence; blocked product slices untouched.

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Phase 1 Setup** → no deps
2. **Phase 2 Foundational** → after Phase 1; **blocks** US1–US4
3. **Phase 3 US1 Auth** → after Phase 2; **MVP**
4. **Phase 4 US2 Tenant** → after US1 security gate
5. **Phase 5 US3 Reliability** → after US2 isolation gate
6. **Phase 6 US4 Shell** → after US1 (can partially parallel with US3 if staffed; needs auth)
7. **Phase 7 Ports** → after Phase 2; safe parallel with US3/US4
8. **Phase 8 Polish** → after US1–US4 + ports

### Parallel Opportunities

- Phase 1: T002–T005, T007–T010
- Phase 2: T014–T017, T019–T020, T022–T023
- US1 tests T029–T032; US2 tests T044–T049; US3 tests T062–T067; US4 tests T078–T081
- Phase 7 ports T089–T095
- US4 tokens/messages T082–T083 while US3 processors land (different trees)

### Within each story

Tests (failing) → models/migrations → domain services → API → web → E2E proof

---

## Coverage Map

| Requirement / acceptance | Tasks |
| --- | --- |
| FR-001–FR-010 identity/tenant | T029–T061, T069–T070 |
| FR-009 / FR-104 audit | T062, T068–T070 |
| FR-115–FR-124 shell/design | T078–T088 |
| NFR-001–002, CSRF/cookies | T031, T038–T039, T043 |
| NFR-007–010 idempotency/jobs | T063–T076 |
| NFR-016–020 i18n/a11y | T078–T088 |
| NFR-021–024 observability/health | T016–T019, T022, T077, T103 |
| `contracts/api-conventions.md` | T015, T020–T021, T027, T102 |
| `contracts/auth-session.md` | T029–T043 |
| `contracts/tenant-authorization.md` | T044–T061 |
| `contracts/audit-events.md` | T062, T068–T070 |
| `contracts/jobs-outbox.md` | T064–T076 |
| `contracts/connector-ports.md` | T089–T095 |
| Q-01–Q-02 | T030, T043 |
| Q-03–Q-06 | T045–T049, T061 |
| Q-07–Q-08 | T063–T064, T077 |
| Q-09 | T080–T081, T084–T087 |
| Q-10 | T019, T028, T077 |
| DEC-014 stack baseline | T001–T026 |
| DEC-003–012 remain open | T096–T101 gates, T108 |

---

## Implementation Strategy

### MVP (Platform Foundation)

1. Phase 1 + 2
2. US1 Auth (stop and validate Q-01/Q-02 + CSRF)
3. US2 Tenant/authz (stop and validate isolation suite)
4. US3 Audit/jobs
5. US4 Shell i18n/a11y
6. Ports only (Phase 7)
7. Phase 8 verification

### Definition of Done (prevents false completion)

A foundation task/story is **not done** unless:

1. Real user action → API → server authz → Postgres/Redis mutation → response → UI → refresh/re-login shows persisted result
2. Negative paths exist (CSRF fail, capability deny, cross-tenant deny, suspended membership, idempotency reuse, worker re-authz fail)
3. Applicable automated tests are green in CI locally (not mocks-only)
4. No secrets committed; no IMKAN SSO dependency; no provider chosen for open DECs
5. Spec/plan/contracts still agree (`T107`/`T108`)

### Security / tenant isolation gate

**Fail-closed:** If `tests/security/cross-tenant-isolation.security.test.ts` or CSRF suite fails, do not merge or start the next phase.

---

## Notes

- `[P]` = different files, no incomplete dependency on unfinished sibling work
- Blocked tasks T096–T101 are **not** part of mandatory foundation execution
- Do not implement product US-001–US-010 journeys in this feature’s mandatory path
- `DEC-001`, `DEC-002`, `DEC-013`, `DEC-014` must not be renumbered or contradicted
