# Coverage Summary — Feature 002 Reference Evidence Baseline

**Status:** `REFERENCE_EVIDENCE_BASELINE_002: COMPLETE_WITH_LIMITATIONS`
**Session:** 2026-08-30 · **Branch:** `002-brand-website-intelligence`

This baseline does **not** claim complete coverage. Jasper has no signed-in session and Semrush's
authenticated product was subscription-gated, so any claim of full parity would be false.

---

## References

| Metric                                                               | Count | Detail                                                                                   |
| -------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| References in scope                                                  | 4     | Semrush, Jasper Brand IQ, Linear, Planable                                               |
| Inspected live (authenticated session)                               | 3     | Semrush (public surfaces only, product app gated), Planable, Linear                      |
| Inspected through official documentation                             | 4     | All four; documentation is the primary source for Semrush and the only source for Jasper |
| Inspected with the product app reachable apart from plan-gated views | 2     | Planable (Grid/List and multi-level approvals remain plan- or enterprise-gated), Linear  |
| Not applicable this session                                          | 2     | Frame.io (`ACCESS_VERIFIED`), Adobe Workfront (`ACCOUNT_LIMITED`)                        |
| New references introduced                                            | 0     | `DEC-013` unchanged                                                                      |
| Cross-project references opened                                      | 0     | No ISP or other-project reference was touched                                            |

## Surfaces

| Metric                                                                  | Count     |
| ----------------------------------------------------------------------- | --------- |
| Surfaces found and recorded                                             | 77        |
| Surfaces carrying a status                                              | 77 (100%) |
| Surfaces with positive verification (`LIVE_VERIFIED` or `DOC_VERIFIED`) | 75        |
| `LIVE_VERIFIED`                                                         | 32        |
| `DOC_VERIFIED`                                                          | 43        |
| `REFERENCE_LIMITED`                                                     | 1         |
| `REFERENCE_LIMITED_NEEDS_SANDBOX_DATA`                                  | 1         |
| `UNKNOWN`                                                               | 0         |

Per reference: Semrush 29 surfaces (2 live, 25 doc, 1 limited, 1 needs sandbox data);
Planable 25 (18 live, 7 doc); Linear 13 (12 live, 1 doc); Jasper 10 (10 doc, 0 live).

## Actions

| Metric                                                              | Count     |
| ------------------------------------------------------------------- | --------- |
| Actions found and recorded                                          | 47        |
| Actions carrying a status                                           | 47 (100%) |
| `LIVE_VERIFIED` (control, precondition or resulting state observed) | 17        |
| `DOC_VERIFIED`                                                      | 27        |
| `UNKNOWN`                                                           | 2         |
| `AUTH_REQUIRED`                                                     | 1         |
| Actions actually executed against a reference product               | **0**     |

The two `UNKNOWN` actions are Planable item rejection (`PLA-A-010`) and Linear record creation
(`LIN-A-007`). The `AUTH_REQUIRED` action is Jasper sign-up (`JAS-A-010`).

## Journeys

| Metric                                                                                                       | Count                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Journeys catalogued                                                                                          | 9                                                                                                                           |
| Journeys with every step classified                                                                          | 9 (100%)                                                                                                                    |
| Journeys whose primary coverage is `LIVE_VERIFIED` (LIVE is the plurality under primary-first step counting) | 2 (J-07 — 6 LIVE of 9 steps, 1 UNKNOWN; J-08 — 4 LIVE of 9 steps, 2 UNKNOWN)                                                |
| Journeys whose primary coverage is `DOC_VERIFIED` with no `UNKNOWN`/`AUTH_REQUIRED` steps                    | 2 (J-01, J-03)                                                                                                              |
| Journeys mixed, or DOC-primary with `UNKNOWN`/`AUTH_REQUIRED`/`REFERENCE_LIMITED` steps                      | 5 (J-02, J-04, J-05, J-06, J-09). J-07 and J-08 are LIVE-primary by plurality and are intentionally **not** in this bucket. |
| Journey steps classified                                                                                     | 72                                                                                                                          |

Journey step breakdown: `LIVE_VERIFIED` 13 · `DOC_VERIFIED` 44 · `UNKNOWN` 8 ·
`REFERENCE_LIMITED` 2 · `REFERENCE_LIMITED_NEEDS_SANDBOX_DATA` 3 · `AUTH_REQUIRED` 2.

## Roles

| Metric                                                     | Count                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| Provable roles and participant types recorded              | 15                                                            |
| Planable roles                                             | 6, plus 3 membership/participant types (orthogonal to role)   |
| Jasper roles                                               | 4 (plus 2 documented actor archetypes that are **not** roles) |
| Linear roles                                               | 1 (only the inspecting account's own observed scope)          |
| Semrush roles                                              | 1 (an entitlement boundary, not a role boundary)              |
| Permission boundaries tested by attempting a denied action | **0**                                                         |

## Aggregate status counts across all artifacts

| Status                                         | Surfaces                           | Actions | Journey steps | Total   |
| ---------------------------------------------- | ---------------------------------- | ------- | ------------- | ------- |
| `LIVE_VERIFIED`                                | 32                                 | 17      | 13            | 62      |
| `DOC_VERIFIED`                                 | 43                                 | 27      | 44            | 114     |
| `REFERENCE_LIMITED` (incl. needs-sandbox-data) | 2                                  | 0       | 5             | 7       |
| `UNKNOWN`                                      | 0                                  | 2       | 8             | 10      |
| `AUTH_REQUIRED`                                | 0                                  | 1       | 2             | 3       |
| `NOT_APPLICABLE`                               | 2 references (Frame.io, Workfront) | —       | —             | 2       |
| **Total classified items**                     | **77**                             | **47**  | **72**        | **196** |

## Coverage percentage — accessible domain only

Percentages are stated with their denominators so none can be misread as parity.

| Measure                                               | Denominator                                                                                          | Result                                                                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Items carrying an explicit status                     | 196 classified items                                                                                 | **100%**                                                                                                                |
| Items with positive verification (live or documented) | 196                                                                                                  | **89.8%** (176 of 196)                                                                                                  |
| Surfaces with positive verification                   | 77 surfaces                                                                                          | **97.4%** (75 of 77)                                                                                                    |
| Live coverage of the live-inspected surface set       | 40 surfaces in that set (Planable 25 including 2 plan-gated, Linear 13, Semrush's 2 public surfaces) | **80.0%** (32 of 40). The denominator is the set that was _attempted_ live, not the set that was entitlement-reachable. |
| Semrush authenticated-product coverage                | Semrush product app                                                                                  | **0%** — subscription-gated                                                                                             |
| Jasper live coverage                                  | Jasper product                                                                                       | **0%** — no account                                                                                                     |

**Overall authenticated reference parity: `PARTIAL`.** Two of four in-scope references were reachable
as products apart from Planable plan-gated and enterprise-gated views; one was reachable only as
public pages; one was not reachable at all.

## Evidence artifacts

Committed structured artifacts, under `specs/002-brand-website-intelligence/reference/`:

| File                             | Contents                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `00-reference-scope.md`          | Reference scope, authority, access and inspection status                                   |
| `01-evidence-log.md`             | 65 evidence items with source, timestamp, verification type and limitations                |
| `02-navigation-map.md`           | Navigation, sections, pages, tabs, panels and relevant settings per reference              |
| `03-surface-inventory.md`        | 77 surfaces                                                                                |
| `04-action-inventory.md`         | 47 actions                                                                                 |
| `05-journey-catalog.md`          | 9 journeys, 72 classified steps                                                            |
| `06-role-permission-matrix.md`   | 15 provable roles and participant types, and the permission questions that remain unproven |
| `07-reference-pattern-matrix.md` | Pattern → OMA surface inputs, including anti-patterns and unprovable requirements          |
| `08-coverage-summary.md`         | This file                                                                                  |

Evidence items by reference: Semrush 17 · Planable 21 · Linear 9 · Jasper 18. **Total 65 unique
evidence ids.** The counts include official-marketing corroboration entries, which are never
load-bearing on their own.

Local, git-ignored raw inspector transcripts, retained for audit but not committed:
`.reference/002-evidence/raw-semrush-live-and-results.txt`,
`.reference/002-evidence/raw-semrush-setup-runtime.txt`, `.reference/002-evidence/raw-planable.txt`,
`.reference/002-evidence/raw-linear.txt`, `.reference/002-evidence/raw-jasper.txt`.

**Screenshots: none.** Screenshot capture was unavailable in these sessions, so every evidence item
is DOM, accessibility-tree, computed-style or documentation text. No image was captured and none is
committed, so no account region could leak through an image.

## Reference audit result

Independent read-only audits were run over this directory after the initial fifteen-defect fix
round and again after a second qualitative fix round.

**Round 1 (arithmetic / id integrity):** evidence-id integrity, surface/action/journey/role counts,
scope, contamination, privacy, read-only discipline and reference-authority discipline passed after
fifteen documentation defects were corrected.

**Round 2 (qualitative):** failed checks 7–10 on overclaiming “fully reachable”, a present-tense
account claim in `reference-matrix.md`, unsupported Planable permission assertions, navigation-map
evidence pointers, citation asymmetries, journey-bucket labelling, and a premature PASS claim in
this section. Those defects were corrected; the remaining round-2 items were:

1. `EV-SEM-013` ↔ `SEM-C-017` bidirectional citation — **corrected** by restoring `SEM-C-017` on
   `EV-SEM-013` and aligning the summary/limitations.
2. Journey bucket wording that excluded J-07 despite an `UNKNOWN` step — **corrected** by defining
   LIVE-primary as LIVE plurality.
3. `PLA-011` multi-role actors claim — **corrected** to inspecting-account observation plus
   documentation-only capability text with enforcement `UNKNOWN`.
4. This section’s own premature PASS claim — **withdrawn** until the post-fix re-audit below.

**Final post-fix status: `REFERENCE_EVIDENCE_AUDIT: PASS`.** An independent re-audit after the
journey-bucket and citation fixes recomputed J-07/J-08 LIVE plurality, confirmed mixed = 5, and
passed checks 1–16 with no remaining BLOCKING defects.

No audit finding changed a product decision, ownership boundary, tenant or permission boundary,
state machine or integration contract.

## Jasper limitations

- No OMA-owned Jasper account exists. Sign-up was refused for this environment, was **not** retried,
  no alternate email was used, and no trial or demo was requested.
- Status remains `JASPER: AUTH_REQUIRED / REFERENCE_LIMITED`.
- Consequently: no Jasper surface, field label, layout, interaction, state transition, permission
  enforcement or generation behaviour was observed. Everything Jasper-derived is `DOC_VERIFIED` at
  best, and none of it proves internal product behaviour.
- Marketing-only claims were flagged and excluded from behavioural conclusions, specifically
  automatic brand-violation flagging and transparent per-claim citations. Per-claim citation display
  therefore stays `UNKNOWN`.
- The vendor's model-architecture page was deliberately not opened. Only the existence of model
  disclosure is recorded; no provider or model name enters any OMA decision, consistent with
  `SR-002-007-AI` and the still-open `DEC-007`.

## Surfaces needing sandbox data

| Surface                                                                                                            | What is needed                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SEM-S-003` — live Site Audit configuration UI                                                                     | An active Semrush subscription plus a provisioned Site Audit project. Would yield live field names, input types, required markers, defaults, inline validation copy and error styling. |
| Semrush audit runtime and results (`SEM-C-013`–`SEM-C-018`, `SEM-D-014`–`SEM-D-021` live equivalents)              | The same, plus at least one completed audit. Currently documentation-only.                                                                                                             |
| Planable Grid and List views (recorded under `PLA-003` as plan-badged menu items, with List detailed at `PLA-030`) | A higher subscription tier. Currently documentation-only.                                                                                                                              |
| Planable multi-level approvals (documented within `PLA-016`)                                                       | An enterprise tier. Currently documentation-only.                                                                                                                                      |
| Planable suggestion disposition and version restore (`PLA-A-014`, `PLA-A-015`)                                     | A disposable sandbox workspace, since both mutate content.                                                                                                                             |
| Planable full create-to-approve loop                                                                               | A disposable sandbox workspace and item.                                                                                                                                               |
| Jasper — everything                                                                                                | An authorized Jasper account.                                                                                                                                                          |
| Linear responsive breakpoints and slow-load behaviour                                                              | Viewport and network control within the read-only policy.                                                                                                                              |

None of these was fabricated. Each is recorded as limited rather than inferred.

## Retained statuses

```
REFERENCE_EVIDENCE_BASELINE_002: COMPLETE_WITH_LIMITATIONS
JASPER: AUTH_REQUIRED / REFERENCE_LIMITED
WORKFRONT: ACCOUNT_LIMITED / NOT_APPLICABLE_TO_FEATURE_002
FRAME.IO: ACCESS_VERIFIED / NOT_APPLICABLE_TO_CURRENT_INSPECTION
AUTHENTICATED_REFERENCE_PARITY: PARTIAL
LIVE-INTEGRATION READY: NO
PRODUCTION LAUNCH READY: NO
```

## Confirmations

- **No external mutations.** Nothing was created, connected, uploaded, invited, commented on,
  approved, rejected, restored, scheduled, published, exported, crawled, purchased or deleted in any
  reference product, and no reference setting was changed. No crawl or audit was started. No trial
  was begun and no billing surface was opened. Forms were opened and closed without submission. The
  single control interaction — a Linear list-row checkbox used to measure the selected-row treatment
  — was reverted immediately and altered no record.
- **No product source changes.** This phase changed only reference documentation under
  `specs/002-brand-website-intelligence/` plus one `.gitignore` line that keeps local raw evidence
  out of the repository. No application code, schema, migration, dependency, test, API, UI, runtime
  configuration or in-repository MCP configuration was touched.
- **No merge to `main`.** Work stays on `002-brand-website-intelligence`. No pull request was
  created.
- **No personal data or secrets.** No account email, personal name, avatar, organisation identifier,
  cookie, token, session id or authorization header is recorded anywhere in this directory.
  Workspace, team, company, project, post and issue identifiers appear only as `{placeholder}`
  patterns. No reference branding asset was copied.
- **No gap resolution.** This phase produced evidence only. No comparison against OMA code, no gap
  matrix, no implementation and no new feature was started.
