# Quickstart Validation Guide — Platform Foundation

**Feature:** `001-oma-ai-product-foundation`
**Status:** `DRAFT FOR APPROVAL`
**Purpose:** Define how foundation behavior will be proven after implementation.
**Not:** runnable commands today (no app scaffold yet).

## Prerequisites (when implemented)

- Approved stack from `plan.md` / `research.md`
- Local Postgres + Redis via Compose
- `apps/api`, `apps/web`, `apps/worker` running
- Seed disabled in production; test fixtures isolated per run

## Scenario Q-01 — Register, login, refresh persistence

1. Register user A; login.
2. Call `GET /api/v1/auth/me` → 200 with user id.
3. Refresh browser; repeat `me` → still authenticated.
4. Restart API process; session cookie still valid until expiry.

**Expect:** Session row durable in Postgres; cookie HttpOnly.

## Scenario Q-02 — Logout and revoke

1. Login; logout.
2. `me` → `401 UNAUTHENTICATED`.
3. Reuse old cookie → denied.

## Scenario Q-03 — Tenant membership gate

1. Create tenant T1; user A active member with `tenant.manage`.
2. Invite user B; B accepts → `ACTIVE`.
3. Set active tenant T1 for A and B.
4. Suspend B; B’s next API call with T1 context → denied; A unaffected.

## Scenario Q-04 — Authorized tenant switch

1. User A active in T1 and T2.
2. Switch active tenant T1 → T2 succeeds; audit event written.
3. Request switch to T3 (no membership) → denied; active tenant unchanged.

## Scenario Q-05 — Cross-tenant isolation

1. Create resource id R1 in T1 (foundation: e.g. invitation or connection stub).
2. As user in T2, `GET` R1 by id → denial without confirming existence.
3. Direct DB-level tests assert queries include `tenant_id` predicate.

## Scenario Q-06 — Capability deny-by-default

1. Member without `capability.assign` attempts grant change → `403`.
2. Privileged action still emits audit when attempted/succeeded per policy.

## Scenario Q-07 — Idempotent command

1. `POST` invitation with `Idempotency-Key: K1` twice → one membership invite.
2. Same key different body hash → `409 IDEMPOTENCY_KEY_REUSE`.

## Scenario Q-08 — Outbox + worker

1. Perform membership invite that enqueues mail job.
2. Worker processes job; JobRun `SUCCEEDED`.
3. Kill worker mid-flight; restart; no duplicate invite; mail consumer idempotent.

## Scenario Q-09 — EN/AR and RTL shell smoke

1. Set locale `ar`; root `dir=rtl`; critical shell chrome readable.
2. Set locale `en`; `dir=ltr`.
3. Keyboard tab order reaches primary nav and tenant switcher.
4. `prefers-reduced-motion` disables nonessential transitions.

## Scenario Q-10 — Health and correlation

1. `/health/live` 200 without auth.
2. `/health/ready` fails if DB down.
3. Propagate `X-Correlation-Id` from web → api → job logs.

## Mapping to Definition of Done

These scenarios cover foundation slices of: action → request → authorization → persistence → response → UI → refresh/re-login → persisted result, plus cross-tenant negatives.

## Explicitly not validated here

Website crawl, WorkDrive sync, Meta launch, pricing, live AI providers — blocked on `DEC-003`–`DEC-007` and later slice plans.
