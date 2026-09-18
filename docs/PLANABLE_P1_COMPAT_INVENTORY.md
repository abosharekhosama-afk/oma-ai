# P1_COMPAT alias inventory

**Decision:** `DEC-017`
**Stage:** P6 — **CLOSED**
**Rule:** Temporary aliases must not remain in runtime product CSS/TSX. P6 removed all remaining definitions and call sites.

Token SoT remains `packages/ui/src/tokens.css` only. Canonical replacements:

| Former alias          | Canonical token                      | P6 disposition                                     |
| --------------------- | ------------------------------------ | -------------------------------------------------- |
| `--oma-violet`        | `--oma-primary` `#1677FF`            | Deleted. Analytics stroke uses `--oma-primary`.    |
| `--oma-signal`        | `--status-success` / `--status-info` | Deleted. Capacity/source badges use status tokens. |
| `--oma-signal-soft`   | success mix on white                 | Deleted. Badge maps to status-success soft fill.   |
| `--oma-review-canvas` | _(deleted in P5)_                    | Remains deleted.                                   |
| `--oma-review-ink`    | _(deleted in P5)_                    | Remains deleted.                                   |
| `--motion-micro`      | `--oma-motion-sidebar`               | Deleted.                                           |
| `--motion-panel`      | `--oma-motion-control`               | Deleted.                                           |
| `--motion-ease`       | `--oma-motion-control-ease`          | Deleted.                                           |
| `--shell-top-height`  | `--shell-header-height` `56px`       | Renamed; all sticky offsets updated.               |

**Historical note:** P2 removed signal from `stage2.css` (`removed from stage2.css in P2`). P3–P5 removed violet/signal from their stage CSS. P6 closed remaining stage6 + tokens definitions.

See also: `docs/FINAL_COMPATIBILITY_INVENTORY.md` (runtime zero proof).
