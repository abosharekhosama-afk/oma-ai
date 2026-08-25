# Research: OMA AI Platform Foundation

**Feature:** `001-oma-ai-product-foundation`
**Date:** 2026-08-25
**Mode:** `PLAN_ONLY`
**Status:** `APPROVED IMPLEMENTATION BASELINE`
**Stack status:** `APPROVED IMPLEMENTATION BASELINE` (`DEC-014`) — installed and verified under DEC-014 (see plan Implementation Sync Notes) until implementation is authorized

## 1. Repository inspection summary

| Fact                   | Evidence                                                               |
| ---------------------- | ---------------------------------------------------------------------- |
| Repo                   | `/Users/burhanbakri/Downloads/oma-ai`                                  |
| Remote                 | `origin` → `https://github.com/burhanbakri1-spec/oma-ai.git`           |
| Prior commit on `main` | `356153b` — Spec Kit + OMA foundation overlay only                     |
| Product code           | None (`src/`, manifests, schemas absent)                               |
| Spec Kit               | `specify 1.0.1`, integration `cursor-agent` installed                  |
| Planning branch        | `001-oma-ai-product-foundation`                                        |
| Authority              | `AGENTS.md`, constitution v0.2.0, `spec.md`, `DEC-013` design strategy |

## 2. Approved technical stack (`APPROVED IMPLEMENTATION BASELINE`)

### Decision (`DEC-014` — RESOLVED)

Adopt a **TypeScript modular monolith** with separately runnable workers as the platform-foundation implementation baseline:

| Layer            | Proposal                                                                                                         | Role                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Language         | TypeScript (strict) on **Node.js Active LTS** (22.x at planning time; pin exact LTS at implement)                | One language across API, workers, and web contracts |
| Monorepo         | **pnpm** workspaces                                                                                              | Shared packages without premature microservices     |
| API              | **NestJS** (stable 11.x line) + Fastify adapter                                                                  | Modular domains, guards, pipes, OpenAPI, DI         |
| Web              | **Next.js App Router** (stable current major at implement)                                                       | App shell, EN/AR, LTR/RTL, SSR/CSR hybrid           |
| Persistence      | **PostgreSQL** (16+; prefer current stable minor at implement)                                                   | Multi-tenant relational SoT for OMA domains         |
| Data access      | **Prisma** Migrate + Client                                                                                      | Typed schema, migrations, reviewable SQL            |
| Cache/queue      | **Redis** + **BullMQ**                                                                                           | Jobs, retries, backoff, scheduled work              |
| Workers          | Separate NestJS worker process(es) sharing domain modules                                                        | Ingestion, AI jobs, connectors, outbox dispatch     |
| Auth (OMA-owned) | Server-side **session cookies** (HttpOnly, Secure, SameSite) + hashed credentials; sessions stored in PostgreSQL | Tenant-safe session lifecycle without IMKAN SSO     |
| Validation       | Zod (shared) + Nest ValidationPipe / DTO boundaries                                                              | Trust-boundary validation                           |
| API docs         | OpenAPI 3 via Nest Swagger                                                                                       | Contract generation for web + E2E                   |
| Observability    | Structured JSON logs (pino), OpenTelemetry traces, Prometheus-compatible metrics                                 | Correlation IDs end-to-end                          |
| Testing          | Vitest (unit/integration), Playwright (E2E + a11y/RTL journeys), Pact or OpenAPI contract checks                 | Real journey proof                                  |
| Local runtime    | Docker Compose for Postgres + Redis only                                                                         | Apps run on host Node unless later decided          |
| Secrets          | Environment + secret manager interface; never in git                                                             | NFR-002/005                                         |

### Rationale

1. Matches constitution gates: modular ownership, server-authoritative authz, durable jobs, bilingual web.
2. NestJS modules map cleanly to SoT domains (Identity, Tenant, Audit, Jobs, Connectors, Design System shell).
3. Separately runnable workers support ingestion/AI/connectors without splitting deployables prematurely.
4. TypeScript end-to-end reduces contract drift between API and Next.js.
5. PostgreSQL + sessions supports deny-by-default multi-tenancy and auditable membership better than client-only JWT authority.
6. Avoids unnecessary microservices and cloud lock-in; deployment topology remains deferred.

### Alternatives considered

| Alternative                                                    | Why not preferred now                                                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Python FastAPI + React/Next**                                | Excellent for AI/workers, but dual-language contracts and shared DTO/types cost more for a bilingual product shell + modular domains in one team. |
| **Next.js full-stack only (Route Handlers + in-process jobs)** | Faster prototype; weaker isolation for long-running ingestion/AI and harder worker scaling; Nest modules give clearer domain boundaries.          |
| **Rails + Sidekiq + Hotwire**                                  | Strong monolith, weaker fit for modern design-system/React density (Linear/Planable patterns) and typed shared contracts.                         |
| **Early microservices / Kubernetes-first**                     | Violates “avoid premature infrastructure”; no evidence of scale needing network boundaries yet.                                                   |
| **Auth0 / Clerk / IMKAN SSO as primary identity**              | Conflicts with resolved `DEC-002` (OMA-owned identity). Future federation is a separate adapter.                                                  |

### Deferred deployment choices (not guessed)

- Exact cloud vendor, region, managed Postgres/Redis SKUs
- Container orchestration (Compose vs managed App Service/ECS/K8s)
- CDN, WAF, and object-storage product for non-WorkDrive staging bytes
- Exact OTEL backend and log sink
- Exact Node LTS minor and Nest/Next major pins at first lockfile (created only after plan approval + `/speckit-tasks`)

## 3. Architecture research findings

### 3.1 Process boundaries

```text
Browser (Next.js)
  → HTTPS → API (NestJS modular monolith)
              ↳ PostgreSQL (authoritative OMA state)
              ↳ Redis (queue/cache)
              ↳ Outbox table → Worker(s) → connectors / AI providers / email
```

- **Web** owns presentation, locale/dir, keyboard UX; never owns authorization truth.
- **API** owns authn/authz, tenant resolution, domain commands, idempotency, audit writes.
- **Workers** re-load tenant/capability context per job; never trust job payload alone for authority.

### 3.2 Authentication and session

- Email/password (or magic-link later) is an implementation detail; foundation requires OMA-owned `User`, `Session`, password/credential secrets hashed at rest.
- Session cookie identifies session row; server loads user + memberships + active tenant grant.
- **Topology:** same-origin reverse proxy so the browser uses one site origin; `/api` proxied to NestJS; host-only session cookie; CSRF token on mutating browser calls (`SameSite=Lax` alone is insufficient).
- Active tenant selection is a **server-side session attribute** after membership check; client may _request_ switch among already-authorized tenants only (`FR-002`).
- Logout/suspend/remove membership invalidates future access immediately (`FR-006`).
- First Platform Owner and `platform.tenant.create` bootstrap are controlled ops procedures (see `plan.md`).

### 3.3 Authorization

- Capability grants on membership (profile templates assign grants; checks use grant codes).
- Every handler: authenticate → resolve tenant from session → capability gate → tenant-scoped query.
- Cross-tenant IDs return indistinguishable denial (`FR-008`).

### 3.4 Idempotency, concurrency, outbox

- Mutating APIs accept `Idempotency-Key` where double-submit risk exists.
- Domain aggregates carry `version` / `updated_at` for optimistic concurrency.
- Domain events written in the same DB transaction as state change (transactional outbox); workers publish/process asynchronously.

### 3.5 AI, files, connectors (adapter-only while DECs open)

| Concern                     | Foundation boundary                                                            | Blocked until |
| --------------------------- | ------------------------------------------------------------------------------ | ------------- |
| AI provider                 | `AiProviderPort` + provenance record schema; no live provider                  | `DEC-007`     |
| File bytes                  | `ObjectStoragePort` + metadata/version refs; no WorkDrive ownership assumption | `DEC-003`     |
| Website ingest              | `WebsiteConnectorPort` + job skeleton                                          | `DEC-004`     |
| Pricing/billing             | Commercial domain module stub only                                             | `DEC-005`     |
| Meta launch                 | `PaidMediaConnectorPort` + campaign intent placeholders                        | `DEC-006`     |
| Multi-brand/agency topology | Tenant model supports one company now; extensibility notes only                | `DEC-008`     |
| Approval topology details   | Generic approval command framework                                             | `DEC-009`     |
| Content types/channels      | Extensible enums; no first-release list                                        | `DEC-010`     |
| Client-visible mapping      | Projection interface; no concrete map                                          | `DEC-011`     |
| Retention/legal             | Retention policy interface + default “retain until policy set”                 | `DEC-012`     |

## 4. Design-system / shell research (`DEC-013`)

- Plan foundation **token + shell architecture** only; do not implement a pixel library until design-system tasks are authorized after stack approval.
- Light operational workspace + dark review canvas as contextual surfaces.
- Working tokens from `docs/DESIGN_REFERENCE_STRATEGY.md` remain **validation inputs** (contrast/EN/AR/RTL pending).
- i18n: message catalogs EN/AR; `dir=ltr|rtl` from locale; no duplicated visual systems from functional references.

## 5. Threat boundaries (foundation)

| Threat                                | Control                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| Tenant ID spoofing                    | Ignore client tenant as authority; session membership only                   |
| Session fixation / CSRF               | Rotate session on login; SameSite cookies; CSRF strategy for cookie sessions |
| Privilege escalation via profile name | Check capability codes, not job titles                                       |
| Cross-tenant IDOR                     | Mandatory tenant predicate on all queries; negative tests                    |
| Secret leakage                        | Secret store; redaction in logs; no secrets in specs/prompts                 |
| SSRF on future crawl                  | Connector allowlist/block private nets (slice gate `DEC-004`)                |
| Upload malware                        | Type/size/scan policy at boundary (slice gate `DEC-003`)                     |
| Worker confused deputy                | Re-authorize actor/tenant/capability inside job handler                      |

## 6. Open decisions — safe planning boundaries

| DEC       | Blocks                        | Safe foundation boundary                                                                          | Must answer before        |
| --------- | ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------- |
| `DEC-003` | File/WorkDrive implementation | Metadata + `ObjectStoragePort` / `WorkDrivePort` interfaces; no byte-ownership schema assumptions | File/WorkDrive slice plan |
| `DEC-004` | Ingestion plan                | `WebsiteConnectorPort` + ingestion job states only                                                | Intelligence slice plan   |
| `DEC-005` | Client commercial plan        | No payment ledger schema; request entity stubs only                                               | Portal commercial slice   |
| `DEC-006` | Paid launch                   | Campaign intent + connector port; no spend mutation                                               | Paid slice plan           |
| `DEC-007` | Live AI                       | Provider port + provenance fields; no vendor lock                                                 | AI technical plan         |
| `DEC-008` | Multi-company agency UX       | Single tenant↔company binding for foundation; note future mapping table                           | Company-structure slice   |
| `DEC-009` | Exact approval chains         | Version-targeted approval command API                                                             | Workflow hardening slice  |
| `DEC-010` | Content-type specifics        | Extensible type codes                                                                             | Production content slice  |
| `DEC-011` | Client status labels          | Projection port                                                                                   | Client portal slice       |
| `DEC-012` | Retention/legal               | Policy interface                                                                                  | Compliance/ops readiness  |

Resolved and binding: `DEC-001`, `DEC-002`, `DEC-013`.

## 7. Research verdict

The stack above is **`APPROVED IMPLEMENTATION BASELINE`** under `DEC-014`. `/speckit-tasks` may generate foundation `tasks.md`. Dependency installation and application scaffolding remain deferred until the user explicitly starts `/speckit-implement`. `DEC-003`–`DEC-012` stay open; no vendor for AI, WorkDrive bytes, crawl mode, Meta launch, pricing, or production email/hosting is chosen here.
