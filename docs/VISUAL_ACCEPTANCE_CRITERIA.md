# Visual Acceptance Criteria — OMA Full Product Experience

**Status:** Binding for Stages 1–7  
**Baseline rejected:** functional demo at `f3f450d`  
**How to prove:** Playwright visual journeys + measured DOM/styles + screenshots with git SHA metadata.  
**Forbidden proofs alone:** route exists, tests green, “looks Linear-like.”

## Global rules (all stages)

| ID     | Criterion                                                       |
| ------ | --------------------------------------------------------------- |
| V-G-01 | One token set; no feature-local palettes                        |
| V-G-02 | Color not sole status signal                                    |
| V-G-03 | EN + AR; `dir` correct; no overflow at 1440/1024/390            |
| V-G-04 | Focus-visible ring on interactive controls                      |
| V-G-05 | `prefers-reduced-motion` respected                              |
| V-G-06 | No proprietary reference assets/logos                           |
| V-G-07 | Demo/simulated disclosures remain honest where demo data exists |
| V-G-08 | External integrations remain Not Connected / Deferred           |

---

## Stage 1 — Shell (`V-SHELL-*`)

| ID         | Measurable criterion                                                        |
| ---------- | --------------------------------------------------------------------------- |
| V-SHELL-01 | Rail expanded width **240±4px** or collapsed **64±4px**                     |
| V-SHELL-02 | Top bar height **56±4px**                                                   |
| V-SHELL-03 | Nav grouped into ≥4 labeled sections (not a flat dump)                      |
| V-SHELL-04 | Top bar contains switcher + search control + create control + notifications |
| V-SHELL-05 | Body text in chrome **14px / 20px** line-height                             |
| V-SHELL-06 | Cards use `elev-1`; drawers/modals `elev-2`                                 |
| V-SHELL-07 | 390px: no horizontal overflow; nav usable                                   |
| V-SHELL-08 | AR RTL: rail border uses logical inline-end; drawers mirror                 |

## Stage 2 — Home / Brand / Strategy

| ID        | Criterion                                                                    |
| --------- | ---------------------------------------------------------------------------- |
| V-HOME-01 | Command Center first viewport explains next actions without briefing         |
| V-HOME-02 | Portfolio + needs-action + deadlines visually hierarchical (not equal cards) |
| V-BWI-01  | Brand table densified; status columns scannable                              |
| V-STR-01  | Strategy workspace uses same shell; Organic/Paid visually distinct           |

## Stage 3 — Campaigns / Content

| ID        | Criterion                                                                                                   | Alias / notes                          |
| --------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| V-CMP-01  | Campaign portfolio is dense/filterable; shows track, status, strategy, owner, content count, next action    | V-CAM-01                               |
| V-CMP-02  | Campaign workspace shows goal, progress, linked content, needs-attention without mini-dashboard clutter     | V-CAM-02                               |
| V-CNT-01  | Content Hub is content-first with real Calendar / List / Grid views                                         | V-CONT-01; calendar items show channel |
| V-CNT-02  | Calendar usable on desktop/mobile and EN/AR without overflow or fake interactions                           | V-CONT-02                              |
| V-CNT-03  | Content detail/composer uses drawer/dialog with keyboard/focus; List/Grid/Calendar switch preserves filters | V-CONT-03                              |
| V-LINK-01 | Strategy → Campaign → Content relationships and links resolve to correct records                            | Stage 3 cross-surface                  |

**Stage 3 status:** implemented on `004-oma-complete-product-demo` — prove with Stage 3 Playwright + unit gates, not screenshots alone.

## Stage 4 — Requests / Tasks

| ID       | Criterion                                                         |
| -------- | ----------------------------------------------------------------- |
| V-REQ-01 | Request inbox + detail/brief in drawer or split without dead ends |
| V-TSK-01 | Kanban columns labeled with counts; cards show priority+due       |
| V-TSK-02 | Task drawer: Esc closes; focus trapped; checklist visible         |

## Stage 5 — Deliverables / Reviews

| ID       | Criterion                                                               |
| -------- | ----------------------------------------------------------------------- |
| V-DEL-01 | Media review uses `--oma-review-canvas`                                 |
| V-DEL-02 | Active version label always visible                                     |
| V-DEL-03 | Compare shows two named versions                                        |
| V-REV-01 | Review inbox prioritizes awaiting items; deep link to deliverable works |

## Stage 6 — Schedule / Analytics / Org

| ID       | Criterion                                                     |
| -------- | ------------------------------------------------------------- |
| V-SCH-01 | Schedule shows readiness + not-connected publishing state     |
| V-ANL-01 | Charts labeled Demo Data; Organic vs Paid comparison readable |
| V-ORG-01 | Team workload readable; restricted presentation clear         |
| V-ORG-02 | Integrations catalog: every row Not Connected/Deferred        |

## Stage 7 — Certification pack

| ID        | Criterion                                                           |
| --------- | ------------------------------------------------------------------- |
| V-CERT-01 | Screenshots for all Stage surfaces at 1440 + AR 390                 |
| V-CERT-02 | Keyboard path documented for shell + one drawer + one modal         |
| V-CERT-03 | No VG-001…004 blockers remain                                       |
| V-CERT-04 | Owner visual session recorded as ACCEPTED or explicit residual list |

---

## Measurement method

1. Capture computed styles for rail/top/type/elevation (same method as `.reference/004-visual-parity/ours/measurements`).
2. Attach `gitSha` in screenshot meta.
3. Fail Stage if any BLOCKER V-* for that Stage fails.
