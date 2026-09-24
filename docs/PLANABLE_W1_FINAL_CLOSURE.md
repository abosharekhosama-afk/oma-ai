# Planable W1 final closure

**Date:** 2026-09-23  
**Starting SHA:** `355e68eb01c0424c2c26a5007637b3982bdcf1b0`  
**Branch:** `004-oma-complete-product-demo`

Product verdict and reference coverage are separate. A missing live frame is an evidence limitation. It is not, by itself, a product gap.

| Surface                            | Product verdict         | Evidence level        | Remaining product gap                                                                                        | Evidence limitation                                                   |
| ---------------------------------- | ----------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Content calendar card              | CLOSE                   | LIVE_VERIFIED         | None. Computed box matches the live card within 0px.                                                         | Sample content is not the Planable sample post.                       |
| Saved column                       | CLOSE                   | LIVE_VERIFIED         | None for the undated-draft column.                                                                           | Live Saved copy and empty-state art were not recaptured in this pass. |
| Feed                               | VERIFIED_OMA_ADAPTATION | OFFICIAL_DOC_VERIFIED | None at the W1 bar. Preview, caption, metadata, and the shared status mark are present.                      | No authenticated Feed frame.                                          |
| List                               | VERIFIED_OMA_ADAPTATION | OFFICIAL_DOC_VERIFIED | None at the W1 bar. Dense row with status, channel, campaign, owner, and date.                               | No authenticated List frame.                                          |
| Grid                               | VERIFIED_OMA_ADAPTATION | OFFICIAL_DOC_VERIFIED | None at the W1 bar. Media-first cards with the shared status mark. Mobile uses the existing fallback.        | No authenticated Grid frame.                                          |
| Status marks                       | VERIFIED_OMA_ADAPTATION | OFFICIAL_DOC_VERIFIED | None. Original marks, EN/AR text, tooltip, aria-label, and a non-color shape.                                | Planable's icon SVG set was not captured live and was not copied.     |
| Approval policy                    | CLOSE                   | OFFICIAL_DOC_VERIFIED | None for NONE, OPTIONAL, and REQUIRED.                                                                       | Multi-level, lock, and auto-schedule stay `PLAN_GATED`.               |
| Schedule calendar / agenda / queue | CLOSE                   | OFFICIAL_DOC_VERIFIED | None. One bucket function, separate date and Schedule commands, visible block reason, publishing disclosure. | Planable's schedule page was not recaptured live in this pass.        |

`AUTHENTICATED_REFERENCE_COVERAGE: PARTIAL`  
`DOCUMENTED_REFERENCE_COVERAGE: SUFFICIENT_FOR_W1`

## Status aliases

| Requested name           | Code `PublishDisplay`                                   | Meaning                                                 |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------- |
| DRAFT                    | `DRAFT`                                                 | Authoring only. No planned date and not scheduled.      |
| APPROVAL_NOT_REQUESTED   | `DRAFT` or `PLANNED_DATE` with approval `NOT_REQUESTED` | Approval has not been asked for.                        |
| APPROVAL_PENDING         | `APPROVAL_PENDING`                                      | Approval was requested and nobody has approved yet.     |
| PARTIALLY_APPROVED       | `PARTIALLY_APPROVED`                                    | Some required approvers have approved.                  |
| APPROVED                 | `APPROVED`                                              | Required approval is complete.                          |
| PLANNED_DATE             | `PLANNED_DATE`                                          | A date is stored. The item is still unscheduled.        |
| SCHEDULED_IN_OMA         | `SCHEDULED_LOCAL`                                       | Schedule ran inside OMA. It is not an external publish. |
| PUBLISHING_NOT_CONNECTED | `PUBLISHING_NOT_CONNECTED`                              | No external publisher is connected.                     |
| PUBLISHED_SAMPLE         | `PUBLISHED_SAMPLE`                                      | Demo sample only. The label says sample.                |
| PUBLISH_FAILED_SAMPLE    | `FAILED_SAMPLE`                                         | Demo failure sample. The label says sample.             |

Approved uses a check. Scheduled in OMA uses a clock. Planned date uses a calendar glyph. Published sample does not reuse the approved check.

## Card measurement

Viewport 1440×900, `prefers-reduced-motion: no-preference`.

| Property   | Live Planable      | OMA computed           |
| ---------- | ------------------ | ---------------------- |
| width      | 126px              | 126px                  |
| height     | 172px              | 172px                  |
| padding    | 6px                | 6px                    |
| radius     | 8px                | 8px                    |
| border     | rgb(226, 227, 229) | 1px rgb(226, 227, 229) |
| transition | 150ms ease-out     | 0.15s, 0.15s ease-out  |
| overflow   | —                  | visible                |

The 172px minimum applies only to `.oma-post-card--calendar`. Feed cards are not forced to that height.

## Schedule truth

Calendar, Agenda, and Queue render the same filtered rows and the same `bucketForScheduleRow` result:

1. Saved drafts
2. Planned date
3. Approval blocked
4. Ready to schedule
5. Scheduled in OMA
6. Publishing not connected

Saving a date does not send a schedule state. Schedule and Unschedule are separate buttons. A blocked row shows `demo-schedule-block-reason` and disables Schedule. The page states `External publishing is not connected` / `النشر الخارجي غير متصل`.

## Gaps

| ID    | Verdict                                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------- |
| G-007 | CLOSED. Calendar/Saved `CLOSE` / `LIVE_VERIFIED`. Feed/List/Grid `VERIFIED_OMA_ADAPTATION` / `OFFICIAL_DOC_VERIFIED`. |
| G-008 | CLOSED                                                                                                                |
| G-009 | CLOSED as `VERIFIED_OMA_ADAPTATION`                                                                                   |
| G-014 | CLOSED                                                                                                                |
| G-015 | CLOSED for NONE / OPTIONAL / REQUIRED                                                                                 |
| G-016 | CLOSED                                                                                                                |

`PLANABLE_W1_PRODUCT_HIGH_GAPS: 0`  
`PLANABLE_W1_PRODUCT_MEDIUM_GAPS: 0`

Onboarding still does not ask for the approval policy. The policy is set on the content page and shown in the composer and on Schedule. That leftover is Low and is not a W1 content-workflow defect. Multi-level approval stays `PLAN_GATED`.

## Evidence

- `artifacts/planable-oma-visual-differential/w1-final-closure/`
- `.reference/007-planable-oma-visual-differential/w1-final-closure/`
- 82 PNG files
- 12 sequences, 6 frames each
- 0 webm files. ffmpeg was not installed.

## Acceptance flags

```
PLANABLE_VISUAL_DIFFERENTIAL_BASELINE: COMPLETE
PLANABLE_UI_UX_WORKFLOW_W1: COMPLETE
PLANABLE_W1_VISUAL_DIFFERENTIAL: PASS
PLANABLE_W1_PRODUCT_HIGH_GAPS: 0
PLANABLE_W1_PRODUCT_MEDIUM_GAPS: 0
AUTHENTICATED_REFERENCE_COVERAGE: PARTIAL
DOCUMENTED_REFERENCE_COVERAGE: SUFFICIENT_FOR_W1
PLANABLE_FULL_PRODUCT_GAPS: IN_PROGRESS
PLANABLE: PRIMARY_AND_SOLE_UI_UX_AND_WORKFLOW_REFERENCE
OWNER_VISUAL_REVIEW: REJECTED
VISUAL_ACCEPTANCE: REJECTED
USER_ACCEPTANCE: PENDING
OPENAI_OFFLINE_CERTIFICATION_GAPS: PAUSED_PENDING_REFERENCE_ALIGNMENT
OPENAI_LIVE_ACCESS: NOT_VERIFIED
AI_LIVE_ENABLED: FALSE
EXTERNAL_INTEGRATIONS: DEFERRED
```

Stage result after the auth harness fix: the five login failures are green. The harness creates the local platform owner when missing and signs in with the bootstrap credentials. Login and tenant checks are unchanged.

Next stage only after a real PASS: `IMPLEMENT_OMA_PLANABLE_OFFICIAL_REFERENCE_GAPS_W2`.
