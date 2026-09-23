# DEC-017 — Planable as the single UI/UX reference for OMA

**Status:** `RESOLVED — PLANABLE_SINGLE_UI_UX_REFERENCE`
**Resolved:** 2026-09-16
**Owner:** Binding owner decision
**Starting SHA:** `6bb76a33de6529ce46af47e379743169599992fa`
**Mode:** `REFERENCE_AND_SPEC_ONLY`
**Implementation:** P1–P6 engineering complete. Owner visual review **REJECTED** (2026-09-22). P7 visual certification superseded. Component-parity rebuild required — see `docs/OWNER_REJECTION_PLANABLE_COMPONENT_AUDIT.md`.

| State                                 | Value                                           |
| ------------------------------------- | ----------------------------------------------- |
| DEC-017                               | `RESOLVED — PLANABLE_SINGLE_UI_UX_REFERENCE`    |
| PLANABLE                              | `PRIMARY_AND_SOLE_UI_UX_AND_WORKFLOW_REFERENCE` |
| OWNER_VISUAL_REVIEW                   | `REJECTED`                                      |
| PREVIOUS_VISUAL_CERTIFICATIONS        | `SUPERSEDED_BY_OWNER_REJECTION`                 |
| PLANABLE_REFERENCE_BASELINE           | `COMPLETE`                                      |
| PLANABLE_UI_UX_STAGE_P1               | `COMPLETE`                                      |
| PLANABLE_UI_UX_STAGE_P2               | `COMPLETE`                                      |
| PLANABLE_UI_UX_STAGE_P3               | `COMPLETE`                                      |
| PLANABLE_UI_UX_STAGE_P4               | `COMPLETE`                                      |
| PLANABLE_UI_UX_STAGE_P5               | `COMPLETE`                                      |
| PLANABLE_UI_UX_STAGE_P6               | `COMPLETE`                                      |
| PLANABLE_UI_UX_IMPLEMENTATION         | `COMPLETE`                                      |
| PLANABLE_FULL_UI_UX_CERTIFICATION     | `TECHNICAL_PASS_VISUAL_REJECTED_BY_OWNER`       |
| PLANABLE_COMPONENT_PARITY_REBUILD     | `COMPLETE_PENDING_OWNER_REVIEW`                 |
| VISUAL_ACCEPTANCE                     | `REJECTED`                                      |
| USER_ACCEPTANCE                       | `PENDING`                                       |
| EXTERNAL_INTEGRATIONS                 | `DEFERRED`                                      |
| PLANABLE_OFFICIAL_REFERENCE_EXPANSION | `COMPLETE`                                      |
| PLANABLE_FULL_PRODUCT_GAP_MATRIX      | `READY_FOR_IMPLEMENTATION`                      |
| OPENAI_OFFLINE_CERTIFICATION_GAPS     | `PAUSED_PENDING_REFERENCE_ALIGNMENT`            |
| OPENAI_LIVE_ACCESS                    | `NOT_VERIFIED`                                  |
| AI_LIVE_ENABLED                       | `FALSE`                                         |

## Decision

Planable is the **primary and sole UI/UX and workflow reference** for OMA.

Product app (authoritative for components): `https://app.planable.io/`
Marketing (brand context only): `https://planable.io/` and `https://planable.io/product/`

From this decision, Planable governs:

App shell, navigation, workspace hierarchy, typography, font sizes and weights, colors, spacing, borders, radius, shadows, icon style, content cards, tables and lists, calendar, grid, feed, composer, drawers, dialogs, popovers, menus, filters, comments, approval states, loading/empty/error states, motion, transitions, responsive behavior, mobile UX, and RTL adaptation.

## What this supersedes

| Prior artifact                                                                    | Change                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEC-013` visual hierarchy (Planable + Linear + Frame.io visual split)            | Visual, motion, layout, and component chrome authority is **revoked** from Linear, Frame.io, Workfront, Jasper, Semrush, Smartly, and ClickUp. `DEC-013` remains a historical functional-reference assignment only.               |
| Constitution Principle XIII “one visual North Star and one interaction reference” | Amended: one UI/UX North Star (Planable). Other products are functional-logic only.                                                                                                                                               |
| Golden design system (`docs/OMA_DESIGN_SYSTEM_BLUEPRINT.md`)                      | Status: **SUPERSEDED as visual authority**. Tokens, shell geometry, Inter-as-product-face, OMA Violet `#6658E8`, Linear 56px top bar, and Frame.io dark-canvas-as-visual-system are not acceptance baselines after this decision. |
| Owner-remediation / full visual certifications                                    | `PREVIOUS_VISUAL_CERTIFICATIONS: SUPERSEDED`. They do not authorize visual acceptance.                                                                                                                                            |
| ClickUp                                                                           | `NOT_ADOPTED` (not a visual or functional authority).                                                                                                                                                                             |

## Functional-only remainder

These products may inform **domain logic** inside OMA. They must not contribute colors, type, shell, visual components, motion, or layout:

| Product   | Authority after DEC-017                        |
| --------- | ---------------------------------------------- |
| Planable  | `PRIMARY_AND_SOLE_UI_UX_AUTHORITY`             |
| Linear    | `FUNCTIONAL_LOGIC_ONLY / NOT_VISUAL_AUTHORITY` |
| Frame.io  | `FUNCTIONAL_LOGIC_ONLY / NOT_VISUAL_AUTHORITY` |
| Workfront | `FUNCTIONAL_LOGIC_ONLY / NOT_VISUAL_AUTHORITY` |
| Jasper    | `CONTENT_MODEL_ONLY`                           |
| Semrush   | `ANALYSIS_MODEL_ONLY`                          |
| Smartly   | `PAID_AND_ANALYTICS_LOGIC_ONLY`                |
| ClickUp   | `NOT_ADOPTED`                                  |

OMA functions that Planable does not show (for example advanced Kanban) stay OMA functions, expressed in Planable visual language.

## Originality and legal boundary

Required:

- High structural, density, motion, and usage parity with Planable.
- OMA name, OMA logo, OMA data, OMA capabilities, original OMA assets.

Forbidden:

- Planable logo, product name inside OMA UI, screenshots of their content as product data, proprietary source, owned media, or any claim that OMA is a Planable product.

Marketing-site gradients, heroes, and illustrations must not enter the OMA app unless the same treatment exists in `app.planable.io`.

## Access for this baseline

Authenticated read-only inspection of an existing `app.planable.io` session over CDP `127.0.0.1:9333` is authorized for measurement. Mutations remain forbidden (create, edit, upload, comment, approve, reject, invite, connect, schedule, publish, export, billing, trial, settings save, delete).

## Downstream specs (no product code)

- `docs/PLANABLE_UI_UX_BASELINE.md`
- `docs/PLANABLE_DESIGN_TOKENS_SPEC.md`
- `docs/PLANABLE_COMPONENT_SPEC.md`
- `docs/PLANABLE_MOTION_SPEC.md`
- `docs/PLANABLE_RESPONSIVE_SPEC.md`
- `docs/PLANABLE_TO_OMA_SURFACE_MAP.md`
- `docs/PLANABLE_VISUAL_ACCEPTANCE_CRITERIA.md`
- `.reference/005-planable-ui-ux/`

## Next permitted stage

`IMPLEMENT_OMA_PLANABLE_OFFICIAL_REFERENCE_GAPS`

Do not implement until that stage is explicitly requested.

## 2026-09-23 official product expansion

Prior sections stay in force. This expansion adds workflow authority. It does not delete the 2026-09-16 decision or the 2026-09-22 owner rejection.

Planable is the sole reference for UI language, interaction language, content-planning workflow, collaboration UX, approval UX, scheduling UX, view organization, and component behavior.

Explicit limits:

- This is not a literal copy of the Planable brand.
- OMA does not copy Planable code, assets, or logos.
- OMA identity, tenancy, authentication, capabilities, audit, immutable approvals, Brand Intelligence, Organic/Paid strategy, AI governance, and DEC-016 stay independent.
- On conflict, OMA security, tenancy, audit, and immutability win.
- The public API does not prove Planable's internal architecture.

Source order, conflict rules, and Evidence IDs: `docs/PLANABLE_REFERENCE_AUTHORITY.md` and `docs/PLANABLE_OFFICIAL_SOURCE_REGISTRY.md`.

Historical live measurements in `.reference/005-planable-ui-ux/` remain. Where a 2026-09-23 Help Center statement is more specific about workflow, the new Evidence ID supersedes the older workflow claim. Pixel measurements from 2026-09-22 are not re-proven by this expansion (`SUPERSEDED_BY` does not apply to unmeasured color or motion).

`IMPLEMENT_OMA_OPENAI_TEXT_INTELLIGENCE_OFFLINE_CERTIFICATION_GAPS` is paused until the Planable journey is the implementation baseline. Existing AI code is unchanged in this expansion.
