# Quickstart Validation Guide — Strategy Organic & Paid Plans

**Feature:** `003-strategy-organic-paid-plans`
**Status:** provider-neutral plan validation (manual/no-AI; no live ads)
**Purpose:** Prove 003 behavior locally and in CI after implement — planning artifact now; execute post-tasks.

## Prerequisites (implement-time)

- Feature 002 Brand Workspace with ability to create an **Approved** Brand Profile (fixture path)
- Foundation bootstrap user + capabilities including strategy.* grants
- `pnpm dev:local` (API + web; worker for outbox/notifications)
- Migrations applied when strategy schema lands (not in PLAN stage)

## Proof journeys

### PJ-01 — Manual create without profile (DP-003-001 B)

1. Brand with **no** Approved profile (or do not link).
2. Create strategy Draft → succeeds with warning / missing-source; **not** labeled evidence-backed.
3. Attempt submit → **blocked**.
4. Create/approve Brand Profile in 002; link Approved version → submit succeeds.

### PJ-02 — Package approve (DP-003-002 A)

1. Enable Organic; disable Paid with rationale; complete required fields.
2. Submit → review → one Approve.
3. Version `APPROVED`; Organic snapshot included; Paid remains disabled+rationale; **no** separate Paid approve step.
4. AI propose endpoint refuses; AI cannot approve.

### PJ-03 — Multi approved + current pointer (DP-003-003 B)

1. Approve Strategy A; approve Strategy B.
2. Approve does **not** auto-set current.
3. Set current → B (`strategy.set_current`); A remains `APPROVED`.
4. Archive B while current → pointer **cleared**; A not auto-selected.
5. Cross-tenant set-current → deny without leak.

### PJ-04 — Immutability & revise

1. Edit approved version → rejected/conflict.
2. Create Draft from approved → edit → submit → approve → prior version `SUPERSEDED` within same strategy; Brand current unchanged unless set-current used.

### PJ-05 — Tenant & capability

1. Other tenant strategy id → deny.
2. Missing `strategy.approve` → cannot package approve.
3. Missing `strategy.set_current` → cannot change pointer.

### PJ-06 — Concurrency / idempotency

1. Stale `rowVersion` patch → `CONFLICT`.
2. Duplicate approve with same idempotency key → one approval record.

### PJ-07 — Paid planning honesty

1. Enter budget → UI shows planning-only label.
2. Test suite asserts zero ad-platform outbound calls.

### PJ-08 — EN/AR RTL + a11y smoke

1. Switch AR + RTL; complete submit/approve keyboard path.
2. Empty/loading/error/permission states understandable.

**CI:** Include PJ-08 locale/RTL smoke in Playwright (not optional).

### PJ-09 — Evidence re-auth

1. Open linked Feature 002 evidence → re-checks tenant/brand authorization.

**CI:** Include PJ-09 in integration or E2E security path.

## CI expectations

- Unit + integration + security + contract + Playwright covering **PJ-01–PJ-09**.
- `DEC-016` compliance: no AI/ad SDK dependencies added for 003.

## Out of scope checks (must remain absent)

Calendar, Kanban, creative upload, publish, live Meta, live AI success path.
