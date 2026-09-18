# P1_COMPAT alias inventory

**Decision:** `DEC-017`  
**Stage:** P5
**Rule:** Aliases are temporary. They must not paint old violet/Linear/Frame values into the rendered shell. Remove at the named later stage.

Token SoT remains `packages/ui/src/tokens.css` only. Every alias below resolves to a Planable token (`#1677FF`, `#F5F6F7`, `#333333`, 150ms/300ms). None keep `#6658E8` or Frame `#121419` as a computed value.

| Alias                 | Resolves to                      | Call sites                                                                                         | Visible impact on P1–P5 shell                                                    | Removal stage                                          |
| --------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `--oma-violet`        | `var(--oma-primary)` `#1677FF`   | `stage6.css` selected-tab/chip rules; `apps/web/src/app/(app)/app/analytics/page.tsx` chart stroke | **Removed from P5** (`stage5.css`). Remaining P6 only.                           | P6 (analytics stroke + settings chips)                 |
| `--oma-signal`        | `var(--status-success)`          | `stage6.css` connected borders / capacity                                                          | **Removed from P3–P5**. Remaining P6 only.                                       | P6 (integrations/team)                                 |
| `--oma-signal-soft`   | success at 12% on white          | _(no P1–P5 call sites)_                                                                            | removed from stage2.css in P2; no P2–P5 call sites.                              | P6                                                     |
| `--oma-review-canvas` | _(deleted)_                      | _(removed from tokens + deliverable-client in P5)_                                                 | Review workspace uses light Planable surfaces + neutral preview gray only.       | P5 done                                                |
| `--oma-review-ink`    | _(deleted)_                      | _(removed from tokens in P5)_                                                                      | Review chrome uses `--oma-ink`.                                                  | P5 done                                                |
| `--motion-micro`      | `--oma-motion-sidebar` `150ms`   | leftover P6+ if any                                                                                | **Removed from P5** review queue cards (`stage-depth.css` uses Planable motion). | P6                                                     |
| `--motion-panel`      | `--oma-motion-control` `300ms`   | `packages/ui/src/motion.css` overlays                                                              | Dialog/drawer 300ms.                                                             | P6 (delete alias after last overlay/settings surfaces) |
| `--motion-ease`       | `--oma-motion-control-ease`      | stage hover rules (P6+)                                                                            | Standard ease, not Linear 120–240 sheet.                                         | P6                                                     |
| `--shell-top-height`  | `56px` = 12+32+12 content header | `stage2.css`, `stage6.css`, `stage-depth.css` sticky offsets                                       | Header band height only.                                                         | P6 sticky math; then rename to `--shell-header-height` |

**P5 remaining alias call sites (not P5 CSS):**

- `apps/web/src/styles/stage6.css` (`--oma-violet`, `--oma-signal`)
- `apps/web/src/app/(app)/app/analytics/page.tsx` chart stroke via `--oma-violet`
- `packages/ui/src/tokens.css` still defines `--oma-violet` / `--oma-signal` / `--oma-signal-soft` for P6 consumers

Schedule calendar styles now live in `stage5.css`. Do not treat remaining alias names as a second visual system.
