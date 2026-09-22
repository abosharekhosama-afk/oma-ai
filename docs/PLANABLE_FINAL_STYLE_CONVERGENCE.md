# Planable Final Style Convergence

**Stage:** `RESUME_AND_COMPLETE_OMA_PLANABLE_FINAL_STYLE_CONVERGENCE`  
**Starting SHA:** `b8dd2dd41219428599780d3a6de7a9eb04f8cd36`  
**Authority:** DEC-017 · Owner rejection audit · Component delta matrix  
**Date:** 2026-09-22

## Binding states

| State                            | Value                          |
| -------------------------------- | ------------------------------ |
| OWNER_VISUAL_REVIEW              | **REJECTED**                   |
| VISUAL_ACCEPTANCE                | **PENDING_OWNER**              |
| PLANABLE_FINAL_STYLE_CONVERGENCE | **PASS** (zero-conditions met) |

Owner Preview acceptance stage is **not** started by this document. Exact next after green CI + Preview:

`OWNER_PREVIEW_AND_ACCEPTANCE_OMA_PLANABLE_COMPONENT_PARITY`

## What changed

Shared `packages/ui` remains the sole visual source of truth for controls, overlays, focus, elevation, and radii.

- Tokenized remaining badge/skeleton/tooltip colors and focus elevations (`--elev-focus*`, badge soft fills, `--oma-skeleton-mid`, `--radius-hairline`).
- Added shared `.oma-input--compact` / `.oma-select--compact` and drawer title typography.
- Removed page-local dialog footer / drawer header visual re-specs and toolbar field re-skins.
- Replaced competing `min-height: 28px` and raw overlay shadow fallbacks with tokens.
- Documented remaining CSS as **layout geometry** via `INTENTIONAL_EXCEPTION` (nav drawer padding, flush/wide drawer radius, review flex region).

## Zero conditions (automated)

Verifier: `node scripts/ui/inventory-runtime-styles.mjs`  
Artifact: `artifacts/planable-final-style-convergence-004/runtime-style-inventory.json`  
Guard test: `tests/unit/planable-final-style-convergence.test.ts`

| Condition                                 | Target | Result                                                 |
| ----------------------------------------- | ------ | ------------------------------------------------------ |
| High visual gaps                          | 0      | 0                                                      |
| Medium visual gaps                        | 0      | 0                                                      |
| Unexplained duplicate primitives          | 0      | 0                                                      |
| Page-local control visual implementations | 0      | 0                                                      |
| Runtime legacy aliases                    | 0      | 0                                                      |
| Runtime legacy colors                     | 0      | 0                                                      |
| Competing dialog/drawer scrims            | 0      | single `--oma-overlay-scrim` + `.oma-overlay-backdrop` |
| Competing focus-ring systems              | 0      | `--focus-ring` + `--elev-focus*` only                  |
| Competing shadow/radius systems           | 0      | `--elev-*` / `--radius-*` / `--oma-radius-*`           |

## Remaining local CSS (layout only — not gaps)

| Location                                            | Why kept                                       |
| --------------------------------------------------- | ---------------------------------------------- |
| `shell.css` `.oma-drawer--nav` padding              | Shell chrome inset for mobile nav layout       |
| `shell.css` nav drawer flex `min-height: 0`         | Scroll region geometry                         |
| `stage3.css` `.oma-drawer--wide` `border-radius: 0` | Flush / mobile full-bleed panel geometry       |
| `stage5.css` `.oma-review-body`                     | Review workspace grid region                   |
| Stage/page CSS grid, widths, gaps                   | Page composition — not control chrome          |
| Chart/SVG semantic fills                            | Semantic visualization — not chrome primitives |

## Evidence

- Inventory: `docs/PLANABLE_RUNTIME_STYLE_INVENTORY.md`
- Artifacts: `artifacts/planable-final-style-convergence-004/`
- Reference mirror: `.reference/005-planable-ui-ux/ours/final-style-convergence/`

## Explicit non-claims

- Does **not** claim owner visual acceptance.
- Does **not** reopen Live Planable capture unless a missing measured value is required (existing parity probe remains authoritative for component metrics).
