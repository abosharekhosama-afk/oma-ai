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

| ID        | Criterion                                                                                                                   | Alias / notes                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| V-REQ-01  | Requests inbox is dense/searchable/filterable; reveals unassigned, incomplete, and overdue work without metric-card walls   | Stage 4 primary                |
| V-REQ-02  | Request detail/triage shows data, relationships, actions, and status clearly in workspace/drawer form                       | Extends inbox criterion        |
| V-BRF-01  | Structured brief editor with completeness/readiness; links brand/campaign/content; AI assistance honesty                    | New Stage 4 mapping            |
| V-TSK-01  | Professional usable Kanban; persisted status matches Demo API after reload (move via accessible control if DnD not shipped) |                                |
| V-TSK-02  | List view is dense and functionally distinct from Board                                                                     |                                |
| V-TSK-03  | Task drawer preserves context; supports edit/checklist/comments/keyboard (Esc, focus trap)                                  | Extends prior drawer criterion |
| V-WRK-01  | Request → Brief → Task workflow is linked, persisted, and conversion is idempotent                                          | Stage 4 handoff                |
| V-LINK-02 | Campaign/Content/Request/Task relationships navigate to correct records                                                     | Continues Stage 3 V-LINK-01    |

**Stage 4 status:** implemented on `004-oma-complete-product-demo` — prove with Stage 4 Playwright + unit/security gates, not screenshots alone.

## Stage 5 — Deliverables / Reviews

| ID        | Criterion                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| V-DEL-01  | Deliverables portfolio shows asset, version, review state, owner/reviewer, relationships, next action at operational density |
| V-REV-01  | Review queue reveals what needs review, who owns it, due date, and open feedback                                             |
| V-REV-02  | Dark review workspace (`--oma-review-canvas`) keeps media central with version/comments/decisions                            |
| V-REV-03  | Visual annotations persist normalized coords, bind to version+thread, survive resize/reload                                  |
| V-VER-01  | Version history/compare distinguishes Latest vs Approved vs Superseded; no fake pixel-diff claim                             |
| V-APR-01  | Approve / Request changes / Reject target a specific version with reason, capability, immutability                           |
| V-WRK-02  | Task → Deliverable → Review → Revision → Approval is linked and Demo-API persisted                                           |
| V-LINK-03 | Campaign / Content / Request / Task / Deliverable deep links resolve to the correct record                                   |

**Legacy mapping (older IDs still referenced in matrix rows):**

| Legacy                    | Maps to             |
| ------------------------- | ------------------- |
| V-DEL-01 (media canvas)   | V-REV-02            |
| V-DEL-02 (active version) | V-VER-01 / V-REV-02 |
| V-DEL-03 (compare)        | V-VER-01            |
| V-REV-01 (inbox)          | V-REV-01 (expanded) |

**Stage 5 status:** implemented on `004-oma-complete-product-demo` — prove with Stage 5 Playwright + unit/security gates, not screenshots alone.

## Stage 6 — Schedule / Analytics / Org

| ID        | Criterion                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------- |
| V-SCH-01  | Schedule shows planning, timing, channels, state, and readiness without claiming live publishing   |
| V-SCH-02  | Calendar/Agenda/Queue usable on desktop/mobile and EN/AR; reschedule persists via Demo API         |
| V-ANL-01  | Analytics linked to campaigns/content, filterable, consistent numbers labeled Sample               |
| V-ANL-02  | Charts understandable visually and via accessible summaries; no Live/AI claims                     |
| V-TEAM-01 | Team/Workload binds Foundation membership CTA to Demo assignments without parallel membership SoT  |
| V-ORG-01  | Company/Members keeps Foundation capabilities/invites with Golden UI                               |
| V-ACT-01  | Activity distinguishes Foundation audited vs Demo workflow events with correct deep links          |
| V-SET-01  | Settings IA organized; working prefs persist; non-working controls are not fake interactive        |
| V-INT-01  | Integrations show Not Connected/Deferred/Manual fallback with no provider selection or credentials |
| V-LINK-04 | Brand→Analytics path coherent; Team/Activity/Settings support without conflicting data             |

**Legacy mapping:**

| Legacy   | Maps to  |
| -------- | -------- |
| V-ORG-02 | V-INT-01 |

**Stage 6 status:** implemented on `004-oma-complete-product-demo` — prove with Stage 6 Playwright + unit/security gates, not screenshots alone.

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
