# Implementation Plan: Brand Website Intelligence

**Branch**: `002-brand-website-intelligence` | **Date**: 2026-08-26 | **Spec**: [`spec.md`](./spec.md) @ `97c9218`

**Input**: Clarified feature specification (`CLARIFY_APPLY` DP-001–DP-005; slice resolutions `SR-002-004-MODE`, `SR-002-007-AI`)

**Plan status**: `APPROVED FOR TASK DECOMPOSITION` — plan remains the authority for this slice; no re-planning required
**Mode**: `TASKS_ONLY` complete, and the provider-neutral core it defines has since been implemented (`tasks.md` T001–T159 complete; Phase BG T200–T208 still blocked). The gates below continue to bind: no live crawl vendor and no live AI provider wiring until `DEC-004`/`DEC-007` close for those choices.

---

## Summary

Deliver **Brand Workspace → public HTTPS website connect → safe async crawl → evidence-backed discovery → optional AI proposal behind port → human review/approval of an immutable Brand & Product Intelligence Profile** inside the existing DEC-014 modular monolith (Next.js web + NestJS API + BullMQ worker + PostgreSQL/Prisma + Redis).

Fixed product boundaries for this plan:

- Brand Workspace is a child of Foundation Tenant (no parallel tenancy).
- **Public HTTPS crawl only** (`SR-002-004-MODE`); no commerce/API connector; `DEC-004` remains open globally.
- Crawl via **`WebsiteConnectorPort`** only; **no crawl vendor** selected.
- AI via **`AiProviderPort`** only; **no AI vendor/model/SDK/keys**; `DEC-007` remains open; AI-unavailable journey is first-class.
- Partial approval only with incompleteness disclosure + explicit confirm + audit (`FR-BWI-029a`–`029d`).
- Approved versions immutable; late results create Draft only.
- Whole-version Reject = Version approve; Insight decide = item-level only.
- Discovery tiers: `REQUIRED_FOR_APPROVAL` / `DISCOVER_WHEN_AVAILABLE` / `DEFERRED_ADVANCED`.
- `DEC-003` open → evidence = excerpts/hashes/metadata; **no** assumed object-storage full-page snapshots.

---

## Technical Context

**Language/Version**: TypeScript (strict), Node.js Active LTS — inherit `DEC-014`

**Primary Dependencies**: NestJS API, Next.js App Router web, Prisma/PostgreSQL, Redis, BullMQ, Vitest, Playwright — inherit foundation; **no new vendor SDKs** in this plan

**Storage**: PostgreSQL authoritative for brand/scan/evidence/profile; Redis/BullMQ for jobs; **no** object-storage assumption (`DEC-003` gate)

**Testing**: Vitest unit/integration/security; contract tests; Playwright E2E with **local deterministic website fixtures** (no public internet crawl in CI)

**Target Platform**: Same as foundation — bilingual responsive web + API + worker

**Project Type**: Feature slice inside modular monolith (not a new microservice)

**Performance Goals**: Scan jobs never block unrelated interactive API; progress visible while user navigates away; per-tenant crawl concurrency limits; pagination on pages/products/evidence lists

**Constraints**: Server-authoritative tenant/capability; SSRF/redirect re-validation; AI cannot approve; no live crawl/AI wiring; EN/AR + RTL/LTR + a11y

**Scale/Scope**: Multi-tenant brand workspaces; bounded public crawl; human-approved profiles for downstream slices later

---

## Constitution Check

| Principle                                | Plan compliance                                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Product truth precedes implementation | Spec + clarifications are authority; plan is `APPROVED FOR TASK DECOMPOSITION`; tasks defined; no code until implement                        |
| II. One owner / SoT                      | Brand Intelligence owns workspace/scan/evidence/profile; live website remains external; Foundation owns identity/tenant/audit/jobs primitives |
| III. Tenant isolation                    | All entities `tenantId`-scoped; workers re-authz; cross-tenant denial in quickstart                                                           |
| IV. AI proposes; humans decide           | `AiProviderPort` optional; refusing/not-configured path; human approve only                                                                   |
| V. Traceability                          | Evidence → observation → insight → profile version chain with scan/attempt ids                                                                |
| VI. Explicit state machines              | Brand / ScanAttempt / ProfileVersion / InsightReview documented separately                                                                    |
| VII. Versions integrity                  | Approved profile immutable; edits/late results → new Draft                                                                                    |
| VIII. Explicit integrations              | Ports only; no vendor SDKs; idempotent jobs + webhook-ready shape unused for public crawl                                                     |
| IX. Accessible bilingual UX              | Routes/components plan EN/AR, RTL, keyboard, reduced motion                                                                                   |
| X. Completion is evidence                | `quickstart.md` eight proof journeys                                                                                                          |
| XI. Controlled cost                      | No premium vendor; fixture crawl in CI                                                                                                        |
| XII. Specs evolve                        | Artifacts under `specs/002-...` only                                                                                                          |
| XIII. Independent design                 | DEC-013: Semrush / Jasper Brand IQ / Linear / Planable pattern roles; original OMA UI                                                         |

**Gate A:** Pass (clarified spec).
**Gate B:** Pass for **gated** architecture (ports + public-only); **Fail** if interpreted as authorizing live crawl/AI vendors.
**Gate C:** `tasks.md` drafted (`TASKS_ONLY`). **Gate D–E:** Implement deferred.

**Post-design re-check:** PASS for `APPROVED FOR TASK DECOMPOSITION` under explicit Decision Gates below.

---

## Decision Gates (must remain visible)

| Gate                  | Status            | Allowed in 002 plan/implement                                                  | Hard stop                                                                 |
| --------------------- | ----------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `SR-002-004-MODE`     | Slice affirmed    | Public HTTPS crawl product + `WebsiteConnectorPort` + **fixture/test** adapter | Production crawl **vendor** selection/wiring                              |
| `DEC-004`             | **Open globally** | Do not close; no commerce path                                                 | Commerce connector as SoT                                                 |
| `SR-002-007-AI`       | Slice affirmed    | Manual profile; optional `AiProviderPort`; test doubles in tests               | Live AI SDK/keys/third-party                                              |
| `DEC-007`             | **Open globally** | Do not close; no region/retention/cost policy as final                         | Production AI vendor                                                      |
| `DEC-003`             | Open              | Excerpts/hashes/URLs only                                                      | Full-page binary snapshot store                                           |
| `DEC-008`/`009`/`012` | Open              | Interim boundaries from spec                                                   | Agency topology / multi-step client approval / market retention as closed |

---

## Project Structure

### Documentation (this feature)

```text
specs/002-brand-website-intelligence/
├── plan.md                 # This file (APPROVED FOR TASK DECOMPOSITION)
├── research.md             # Phase 0 — future vendor options, not decisions
├── data-model.md           # Phase 1 — logical model (no Prisma migration)
├── quickstart.md           # Phase 1 — proof journeys
├── contracts/              # Phase 1 — docs only
│   ├── brand-workspace-api.md
│   ├── website-scan-api.md
│   ├── discovery-profile-api.md
│   ├── ingestion-ai-ports.md
│   └── brand-capabilities.md
├── checklists/requirements.md
├── spec.md
└── tasks.md                # TASKS_ONLY — provider-neutral core + blocked gates
```

### Source code layout (planned — create only at implement)

```text
apps/api/src/
├── brand/                  # BrandWorkspace + WebsiteSource commands/queries
│   ├── brand.controller.ts
│   ├── brand.service.ts
│   ├── website-source.service.ts
│   └── scan.controller.ts / scan.service.ts
├── intelligence/           # Profile versions, insights, approval
│   ├── profile.controller.ts
│   ├── profile.service.ts
│   └── insight.service.ts
└── discovery/              # Pages/products/evidence read APIs
    ├── discovery.controller.ts
    └── evidence.service.ts

apps/worker/src/processors/
├── ingestion.processor.ts  # queue: ingestion — crawl/extract via WebsiteConnectorPort
├── analysis.processor.ts   # queue: analysis — optional AiProviderPort proposals
└── (reuse) outbox.publisher.ts + JobRun correlation

apps/web/src/app/(app)/app/
├── brands/page.tsx
├── brands/new/page.tsx
├── brands/[brandId]/page.tsx
├── brands/[brandId]/connect/page.tsx
├── brands/[brandId]/scans/[scanId]/page.tsx
├── brands/[brandId]/discovery/pages/page.tsx
├── brands/[brandId]/discovery/products/page.tsx
└── brands/[brandId]/profiles/[versionId]/page.tsx

packages/domain/src/
├── brand/                  # states, capability codes, URL safety pure functions
└── ports/                  # extend WebsiteConnectorPort / AiProviderPort shapes as needed

packages/db/prisma/         # schema+migration ONLY at implement (not this stage)

tests/
├── fixtures/websites/      # local static fixture sites for crawl tests
├── integration/brand-*.ts
├── security/ssrf-*.ts / brand-tenant-*.ts
└── e2e/brand-intelligence.e2e.ts
```

**Structure Decision:** Extend existing apps/packages. No new deployable service. Reuse `writeOutbox` + `JobRun` + `job_run_id` Bull payload correlation from foundation mail path.

---

## Domain / Source-of-Truth map

| Domain                     | Logical owner                                                                                                    | Authoritative writer     | Storage                   | Readers          | Tenant gate                | Notes                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------- | ---------------- | -------------------------- | -------------------------- |
| Brand Workspace            | OMA Brand Intelligence (= Foundation “Website Intelligence” ownership alias; **one** SoT, not a second registry) | Brand commands           | Postgres                  | Capable members  | Active tenant + capability | Child of Foundation Tenant |
| Website Source             | OMA Brand Intelligence                                                                                           | Website connect          | Postgres                  | Capable members  | Tenant+brand               | Live site external         |
| Scan Attempt               | OMA Brand Intelligence                                                                                           | Scan commands + worker   | Postgres + BullMQ         | Capable members  | Tenant+brand               | Linked JobRun              |
| Crawl bytes                | External website                                                                                                 | External origin          | Not stored as full mirror | Connector read   | Safety policy              | Excerpts only in OMA       |
| Observations/Evidence      | OMA Brand Intelligence                                                                                           | Ingestion worker         | Postgres                  | Reviewers        | Tenant+brand               | Immutable observations     |
| AI proposals               | OMA Brand Intelligence                                                                                           | Analysis worker via port | Postgres                  | Reviewers        | Tenant+brand               | Optional; never approve    |
| Human decisions            | OMA Brand Intelligence                                                                                           | Insight/approve commands | Postgres                  | Members          | Tenant+brand               | Audit                      |
| Approved Profile Version   | OMA Brand Intelligence                                                                                           | Version approve          | Postgres                  | Downstream later | Tenant+brand               | Immutable SoT              |
| Membership/Capability      | Foundation Identity                                                                                              | Existing services        | Postgres                  | Workers re-check | Session                    | Confused-deputy prevention |
| Audit/Outbox/Notifications | Foundation                                                                                                       | Existing writers         | Postgres/Redis            | Ops/users        | Tenant                     | Reuse                      |

---

## Architecture (modular monolith)

```text
[Next.js Web] --HTTPS/cookies/CSRF--> [NestJS API]
                                         |  TX: aggregates + OutboxEvent + JobRun
                                         v
                                    [PostgreSQL]
                                         ^
[BullMQ/Redis] <--publishPendingOutbox-- [Worker]
      |                                       |
      +--> ingestion processor --> WebsiteConnectorPort (fixture/refusing/future)
      +--> analysis processor  --> AiProviderPort (refusing / test double / future)
```

**Boundaries:**

- Web: presentation, capability-filtered nav (`Intelligence` → Brands), no trust of client tenant ids.
- API: commands/queries, validation, capability gates, audit, idempotency, optimistic concurrency.
- Worker: crawl/extract/optional AI; **re-resolve membership + capabilities** before mutate; update only correlated `JobRun` / `ScanAttempt`.
- Ports: only place future vendors attach; default production = not configured / refusing until decisions close.

---

## Capability codes (planned)

Extend `packages/domain` + `CapabilitiesGuard.routeRequirements` (both required):

| Code                     | Maps to spec intent                          |
| ------------------------ | -------------------------------------------- |
| `brand.create`           | Brand create                                 |
| `brand.read`             | Brand read                                   |
| `brand.archive`          | Brand archive                                |
| `brand.website.connect`  | Website connect                              |
| `brand.scan.control`     | Scan control                                 |
| `brand.discovery.review` | Discovery review                             |
| `brand.insight.edit`     | Insight edit                                 |
| `brand.insight.decide`   | Insight decide (item only)                   |
| `brand.version.approve`  | Version approve **and** whole-version reject |

Profiles: extend `COMPANY_OWNER` / strategist-like profiles in implement; exact grants follow existing seed pattern.

---

## Job / queue design

| Queue           | Purpose                | Processor             | Payload must include                                                                                           |
| --------------- | ---------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ingestion`     | Public crawl + extract | `ingestion.processor` | `job_run_id`, `scan_attempt_id`, `tenant_id`, `brand_id`, `correlation_id`, `actor_user_id`, `idempotency_key` |
| `analysis`      | Optional AI proposals  | `analysis.processor`  | same + `profile_version_id`                                                                                    |
| `outbox` / mail | Unchanged foundation   | existing              | —                                                                                                              |

**Correlation:** Same as foundation mail — create `JobRun` + outbox in one TX with `jobRunId` in payload; Bull custom id `ingestion-{jobRunId}` / `analysis-{jobRunId}` (no `:`); worker loads by `job_run_id` only (never `findFirst` by queue+QUEUED).

**Idempotency keys (examples):**

- Start scan: `scan:start:{brandId}:{sourceVersion}:{clientKey}`
- Retry: `scan:retry:{parentAttemptId}:{clientKey}`
- Approve: `profile:approve:{versionId}` (single success)

---

## Crawl pipeline (normative plan)

1. URL normalization (HTTPS, host lowercase, strip credentials/fragments per policy).
2. User authorization attestation (checkbox) + audit.
3. Idempotent scan request → `ScanAttempt` QUEUED + `JobRun` + outbox.
4. Queue publish.
5. Worker re-authz (membership ACTIVE + `brand.scan.control`).
6. Safe URL/DNS validation (block private/link-local/metadata/localhost).
7. `robots.txt` + rate policy evaluation.
8. Fetch via `WebsiteConnectorPort` with timeouts/size limits.
9. **Re-validate every redirect target** (SSRF/DNS/host policy) — not only the first URL.
10. Content-type / size / decompression bounds.
11. Canonicalization + dedupe (canonical URL hash per brand+attempt).
12. Structured data extraction (HTML meta, JSON-LD, OG) into Observations.
13. Page / product / service classification (heuristic rules; no login bypass).
14. Evidence excerpt creation (short text + content hash; **no full mirror**).
15. Profile Draft preparation (`REQUIRED_FOR_APPROVAL` / available fields).
16. Optional AI proposal via `AiProviderPort` (skip if not configured → Partial if observations usable).
17. Human review → approve/reject per FR-BWI-029*.

**Threat controls:** SSRF, DNS rebinding, credential-in-URL, disallowed schemes/ports, redirect loops, decompression bombs, huge bodies, content-type spoofing, slowloris timeouts, crawl loops, rate abuse, cross-tenant job id guessing (tenantWhere + capability).

---

## AI-unavailable journey (must work)

| Condition                                         | ScanAttempt                                | Profile                              | User                                                    |
| ------------------------------------------------- | ------------------------------------------ | ------------------------------------ | ------------------------------------------------------- |
| AI not configured / refuses + usable observations | `Partial` (skip analysis job)              | Draft/Needs review from observations | Manual fill; AI-unavailable banner; may approve if 029a |
| AI not configured + insufficient observations     | `Failed` (skip analysis job)               | No approve                           | Actionable error                                        |
| AI configured (future)                            | Succeeded or Partial (may enter Analyzing) | May include `AI_INFERRED`            | Human dispositions required                             |

Test adapters **only in tests**. Production default: refusing / not configured.

---

## Partial approval gate (UI + API)

Approval command rejected unless:

- FR-BWI-020a required fields present.
- FR-BWI-029a–029c satisfied.
- Request includes `acknowledge_incomplete: true` when attempt is Partial.
- Response/UI previously exposed: coverage summary, failed/skipped pages, missing required, unknowns, claims lacking evidence, AI availability, version id.

Audit must store incompleteness warnings acknowledged.

---

## State machines (summary)

Full tables live in [`data-model.md`](./data-model.md). Sensitive transitions emit audit + optional notification.

| Machine        | Key transitions                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BrandWorkspace | Draft → ReadyToScan → Active; → Archived (cancel-then-archive)                                                                                                            |
| ScanAttempt    | Queued → Crawling → Extracting → (Analyzing **or skip if AI absent**) → Succeeded\|Partial\|Failed\|Cancelled; **≤1 non-terminal attempt per brand**; retry = new attempt |
| ProfileVersion | Draft → NeedsReview → Approved\|Rejected; Approved → Superseded by newer approval                                                                                         |
| InsightReview  | Proposed → Accepted\|Rejected\|Edited (item-level; Insight decide/edit)                                                                                                   |

**Mid-flight:** membership suspended / capability lost → worker sets JobRun `DEAD` / ScanAttempt `Failed` with `PERMISSION_DENIED`; no false success.

**Late result after Approved:** ignore mutate; enqueue/create new Draft tied to new attempt or “late result” draft policy — **never** patch Approved rows.

**Concurrent human edit vs late AI:** optimistic `version` / `rowVersion` on ProfileVersion; conflict → 409; no silent overwrite.

---

## UX architecture

**Archetype:** Intelligence workspace (`DEC-013`).

| Surface                         | Reference emphasis | Notes                                  |
| ------------------------------- | ------------------ | -------------------------------------- |
| Evidence / coverage / gaps      | Semrush            | Confidence, freshness, missing         |
| Brand voice / profile structure | Jasper Brand IQ    | Proposal labeling; human owns approval |
| Density, progress, side panel   | Linear             | Evidence drawer; restrained motion     |
| Multi-actor review tone         | Planable           | Collaboration patterns only            |

**Routes:** under `/app/brands/...` inside existing shell; add Intelligence nav item filtered by `brand.read`.

**Must support:** EN/AR, LTR/RTL, desktop/tablet/mobile, keyboard, focus, screen reader labels for progress, reduced motion, empty/loading/error/permission-denied, incompleteness banner.

---

## Testing strategy

| Layer          | Focus                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------- |
| Unit           | URL normalize/SSRF pure functions; state transition guards; discovery tier classification |
| DB integration | Tenant scope, unique idempotency, immutable approve, concurrent version conflict          |
| API contract   | OpenAPI shapes for brand/scan/discovery/profile                                           |
| Worker         | Job correlation, reauthz, cancel, retry, late-result, AI-not-configured                   |
| Security       | SSRF/DNS/redirect chain, cross-tenant, capability matrix                                  |
| E2E Playwright | Eight journeys in `quickstart.md` against local fixture site + real Postgres/Redis        |

**CI:** fixture HTTP server or static fixture root; **forbid** egress to public websites.

---

## Observability & operations

- Queues: `ingestion`, `analysis` (+ foundation outbox/mail).
- Logs: structured with `correlation_id`, `tenant_id`, `brand_id`, `scan_attempt_id`, `job_run_id`.
- Metrics: queue depth, attempt outcomes, pages fetched, SSRF denials, AI unavailable count, approve Partial rate.
- Alerts: dead-letter growth, per-tenant crawl budget exhaustion, worker authz failure spikes.
- Budgets: max pages/depth/duration/bytes per attempt (config); per-tenant concurrency cap.
- Health: reuse API/worker health; optional queue lag signal.
- Retention: soft delete/archive hooks; hard retention policy gated by `DEC-012`.
- Rollback: migrations reversible where possible; Approved rows never rewritten.

---

## Requirement → plan traceability (selected)

| Spec ID          | Plan locus                                       |
| ---------------- | ------------------------------------------------ |
| FR-BWI-001–005   | Domain map; data-model tenant keys               |
| FR-BWI-006a–012a | Crawl pipeline; ports; SR-002-004-MODE           |
| FR-BWI-014–019   | ScanAttempt + JobRun; contracts/website-scan-api |
| FR-BWI-020a–c    | data-model discovery tiers                       |
| FR-BWI-023–025   | Evidence entity                                  |
| FR-BWI-028a–b    | AI-unavailable; analysis processor               |
| FR-BWI-029–029d  | Approval gate; discovery-profile-api             |
| FR-BWI-032–035   | UX architecture                                  |
| SC-BWI-001–010   | quickstart proofs                                |
| NFR-BWI-*        | Testing + ops                                    |

---

## Complexity Tracking

No constitution violations. Complexity remains modular monolith + workers.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |

---

## Next stage

Plan status: `APPROVED FOR TASK DECOMPOSITION`. Tasks: [`tasks.md`](./tasks.md).

The provider-neutral core defined by this plan is implemented and verified (`PROVIDER-NEUTRAL CORE DONE`, `VISIBLE PRODUCT BASELINE DONE`). The remaining work in this slice is Phase BG, which is blocked: it needs a live crawl vendor authorization under `DEC-004` and a live AI provider decision under `DEC-007`. A waiver does not substitute for either. Nothing in this plan authorizes that wiring.
