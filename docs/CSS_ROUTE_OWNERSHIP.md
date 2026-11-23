# CSS route ownership (phase 3)

Canonical owners for ops/product surfaces. **Later layers must not override** earlier owners without updating this map.

| Route prefix        | Primary CSS                                                 | Mobile authority (≤767px)                                  |
| ------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| `/app`              | `home.css`                                                  | `mobile-surfaces-clean`, `mobile-ops-authority`            |
| `/app/content`      | `stage3/*`, `content-views.css`                             | `mobile-surfaces-clean`, `mobile-ops-authority`            |
| `/app/requests`     | `stage4/10-requests.css`, `stage4/40-detail-components.css` | `mobile-ops-authority`, `mobile-precise-nov03` (list only) |
| `/app/tasks`        | `stage4/30-kanban-board.css`, `stage4/20-ops-*`             | `mobile-oct27` (board scroll), `globals` tasks table       |
| `/app/deliverables` | `stage5.css`, `stage4/20-ops-*`                             | `mobile-ops-authority`                                     |
| Brand workspace     | `brand-intel.css`, `brand-mobile-clean.css`                 | same                                                       |

## Cascade order (simplified)

```
tokens → shell → stage2 → stage3* → stage4* → stage5 → … → mobile-* → mobile-ops-authority (last)
```

## PurgeCSS policy

- **No automated purge in CI** until visual PASS per row in this table.
- Run `pnpm css:audit:purge --dry-run` locally only; safelist in `scripts/css-audit/purgecss.config.mjs`.

## `!important` reduction

- New mobile ops rules use `html[data-oma-ops-mobile='v1']` + moderate specificity **without** `!important`.
- Legacy `!important` in stage4 partials trimmed only when `css:audit:imposing` is clean for that route.
