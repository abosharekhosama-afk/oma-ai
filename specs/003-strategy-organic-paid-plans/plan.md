# Implementation Plan: Strategy — Organic & Paid Plans

**Branch**: `003-strategy-organic-paid-plans` | **Date**: 2026-09-08 | **Spec**: [`spec.md`](./spec.md) @ `7a11932`

**Input**: Owner-resolved feature specification (`DP-003-001` B, `DP-003-002` A, `DP-003-003` B; slice resolutions `SR-003-001-B`, `SR-003-002-A`, `SR-003-003-B`, `SR-003-016-EXT`, `SR-003-MANUAL`, `SR-003-PAID-PLANNING`)

**Plan status**: `READY_FOR_REVIEW` — provider-neutral technical plan only; **no** `tasks.md`, Prisma migration, or product code in this stage

---

## Summary

Deliver **Brand-scoped Strategy Workspace → manual Draft strategy → link immutable Approved Brand Profile → distinct Organic and Paid planning tracks → human package review/approve → version history/compare → explicit Brand `currentApprovedStrategyId`** inside the existing DEC-014 modular monolith (Next.js web + NestJS API + PostgreSQL/Prisma + Foundation audit/outbox/notifications). Redis/BullMQ used only via existing outbox/notification workers — **no** new crawl/AI/ad queues for 003.

Fixed product/plan boundaries:

- Strategy is a child of Feature 002 `BrandWorkspace` under Foundation `Tenant` (no parallel tenancy).
- Feature 002 remains SoT for Brand Profile versions and evidence; 003 stores **immutable pointers** only.
- **`DP-003-001` B**: Draft without Approved profile + warning; `IN_REVIEW`/Approve require linked Approved `ProfileVersion`.
- **`DP-003-002` A**: One package approval covers strategy foundation + enabled Organic/Paid track snapshots.
- **`DP-003-003` B**: Multiple approved strategies; Brand `currentApprovedStrategyId` set only by authorized humans; deterministic clear rules; never auto-select.
- **`DEC-016`**: No live AI, ads, analytics, publishing, or provider SDKs; refusing `AiProviderPort` honesty only; Paid budgets are planning records.
- Out of scope: calendar, Kanban, briefs/tasks, creative upload, publishing.

---

## Technical Context

**Language/Version**: TypeScript (strict), Node.js Active LTS — inherit `DEC-014`

**Primary Dependencies**: NestJS API, Next.js App Router web, Prisma/PostgreSQL, Redis, BullMQ (existing outbox), Vitest, Playwright — **no new vendor SDKs**

**Storage**: PostgreSQL authoritative for strategy aggregates; Brand pointer on `BrandWorkspace`; Foundation `AuditEvent` / `OutboxEvent` / `Notification` / `IdempotencyRecord` reused

**Testing**: Vitest unit/integration/security/contract; Playwright E2E manual/no-AI journeys; no public internet / no ad-platform calls in CI

**Target Platform**: Same as foundation — bilingual responsive web + API (+ existing worker for outbox)

**Project Type**: Feature slice inside modular monolith

**Performance Goals**: Interactive edits never enqueue crawl/AI jobs; list/compare usable for typical agency brand strategy counts; pagination on comments/history

**Constraints**: Server-authoritative tenant/capability; optimistic concurrency; package approval immutability; EN/AR + RTL/LTR + a11y; DEC-016 honesty states

**Scale/Scope**: Multi-tenant brands with multiple strategies; versioned planning documents; no live media delivery

---

## Constitution Check

| Principle                                | Plan compliance                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| I. Product truth precedes implementation | Spec + Owner DPs closed; plan for review; no implement until tasks authorized                                         |
| II. One owner / SoT                      | Strategy owns plans/versions; Brand Intelligence owns profiles/evidence; Foundation owns identity/tenant/audit/notify |
| III. Tenant isolation                    | All entities `tenantId`+`brandId`; set-current denies cross-tenant; workers/outbox re-authz                           |
| IV. AI proposes; humans decide           | Manual journey complete; refusing AI; AI cannot approve or set-current                                                |
| V. Traceability                          | Profile version + evidence links → strategy version → Organic/Paid tracks → future US-003 IDs only                    |
| VI. Explicit state machines              | Strategy / StrategyVersion / track enablement / current pointer documented                                            |
| VII. Versions integrity                  | Approved/IN_REVIEW immutable; revise → new Draft; package ApprovalRecord                                              |
| VIII. Explicit integrations              | Ports honesty only; no vendor SDKs; idempotent commands                                                               |
| IX. Accessible bilingual UX              | Routes/components plan EN/AR, RTL, keyboard, reduced motion                                                           |
| X. Completion is evidence                | `quickstart.md` proof journeys                                                                                        |
| XI. Controlled cost                      | No premium vendor; no live AI/ads                                                                                     |
| XII. Specs evolve                        | Artifacts under `specs/003-...` only                                                                                  |
| XIII. Independent design                 | DEC-013 Strategy canvas (Jasper + Linear); Planable for review-adjacent; original OMA UI                              |

**Gate A:** Pass (Owner-resolved spec).
**Gate B:** Pass for provider-neutral architecture under `DEC-016`.
**Gate C–E:** Deferred to `TASKS_003` / implement after plan approval.

**Post-design re-check:** PASS for `READY_FOR_REVIEW` under Decision Gates below.

---

## Decision Gates (must remain visible)

| Gate         | Status                 | Allowed in 003 plan/implement                                   | Hard stop                                                   |
| ------------ | ---------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| `DP-003-001` | **OWNER_APPROVED — B** | Draft w/o profile; review/approve require Approved profile link | Evidence-backed claim without linkage                       |
| `DP-003-002` | **OWNER_APPROVED — A** | Package approval of version + enabled tracks                    | Separate Organic/Paid approve in 003; AI approve            |
| `DP-003-003` | **OWNER_APPROVED — B** | Brand `currentApprovedStrategyId` + set-current + §8.4 clears   | Implicit auto-current; pointer superseding other strategies |
| `DEC-016`    | **RESOLVED**           | Product-first; refusing adapters; planning-only Paid            | Live AI/ads/social/analytics/keyword SDKs                   |
| `DEC-007`    | Deferred               | Honesty UI + refusing `AiProviderPort` only                     | Live AI SDK/keys/models                                     |
| `DEC-006`    | Deferred               | Paid planning fields only                                       | Ad account / live spend                                     |
| `DEC-003`    | Deferred               | Evidence links to 002 excerpts only                             | New object-storage for strategy binaries                    |
| `DEC-004`    | Deferred               | No crawl in 003                                                 | Website connector wiring in 003                             |
| US-003+      | Out of scope           | Stable IDs for future briefs/tasks                              | Calendar/Kanban/creative/publish in 003                     |

---

## Project Structure

### Documentation (this feature)

```text
specs/003-strategy-organic-paid-plans/
├── plan.md                 # This file (READY_FOR_REVIEW)
├── research.md             # Phase 0
├── data-model.md           # Phase 1 — logical model (no Prisma migration yet)
├── quickstart.md           # Phase 1 — proof journeys
├── contracts/              # Phase 1 — docs only
│   ├── strategy-api.md
│   ├── strategy-review-api.md
│   ├── strategy-capabilities.md
│   └── strategy-ports.md
├── checklists/requirements.md
├── decisions/              # Owner packets (closed)
├── spec.md
└── tasks.md                # NOT created in PLAN stage
```

### Source code layout (planned — create only at implement)

```text
apps/api/src/
├── strategy/
│   ├── strategy.module.ts
│   ├── strategy.controller.ts
│   ├── strategy.service.ts
│   ├── strategy-version.service.ts
│   ├── strategy-plan-track.service.ts
│   ├── strategy-review.service.ts
│   ├── strategy-current.service.ts
│   ├── strategy.guard-map.ts          # capability route requirements
│   └── dto/

apps/web/src/
├── app/[locale]/app/brands/[brandId]/strategies/
│   ├── page.tsx                       # list
│   ├── new/page.tsx
│   └── [strategyId]/
│       ├── page.tsx                   # overview / current badge
│       ├── edit/page.tsx              # foundation editor
│       ├── organic/page.tsx
│       ├── paid/page.tsx
│       ├── evidence/page.tsx
│       ├── review/page.tsx
│       └── versions/
│           ├── page.tsx
│           └── compare/page.tsx
├── components/strategy/               # canvas panels, track tabs, honesty banners

packages/domain/src/
├── strategy/                          # pure domain: transitions, eligibility, package approve, pointer rules
└── ports/ai-provider.port.ts          # reuse refusing adapter (no live)

packages/db/prisma/
└── schema.prisma                      # Strategy* models + BrandWorkspace.currentApprovedStrategyId (at implement)

tests/
├── unit/strategy/
├── integration/strategy/
├── security/strategy/
├── contract/strategy/
└── e2e/strategy-*.e2e.ts
```

---

## Architecture summary

```text
Web (Next.js) ──► NestJS Strategy module ──► PostgreSQL (Strategy SoT)
                         │
                         ├── read ProfileVersion / EvidenceExcerpt (002) by id + tenant/brand re-check
                         ├── CapabilityGuard (Foundation)
                         ├── IdempotencyRecord (Foundation)
                         ├── AuditEvent (Foundation)
                         └── OutboxEvent → existing worker → Notification
```

- **No new microservice.**
- **No BullMQ strategy generation queue** in 003 (manual path). Optional future AI job remains gated by `DEC-007` and is not required for completion.
- Transaction boundary for approve/submit/set-current: single DB transaction + outbox row for notifications.
- Compare is read-only projection of two immutable versions (sync API).

---

## Phase mapping (for later tasks — not tasks.md)

| Phase | Intent                                                      |
| ----- | ----------------------------------------------------------- |
| 1     | Schema + domain transitions + capabilities seed             |
| 2     | API CRUD + profile link + track editors                     |
| 3     | Submit/review/package approve + comments                    |
| 4     | Versions/compare/clone draft + set-current + archive clears |
| 5     | Web Strategy canvas EN/AR/RTL + honesty states              |
| 6     | Tests + E2E proof journeys                                  |

---

## Spec → plan traceability (high level)

| Spec area               | Plan artifact                                                |
| ----------------------- | ------------------------------------------------------------ |
| US-SOP-01–12 / FR-SOP-* | `strategy-api.md`, `strategy-review-api.md`, web routes      |
| DP-003-001 B            | Eligibility in domain + API guards + data-model link fields  |
| DP-003-002 A            | `StrategyApprovalRecord` package + review API                |
| DP-003-003 B            | `BrandWorkspace.currentApprovedStrategyId` + set-current API |
| DEC-016 / manual AI     | `strategy-ports.md` refusing AI; quickstart manual journey   |
| SC-SOP-*                | `quickstart.md` + test matrix in plan §Testing               |

---

## Testing strategy

| Layer                  | Covers                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                   | Transition guards; package eligibility; pointer §8.4 clears; Organic/Paid enable rules                                                                                |
| Integration (Postgres) | FK tenant/brand; unique indexes; optimistic concurrency; immutability after approve                                                                                   |
| Contract               | OpenAPI/route shapes in `contracts/*`                                                                                                                                 |
| Security               | Cross-tenant deny; capability matrix; AI cannot approve/set-current                                                                                                   |
| Idempotency            | Duplicate submit/approve/set-current                                                                                                                                  |
| E2E Playwright         | Manual journey; profile gate; package approve; multi-approved + set-current; archive clears pointer; revise/clone; EN/AR RTL; evidence re-auth; a11y smoke (PJ-01–09) |

CI must assert **zero** outbound ad/AI provider HTTP from strategy tests.

---

## Complexity tracking

| Topic                  | Resolution                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| Embed tracks vs tables | **Normalized track rows** + JSON for freeform sections — see `research.md`                         |
| Comments reuse         | New strategy-scoped comment/decision tables mirroring 002 review patterns — not ProfileVersion FKs |
| Worker need            | **None** beyond Foundation outbox consumer                                                         |

---

## Next stage

After plan approval: **`TASKS_003_STRATEGY_ORGANIC_PAID_PLANS`** (`/speckit-tasks`).
Do not implement until tasks are authorized.
