# Planable reference authority

**Stage:** `PLANABLE_OFFICIAL_PRODUCT_REFERENCE_EXPANSION_AND_OMA_GAP_MATRIX`  
**Access date:** 2026-09-23  
**Status:** `PLANABLE_OFFICIAL_REFERENCE_EXPANSION: COMPLETE`

Planable is `PRIMARY_AND_SOLE_UI_UX_AND_WORKFLOW_REFERENCE` for OMA interaction and content-planning experience. OMA remains an independent product.

## Source order

| Rank | Class                                         | Use                                                                                                                                                                                    |
| ---- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `LIVE_AUTHENTICATED_PLANABLE_APP`             | Current UI and interactions only when actually observed. This stage did **not** re-open the live app. Prior 2026-09-22 measurements stay historical and are not upgraded by this pack. |
| 2    | `OFFICIAL_PLANABLE_HELP_CENTER`               | Screens, steps, statuses, filters, approvals, scheduling.                                                                                                                              |
| 3    | `OFFICIAL_PLANABLE_PUBLIC_API_DOCS`           | Public resources and announced operations only.                                                                                                                                        |
| 4    | `OFFICIAL_PRODUCT_GUIDES_AND_GETTING_STARTED` | Customer journey and agency usage.                                                                                                                                                     |
| 5    | `OFFICIAL_CHANGELOG`                          | Recent behavior changes.                                                                                                                                                               |
| 6    | `OFFICIAL_MARKETING_PAGES`                    | Supporting narrative only. Not a measurement authority.                                                                                                                                |

Third-party blogs, reviews, image search, and other products (Linear, Frame.io, Workfront) are not authorities.

## Conflict rules

1. A newer official help or changelog statement supersedes an older OMA note. Mark the old claim `SUPERSEDED_BY` plus the new Evidence ID. Do not delete history.
2. Help Center proves workflow and labeled states. It does not prove pixels, motion timings, or internal architecture.
3. Public API proves announced resources and operations. It does not prove database tables, queues, tenancy, or services.
4. Marketing copy is `DOC_SUPPORTING` until Help Center or a live session confirms it.
5. If no official source states a fact, record `UNKNOWN`. Do not invent CSS.
6. `PLAN_GATED` means the official source limits the behavior to a named plan (for example Enterprise multi-level approval, Pro/Enterprise Public API).
7. `OMA_ADAPTATION` is allowed only for OMA-owned domains that Planable does not govern: tenancy, authentication, capabilities, audit, immutable approvals, Brand Intelligence, Organic/Paid strategy, AI governance, and `DEC-016` external integrations.

## What Planable does not override

OMA tenancy, authentication, capability ownership, audit, immutable approved records, Brand Intelligence, Strategy Organic/Paid, AI governance, and external-integration decisions stay OMA-owned. On conflict, those rules win over a Planable interaction pattern. The visual and workflow language should still be Planable-shaped.

## AI pause

`IMPLEMENT_OMA_OPENAI_TEXT_INTELLIGENCE_OFFLINE_CERTIFICATION_GAPS` is paused. AI surfaces wait for this Planable journey map. `AI_LIVE_ENABLED` stays false. No live model verification is claimed.
