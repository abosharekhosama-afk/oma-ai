# DP-003-002 — Strategy vs plan approval granularity

**Status:** `OWNER_APPROVED / RESOLVED`
**Resolution:** **Option A** (Owner 2026-09-08)
**Feature:** `003-strategy-organic-paid-plans`
**Slice resolution:** `SR-003-002-A`
**Raised:** 2026-09-08

## Question

Does approving a **Strategy Version** in Feature 003 also approve the enabled Organic and Paid track contents packaged in that version, or must each enabled track receive a separate accountable approval?

## Options (historical)

| Option | Meaning                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A**  | **Package approval** — one Strategy Version approval covers strategy core + enabled Organic/Paid track snapshots for 003. Separate plan-item approvals appear later at brief/task conversion (US-003). |
| **B**  | **Independent track approvals** — Strategy core, Organic plan, and Paid plan each require their own approve decision before the strategy package is considered fully approved.                         |
| **C**  | **Hybrid** — Strategy approval required; Paid track additionally requires a distinct paid-planning acknowledgment capability; Organic does not.                                                        |

## Owner resolution — Option A

- One approval decision applies to the Strategy Version **package**.
- The package includes strategy foundation plus all **enabled** Organic/Paid tracks.
- Disabled tracks require recorded rationale (not separate approvals).
- Separate item/task/content approvals belong to later product features.
- AI cannot approve.

Canonical behavior: Feature 003 `spec.md` §8.3, `FR-SOP-044`, `US-SOP-08`.

## Out of scope for this packet

- Live Meta spend approval (`DEC-006`)
- Deliverable/creative approval (US-005)
