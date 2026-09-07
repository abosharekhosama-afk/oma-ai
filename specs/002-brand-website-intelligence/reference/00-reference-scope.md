# Reference Scope — Feature 002 Brand Website Intelligence

**Phase:** `REFERENCE_INSPECTION_ONLY`
**Feature:** `002-brand-website-intelligence`
**Session:** 2026-08-30
**Inspector:** OpenCode Reference Inspection Worker (`reference-inspector`) over the dedicated
`OMA References` Chrome profile on loopback CDP. The Cursor parent orchestrated only; it did not
drive the reference browser.
**Baseline status:** `REFERENCE_EVIDENCE_BASELINE_002: COMPLETE_WITH_LIMITATIONS`

This directory is a reference **evidence** baseline. It is not a gap analysis against OMA code, not
a design specification, and not an implementation authorization. `DEC-013` is unchanged and no new
reference product was introduced.

## Authority per reference (fixed by `DEC-013`)

| Reference       | Authority for Feature 002                                                                                                                                                      | In scope this session                                                                                                                                                                               | Out of scope this session                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Semrush         | Website intelligence, site-audit presentation, crawl configuration, progress, coverage, issues, crawled pages, evidence clarity, filters, comparison/history                   | Site Audit configuration, runtime, results, filters, compare/history, export affordance                                                                                                             | Keyword/backlink/traffic/advertising toolkits; pricing; admin       |
| Jasper Brand IQ | Brand profile organisation, brand voice, knowledge organisation, source-backed brand information, missing/unknown information, reviewable brand guidance                       | Official public product pages, official documentation, official Help Center                                                                                                                         | Any signed-in Jasper surface; AI provider/model choices             |
| Linear          | Product shell, sidebar, navigation density, page hierarchy, side panels, filters, keyboard interaction, calm motion, empty/loading states, responsive behaviour where provable | Live workspace shell, navigation, filters, display options, issue detail panel, keyboard model, row states, empty/loading states, measured layout values                                            | Issue domain model; branding; billing; any persisted setting change |
| Planable        | Review workflow, status visibility, approval, item decisions, collaboration presentation, comments, version/revision clarity, workspace organisation                           | Live product shell, workspace organisation, approval queue and review flow, post review surface, status vocabulary, filters, notifications, plus official docs for approval configuration and roles | Publishing to social channels; analytics; social inbox; billing     |

## Explicitly not applicable to this session

| Reference       | Recorded status                                                    | Reason                                                                                                                                   |
| --------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Frame.io        | `ACCESS_VERIFIED / NOT_APPLICABLE_TO_CURRENT_REFERENCE_INSPECTION` | Exact-version media review is not a Feature 002 surface. Access status retained for a later review-room phase.                           |
| Adobe Workfront | `ACCOUNT_LIMITED / NOT_APPLICABLE_TO_FEATURE_002`                  | The account is authenticated to Adobe but is not linked to a Workfront organisation, and workflow planning is not a Feature 002 surface. |
| Smartly         | Not inspected                                                      | Paid-media reference; no Feature 002 authority.                                                                                          |

No reference from any other project was opened, and no reference was added to `DEC-013`.

## Access and inspection status

| Reference       | Access status                                              | Inspection status                                | Inspection method                                                                                                                                                                                                                              |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semrush         | `ACCESS_VERIFIED` (authenticated) / `SUBSCRIPTION_LIMITED` | `PARTIAL — DOC_PRIMARY`                          | Live navigation + public entry form verified; the authenticated product app never rendered because the account has no active paid subscription, so configuration, runtime and results are documented from the official Semrush Knowledge Base. |
| Planable        | `ACCESS_VERIFIED`                                          | `SUBSTANTIAL — LIVE_PRIMARY`                     | Live product shell, approval queue, review flow, post review surface, filters and notifications inspected read-only in an existing sample workspace; plan-gated and write-only behaviour documented from the official Help Center.             |
| Linear          | `ACCESS_VERIFIED`                                          | `SUBSTANTIAL — LIVE_PRIMARY`                     | Live shell, navigation, filters, display options, issue detail, keyboard model, row states and empty states inspected read-only, with selected layout values measured from computed styles.                                                    |
| Jasper Brand IQ | `AUTH_REQUIRED / REFERENCE_LIMITED`                        | `DOC_ONLY`                                       | No OMA-owned Jasper account exists and signup was refused; only official Jasper product pages, documentation and Help Center were used.                                                                                                        |
| Frame.io        | `ACCESS_VERIFIED`                                          | `NOT_APPLICABLE_TO_CURRENT_REFERENCE_INSPECTION` | Not inspected.                                                                                                                                                                                                                                 |
| Adobe Workfront | `ACCOUNT_LIMITED`                                          | `NOT_APPLICABLE_TO_FEATURE_002`                  | Not inspected.                                                                                                                                                                                                                                 |

## Read-only and privacy compliance

- No workspace, project, issue, post, record, crawl, upload, connection, invitation, comment,
  approval, rejection, setting change, deletion, export, trial or billing action was performed in
  any reference product. Forms were opened and closed without submission.
- One reversible, non-persisting UI selection was used in Linear to measure the selected-row
  treatment (a list-row checkbox), and it was immediately deselected. No record changed.
- No account email, personal name, avatar, organisation identifier, cookie, token, session id or
  authorization header is recorded in this directory. Workspace, team, project, post and issue
  identifiers appear only as `{placeholder}` patterns.
- No reference branding asset, icon, screenshot of an account area, or heavy binary was committed.
- Raw inspector transcripts are kept locally in `.reference/002-evidence/` and are git-ignored.

## Artifacts in this baseline

| File                             | Covers                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `00-reference-scope.md`          | Reference scope, authority, access and inspection status (this file)                      |
| `01-evidence-log.md`             | Every evidence item with id, reference, source, timestamp, verification type, limitations |
| `02-navigation-map.md`           | Application, workspace, main navigation, sections, pages, tabs, panels per reference      |
| `03-surface-inventory.md`        | Surfaces with purpose, fields, controls, states, actors, evidence, relevance              |
| `04-action-inventory.md`         | Actions with actor, preconditions, trigger, validation, result, history visibility        |
| `05-journey-catalog.md`          | Feature 002 journeys with per-step coverage classification                                |
| `06-role-permission-matrix.md`   | Only provable roles and permissions, with evidence                                        |
| `07-reference-pattern-matrix.md` | Reference pattern → OMA surface inputs (no gap resolution)                                |
| `08-coverage-summary.md`         | Counts, coverage percentage, audit result, limitations, confirmations                     |
