# Implementation Plan: OMA AI Platform Foundation

**Branch**: `001-oma-ai-product-foundation` | **Date**: 2026-08-25 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `/specs/001-oma-ai-product-foundation/spec.md`

**Plan status**: `DRAFT FOR APPROVAL`
**Stack status**: `PROPOSED FOR APPROVAL` (see [`research.md`](./research.md))
**Mode**: `PLAN_ONLY` — no product code, no dependency install, no `tasks.md`

## Summary

Deliver the **independent OMA AI platform foundation**: repository layout, modular API + web + worker boundaries, OMA-owned authentication/sessions, tenant/company membership and capabilities, server-authoritative authorization, audit, transactional outbox/jobs, API conventions, design-system/shell architecture under resolved `DEC-013`, i18n/a11y foundations, and adapter ports for AI/files/connectors — without implementing later product slices or resolving `DEC-003`–`DEC-012`.

## Technical Context

**Language/Version**: TypeScript (strict) on Node.js Active LTS — **PROPOSED FOR APPROVAL**

**Primary Dependencies**: NestJS (API/workers), Next.js App Router (web), Prisma, PostgreSQL, Redis, BullMQ, Zod, Playwright, Vitest — **PROPOSED FOR APPROVAL**

**Storage**: PostgreSQL as OMA authoritative state; Redis for queues/cache; object-storage adapter interface only (byte ownership deferred — `DEC-003`)

**Testing**: Vitest unit/integration; OpenAPI contract checks; Playwright E2E including EN/AR, RTL/LTR, a11y, tenant negative paths

**Target Platform**: Responsive bilingual web application (desktop-first operational UX, mobile-usable required journeys) + Linux-compatible API/worker processes

**Project Type**: Modular monolith web product (API + web + workers in one repo)

**Performance Goals**: Interactive API p95 budgets TBD with volume baselines (`NFR-012`); boards/search must paginate (`NFR-013`); long jobs never block unrelated interactive work (`NFR-014`)

**Constraints**: No IMKAN ONE identity/SSO dependency (`DEC-002`); deny-by-default multi-tenancy; AI cannot self-approve; no external spend without authorized command; secrets never in git; EN/AR + RTL/LTR mandatory

**Scale/Scope**: Multi-company SaaS foundation; first pilot may be single company but isolation required from day one

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Foundation plan compliance |
| --- | --- |
| I. Product truth precedes implementation | Spec remains authority; stack is proposed, not installed; `DEC-003`–`012` not silently closed |
| II. One owner / SoT per domain | Domain map in this plan + `data-model.md`; adapter ports for external SoTs |
| III. Tenant isolation & least privilege | Session-derived tenant; capability gates; cross-tenant negative E2E required |
| IV. AI proposes; humans decide | `AiProviderPort` + provenance; no auto-approval paths |
| V. Traceability | ID conventions and future link fields reserved; foundation entities carry correlation IDs |
| VI. Explicit state machines | Job/session/membership states defined; product workflow machines remain in spec for later slices |
| VII. Files/versions integrity | Metadata/version refs only; approved-version immutability as invariant for later deliverables |
| VIII. Explicit integrations | Connector ports + idempotency/webhook/reconcile contracts |
| IX. Accessible bilingual UX | i18n/dir/a11y/reduced-motion foundations in shell architecture |
| X. Completion is evidence | `quickstart.md` E2E proofs for auth/tenant/permission |
| XI. Controlled cost/agents | Modular monolith; no premium services assumed |
| XII. Specs evolve | Plan artifacts under `specs/001-...`; templates untouched for product truth |
| XIII. Independent coherent design | `DEC-013` hierarchy; original OMA tokens; no IMKAN ONE visual copy |

**Gate A (Definition ready):** Pass — product spec + checklist ready for foundation plan.
**Gate B (Architecture ready):** Conditionally pass pending **user approval** of this draft stack/architecture.
**Gate C–E:** Not applicable until `/speckit-tasks` and implementation.

**Post-design re-check:** Phase 1 artifacts stay within foundation scope; no schemas assume unresolved commercial/file/AI vendor answers. **PASS for DRAFT FOR APPROVAL.**

## Project Structure

### Documentation (this feature)

```text
specs/001-oma-ai-product-foundation/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   ├── api-conventions.md
│   ├── auth-session.md
│   ├── tenant-authorization.md
│   ├── audit-events.md
│   ├── jobs-outbox.md
│   └── connector-ports.md
├── checklists/
│   └── requirements.md
├── spec.md
└── tasks.md             # NOT created in PLAN_ONLY
```

### Source Code (repository root) — planned layout only

```text
apps/
├── web/                 # Next.js App Router (shell, i18n, locale/dir)
├── api/                 # NestJS HTTP API
└── worker/              # NestJS BullMQ processors (shared domain libs)

packages/
├── domain/              # Pure domain types, state machines, capability codes
├── db/                  # Prisma schema + migrations
├── api-client/          # Generated/typed client from OpenAPI
├── ui/                  # Design tokens, primitives, shell chrome (OMA original)
├── i18n/                # EN/AR message catalogs + locale utilities
├── observability/       # Logging/tracing helpers, correlation ID
└── config/              # Env schema (Zod), feature flags interface

infra/
├── docker-compose.yml   # Postgres + Redis for local only (when implemented)
└── README.md            # Portability notes; cloud choices deferred

tests/
├── e2e/                 # Playwright journeys
├── contract/            # OpenAPI / consumer contracts
└── security/            # Cross-tenant & permission suites
```

**Structure Decision:** Single pnpm monorepo with three runnable apps (`web`, `api`, `worker`) and shared packages. No microservices. Paths above are **planned**; directories must not be created until implementation is authorized.

## Complexity Tracking

> No constitution violations requiring justification. Complexity stays at modular monolith + workers as required by the user.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| — | — | — |

## Architecture summary

### Runtime topology

1. **Web** authenticates via API session cookie; never trusts local storage for tenant authority.
2. **API** modules: `Identity`, `Tenant`, `Membership`, `Capability`, `Audit`, `Jobs`, `Notifications` (skeleton), `Connectors` (ports only), `Health`.
3. **Worker** consumes queues: mail, outbox dispatch, future ingestion/AI/connector jobs.
4. **PostgreSQL** stores users, sessions, tenants, memberships, grants, audit, outbox, idempotency keys.
5. **Redis** backs BullMQ; not a source of truth for domain state.

### Domain / source-of-truth map (foundation)

| Domain | Logical owner | Storage owner | Authoritative writer | Readers | Tenant gate | Permission gate | Events | Consumers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| User account | OMA Identity | OMA Postgres | Identity module | Self, Platform Owner (audited) | N/A (user-global) | account.* | `user.created/updated` | Tenant membership, audit |
| Session | OMA Identity | OMA Postgres | Identity module | Owning user only | Bound memberships | session.* | `session.created/revoked` | API authn |
| Tenant/Company | OMA Tenant | OMA Postgres | Tenant module | Members | Tenant id from session | tenant.manage | `tenant.created/updated` | All domain modules |
| Membership | OMA Tenant | OMA Postgres | Tenant module | Tenant admins; self limited | Tenant id | membership.* | `membership.*` | Authz, notifications |
| Capability grant | OMA Authz | OMA Postgres | Tenant module | Authz middleware | Tenant id | capability.assign | `capability.changed` | All commands |
| Audit event | OMA Security | OMA Postgres (append-only) | Audit writer | Authorized auditors | Tenant-scoped when applicable | audit.read | n/a | Compliance, support |
| Outbox/job | OMA Platform | Postgres + Redis queue | Emitting module / worker | Operators | Re-resolved in worker | job.admin | `job.*` | Workers, observability |
| Notification (skeleton) | Originating domain (event) | OMA Postgres notification store | Origin command writes outbox; Notification consumer materializes recipient rows | Recipient (tenant-safe) | Tenant + visibility re-check on read/deep link | notification.read | `notification.*` | Web UI, mail worker |
| Object bytes | TBD `DEC-003` | External via port | Storage adapter | Authorized via OMA gate | Tenant binding | file.* | `file.sync.*` | Production later |
| AI generation | OMA AI governance | OMA Postgres provenance | AI module via port | Authorized roles | Tenant | ai.generate | `ai.*` | Strategy later |
| External connectors | Adapter boundary | Provider + OMA projection | Connector adapters | Scoped modules | Tenant-bound connection | connector.* | `connector.*` | Sync/reconcile |

Future IMKAN federation: external subject/company **mapping table** only; canonical OMA IDs unchanged (`FR-010`).

### Foundation component → requirement mapping

| Component | Primary FR / NFR / US |
| --- | --- |
| Session auth + logout/suspend | FR-001–FR-010, NFR-001–002 |
| Tenant context resolution | FR-001–FR-002, FR-008 |
| Membership invite/suspend/remove | FR-004–FR-007 |
| Capability checks | FR-003, §10 matrix (foundation subset) |
| Audit trail | FR-009, FR-104, NFR-006 |
| Idempotency + concurrency | FR-046 pattern, NFR-007–008 |
| Outbox / jobs | NFR-009–010, NFR-021–022 |
| API conventions | NFR-025–027, §11 style for connectors |
| App shell + tokens | FR-115–FR-124, DEC-013, NFR-016–020 |
| i18n/RTL/a11y | NFR-016–020, FR-123 |
| AI port + provenance | FR-106–FR-114 (boundary only), DEC-007 open |
| Storage/connector ports | FR-076–FR-095 (ports only), DEC-003/004/006 open |
| Security tests | M-010, Gate III, DoD §18 |
| Observability/health | NFR-021–024 |
| E2E proof | US patterns + DoD; `quickstart.md` |

### Authentication & tenant threat model (foundation)

See `research.md` §5 and `contracts/auth-session.md` / `tenant-authorization.md`.

### Web ↔ API session topology (chosen for this draft)

- **Same-origin reverse proxy** in all environments that serve the product UI: browser talks only to the site origin; `/api/*` is proxied to the NestJS API.
- Session cookie `Path=/; HttpOnly; Secure` (non-local); `SameSite=Lax`.
- CSRF: double-submit or synchronized token required on cookie-authenticated state-changing requests from the web app.
- Credentialed cross-origin CORS between separate web/API hostnames is **not** the foundation default (avoids fragile cross-site cookie setups). Local Next.js rewrites emulate the same-origin path.

### Tenant naming rule (foundation)

For this foundation, **Tenant = the single company workspace** identity. Do not introduce a separate Company registry until `DEC-008` defines multi-brand/agency topology.

### Foundation capability catalog (machine codes)

| Code | Intent | Typical profiles |
| --- | --- | --- |
| `tenant.manage` | Update tenant profile/settings | Company Owner, Platform Owner (scoped) |
| `membership.invite` | Invite members | Company Owner / Production Manager if granted |
| `membership.manage` | Suspend/remove members | Company Owner |
| `capability.assign` | Grant/revoke capability codes | Company Owner |
| `audit.read` | Read tenant audit events | Company Owner, Platform Owner |
| `job.read` | Read job status for tenant | Managers / actor-owned jobs |
| `notification.read` | Read own notifications | Any member |
| `platform.tenant.create` | Create tenants (bootstrap/platform) | Platform Owner |
| `platform.support.access` | Break-glass cross-tenant support (audited) | Platform Owner only |

Runtime authorization checks **codes**, never job titles (`FR-003`). Profiles expand to codes via `CapabilityProfile` bundles (`data-model.md`).

### Bootstrap & Platform Owner acceptance

1. Controlled bootstrap creates the first Platform Owner user (out-of-band ops procedure; never open self-serve platform elevation).
2. Platform Owner with `platform.tenant.create` creates tenant #1 and an initial Company Owner membership.
3. Further tenants follow the same capability; normal users cannot mint platform capabilities.
4. Break-glass `platform.support.access` requires explicit grant + mandatory audit (`FR-005`).

### Required E2E proofs (foundation)

1. Register/login → session cookie → refresh → still authenticated.
2. Logout / session revoke → protected API denied.
3. Membership suspend/remove → immediate denial after refresh.
4. Authorized tenant switch among memberships; unauthorized tenant id rejected.
5. Cross-tenant resource access by guessed UUID → denial without existence leak.
6. Capability missing → action denied; audit recorded for privileged attempts where required.
7. Re-login restores only authorized tenant context; no stale elevated grants.

## Design-system architecture (foundation only)

- **Packages/ui**: CSS variables for working tokens; light workspace + dark `reviewCanvas`; status tokens never sole signal.
- **Shell**: left rail IA from design strategy (capability-filtered), top context (company, search, create, notifications, profile), right contextual panel pattern (Linear density).
- **Endorsement**: product chrome may show approved **“OMA AI by IMKAN”** endorsement without adopting IMKAN ONE visuals.
- **Motion**: 120–180 ms micro; 180–240 ms panel/route; `prefers-reduced-motion` respected.
- **Originality**: no copying Planable/Linear/Frame.io/IMKAN ONE assets or full layouts.
- **Implementation of full component library** waits for approved stack + design-system tasks; this plan only freezes architecture rules.

### Foundation screens (FR-124)

| Archetype | Primary reference behavior | OMA adaptation | Represented SoT / state | A11y / i18n |
| --- | --- | --- | --- | --- |
| Auth (login/register) | Linear calm density | Original OMA branding; no third-party auth chrome | Session ACTIVE/REVOKED; credential errors | EN/AR, LTR/RTL, keyboard, visible focus, non-color errors |
| Persistent product shell / Home | Linear shell + Planable content priority later | Capability-filtered rail; empty/denied nav items hidden or disabled with explanation | Active tenant from session; membership ACTIVE | Same + skip link; reduced motion |
| Tenant / company context switcher | Linear workspace switcher pattern | Lists only authorized memberships; server switch command | `session.active_tenant_id` + Membership | Announces active company; RTL-safe menu |
| Permission-denied / empty foundation states | Linear clarity | Actionable next step; no cross-tenant leakage | `PERMISSION_DENIED` / empty membership | Localized `message_key` |

## Testing strategy

| Layer | Scope |
| --- | --- |
| Unit | Domain transitions, capability evaluation, idempotency key handling |
| Integration | API + Postgres (testcontainers or Compose); session + tenant predicates |
| Contract | OpenAPI stability for auth/tenant/audit/jobs |
| E2E | Playwright journeys in `quickstart.md` |
| A11y/RTL | axe + manual RTL smoke; keyboard paths for shell |
| Security | Cross-tenant suite mandatory for merge of authz code |
| Visual | Deferred lightweight screenshot gates after UI tokens land |

## Local development & operations (planned)

- `.env.example` schema only after tasks authorize scaffolding (not in this commit).
- Compose: Postgres + Redis.
- Migrations via Prisma; expand/contract rules for zero-downtime later.
- Health: `/health/live`, `/health/ready` (DB + Redis).
- Backup/restore objectives documented as ops requirements; vendor backup product deferred.
- Rollback: previous image + migrate down only when safe; prefer forward fixes for prod.

## Delivery boundary for later `/speckit-tasks`

Foundation tasks may scaffold monorepo, identity/tenant/audit/jobs, shell i18n skeleton, and ports.
Foundation tasks must **not** implement WorkDrive sync, website crawl, Meta launch, pricing, or live AI providers while their DECs remain open.

## Open decisions reminder

`DEC-003`–`DEC-012` remain open with safe boundaries in `research.md` §6.
`DEC-001`, `DEC-002`, `DEC-013` resolved and binding.
