# DP-003-003 — Current-approved strategy pointer

**Status:** `OWNER_APPROVED / RESOLVED`
**Resolution:** **Option B** (Owner 2026-09-08)
**Feature:** `003-strategy-organic-paid-plans`
**Slice resolution:** `SR-003-003-B`
**Raised:** 2026-09-08

## Question

When a Brand has multiple strategies, how does OMA define the **current approved strategy**?

## Options (historical)

| Option | Meaning                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **A**  | At most one `APPROVED` (non-superseded) strategy per Brand; approving another supersedes the previous brand-current strategy.   |
| **B**  | Many approved strategies allowed; Brand stores an explicit `currentApprovedStrategyId` set by an authorized user.               |
| **C**  | Many approved strategies allowed; “current” is contextual (by time horizon / campaign tag) with no single brand pointer in 003. |

## Owner resolution — Option B

- Multiple approved strategies MAY exist for one Brand.
- Brand holds an explicit `currentApprovedStrategyId`.
- Only an authorized capability (Strategy set current) may set or change the current strategy.
- Changing the pointer does **not** mutate, reject, or supersede other approved strategies.
- Pointer changes require audit logging and concurrency protection.
- Approving a strategy does **not** implicitly set the pointer.
- When the current strategy is archived, becomes ineligible, is inaccessible, or fails tenant/brand checks, apply deterministic clear/unavailable rules in `spec.md` §8.4 — **never** auto-select another current without authorized human set-current.

Canonical behavior: Feature 003 `spec.md` §4.5, §8.4, `FR-SOP-070`–`077`, `US-SOP-12`.

## Out of scope for this packet

- Cross-brand strategy templates
- Agency portfolio rollups
