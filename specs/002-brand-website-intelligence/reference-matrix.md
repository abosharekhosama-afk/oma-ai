# Public Reference Matrix — Brand Website Intelligence

**Feature:** `002-brand-website-intelligence`
**Phase:** `VISIBLE_PRODUCT_RECOVERY_AND_PUBLIC_REFERENCE_PASS`
**Status:** `AUTHENTICATED_REFERENCE_PARITY: PARTIAL` — superseded for evidence purposes by [`reference/`](./reference/)

## Evidence basis and limits

**At the time of this public-source pass**, no OMA-owned account existed on any
reference product. Every row below was derived only from publicly reachable
marketing pages, public documentation, and public help centres of the named
products. Nothing in *this* matrix was observed inside a signed-in product
session, so no row may be read as verified parity. A later authenticated
baseline lives in [`reference/`](./reference/) and supersedes this caveat for
Planable and Linear only — see the status section below.

This document studies interaction patterns only. It authorises no copying of
reference logos, assets, icons, copy, colour systems, or layouts. `DEC-013` is
unchanged and no new primary reference is introduced.

Reference scope is fixed by `DEC-013`:

| Reference       | Public source                     | Domain it may inform in OMA               |
| --------------- | --------------------------------- | ----------------------------------------- |
| Semrush         | semrush.com product + help centre | Site-audit result clarity, tables, issues |
| Jasper Brand IQ | jasper.ai product + help centre   | Brand profile organisation, voice fields  |
| Linear          | linear.app product + docs         | Shell density, sidebar, panels, motion    |
| Planable        | planable.io product + help centre | Review flow, decisions, status visibility |

## Matrix

| #   | Reference pattern                                                                      | Reference       | OMA screen                                      | Applied in this pass                                                                                                           | Pending authenticated study                               | Deliberate divergence                                                                                                     |
| --- | -------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Persistent left sidebar with grouped primary destinations and an explicit active state | Linear          | Global shell (`components/shell/app-shell.tsx`) | Sidebar with a `Workspace` group, `Home` and `Brand Intelligence` entries, `aria-current` plus visual active state             | Command palette, nested project trees, collapse behaviour | OMA keeps two destinations because only one product domain exists; inventing more would be a non-functional UI            |
| 2   | Restrained typographic density and calm state changes rather than decorative motion    | Linear          | Global shell, all list screens                  | Token-driven spacing, 13–14px control text, no decorative animation, existing reduced-motion rules retained                    | Keyboard-first navigation model, multi-pane layouts       | `DEC-013` is resolved but fixes direction only; the base design system is a separate approval, so tokens stay provisional |
| 3   | Workspace/organisation selector in the top bar that rescopes all data                  | Linear          | Top bar tenant selector                         | Localised selector, server-deduplicated membership list, full document reload on switch so no view keeps another tenant's data | Recent/starred workspaces, search within many workspaces  | Tenant scope is resolved server-side from the session; the client selection is only a request to change it                |
| 4   | Scan/audit result surface that separates crawled pages from findings                   | Semrush         | Brand detail → Discovered pages                 | Page list with canonical URL, classification, fetch status, HTTP status                                                        | Issue severity grouping, historical trend charts          | OMA has no issue-severity model in 002; adding one would be UI without a domain behind it                                 |
| 5   | Explicit crawl coverage with fetched / failed / skipped counts                         | Semrush         | Scan progress and brand overview                | Real counters from the scan API, partial-scan disclosure before approval                                                       | Crawl budget tuning UI, scheduled recrawls                | Coverage in OMA gates approval; in the reference it is informational only                                                 |
| 6   | Every finding traceable to the source page it came from                                | Semrush         | Evidence side panel                             | Source URL, canonical URL, excerpt, fetch timestamp, extraction method                                                         | Side-by-side rendered page preview                        | `DEC-003` is still open, so OMA stores an excerpt rather than page bytes and defers any snapshot view                     |
| 7   | Brand profile split into named identity sections                                       | Jasper Brand IQ | Brand intelligence editor                       | Named sections rendered as labelled fields with a per-claim required/optional marker, never as a raw data dump                 | Tone sliders, generated voice samples                     | OMA exposes provenance per claim; the reference presents an authored profile                                              |
| 8   | Explicit "we do not know this yet" state instead of a silent blank                     | Jasper Brand IQ | Brand intelligence editor                       | Unknown fields shown as unknown with a manual completion path                                                                  | Guided completion wizard                                  | OMA never promotes an Unknown to a Fact, including after human entry                                                      |
| 9   | AI contribution marked as a suggestion, not a decision                                 | Jasper Brand IQ | AI unavailable banner, insight claims           | Availability banner, `Fact / Inference / User-entered` labelling, pending review status                                        | Provider-specific model disclosure                        | OMA has no AI provider selected (`DEC-007`); the current state is `NOT_CONFIGURED` rather than a suggestion stream        |
| 10  | Item-level accept/reject distinct from whole-version approval                          | Planable        | Insight decisions, approval summary             | Separate insight decision controls and version approve/reject, separated by capability                                         | Threaded comments, per-approver assignment                | Approval eligibility is server-enforced; the UI cannot offer approval on an ineligible version                            |
| 11  | Status chips that make review state readable at a glance                               | Planable        | Brand list, scan status, version status         | Shared badge component across brand status, scan status, review status                                                         | Full colour-coded workflow board                          | A single badge vocabulary is used so status colour never means two things                                                 |
| 12  | Approval that states what is incomplete before it is granted                           | Planable        | Approval summary                                | Partial-scan disclosure, blocking-reason list, explicit confirmation checkbox                                                  | Approval delegation and reminders                         | OMA blocks rather than warns when required fields are missing                                                             |
| 13  | Version history reachable from the object it belongs to, not only from the newest item | Planable        | Brand workspace → Intelligence                  | `Intelligence` workspace tab and a version index listing every draft and approved version with its dates and AI availability   | Diff presentation inside a review thread                  | OMA marks the approved version explicitly because approval, not recency, is the authority                                 |

## Structured reference capture status

**Superseded for evidence purposes on 2026-08-30.** The rows above remain the record of
the earlier public-source pass. A subsequent `REFERENCE_INSPECTION_ONLY` phase produced
an authenticated, structured evidence baseline in
[`reference/`](./reference/), where every surface, action and journey step carries an
explicit status and an evidence id. Read that directory, not this matrix, when reference
evidence is needed.

The structured baseline supersedes this matrix's "no authenticated study" caveat only for
Planable and Linear, which were inspected live. Semrush remains documentation-primary
because its authenticated product app is subscription-gated, and Jasper remains
documentation-only. Overall status is
`AUTHENTICATED_REFERENCE_PARITY: PARTIAL`, not complete.

The repository's Reference Intelligence subsystem (`scripts/reference/`) still lives on
another branch and is not present here, so this phase's inspection used the user-level
`reference-inspector` worker and the `OMA References` Chrome profile. Raw transcripts are
retained locally under `.reference/002-evidence/` and are git-ignored.

## Not studied in this pass

- Any screen only reachable behind a reference product login.
- Pricing, billing, or admin surfaces of any reference product.
- Reference mobile applications.

These three items specifically remain `PENDING`: reference pricing, billing and admin surfaces were
never opened, reference mobile applications were never inspected, and every Jasper surface behind a
login is unreachable because no Jasper account exists. Planable and Linear login-gated screens are
no longer pending — they were inspected live in the `reference/` baseline — and Semrush's
login-gated product app remains pending because it is subscription-gated rather than
inaccessible.
