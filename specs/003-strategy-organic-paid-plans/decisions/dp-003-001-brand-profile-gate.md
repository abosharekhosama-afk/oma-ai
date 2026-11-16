# DP-003-001 — Brand Profile linkage gate

**Status:** `SUPERSEDED (2026-11-16) — see addendum`
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

## Addendum (2026-11-16) — moved to Option A

Commit `b636b3f3` (`feat: enforce approved brand profiles for strategies`) moved the product to
**Option A**: creating a strategy requires the brand to have an `APPROVED` profile
(`403 BRAND_PROFILE_NOT_APPROVED`), draft profiles can no longer be linked
(`403 DRAFT_PROFILE_FORBIDDEN`), and plan requests require the linked profile to still be approved
(`403 LINKED_PROFILE_NOT_APPROVED`). A new draft created from an approved brand is still flagged
`missing_source` until a specific approved version is linked, and submit still requires the link.
