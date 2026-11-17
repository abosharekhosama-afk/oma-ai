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

- [ ] CHK010 Ops: Worker consumes ingestion job within 2 min (manual or T002)
- [ ] CHK011 Scan: live proof URL reaches PARTIAL|SUCCEEDED with pages > 0
- [ ] CHK012 Discovery: products persisted; reimport idempotent (T014–T015)
- [ ] CHK013 Profile: catalog materialized on approve/refresh (T032–T033)
- [ ] CHK014 Strategy: plan preview `catalog_offerings_count > 0` when products exist (T035)
- [ ] CHK015 Integration test T040 green in CI (or documented waiver with owner sign-off)
- [ ] CHK016 Owner decisions DP-005-* = OWNER_APPROVED or defaults accepted in writing

## Label when all CHK010–016 pass

`SCAN_ANALYSIS_STRATEGY_OPS_CLOSURE: VERIFIED`
