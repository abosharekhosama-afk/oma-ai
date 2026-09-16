# OMA AI Design Reference Strategy

**Status:** `DEC-017` supersedes visual/UI/UX authority. `DEC-013` is historical functional assignment only.
**Updated:** 2026-09-16
**Decision:** `DEC-017 — RESOLVED 2026-09-16` (Planable sole UI/UX). `DEC-013` remains on file and is **not** visual authority.
**Scope:** Product experience direction only; this is not a component library or implementation plan.

> **Binding now:** Planable (`app.planable.io`) is `PRIMARY_AND_SOLE_UI_UX_AUTHORITY` for shell, type, color, space, motion, components, calendar/grid/feed/list, composer, comments, approvals, responsive, and RTL adaptation. Linear, Frame.io, Workfront, Jasper, Semrush, and Smartly are **not** visual authorities. ClickUp is `NOT_ADOPTED`. Specs: `docs/decisions/DEC-017-planable-single-ui-ux-reference.md`.

## 1. Fixed product boundary

OMA AI is an independent product under the IMKAN ecosystem. It has its own repository, deployable application boundary, information architecture, visual language, motion language, and design tokens. It is not required to copy IMKAN ONE screens, colors, navigation, or transitions.

The IMKAN relationship should initially be expressed through an approved endorsement such as **“OMA AI by IMKAN”** and explicit integrations such as WorkDrive—not through pixel-level duplication. Any future shared account, SSO, or company synchronization is a separate integration decision and must preserve OMA ownership.

## 2. Reference hierarchy

OMA AI must not become a collage of unrelated products. **One product** governs UI/UX. Other products inform named **functional logic** only.

| Priority | Official reference | Authority after DEC-017 | Adopt as a pattern | Do not copy |
| --- | --- | --- | --- | --- |
| Sole UI/UX | [Planable app](https://app.planable.io/) | `PRIMARY_AND_SOLE_UI_UX_AUTHORITY` | Shell, type, color, density, calendar/feed/grid/list, composer, comments, approvals, motion, responsive | Logo, name in-product, illustrations, proprietary assets, marketing heroes |
| Functional (not visual) | [Linear](https://linear.app/now/behind-the-latest-design-refresh) | `FUNCTIONAL_LOGIC_ONLY / NOT_VISUAL_AUTHORITY` | Issue/task workflow concepts only | Any Linear color, type, shell, motion, or layout |
| Functional (not visual) | [Frame.io](https://frame.io/features/review-and-approval) | `FUNCTIONAL_LOGIC_ONLY / NOT_VISUAL_AUTHORITY` | Exact-version review *logic* | Dark theater chrome, player, icons |
| Workflow (not visual) | [Adobe Workfront / CSC](https://business.adobe.com/solutions/content-supply-chain/workflow-planning.html) | `FUNCTIONAL_LOGIC_ONLY / NOT_VISUAL_AUTHORITY` | Request→production concepts | Adobe density or styling |
| Content model only | [Jasper Brand IQ](https://www.jasper.ai/brand-iq) | `CONTENT_MODEL_ONLY` | Brand context, governed generation | Jasper UI |
| Analysis model only | [Semrush](https://www.semrush.com/features/competitor-analysis/) | `ANALYSIS_MODEL_ONLY` | Evidence-led comparisons | Semrush chrome or third-party metrics as OMA facts |
| Paid logic only | [Smartly](https://www.smartly.io/platform-overview) | `PAID_AND_ANALYTICS_LOGIC_ONLY` | Linking creative to paid delivery state | Smartly UI or provider IDs in shared domains |
| Not adopted | ClickUp | `NOT_ADOPTED` | — | Any ClickUp visual or IA |

### Reference rule

- **Planable** is the only visual, interaction, motion, and layout authority.
- Linear, Frame.io, Workfront, Jasper, Semrush, and Smartly must not add competing color, type, shell, motion, or navigation models.
- ClickUp is not adopted.
- References describe useful patterns, not a license to clone. OMA keeps its name, logo, data, and original assets. Marketing `planable.io` is not a component source.

## 3. Initial OMA visual direction

### Experience character

- **Precise:** evidence, approvals, states, and next actions are unmistakable.
- **Creative:** content previews and assets receive visual priority.
- **Calm:** high information density without visual noise.
- **Accountable:** AI suggestions, human decisions, and external states are clearly different.
- **Premium but practical:** polished surfaces without decorative complexity.

### Proposed color tokens

**Superseded for implementation.** Historical DEC-013 violet/teal values remain below as archive only. Binding tokens: `docs/PLANABLE_DESIGN_TOKENS_SPEC.md` (canvas `#F5F6F7`, ink `#333333`, primary `#1677FF`, radius 6px, rail 256px).

<details>
<summary>Archived DEC-013 working palette (not visual authority)</summary>

These tokens are a direction for approval, not a finished accessible design system. Contrast pairs must be tested before implementation.

| Token | Value | Intended use |
| --- | --- | --- |
| `oma.ink` | `#14151A` | Primary text, navigation emphasis |
| `oma.canvas` | `#F6F7FB` | Main light workspace background |
| `oma.surface` | `#FFFFFF` | Cards, panels, tables, modals |
| `oma.primary` | `#6658E8` | Primary action, selected state, brand signature |
| `oma.primarySoft` | `#EEEAFE` | Selected rows, AI proposal context, subtle emphasis |
| `oma.signal` | `#12A7A1` | Evidence, connected/synchronized state, supporting accent |
| `oma.muted` | `#667085` | Secondary text |
| `oma.border` | `#E3E6ED` | Dividers and component boundaries |
| `oma.reviewCanvas` | `#121419` | Focused video/image/design review background only |
| `status.info` | `#2F6FDB` | Informational workflow state |
| `status.success` | `#21875A` | Approved, synchronized, completed |
| `status.warning` | `#B7791F` | Waiting, risk, partial, needs attention |
| `status.danger` | `#C43D4B` | Failed, rejected, destructive action |

</details>

Color must never be the only status signal. Every state also needs text, iconography where helpful, and accessible focus/contrast behavior.

### Surface model

1. **Operational workspace — light-first Planable canvas (`#F5F6F7`):** all OMA work including review comments beside content.
2. **No second visual system:** Frame.io-style dark theater is not the OMA app chrome after DEC-017.
3. **Client view:** the same Planable-language system with internal-only controls removed.

## 4. Proposed product shell

### Persistent shell (Planable)

- Left rail **256px**: workspace switcher, search, Content / Campaigns / Approvals / related OMA items, channels/brands, user + notifications.
- Content header: breadcrumbs + primary 32px action (`#1677FF`, radius 6px).
- Detail: modal + attached comments/approvals drawer (not a Linear 56px global bar).
- Company/brand context always visible when switching tenant-scoped work.

### Screen archetypes

| Archetype | Primary job | Reference emphasis |
| --- | --- | --- |
| Intelligence workspace | Connect a website, inspect sources, products, competitors, evidence | Planable editor/detail language; Semrush **logic only** |
| Strategy canvas | Evidence, objectives, Organic/Paid plans | Planable structured workspace; Jasper **model only** |
| Content plan | Calendar, feed/grid, list | Planable |
| Production board | Tasks through valid states | OMA Kanban in **Planable visual language** |
| Content detail | Brief, files, comments, versions, approvals | Planable post modal + drawer |
| Review room | Exact version + comments + decision | Planable approvals beside preview; Frame.io **logic only** |
| Client portal | Request, review, approve | Planable collaboration |
| Paid command center | Paid plan + creative + external status | Planable chrome; Smartly **logic only** |

## 5. Motion and interaction language

- Motion communicates hierarchy or state change; it is not decorative branding.
- Binding timings are Planable-measured: chrome **150ms linear**, controls **300ms cubic-bezier(0.4, 0, 0.2, 1)** or **300ms ease** (`docs/PLANABLE_MOTION_SPEC.md`). The older Linear 120–240ms sheet is not authority.
- Drag-and-drop must show a clear pickup state, valid targets, invalid targets, optimistic waiting, server confirmation, and authoritative rollback on rejection.
- AI generation uses a durable progress/state pattern rather than an indefinite shimmer that implies completion.
- Approval, external spend, publishing, deletion, and replacement of an approved version require deliberate confirmation proportional to risk.
- Preserve spatial context when opening details; prefer side panels or focused overlays when the user must return to the same calendar/board position.
- Support reduced motion, keyboard equivalents, visible focus, and RTL-safe directionality from the first component specification.

## 6. Integration experience rule

External systems appear as explicit connections with:

- provider and connected account;
- tenant/company binding;
- scope and permission status;
- last successful synchronization;
- authoritative external status;
- failure and retry/reconciliation action;
- a safe deep link when the user is authorized.

WorkDrive, Meta, and future platforms must feel integrated inside one OMA workflow, but the UI must never imply OMA owns external file bytes, billing, spend, delivery, or provider policy state when it does not.

## 7. Originality and design QA gate

Before a UI plan or implementation is approved:

1. Name the screen archetype and the single primary reference behavior used.
2. Explain the OMA adaptation and which product state/source of truth it represents.
3. Use OMA tokens and original components; do not copy source assets, proprietary icons, marketing copy, or complete screen arrangements.
4. Verify EN/AR, LTR/RTL, responsive layout, keyboard path, focus, contrast, non-color status, loading, empty, error, permission, stale, and conflict states.
5. Verify the product remains visually coherent when intelligence, planning, production, review, client, and paid-media surfaces are traversed in one journey.

## 8. DEC-013 (historical) vs DEC-017 (binding)

DEC-013 seven-reference research is retained. It does **not** authorize visual implementation.

Visual implementation follows **DEC-017** and `docs/PLANABLE_DESIGN_TOKENS_SPEC.md`.

Next stage when requested: **IMPLEMENT_OMA_PLANABLE_UI_UX_REBUILD_STAGE_P1**.

## 9. Visual rebuild program

Owner visual review remains `REJECTED`. Previous golden-shell / owner-remediation certifications are `SUPERSEDED`.

| Document | Path |
| --- | --- |
| DEC-017 | `docs/decisions/DEC-017-planable-single-ui-ux-reference.md` |
| Planable baseline | `docs/PLANABLE_UI_UX_BASELINE.md` |
| Tokens | `docs/PLANABLE_DESIGN_TOKENS_SPEC.md` |
| Components | `docs/PLANABLE_COMPONENT_SPEC.md` |
| Motion | `docs/PLANABLE_MOTION_SPEC.md` |
| Responsive | `docs/PLANABLE_RESPONSIVE_SPEC.md` |
| Surface map | `docs/PLANABLE_TO_OMA_SURFACE_MAP.md` |
| Acceptance | `docs/PLANABLE_VISUAL_ACCEPTANCE_CRITERIA.md` |
| Evidence | `.reference/005-planable-ui-ux/` |

Historical DEC-013 pack (`OMA_DESIGN_SYSTEM_BLUEPRINT.md`, Linear V-SHELL numbers, `.reference/004-visual-parity/`) is archive only.
