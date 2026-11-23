# Mobile Redesign v1 (primary workspaces)

**Branch policy:** work on `cursor/mobile-shell-redesign-f9b2` (or successors) until v1 is owner-accepted; do not rely on document `zoom`.

## Scope (phase 1)

| Workspace    | Routes                           | Status |
| ------------ | -------------------------------- | ------ |
| Home         | `/app`                           | v1 CSS |
| Content      | `/app/content`, `/app/approvals` | v1 CSS |
| Requests     | `/app/requests/*`                | v1 + requests override (icons, tabs, cards) |
| Tasks        | `/app/tasks/*`                   | v1 CSS |
| Deliverables | `/app/deliverables/*`            | v1 CSS |

## Mechanism

1. `html[data-oma-mobile-redesign="v1"]` when viewport ≤767px (`mobile-redesign-v1.ts`).
2. `mobile-redesign-v1.css` imported **after** all legacy mobile layers in `globals.css`.
3. `.oma-shell[data-mobile-redesign-ws]` scopes workspace-specific rules.

## Design tokens (v1)

- Rhythm: 4 / 8 / 12 / 16px
- Tap: 44px; control height: 32px; icons: 16px
- Type: title 17px, body 13px, caption 12px
- Cards: 12px radius, 1px border + light shadow
- Segments: pill track + active chip (replaces oversized desktop toggles)

## Migration (later phases)

1. Remove redundant `mobile-oct27` / `stage4` mobile overrides for scoped workspaces only after visual PASS.
2. Extract shared `oma-m-*` components (segment, action row, list card).
3. Expand v1 to brand, inbox, listening, settings.

## References

- `DEC-017` Planable UI authority
- Skills: `oma-ui-ux-pro-max`, `oma-mobile-feel-better`
- Tests: `tests/unit/mobile-redesign.test.ts`, `tests/unit/mobile-density.test.ts`
