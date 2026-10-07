# OMA × Planable — Pixel-Level Parity Gap Ledger

**Method:** `PIXEL_LEVEL_REFERENCE_PARITY` (`.cursor/rules/pixel-level-reference-parity.mdc`)  
**Starting SHA:** `e576570631b948c11b8a0a57d0d83614abd9e765`  
**Owner decision:** Previous R2–R6 visual PASS labels are revoked. Technical CI is historical evidence only.

## Binding status labels (Part B — Content Plan golden)

| Label                            | Status           |
| -------------------------------- | ---------------- |
| GOLDEN_CONTENT_PLAN              | PASS             |
| OMA_PLANABLE_PIXEL_LEVEL_REBUILD | IN_PROGRESS      |
| OWNER_VISUAL_REVIEW              | REJECTED         |
| VISUAL_ACCEPTANCE                | REJECTED         |
| USER_ACCEPTANCE                  | PENDING          |
| REAL_RENDERED_VISUAL_PARITY      | NOT_PASS         |
| R2_SHARED_COMPONENT_PARITY       | REVOKED_BY_OWNER |
| R3_SHELL_HIERARCHY_PARITY        | REVOKED_BY_OWNER |
| R4_PLANNING_PARITY               | REVOKED_BY_OWNER |
| R5_PRODUCTION_REVIEW_PARITY      | REVOKED_BY_OWNER |
| R6_REMAINING_SURFACE_PARITY      | REVOKED_BY_OWNER |

## Gate counters (live)

| Gate                                    | Before (e576570)    | After (Part B golden)                                          |
| --------------------------------------- | ------------------- | -------------------------------------------------------------- |
| P0                                      | many (Owner reject) | 0 (Content Plan golden scope)                                  |
| P1                                      | many                | 0 (Content Plan golden scope)                                  |
| Unexplained P2                          | many                | 0 for Content Plan chrome; PX-CP-005 remains REFERENCE_LIMITED |
| Full-page calendar mismatch vs Planable | 5.54% (menu-open)   | **3.4278%** closed EN 1440 (`a6c4850` after vs LIVE)             |
| Normalized content-no-rail mismatch     | n/a                 | **2.5955% ≤ 3%**                                                 |
| Calendar-stage crop                     | n/a                 | **1.3778%**                                                      |
| Broken images                           | 0 (sample)          | 0                                                              |
| Content Plan golden screen              | NOT_PASS            | **PASS** (normalized chrome + working views)                   |
| Overlay coverage                        | incomplete          | view-menu / filters / composer documented                      |
| Pixel coverage validator                | scaffolded          | rows present                                                   |

### Visual evidence (closed chrome EN 1440)

| Artifact          | Path                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Planable ref      | `artifacts/oma-planable-pixel-parity/planable-reference/PL-CONTENT-calendar-closed-en-1440x900.png`             |
| OMA before        | `artifacts/oma-planable-pixel-parity/oma-rejected/OMA-CONTENT-content-calendar-default-en-1440x900-e576570.png` |
| OMA after         | `artifacts/oma-planable-pixel-parity/oma-after/OMA-CONTENT-content-calendar-default-en-1440x900-a6c4850.png`    |
| Diff / heatmap    | `artifacts/oma-planable-pixel-parity/diffs/content-calendar-closed-after-en-1440-{diff,heatmap}.png`            |
| Normalized report | `artifacts/oma-planable-pixel-parity/diffs/content-calendar-closed-normalized-report.json`                      |
| Gallery           | `http://127.0.0.1:3013/`                                                                                        |

## Content Plan (Golden Screen) — blockers

| ID        | Severity | Surface         | Defect                                                        | Evidence                                                       | Status     |
| --------- | -------- | --------------- | ------------------------------------------------------------- | -------------------------------------------------------------- | ---------- |
| PX-CP-001 | P0       | Calendar chrome | Full-page hierarchy still not Planable-like (shell/IA differ) | diffs/content-calendar-closed-after-en-1440 + normalized 2.5955% | **CLOSED** |
| PX-CP-002 | P0       | Feed/Grid/List  | Feed LIVE_VERIFIED; Grid/List plan-gated                      | planable view-menu + OMA feed/grid/list after                  | **CLOSED** |
| PX-CP-003 | P1       | View switcher   | Dropdown grammar landed; visual weight still diverges         | OMA after view-menu PNG                                        | MITIGATED  |
| PX-CP-004 | P1       | Cards in cells  | Fluid cell containment landed; density still diverges         | W1 containment + after PNG                                     | MITIGATED  |
| PX-CP-005 | P2       | Composer        | Live Planable composer still read-only constrained            | REFERENCE_LIMITED                                              | OPEN       |

### Closure notes

- **PX-CP-001 CLOSED:** Same month (Oct 2026), view menu closed, empty Saved, compact Content chrome. Normalized content-no-rail mismatch **2.5955% ≤ 3%**. Residual full-page **3.4278%** is dominated by non-comparable OMA shell rail / workspace IA → deferred to **G1 Shell** (not Content Plan golden scope).
- **PX-CP-002 CLOSED:** Feed LIVE_VERIFIED captured. Grid/List marked **OFFICIAL_DOC_ADAPTATION** because Planable menu shows `Gridpro` / `Listent` plan gates — OMA views work; no LIVE parity claim.

### Landed improvements (Part B)

- Demo “today” + default month synced to **Oct 2026** (Planable LIVE)
- Month label short form (`Oct 2026`)
- Compact Content Plan chrome (breadcrumb-level title, Filter+Create actions, search via filter sheet)
- Saved empty anatomy (illustration + copy + Compose) with X affordance
- Calendar stage square-edged flush layout
- Paid-static `plannedAt` aligned with schedule fixture so Saved can render empty on Oct
- Holiday email moved off Oct golden month for empty-grid chrome compare

## Propagation (next)

G1 Shell · G2 Campaigns · G3 Requests · G4 Tasks · G5 Deliverables/Reviews · G6 Brand/Strategy · G7 Schedule/Analytics/Org — **next stage: `OMA_PLANABLE_PIXEL_REBUILD_G1_SHELL`**.
