# Research: Strategy — Organic & Paid Plans

**Feature**: `003-strategy-organic-paid-plans`
**Date**: 2026-09-08
**Status**: Phase 0 complete for provider-neutral plan
**Authority**: [`spec.md`](./spec.md), Owner DPs, `DEC-014`, `DEC-016`, Feature 002 implemented patterns

No external reference discovery was required. DEC-013 Strategy canvas roles reuse repository authority (`docs/DESIGN_REFERENCE_STRATEGY.md`).

---

## R1 — Where does Strategy live?

**Decision:** Nested NestJS `strategy` module + domain package under existing modular monolith; web routes under Brand Workspace.

**Rationale:** Matches Feature 002 brand module placement; preserves one deployable boundary (`DEC-014`).

**Alternatives rejected:** Separate microservice; storing strategy inside `ProfileVersion.sectionsJson` (wrong SoT; blocks Organic/Paid distinctness and versioning).

---

## R2 — Organic/Paid storage shape

**Decision:** `StrategyOrganicTrack` and `StrategyPaidTrack` as **1:1 child rows** of `StrategyVersion`, plus JSON columns for extensible field bags where lists are nested (pillars detail, allocation breakdown). Structured first-class columns for enablement, budget amount/currency, cadence, horizon.

**Rationale:** Enforces distinct tracks at DB/API; supports package snapshot immutability; avoids collapsing into one typed list (FR-SOP-025).

**Alternatives rejected:** Single `plans` table with `type` discriminator only (too easy to UX-collapse); all-JSON blob (weak constraints/indexes).

---

## R3 — Brand Profile linkage

**Decision:** `StrategyVersion.linkedApprovedProfileVersionId` nullable on Draft; required non-null and must reference `ProfileVersion` with `status=APPROVED`, same `tenantId`/`brandId`, before `IN_REVIEW`/Approve. Optional `draftProfileVersionId` for drafting aid never satisfies gate.

**Rationale:** Owner `DP-003-001` B; mirrors Brand pointer discipline without mutating 002.

---

## R4 — Current strategy pointer

**Decision:** Add `BrandWorkspace.currentApprovedStrategyId` (nullable FK logical to `Strategy.id`) with `version` concurrency already on BrandWorkspace. Set/clear via dedicated command; approve does not set; archive of current strategy clears pointer in same transaction.

**Rationale:** Owner `DP-003-003` B; parallels `currentApprovedProfileVersionId`.

**Alternatives rejected:** Option A single-approved-only; Option C no pointer.

---

## R5 — Package approval record

**Decision:** `StrategyApprovalRecord` 1:1 with approved `StrategyVersion`; stores actor, capability code, comment, enabled-track snapshot flags, linked profile version id, unknowns acknowledgment. No per-track approval rows in 003.

**Rationale:** Owner `DP-003-002` A.

---

## R6 — Async jobs / BullMQ

**Decision:** No new strategy generation/crawl queues. Use Foundation outbox → existing worker for notifications only.

**Rationale:** Manual/no-AI journey; DEC-016; avoid Redis contention with brand scans.

---

## R7 — AI boundary

**Decision:** Reuse refusing `AiProviderPort`. Strategy surfaces show AI not-configured. No `GENERATING` required for SC success. Do not add AI SDK deps.

**Rationale:** `SR-003-MANUAL`, `DEC-007` deferred, `DEC-016`.

---

## R8 — Comments & activity

**Decision:** `StrategyComment` and `StrategyReviewDecision` tables keyed by `strategyVersionId` (and optional field path). Reuse notification types via outbox; do not write into Feature 002 `ReviewDecision`.

**Rationale:** Separate SoT; same UX patterns as 002 without FK entanglement.

---

## R9 — UX information architecture

**Decision:** Strategy canvas with tabs/panels: Foundation | Organic | Paid | Evidence | Risks/KPIs | Review. List page shows current badge from Brand pointer. Honesty banners for missing profile, AI unavailable, Paid planning-only.

**Rationale:** DEC-013 Strategy canvas; Linear density; no Planable calendar (out of scope).

---

## R10 — Retention / archive / delete

**Decision:** Soft-archive Strategy (`ARCHIVED`) and versions remain readable per capability. Hard delete out of scope pending `DEC-012`. Archiving strategy that is current clears Brand pointer (deterministic).

**Rationale:** Spec §8.4; Foundation retention open.

---

## Open technical items deferred to tasks/implement (non-product)

- Exact Prisma migration ordering and seed profile grant matrix wording
- OpenAPI generator wiring details
- Component library primitives under existing web design tokens

None reopen Owner decisions.
