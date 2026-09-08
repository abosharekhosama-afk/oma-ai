# DP-003-002 — Strategy vs plan approval granularity

**Status:** `UNRESOLVED`
**Feature:** `003-strategy-organic-paid-plans`
**Raised:** 2026-09-08
**Why it matters:** Foundation FR-038/FR-039 allow approvals on strategy and plan/brief versions. Feature 003 ships strategy + Organic + Paid tracks before briefs/tasks (US-003). Ambiguity here changes capability grants and notification targets.

## Question

Does approving a **Strategy Version** in Feature 003 also approve the enabled Organic and Paid track contents packaged in that version, or must each enabled track receive a separate accountable approval?

## Options

| Option | Meaning                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A**  | **Package approval** — one Strategy Version approval covers strategy core + enabled Organic/Paid track snapshots for 003. Separate plan-item approvals appear later at brief/task conversion (US-003). |
| **B**  | **Independent track approvals** — Strategy core, Organic plan, and Paid plan each require their own approve decision before the strategy package is considered fully approved.                         |
| **C**  | **Hybrid** — Strategy approval required; Paid track additionally requires a distinct paid-planning acknowledgment capability; Organic does not.                                                        |

## Spec interim (not an Owner resolution)

Until Owner chooses, Spec §8.3 uses **Option A**.

## Out of scope for this packet

- Live Meta spend approval (`DEC-006`)
- Deliverable/creative approval (US-005)
