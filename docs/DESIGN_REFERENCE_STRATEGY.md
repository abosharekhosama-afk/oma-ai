# OMA AI Design Reference Strategy

**Status:** Approved reference hierarchy — palette and component details remain design-validation inputs
**Updated:** 2026-08-25
**Decision:** `DEC-013 — RESOLVED 2026-08-25`
**Scope:** Product experience direction only; this is not a component library or implementation plan.

## 1. Fixed product boundary

OMA AI is an independent product under the IMKAN ecosystem. It has its own repository, deployable application boundary, information architecture, visual language, motion language, and design tokens. It is not required to copy IMKAN ONE screens, colors, navigation, or transitions.

The IMKAN relationship should initially be expressed through an approved endorsement such as **“OMA AI by IMKAN”** and explicit integrations such as WorkDrive—not through pixel-level duplication. Any future shared account, SSO, or company synchronization is a separate integration decision and must preserve OMA ownership.

## 2. Reference hierarchy

OMA AI must not become a collage of unrelated products. One reference governs the content experience, one supports interaction quality, and the remaining references inform only their named functional domain.

| Priority | Official reference | OMA use | Adopt as a pattern | Do not copy |
| --- | --- | --- | --- | --- |
| Visual North Star | [Planable](https://planable.io/product/) | Primary visual reference for content planning, calendars, previews, and collaboration | Content-first cards, rich previews, approvals next to the content, role-aware workspaces | Brand colors, logo, illustrations, or exact screen composition |
| Interaction reference | [Linear](https://linear.app/now/behind-the-latest-design-refresh) | Interface density, speed, side panels, and restrained motion | Calm hierarchy, compact navigation, fast transitions, detail drawer patterns | Linear's brand palette, issue model, or dark visual identity as the whole product |
| Review reference | [Frame.io](https://frame.io/features/review-and-approval) | Image/video review with feedback tied to one exact version | Dark focus canvas, anchored feedback, review status tied to a version | Player chrome, icons, terminology, or proprietary assets |
| Workflow reference | [Adobe Content Supply Chain / Workfront](https://business.adobe.com/solutions/content-supply-chain/workflow-planning.html) | Request, planning, production, and approval workflow | Connected workflow and approval concepts | Enterprise visual density or Adobe styling |
| AI brand intelligence | [Jasper Brand IQ](https://www.jasper.ai/brand-iq) | Brand intelligence, voice, tone, and style | Explicit brand context and governed generation | Jasper's visual language or claims |
| Website and competitor intelligence | [Semrush Competitor Analysis](https://www.semrush.com/features/competitor-analysis/) | Website, competitor, and evidence analysis | Source-backed comparisons, gaps, and confidence/freshness | Third-party metrics presented as OMA-owned facts |
| Paid-media operations | [Smartly](https://www.smartly.io/platform-overview) | Connect approved content to paid-media planning and execution | One operational view linking creative, media intent, and external delivery state | Smartly's campaign model or provider-specific identifiers in shared OMA domains |

### Reference rule

- **Planable + Linear** may influence the base product experience.
- **Frame.io** may influence only the focused asset-review surface.
- Workfront, Jasper, Semrush, and Smartly are functional references. They must not add competing color systems or navigation models.
- References describe useful patterns, not requirements to clone source products. OMA must use original layouts, copy, icons, tokens, and assets.

## 3. Initial OMA visual direction

### Experience character

- **Precise:** evidence, approvals, states, and next actions are unmistakable.
- **Creative:** content previews and assets receive visual priority.
- **Calm:** high information density without visual noise.
- **Accountable:** AI suggestions, human decisions, and external states are clearly different.
- **Premium but practical:** polished surfaces without decorative complexity.

### Proposed color tokens

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

Color must never be the only status signal. Every state also needs text, iconography where helpful, and accessible focus/contrast behavior.

### Surface model

1. **Operational workspace — light-first:** intelligence, strategy, plans, calendars, boards, dashboards, client portal, and paid operations.
2. **Review focus — dark canvas:** video, photography, and design review where media accuracy and anchored feedback require reduced surrounding contrast.
3. **Client view — simplified light surface:** the same OMA design system with internal-only controls removed, not a separate product theme.

This is contextual surface switching, not two unrelated applications.

## 4. Proposed product shell

### Persistent shell

- Left rail: `Home`, `Intelligence`, `Strategy`, `Content Plan`, `Production`, `Reviews`, `Assets`, `Paid Media`, and `Client Portal`, filtered by capability.
- Top context bar: active company/brand, global search, create action, notifications, help, and profile.
- Contextual right panel: AI assistant, object details, evidence, activity, or approvals without losing the current workspace.
- Company/brand context must always be visible when switching could affect tenant-scoped work.

### Screen archetypes

| Archetype | Primary job | Reference emphasis |
| --- | --- | --- |
| Intelligence workspace | Connect a website, inspect sources, products, competitors, evidence, confidence, and freshness | Semrush + Linear |
| Strategy canvas | Review evidence, assumptions, objectives, recommendations, and separate Organic/Paid plans | Jasper + Linear |
| Content plan | Switch among calendar, feed/grid preview, and list; filter by channel, campaign, status, and owner | Planable |
| Production board | Convert plan items to tasks; assign, drag through valid states, expose blockers and workload | Linear interaction + Workfront workflow |
| Content detail | Show brief, objective, references, files, comments, versions, approvals, and activity in one stable context | Planable + Frame.io when reviewing media |
| Review room | Review one exact deliverable version with anchored feedback, decision history, and compare behavior | Frame.io |
| Client portal | Request/price content, answer clarification, track milestones, review exposed versions, approve permitted actions | Planable collaboration + OMA simplified shell |
| Paid command center | Link Paid-plan intent and approved creative to campaign drafts, approvals, sync, spend, and provider status | Smartly |

## 5. Motion and interaction language

- Motion communicates hierarchy or state change; it is not decorative branding.
- Micro-interactions should normally complete in `120–180 ms`; panel and route transitions in `180–240 ms`.
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

## 8. Approved DEC-013 reference hierarchy

The user approved the seven-reference assignment in section 2:

- Planable for the primary visual content-planning, calendar, preview, and collaboration experience;
- Linear for interface density, speed, side panels, and restrained motion;
- Frame.io for exact-version image/video review and feedback;
- Adobe Workfront for request, planning, production, and approval workflow;
- Jasper Brand IQ for brand voice, tone, style, and governed brand intelligence;
- Semrush for website, competitor, and evidence-led intelligence;
- Smartly for connecting approved content to paid-media planning and execution.

No additional product may be added to the canonical hierarchy without an explicit decision update. The light/dark surface model and OMA Violet `#6658E8` plus Signal Teal `#12A7A1` remain working design inputs that must pass prototype, accessibility, EN/AR, and RTL/LTR validation; they are not copied from the reference products.

Approval of the reference hierarchy authorizes a later design-system specification. It does not authorize UI code or choose a frontend stack.
