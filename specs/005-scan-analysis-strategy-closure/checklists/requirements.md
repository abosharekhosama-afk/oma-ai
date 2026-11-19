# Requirements checklist — 005 Operational Closure

**Feature**: [`spec.md`](../spec.md)
**Updated**: 2026-11-17

Mark `[x]` only when **evidence** exists (test name, CI run, or artifact path).

## Spec quality

- [x] CHK001 Problem, outcome, stories, FRs, SCs, non-goals present
- [x] CHK002 Owner decision packets DP-005-001–003 documented with defaults
- [x] CHK003 No new tenancy/auth system; extends 002+003
- [x] CHK004 Visual/Planable parity explicitly out of scope
- [x] CHK005 DEC-016 respected (no new vendor SDKs in CORE tasks)

## Closure evidence (implement stage)

- [ ] CHK010 Ops: `API_BASE=… scripts/closure-005/ops-smoke.sh` → `worker_alive=true`; then scan consumed within 2 min (`docs/RENDER_OPERATIONS_STABILITY.md` on Render)
- [ ] CHK011 Scan: live proof URL reaches PARTIAL|SUCCEEDED with pages > 0 (see `quickstart.md` CLOSURE_PROOF_URL)
- [x] CHK012 Discovery: products persisted; reimport idempotent (T014–T015) — `scan-reimport-api.integration.test.ts`, `catalog-reimport.integration.test.ts`
- [x] CHK013 Profile: catalog materialized on approve/refresh (T032–T033) — code + `scan-analysis-strategy-closure.integration.test.ts`
- [x] CHK014 Strategy: plan preview `catalog_offerings_count > 0` when products exist (T035) — same integration file
- [x] CHK015 Integration test T040 green in CI (or documented waiver with owner sign-off) — `scan-analysis-strategy-closure.integration.test.ts`, `scan-analysis-ai-closure.integration.test.ts`
- [x] CHK016 Owner decisions DP-005-* = OWNER_APPROVED or defaults accepted in writing

## Label when all CHK010–016 pass

`SCAN_ANALYSIS_STRATEGY_OPS_CLOSURE: VERIFIED` — **pending CHK010–CHK011** (manual Worker + live scan on deploy).
