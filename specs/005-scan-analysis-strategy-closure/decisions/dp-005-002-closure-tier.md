# DP-005-002 — Closure sign-off tier

**Status**: `PROPOSED` (default **Option A**)

## Question

What must pass for `SCAN_ANALYSIS_STRATEGY_OPS_CLOSURE: VERIFIED`?

## Options

| Option | Proof journey |
| ------ | ------------- |
| **A (recommended)** | Scan → discovery → profile approve (with catalog) → strategy approve → plan-requests commit (no WorkDrive) |
| **B** | Option A + `catalog.generate` with WorkDrive CONNECTED |

## Recommendation

**A** first; **B** as optional stretch goal.