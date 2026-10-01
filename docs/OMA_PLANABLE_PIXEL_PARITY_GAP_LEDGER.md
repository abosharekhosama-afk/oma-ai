# OMA × Planable — Pixel-Level Parity Gap Ledger

**Method:** `PIXEL_LEVEL_REFERENCE_PARITY` (`.cursor/rules/pixel-level-reference-parity.mdc`)  
**Starting SHA:** `e576570631b948c11b8a0a57d0d83614abd9e765`  
**Owner decision:** Previous R2–R6 visual PASS labels are revoked. Technical CI is historical evidence only.

## Superseded visual labels (binding)

| Label                                | Status           |
| ------------------------------------ | ---------------- |
| R2_SHARED_COMPONENT_PARITY           | REVOKED_BY_OWNER |
| R3_SHELL_HIERARCHY_PARITY            | REVOKED_BY_OWNER |
| R4_PLANNING_PARITY                   | REVOKED_BY_OWNER |
| R5_PRODUCTION_REVIEW_PARITY          | REVOKED_BY_OWNER |
| R6_REMAINING_SURFACE_PARITY          | REVOKED_BY_OWNER |
| OMA_PLANABLE_FORENSIC_PARITY_REBUILD | NOT_PASS         |
| REAL_RENDERED_VISUAL_PARITY          | NOT_PASS         |
| OWNER_VISUAL_REVIEW                  | REJECTED         |
| VISUAL_ACCEPTANCE                    | REJECTED         |

## Historical technical evidence (not visual acceptance)

- A2_CODE_MIGRATION / A2_TECHNICAL_CERTIFICATION: historical PASS
- Filter-sheet CI repair on `e576570`: functional only
- Prior forensic ledgers: superseded for visual claims

## Gate counters (live — update as evidence lands)

| Gate                                    | Before (e576570)    | After (`e1456f9` WIP)                          |
| --------------------------------------- | ------------------- | ---------------------------------------------- |
| P0                                      | many (Owner reject) | >0                                             |
| P1                                      | many                | >0                                             |
| Unexplained P2                          | many                | >0                                             |
| Full-page calendar mismatch vs Planable | 5.54% (menu-open)   | 4.57% closed-chrome (`7193767` after vs LIVE)  |
| Broken images                           | 0 (sample)          | 0 (OMA sample) / Planable media may report >0  |
| Content Plan golden screen              | NOT_PASS            | NOT_PASS (in progress)                         |
| Overlay coverage                        | incomplete          | incomplete                                     |
| Pixel coverage validator                | scaffolded          | scaffolded                                     |

## Content Plan (Golden Screen) — blockers

| ID        | Severity | Surface         | Defect                                                           | Evidence                                      | Status      |
| --------- | -------- | --------------- | ---------------------------------------------------------------- | --------------------------------------------- | ----------- |
| PX-CP-001 | P0       | Calendar chrome | Full-page hierarchy still not Planable-like (shell/IA differ)    | diffs/content-calendar-closed-after-en-1440   | OPEN        |
| PX-CP-002 | P0       | Feed/Grid/List  | Feed LIVE_VERIFIED captured; Grid/List plan-gated                | planable-reference PL-CONTENT-feed            | OPEN        |
| PX-CP-003 | P1       | View switcher   | Dropdown grammar landed; visual weight still diverges            | OMA after calendar PNG                        | MITIGATED   |
| PX-CP-004 | P1       | Cards in cells  | Fluid cell containment landed; density still diverges            | W1 containment + after PNG                    | MITIGATED   |
| PX-CP-005 | P2       | Composer        | Live Planable composer still read-only constrained               | REFERENCE_LIMITED                             | OPEN        |

### Landed improvements (not PASS)

- URL `?view=` honored over stale session preference
- EN week starts Monday (Planable LIVE_VERIFIED)
- Month/Week toggle (Planable chip grammar)
- View switcher is a dropdown (Planable LIVE_VERIFIED grammar)
- Calendar cards fluidly fill day cells (no overflow)
- Saved column moved to inline-end (280px)
- Desktop date-strip hidden; mobile agenda retained
- CI repair: W1 desktop containment + mobile agenda contract

## Propagation (blocked until Content Plan P0=P1=0)

G1 Shell · G2 Campaigns · G3 Requests · G4 Tasks · G5 Deliverables/Reviews · G6 Brand/Strategy · G7 Schedule/Analytics/Org — **BLOCKED**.
