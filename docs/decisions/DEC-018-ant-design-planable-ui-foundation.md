# DEC-018 — Ant Design as the Planable UI implementation base

**Status:** Accepted as the A1 shared-control foundation. Surface migration stays in progress. Owner visual acceptance stays pending.
**Date:** 2026-09-24
**Branch:** `004-oma-complete-product-demo`
**Mode:** `IMPLEMENT`

## Decision

OMA keeps Planable as the primary and sole UI/UX and workflow reference.

Ant Design (`antd` 6.6.5, MIT) is the open-source implementation base for shared controls. This is not a redesign, not an admin-dashboard adoption, and not permission to copy Planable source, CSS, assets, icons, or trademarks.

`@ant-design/pro-components` and the Ant Design Pro application template are not installed. Pro’s dashboard shell is out of scope.

Postiz, Mixpost, Shoutrrr, and OpenPost stay `NOT_ADOPTED`.

## What this stage wired

- One theme object: `packages/ui/src/antd-theme.ts`, exported from `@oma/ui`.
- One client provider: `apps/web/src/components/ui/oma-antd-provider.tsx`, mounted from the root layout through `@ant-design/nextjs-registry` `AntdRegistry`, `ConfigProvider` direction and locale, and `App`.
- Shared `Dialog` renders Ant Design `Modal`. Shared `Drawer` renders Ant Design `Drawer`.
- Create Brand, the content composer, content search/date/select filters, the content view switcher, Create Request, and the task drawer use the `@oma/ui/controls` adapters.
- Notifications use Ant Design `Popover`. Toasts use `App.useApp().notification` with `title`, not the static `message` API.
- Feedback, empty, error, denied, and skeleton states use Ant Design `Empty`, `Result`, and `Skeleton` while keeping OMA copy.
- Page-local `oma-btn` / `oma-input` / `oma-select` markup outside those pilots stays in place for A2.

## What stays authoritative elsewhere

OMA domain models, APIs, tenancy, capabilities, and state machines are unchanged.

Calendar remains the approved FullCalendar path. Composer editing remains Lexical. Kanban drag remains dnd-kit.

Existing `packages/ui` CSS token sheets still style unmigrated page markup. They are not a second theme for Ant Design controls. Retiring that sheet is `DEFERRED_A2`.

## Evidence limit

A read-only measurement of the already open authenticated Planable view found `ant-input`, `ant-dropdown-trigger`, and `ant-badge` in the live DOM. Body type was 14px, ink `rgb(51, 51, 51)`, canvas `rgb(245, 246, 247)`, and a sampled icon button was 32×32 with 6px radius. A later non-mutating pass opened and closed an empty composer shell. Dropdown menu geometry and the tab switcher stayed unavailable on that view. The Planable package version is unproven. Raw JSON stays in gitignored `artifacts/planable-ant-design-a1/`. Workspace identifiers are omitted.

`OWNER_VISUAL_REVIEW` stays `REJECTED`. `VISUAL_ACCEPTANCE` stays `PENDING_OWNER`.

## Next stage

`MIGRATE_OMA_PLANABLE_SURFACES_TO_ANT_DESIGN_A2` after this foundation is green and the remaining inventory is migrated.
