# OMA Design System Blueprint (Golden)

**Status:** READY for Stage 1 implementation (tokens + shell)  
**Authority:** `DEC-013` · `docs/DESIGN_REFERENCE_STRATEGY.md` · `docs/REFERENCE_PARITY_AUDIT.md`  
**Originality:** OMA tokens/layouts/icons/copy only — references authorize patterns, never assets.

## 1. Unified visual direction (one product)

OMA is a **light-first operational SaaS** with a **single dark review canvas** for media.

| Layer                                | Governing reference | OMA adaptation                                                |
| ------------------------------------ | ------------------- | ------------------------------------------------------------- |
| Shell density, speed, panels, motion | Linear              | Compact rail, quiet chrome, side drawers, 120–240ms motion    |
| Content planning visuals             | Planable            | Preview-led cards, calendar/grid/list, approvals near content |
| Media review only                    | Frame.io            | Dark canvas, version-locked feedback — not whole app chrome   |
| Request→production workflow concepts | Workfront           | Connected states — not Adobe visual system                    |
| Brand intelligence clarity           | Jasper / Semrush    | Sectioned profiles, evidence honesty — not their palettes     |
| Paid planning link                   | Smartly             | Operational status honesty — not Smartly UI                   |

**Do not** blend competing visual systems. One token set, one type scale, one shell.

Character (DEC-013): Precise · Creative · Calm · Accountable · Premium but practical.

## 2. Color tokens (canonical — implement as CSS variables)

Contrast pairs must be verified WCAG AA before Stage 1 acceptance. Values match approved DEC-013 working set.

| Token                  | Value     | Role                         |
| ---------------------- | --------- | ---------------------------- |
| `--oma-ink`            | `#14151A` | Primary text                 |
| `--oma-ink-subtle`     | `#3A3D46` | Strong secondary             |
| `--oma-muted`          | `#667085` | Secondary text               |
| `--oma-canvas`         | `#F6F7FB` | App background               |
| `--oma-surface`        | `#FFFFFF` | Panels, cards, tables        |
| `--oma-surface-raised` | `#FFFFFF` | Drawers/modals (+ elevation) |
| `--oma-border`         | `#E3E6ED` | Hairline borders             |
| `--oma-border-strong`  | `#C9CEDA` | Emphasized boundaries        |
| `--oma-primary`        | `#6658E8` | Primary action / selection   |
| `--oma-primary-soft`   | `#EEEAFE` | Selected row / soft focus    |
| `--oma-primary-ink`    | `#FFFFFF` | Text on primary              |
| `--oma-signal`         | `#12A7A1` | Connected / evidence accent  |
| `--oma-signal-soft`    | `#E6F7F6` | Soft signal fill             |
| `--oma-review-canvas`  | `#121419` | Media review background only |
| `--oma-review-ink`     | `#F3F4F6` | Text on review canvas        |
| `--status-info`        | `#2F6FDB` | Info                         |
| `--status-success`     | `#21875A` | Approved / done              |
| `--status-warning`     | `#B7791F` | Needs attention              |
| `--status-danger`      | `#C43D4B` | Failed / reject              |
| `--status-neutral`     | `#667085` | Draft / deferred             |

Rules: color never sole status signal; review-dark only on Frame.io-scoped surfaces.

## 3. Typography scale

**Family:** IBM Plex Sans (already in product) + system Arabic-capable fallback stack for AR.  
Do not switch to Inter/Roboto/default system as primary.

| Token      | Size / line / weight | Use                               |
| ---------- | -------------------- | --------------------------------- |
| `display`  | 28/34/600            | Rare page heroes (landing only)   |
| `title`    | 22/28/600            | Page H1                           |
| `title-sm` | 18/24/600            | Section H2                        |
| `body`     | 14/20/400            | Default dense body (Linear-grade) |
| `body-em`  | 14/20/500            | Emphasized body                   |
| `label`    | 12/16/500            | Field labels, nav secondary       |
| `meta`     | 12/16/400            | Timestamps, muted meta            |
| `mono`     | 12/16 IBM Plex Mono  | IDs, hashes                       |

**Current gap:** measured shell body at 16px with `lineHeight: normal` — rebuild to 14/20 denser default for app chrome; keep 16 only for marketing/public pages.

## 4. Spacing scale

Base unit **4px**. Allowed: `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

| Token     | px  | Use                     |
| --------- | --- | ----------------------- |
| `space-1` | 4   | Icon gaps               |
| `space-2` | 8   | Compact control padding |
| `space-3` | 12  | Default control padding |
| `space-4` | 16  | Card padding compact    |
| `space-5` | 20  | Section gaps            |
| `space-6` | 24  | Page section separation |
| `space-8` | 32  | Major blocks            |

## 5. Elevation / radius

| Token       | Value                            | Use                     |
| ----------- | -------------------------------- | ----------------------- |
| `radius-sm` | 6px                              | Inputs, chips           |
| `radius-md` | 8px                              | Buttons, menus          |
| `radius-lg` | 12px                             | Cards                   |
| `radius-xl` | 16px                             | Modals                  |
| `elev-0`    | none                             | Flat tables/rows        |
| `elev-1`    | `0 1px 2px rgba(20,21,26,0.06)`  | Cards                   |
| `elev-2`    | `0 8px 24px rgba(20,21,26,0.12)` | Drawers/modals/popovers |

**Current gap:** measured `boxShadow: none` everywhere — Stage 1 must introduce elev-1/2.

## 6. Grid / layout

| Breakpoint | Width    | Shell behavior                                                                              |
| ---------- | -------- | ------------------------------------------------------------------------------------------- |
| `mobile`   | ≤767     | Horizontal scroll rail or collapse to top nav strip; no horizontal page overflow            |
| `tablet`   | 768–1279 | Rail 64→200 expandable; content fluid                                                       |
| `desktop`  | ≥1280    | Rail **240px expanded** / **64px collapsed**; content max **1280px** inside main (not 1120) |
| `wide`     | ≥1440    | Same; optional right drawer 360–400px without crushing content                              |

**Measured now:** rail **220px** fixed; main container **1120px**; mobile stacks rail above content.

## 7. Shell geometry (Stage 1 target)

| Part                | Spec                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Left rail expanded  | 240px; brand mark + “OMA” + endorsement; section labels; icon+label nav                                       |
| Left rail collapsed | 64px icon-only; tooltips                                                                                      |
| Top bar             | Height **56px**; company/brand switcher; global search; primary Create; notifications; locale; profile/logout |
| Main                | Padding `20–24px`; min content width protected                                                                |
| Right drawer        | 360–400px overlay/push; Escape closes; focus trap                                                             |

IA sections (DEC-013 adapted to shipped domains):

1. **Workspace** — Home (Command Center)
2. **Intelligence** — Brand Intelligence (+ Strategy under brand)
3. **Plan** — Campaigns, Content
4. **Produce** — Requests, Tasks, Deliverables
5. **Govern** — Reviews, Schedule, Analytics
6. **Org** — Team, Activity, Company, Settings

## 8. Motion

| Kind                | Duration  | Easing   |
| ------------------- | --------- | -------- |
| Micro (hover/press) | 120–160ms | ease-out |
| Panel / drawer      | 180–240ms | ease     |
| Route crossfade     | 180–220ms | ease     |
| Reduced motion      | ≤0.01ms   | forced   |

No decorative loops. Drag pickup/valid/invalid states required when DnD ships.

## 9. RTL / i18n

- Logical properties only (`margin-inline`, `border-inline-end`, `inset-inline`).
- Mirroring for drawers (open from inline-end).
- Arabic uses same type tokens; verify IBM Plex Arabic coverage or approved Arabic companion font in Stage 1.
- No hardcoded left/right in new CSS.

## 10. Surfaces model

1. Operational light workspace (default)
2. Review dark canvas (deliverable media review only)
3. Client simplified light (future — same tokens)

## 11. Stage 1 completion gate

Stage 1 is done only when:

- tokens.css + type + space + elevation ship and are used by shell;
- rail IA sections match §7;
- top bar includes search + create placeholders (wired or honest disabled with labels);
- Command Center uses new shell without demo-only styling forks;
- EN/AR · LTR/RTL · 1440/1024/390 · focus-visible · reduced-motion verified;
- Visual acceptance criteria V-SHELL-* pass (`docs/VISUAL_ACCEPTANCE_CRITERIA.md`).

No product domain rebuild in Stage 1 beyond shell + Command Center chrome.
