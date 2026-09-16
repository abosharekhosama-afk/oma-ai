# Planable motion spec (OMA)

**Status:** SPEC only.
**Authority:** `DEC-017` · live computed `transition-*` on `app.planable.io` 2026-09-16.

## Measured (LIVE)

| Interaction                | Duration | Easing                         | Evidence                                                     |
| -------------------------- | -------- | ------------------------------ | ------------------------------------------------------------ |
| Sidebar expand/collapse    | `150ms`  | `linear`                       | `navSidebar.transitionDuration` / `transitionTimingFunction` |
| Primary button hover/focus | `300ms`  | `cubic-bezier(0.4, 0, 0.2, 1)` | `reviewPostsButton`                                          |
| Search/input               | `300ms`  | `ease`                         | `global-search-input`                                        |
| Body/html                  | `0s`     | `ease`                         | no decorative page fade                                      |

## Archived / inferred (not fresh LIVE)

| Interaction       | Contract until re-measured                                           | Level                                     |
| ----------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| Modal open/close  | Match control 300ms standard ease; Escape cancels; no submit         | ARCHIVED behavior + LIVE close control    |
| Drawer (feedback) | Horizontal attach to content modal; 150–300ms in the measured family | ARCHIVED                                  |
| Popover/menu      | Open on pointer; Escape closes; no page shift                        | ARCHIVED + this-run PARTIAL view switcher |
| View switch       | Instant route/content replace; no marketing carousel                 | ARCHIVED                                  |
| Card selection    | Quiet highlight; not Linear lift shadows                             | ARCHIVED                                  |
| Loading           | Splash/loader (`loaderSplashScreen` LIVE on calendar this run)       | LIVE presence; duration not timed         |

## OMA rules

- Motion explains hierarchy or state. No decorative loops.
- `prefers-reduced-motion: reduce` → disable non-essential transitions (`OMA_ADAPTATION`; not observed on Planable).
- Focus must remain visible; overlay must lock scroll; z-index: rail < content < menu < modal < toast (exact z `SANDBOX_DATA_REQUIRED`).
- Do not use the previous Linear 120–240ms sheet as authority. Where a new Planable surface is unmeasured, default to **150ms linear (chrome)** or **300ms standard ease (controls)**.
