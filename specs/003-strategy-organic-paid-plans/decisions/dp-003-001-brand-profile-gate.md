# DP-003-001 — Brand Profile linkage gate

**Status:** `OWNER_APPROVED / RESOLVED`
**Resolution:** **Option B** (Owner 2026-09-08)
**Feature:** `003-strategy-organic-paid-plans`
**Slice resolution:** `SR-003-001-B`
**Raised:** 2026-09-08

## Question

At which gate MUST a Strategy link an **Approved** Feature 002 Brand Profile version?

## Options (historical)

| Option | Create Draft             | Enter `IN_REVIEW`                              | Approve                                     |
| ------ | ------------------------ | ---------------------------------------------- | ------------------------------------------- |
| **A**  | Require approved profile | Require                                        | Require                                     |
| **B**  | Allow without            | Require approved profile link                  | Require                                     |
| **C**  | Allow without            | Allow with mandatory incompleteness disclosure | Allow with explicit confirm (Partial-style) |
| **D**  | Allow without            | Allow                                          | Require approved profile                    |

## Owner resolution — Option B

- Strategy **Draft** MAY be created without an approved Brand Profile.
- UI MUST show a clear warning and missing-source state until linked.
- Submission to review (`IN_REVIEW`) **requires** linking an immutable Approved Brand Profile version.
- Approval **requires** the same valid Approved profile linkage.
- Product MUST NOT claim evidence-backed status before linkage.

Canonical behavior: Feature 003 `spec.md` §8.2, `FR-SOP-010`–`012`.

## Out of scope for this packet

- Closing `DEC-004` / live crawl
- Allowing 003 to mutate Feature 002 approvals
