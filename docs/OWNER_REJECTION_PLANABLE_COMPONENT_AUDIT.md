# Owner Rejection — Planable Component Parity Rebuild

**Stage:** `IMPLEMENT_OMA_PLANABLE_COMPONENT_PARITY_AND_PRODUCT_CLARITY_REBUILD`  
**Starting SHA:** `20849acf64ecbca60462333af57df69054c5339c`  
**Authority:** DEC-017 (Planable sole UI/UX reference)  
**Date recorded:** 2026-09-22

## Binding acceptance states (immediate)

| State                                  | Value                                       |
| -------------------------------------- | ------------------------------------------- |
| OWNER_VISUAL_REVIEW                    | **REJECTED**                                |
| VISUAL_ACCEPTANCE                      | **PENDING_OWNER**                           |
| PLANABLE_FULL_UI_UX_CERTIFICATION      | **TECHNICAL_PASS_VISUAL_REJECTED_BY_OWNER** |
| PREVIOUS_PLANABLE_VISUAL_CERTIFICATION | **SUPERSEDED_BY_OWNER_REJECTION**           |
| PLANABLE_COMPONENT_PARITY_REBUILD      | **COMPLETE_PENDING_OWNER_REVIEW**           |
| USER_ACCEPTANCE                        | PENDING                                     |
| EXTERNAL_INTEGRATIONS                  | DEFERRED                                    |
| DEMO_MODULES                           | NOT_PRODUCTION_COMPLETE                     |

P7 technical certification evidence may remain as engineering history. It is **not** visual acceptance proof.

## Owner rejection reasons (binding)

1. Product does not look close enough to Planable.
2. Dialogs and overlays are not professional enough.
3. Borders / radii / shadows are inaccurate.
4. Spacing / padding / alignment are inconsistent.
5. Inputs / selects / textareas do not read as a global product.
6. Hover / focus / active / disabled / error states are weak.
7. Motion / transitions are not Planable-enough.
8. Some pages look generic or like separate apps.
9. Client journey and per-stage value are unclear.
10. Production / Demo / AI-not-connected distinctions are unclear.
11. Passing tests do not address these visual/product objections.

## Rebuild mandate

- Live Planable **component-level** measurement (DOM + computed styles).
- Rebuild shared UI primitives once; apply across all OMA surfaces.
- Clarify product journey and AI/integration honesty in-product.
- New Owner Preview only — no automatic owner acceptance claim.

## Live component probe (2026-09-22)

- Profile: `OMA-References-Chrome`
- CDP: `127.0.0.1:9333`
- Access: `CDP_READY_AUTHENTICATED` on `https://app.planable.io/dashboard`
- Artifact: `artifacts/planable-component-parity-004/component-probe.json`
- Matrix: `docs/PLANABLE_COMPONENT_DELTA_MATRIX.md`
- Journey/AI: `docs/OMA_PRODUCT_JOURNEY_AND_AI_MAP.md`

Read-only rules observed: no Create/Edit/Upload/Comment/Approve/Invite/Publish/Save; no billing.

## Rebuild progress

| Workstream                                                   | Status                  |
| ------------------------------------------------------------ | ----------------------- |
| Shared tokens/primitives (input/dialog/drawer/button states) | UPDATED                 |
| Dialog structure (header/body/footer/close)                  | UPDATED                 |
| Command Center journey + checklist + honesty                 | UPDATED                 |
| EmptyState why/next slots                                    | UPDATED                 |
| Duplicate primitive inventory script                         | ADDED                   |
| Full page-by-page control migration                          | CONTINUES via inventory |

## Exact next

`OWNER_PREVIEW_AND_ACCEPTANCE_OMA_PLANABLE_COMPONENT_PARITY` after implementation gates + Owner Preview.
