# DP-003-001 — Brand Profile linkage gate

**Status:** `UNRESOLVED`
**Feature:** `003-strategy-organic-paid-plans`
**Raised:** 2026-09-08
**Why it matters:** Feature 002 produces immutable approved Brand Profile versions. Foundation US-002/FR-026 expect strategy from selected profile/snapshot evidence. Creating a false “evidence-backed” approval without a profile breaks product truth; blocking all drafting without a profile may stall teams mid-onboarding.

## Question

At which gate MUST a Strategy link an **Approved** Feature 002 Brand Profile version?

## Options

| Option | Create Draft             | Enter `IN_REVIEW`                              | Approve                                     |
| ------ | ------------------------ | ---------------------------------------------- | ------------------------------------------- |
| **A**  | Require approved profile | Require                                        | Require                                     |
| **B**  | Allow without            | Require approved profile link                  | Require                                     |
| **C**  | Allow without            | Allow with mandatory incompleteness disclosure | Allow with explicit confirm (Partial-style) |
| **D**  | Allow without            | Allow                                          | Require approved profile                    |

## Spec interim (not an Owner resolution)

Until Owner chooses, Spec §8.2 uses **Option B behavior**: Draft allowed with warning; `IN_REVIEW` blocked without linked Approved Brand Profile version.

## Out of scope for this packet

- Closing `DEC-004` / live crawl
- Allowing 003 to mutate Feature 002 approvals
