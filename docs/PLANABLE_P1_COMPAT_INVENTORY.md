# P1_COMPAT alias inventory

**Decision:** `DEC-017`  
**Stage:** P4
**Rule:** Aliases are temporary. They must not paint old violet/Linear/Frame values into the rendered shell. Remove at the named later stage.

Token SoT remains `packages/ui/src/tokens.css` only. Every alias below resolves to a Planable token (`#1677FF`, `#F5F6F7`, `#333333`, 150ms/300ms). None keep `#6658E8` or Frame `#121419` as a computed value.

| Alias                 | Resolves to                      | Call sites                                                                                                       | Visible impact on P1–P4 shell                                                                    | Removal stage                                                 |
| --------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `--oma-violet`        | `var(--oma-primary)` `#1677FF`   | `stage5.css`, `stage6.css` selected-tab/chip rules; `apps/web/src/app/(app)/app/analytics/page.tsx` chart stroke | **Removed from P4** (`stage4.css`). Remaining P5/P6 only. Shell chrome does not read this alias. | P5 (deliverable tabs), P6 (analytics stroke + settings chips) |
| `--oma-signal`        | `var(--status-success)`          | `stage6.css` connected borders                                                                                   | **Removed from P3/P4** (`stage3.css`, `stage4.css`). Remaining P6 only.                          | P6 (integrations)                                             |
| `--oma-signal-soft`   | success at 12% on white          | _(no P1–P4 call sites)_                                                                                          | removed from stage2.css in P2; no P2–P4 call sites.                                              | P6                                                            |
| `--oma-review-canvas` | `var(--oma-canvas)` `#F5F6F7`    | `deliverable-client.tsx` inline background                                                                       | Review stage is light operational canvas, not Frame dark.                                        | P5                                                            |
| `--oma-review-ink`    | `var(--oma-ink)` `#333333`       | review workspace CSS via token                                                                                   | Light ink on review chrome.                                                                      | P5                                                            |
| `--motion-micro`      | `--oma-motion-sidebar` `150ms`   | `stage-depth.css` P5+ cards                                                                                      | **Removed from P4** (`stage4.css`). Interior hovers use Planable chrome timing.                  | P5                                                            |
| `--motion-panel`      | `--oma-motion-control` `300ms`   | `packages/ui/src/motion.css` overlays                                                                            | Dialog/drawer 300ms.                                                                             | P6 (delete alias after last overlay/settings surfaces)        |
| `--motion-ease`       | `--oma-motion-control-ease`      | stage hover rules (P5+)                                                                                          | Standard ease, not Linear 120–240 sheet.                                                         | P6                                                            |
| `--shell-top-height`  | `56px` = 12+32+12 content header | `stage2.css`, `stage5.css`, `stage6.css`, `stage-depth.css` sticky offsets                                       | Header band height only. Search/user/notifications are in the rail, not a Linear command bar.    | P2–P6 sticky math; then rename to `--shell-header-height`     |

**P4 remaining alias call sites (not P4 CSS):**

- `apps/web/src/styles/stage5.css` (`--oma-violet`, `--oma-review-*`, motion aliases as used)
- `apps/web/src/styles/stage6.css` (`--oma-violet`, `--oma-signal`)
- `apps/web/src/app/(app)/app/analytics/page.tsx` chart stroke via `--oma-violet`
- `packages/ui/src/tokens.css` still defines the alias names for P5/P6 consumers

Do not treat these names as a second visual system. After each later stage, delete unused aliases from `tokens.css`.
