# Planable responsive spec (OMA)

**Status:** SPEC only.
**Authority:** `DEC-017` · LIVE viewports 1440×900, 1024×768, 390×844 on `app.planable.io` 2026-09-16.

## Matrix

| Viewport | Surface captured                | Overflow | Shell behavior                                                                                 |
| -------- | ------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| 1440×900 | Approvals, campaigns, dashboard | None     | 256px persistent rail on workspace pages; dashboard is full-width card grid                    |
| 1024×768 | Dashboard                       | None     | Full-width `navBody`; search/help/notifications/user remain in header cluster                  |
| 390×844  | Dashboard                       | None     | `hamburgerMenuButton`; search input collapsed (0×0 box, `searchToggle`); workspace cards stack |

Calendar/grid/composer/drawer at tablet/mobile: **not recaptured this run** (calendar splash; composer missing on dashboard). Use ARCHIVED mobile-app DOC (“plan, review, approve on the go”) plus `SANDBOX_DATA_REQUIRED` for cell sizes. Do not PASS P7 without live mobile calendar/composer.

## Binding behaviors

1. No horizontal page overflow at 1440 / 1024 / 390.
2. Desktop workspace: 256px rail unless user collapses it.
3. Mobile: hamburger, not a squeezed 256px rail.
4. Primary actions remain 32px-class hit targets (LIVE 32px buttons). Touch targets must stay ≥32px; prefer 40px on 390 if Planable’s live calendar later shows larger — until then keep 32px and verify.
5. Drawers/modals must remain inside the viewport; Escape closes; no settings save.
6. RTL: Planable English LTR only this session. OMA mirrors rail to inline-start and keeps status logic (not a mirrored workflow). Glyphs: Noto Sans Arabic as coverage, same 14px body metrics.

## Filters and composer

- Filters: archived as a side panel/tabs on calendar; mobile transformation `SANDBOX_DATA_REQUIRED`.
- Composer: archived as modal; mobile likely full-screen — confirm before P3 acceptance.
