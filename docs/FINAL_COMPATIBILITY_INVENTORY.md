# Final compatibility inventory — Planable P6

**Stage:** `IMPLEMENT_OMA_PLANABLE_UI_UX_REBUILD_STAGE_P6`
**Decision:** DEC-017
**Scope:** Runtime product source (CSS/TSX/SVG under `apps/web`, `packages/ui`) — not historical evidence archives.

## Verdict

| Check                                     | Count | Status |
| ----------------------------------------- | ----- | ------ |
| Runtime alias definitions                 | 0     | PASS   |
| Runtime alias usages                      | 0     | PASS   |
| Legacy primary `#6658E8` / `#6658e8`      | 0     | PASS   |
| Legacy Frame canvas `#121419`             | 0     | PASS   |
| Inter / IBM Plex product face assumptions | 0     | PASS   |

## Aliases removed in P6

- `--oma-violet`
- `--oma-signal`
- `--oma-signal-soft`
- `--motion-micro`
- `--motion-panel`
- `--motion-ease`
- `--shell-top-height` → renamed to `--shell-header-height` (canonical)

## Canonical replacements

| Former                    | Replacement                                              |
| ------------------------- | -------------------------------------------------------- |
| `var(--oma-violet)`       | `var(--oma-primary)`                                     |
| `var(--oma-signal)`       | `var(--status-success)` / `var(--status-info)` as needed |
| `var(--oma-signal-soft)`  | success soft mix / `--oma-primary-soft` where primary    |
| `var(--motion-*)`         | `--oma-motion-sidebar` / `--oma-motion-control` (+ ease) |
| `var(--shell-top-height)` | `var(--shell-header-height)`                             |

## Files touched for purge

- `packages/ui/src/tokens.css` — definitions removed / rename
- `packages/ui/src/primitives.css` — badge--signal uses status tokens
- `apps/web/src/styles/stage6.css` — full Planable rewrite
- `apps/web/src/styles/stage2.css` — sticky offset rename only
- `apps/web/src/styles/stage-depth.css` — sticky offset rename only
- `apps/web/src/app/(app)/app/analytics/page.tsx` — chart stroke primary + dashed paid series

## Out of scope (not runtime product)

- Historical auditor notes that mention former aliases (e.g. DEC-017 P1 verdicts)
- Superseded design blueprints that document pre-DEC-017 palettes
- `.reference/` archived capture notes

## Honest limitations

- Owner visual acceptance remains REJECTED until certification / owner preview (P7).
- External integrations remain DEFERRED — catalog is honesty-only.
- No live analytics providers.

**Runtime alias definitions = 0. Runtime alias usages = 0.**
