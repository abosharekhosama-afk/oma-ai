# Reference Parity Audit — Complete Product Demo Visual Quality

**Status:** COMPLETE for blueprint authorization  
**Mode:** REFERENCE_DISCOVERY  
**Branch:** `004-oma-complete-product-demo`  
**App HEAD measured:** `f3f450d4c8c39a34196e820c5751145d51ce1348`  
**Governing authority:** `DEC-013` via `docs/DESIGN_REFERENCE_STRATEGY.md`  
**Protocol:** `docs/REFERENCE_PARITY_PROTOCOL.md`  
**Registry:** `.reference/registry.json`  
**Owner decision:** `OMA_FULL_DEMO_VISUAL_ACCEPTANCE: REJECTED` (functional demo certified; visual/product quality insufficient)

## 1. Access and authority validation

| Check                                                 | Result                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Reference strategy read                               | PASS — DEC-013 seven-reference hierarchy                                            |
| Registry `authenticatedReferenceParity`               | `PENDING`                                                                           |
| All DEC-013 refs `accessPolicy`                       | `PUBLIC_SOURCE_ONLY`                                                                |
| New authenticated Reference Inspector runs this stage | **NOT PERMITTED** by registry                                                       |
| Prior archived live evidence reuse                    | ALLOWED as historical `LIVE_VERIFIED` with ceiling `REFERENCE_LIMITED` for re-claim |
| Public marketing/docs                                 | ALLOWED as `DOC_VERIFIED`                                                           |
| OMA application measurement                           | PASS — Playwright DOM/computed-style on Owner preview                               |

**Implication:** This audit does **not** claim fresh live authenticated parity against Planable/Linear/Frame.io app shells. Precise rebuild specs use (a) DEC-013 design direction, (b) archived `.reference/002-evidence/raw-*.txt` structural observations, (c) official public docs, (d) measured OMA surfaces. Anything requiring a signed-in reference session that is not already archived remains `UNKNOWN` / `REFERENCE_LIMITED`.

## 2. References inspected (this stage)

| referenceId     | Authority (DEC-013)                             | Access this stage  | Evidence used                                        | Status                                  |
| --------------- | ----------------------------------------------- | ------------------ | ---------------------------------------------------- | --------------------------------------- |
| planable        | VISUAL_REFERENCE + WORKFLOW_AUTHORITY (content) | PUBLIC_SOURCE_ONLY | `002-evidence/raw-planable.txt`, public product page | LIVE_VERIFIED (archived) + DOC_VERIFIED |
| linear          | PLATFORM_SHELL + NAVIGATION                     | PUBLIC_SOURCE_ONLY | `002-evidence/raw-linear.txt`, design refresh docs   | LIVE_VERIFIED (archived) + DOC_VERIFIED |
| frameio         | SECONDARY — media review only                   | PUBLIC_SOURCE_ONLY | Feature docs + DEC-013                               | DOC_VERIFIED                            |
| workfront       | WORKFLOW_AUTHORITY only                         | PUBLIC_SOURCE_ONLY | Public CSC/workflow docs                             | DOC_VERIFIED                            |
| jasper-brand-iq | FUNCTIONAL                                      | PUBLIC_SOURCE_ONLY | `raw-jasper.txt` / 002 pattern matrix                | DOC_VERIFIED                            |
| semrush         | FUNCTIONAL                                      | PUBLIC_SOURCE_ONLY | 002 Semrush patterns                                 | DOC_VERIFIED / LIVE_LIMITED archived    |
| smartly         | FUNCTIONAL (paid link)                          | PUBLIC_SOURCE_ONLY | Public overview                                      | DOC_VERIFIED                            |

**AUTH_REQUIRED sites if Owner later enables authenticated policy:** `app.planable.io`, `linear.app` (workspace), Frame.io app, Jasper app, Semrush app, Smartly app. Do not guess credentials.

## 3. OMA surfaces measured (LIVE — our app)

Evidence: `.reference/004-visual-parity/ours/measurements/*.json`  
Screenshots: `artifacts/visual-parity-004/*-1440.png` (+ `command-center-390.png`)

| Surface            | Route                                   | Rail W | Top H | H1                    | Notes                          |
| ------------------ | --------------------------------------- | ------ | ----- | --------------------- | ------------------------------ |
| Command Center     | `/app`                                  | 220px  | ~66px | Command center        | Hybrid real+demo panels        |
| Brand Intelligence | `/app/brands`                           | 220    | ~66   | Brand Intelligence    | Production 002                 |
| Campaigns          | `/app/campaigns`                        | 220    | ~66   | Campaigns             | Demo list                      |
| Content            | `/app/content`                          | 220    | ~66   | Content               | Calendar/grid/list toggle      |
| Requests           | `/app/requests`                         | 220    | ~66   | Requests              | Demo                           |
| Tasks              | `/app/tasks`                            | 220    | ~66   | Tasks                 | Kanban                         |
| Deliverable detail | `/app/deliverables/demo-deliv-carousel` | 220    | ~66   | Fabric story carousel | Light canvas — not review-dark |
| Reviews            | `/app/reviews`                          | 220    | ~66   | Reviews               | Demo inbox                     |
| Schedule           | `/app/schedule`                         | 220    | ~66   | Schedule              | Demo                           |
| Analytics          | `/app/analytics`                        | 220    | ~66   | Analytics             | Demo charts                    |
| Team               | `/app/team`                             | 220    | ~66   | Team                  | Demo                           |
| Activity           | `/app/activity`                         | 220    | ~66   | (weak heading)        | Demo                           |
| Settings           | `/app/settings`                         | 220    | ~66   | Settings              | Integrations deferred          |
| Company            | `/app/company/members`                  | 220    | ~66   | Company members       | Production 001                 |

**Measured tokens in use:** ink `#14151a`, canvas `#f6f7fb`, surface `#ffffff`, primary `#6658e8`, signal `#12a7a1`, muted `#667085`, border `#e3e6ed`, font IBM Plex Sans. Card radius `12px`, button radius `8px`, **box-shadow: none** on shell/card. Main max-width container `1120px`.

## 4. Most severe current OMA gaps (Owner-visible)

| ID     | Severity | Gap                                                                   | Why it fails global SaaS quality                                              |
| ------ | -------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| VG-001 | BLOCKER  | Flat 14-link rail without IA hierarchy / section grouping             | Linear/Planable shells group work; OMA reads as a feature dump                |
| VG-002 | BLOCKER  | No content-first visual hierarchy on planning surfaces                | Planable authority requires preview-led cards; OMA uses generic compact lists |
| VG-003 | BLOCKER  | No Linear-grade detail drawer / right contextual panel                | Detail navigation loses spatial context; density feels sparse + disconnected  |
| VG-004 | BLOCKER  | Media review is light page, not Frame.io review canvas                | Deliverable review lacks dark focus, anchored feedback, version primacy       |
| VG-005 | MAJOR    | Incomplete type/spacing/elevation system                              | Single 16px body; no modular scale; no shadow/elevation language              |
| VG-006 | MAJOR    | Top bar missing search + primary create + clear brand context density | Shell incomplete vs DEC-013 §4                                                |
| VG-007 | MAJOR    | Calendar/kanban geometry amateur                                      | Filters/toggles exist but lack professional column rhythm & preview cards     |
| VG-008 | MAJOR    | Status/chip/table systems inconsistent across demo vs 002             | One product must share one status language                                    |
| VG-009 | MAJOR    | Motion language under-implemented                                     | Only reduced-motion + fade; no panel 180–240ms system                         |
| VG-010 | MINOR    | Activity heading weakness / empty polish variance                     | Dead-end risk on secondary surfaces                                           |

## 5. False-parity audit

| Claim                                               | Verdict                      |
| --------------------------------------------------- | ---------------------------- |
| Functional demo = visual acceptance                 | REJECTED (Owner)             |
| “Linear-like / Planable-style” without measurements | FORBIDDEN in rebuild specs   |
| Authenticated live parity 100%                      | NOT CLAIMED — policy PENDING |
| Demo modules production-complete                    | NOT CLAIMED                  |
| Copying reference assets/branding                   | FORBIDDEN                    |

## 6. Evidence limitations

1. Cannot re-open authenticated Planable/Linear apps under current `PUBLIC_SOURCE_ONLY`.
2. Archived live notes may drift from current reference UI versions.
3. Frame.io / Smartly / Workfront lack deep archived DOM measurements — treat as pattern authority + DOC only.
4. OMA screenshots are Owner-preview demo mode; production-shaped Brand/Strategy visuals still share the same weak shell.

## 7. Downstream artifacts

| Deliverable                     | Path                                          |
| ------------------------------- | --------------------------------------------- |
| Design system blueprint         | `docs/OMA_DESIGN_SYSTEM_BLUEPRINT.md`         |
| Component/interaction blueprint | `docs/COMPONENT_AND_INTERACTION_BLUEPRINT.md` |
| Surface rebuild matrix          | `docs/SURFACE_REBUILD_MATRIX.md`              |
| Visual acceptance criteria      | `docs/VISUAL_ACCEPTANCE_CRITERIA.md`          |
| Machine measurements            | `.reference/004-visual-parity/`               |

**Next stage authorized:** `IMPLEMENT_OMA_GOLDEN_DESIGN_SYSTEM_AND_SHELL` (Stage 1 only until Stage 1 acceptance criteria pass).
