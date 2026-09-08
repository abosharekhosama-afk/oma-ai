# DP-003-003 — Current-approved strategy pointer

**Status:** `UNRESOLVED`
**Feature:** `003-strategy-organic-paid-plans`
**Raised:** 2026-09-08
**Why it matters:** Brands may need multiple strategies (e.g., seasonal vs always-on). Downstream US-003 conversion and client views need a deterministic “current approved” meaning.

## Question

When a Brand has multiple strategies, how does OMA define the **current approved strategy**?

## Options

| Option | Meaning                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **A**  | At most one `APPROVED` (non-superseded) strategy per Brand; approving another supersedes the previous brand-current strategy.   |
| **B**  | Many approved strategies allowed; Brand stores an explicit `currentApprovedStrategyId` set by an authorized user.               |
| **C**  | Many approved strategies allowed; “current” is contextual (by time horizon / campaign tag) with no single brand pointer in 003. |

## Spec interim (not an Owner resolution)

003 MUST support multiple Strategy records per Brand and MUST support `SUPERSEDED` when a **newer version of the same strategy** is approved. Brand-level single-current pointer semantics remain **UNRESOLVED** — UI MUST NOT invent a fake single-current badge until Owner chooses.

## Out of scope for this packet

- Cross-brand strategy templates
- Agency portfolio rollups
