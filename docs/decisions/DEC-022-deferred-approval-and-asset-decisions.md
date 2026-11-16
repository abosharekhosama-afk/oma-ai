# DEC-022 — Deferred decisions for approval policies and asset review

**Status:** `DEFERRED / DESIGN_FOR_EXTENSION`
**Date:** 2026-11-16
**Pillars:** 3 — Planable W2 approvals, 4 — Frame.io-style asset review

These are intentionally not decided in Phase 1. Phase 1 code must not block them.

| Topic                      | Default until decided                                                       |
| -------------------------- | --------------------------------------------------------------------------- |
| Multi-level approval       | Sequential ordered levels; plan-gated via `PlanFeature`; counter mode stays |
| Lock scope                 | Lock body, media and targets; `plannedAt` stays editable and audited        |
| `OPTIONAL` policy schedule | Allowed without approval, except AI-origin content (DEC-020)                |
| Schedule pre-conditions    | Approval complete + at least one connected publishing account               |
| Asset version immutability | Application guard now; Postgres trigger in Phase 4                          |
| Comment ↔ version binding  | Required for new comments in Phase 4; legacy comments backfilled            |

Each row becomes its own decision record when its phase starts.
