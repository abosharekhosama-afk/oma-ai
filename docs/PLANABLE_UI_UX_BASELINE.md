# Planable UI/UX baseline (OMA)

**Status:** `COMPLETE` for specification. Implementation: `NOT_STARTED`.
**Decision:** `DEC-017`
**Product source of visual truth:** `https://app.planable.io/` (PRODUCT_APP)
**Marketing (not component source):** `https://planable.io/`, `https://planable.io/product/`
**Captured:** 2026-09-16 against live CDP session + archived 002 live notes + official help docs.

## Access

| Check                 | Result                                                 |
| --------------------- | ------------------------------------------------------ |
| CDP `127.0.0.1:9333`  | `READY` (Chrome 151)                                   |
| `app.planable.io` tab | Present, not on login                                  |
| Session               | `CDP_READY_AUTHENTICATED`                              |
| Mutations             | None. Navigation, view open, Escape/close only.        |
| New LIVE claimed      | Only surfaces actually opened this run (see coverage). |

## Evidence mix (honest)

| Level                        | Surfaces                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LIVE_VERIFIED (this run)** | Shell/approvals desktop, campaigns list, dashboard, tablet dashboard, mobile dashboard. Sidebar **256px**, body type, canvas color, primary button, search field, motion timings.                                         |
| **LIVE splash / PARTIAL**    | Calendar route this run (`loaderSplashScreen` only). Do not treat calendar cell geometry as live 2026-09-16.                                                                                                              |
| **ARCHIVED LIVE (002)**      | Sample-workspace calendar cards, post modal, comments, suggestions, activity, approvals board, compose modal fields, view switcher (Calendar / Feed / Grid PRO / List ENT), filters, bulk review modal opened and closed. |
| **PLAN_GATED**               | Grid and List in this account (`PRO` / `ENT`). Structure from archived view-switcher + marketing/docs, not fresh live canvas.                                                                                             |
| **DOC_VERIFIED**             | Help centre: approvals, comments, suggestions, annotations, internal notes, members/roles. Product marketing used only for feature inventory, not tokens.                                                                 |
| **SANDBOX_DATA_REQUIRED**    | Settings forms, members/roles tables, composer footer validation, Arabic UI, reduced-motion preference, unsaved-composer prompt.                                                                                          |
| **NOT LIVE this run**        | Feed canvas (direct `/feed/{id}` 404 historically; switcher `data-cy=viewSelector` missing on approvals). Notification drawer contents. Billing (never opened).                                                           |

## Product app vs marketing

|                  | `app.planable.io`                      | `planable.io` marketing                                           |
| ---------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Authority        | **Sole component/token/motion source** | Brand story only                                                  |
| Observed type    | System UI stack, 14px body             | Marketing headlines — **do not import**                           |
| Observed primary | `rgb(22, 119, 255)` buttons            | Decorative marketing color — **do not import unless also in app** |
| Observed canvas  | `rgb(245, 246, 247)`                   | Hero/gradient pages — **do not import**                           |

## Shell model (live)

Planable is **not** a Linear-style 56px global top bar plus 240px rail.

Desktop workspace (approvals + campaigns, 1440×900):

- Persistent left sidebar `data-cy=navSidebar` **256×900**.
- Sidebar search `data-cy=global-search-input` (14px / 22px, radius 6px).
- Workspace switcher, notifications, user menu, help live in the rail (`workspace-menu-button`, `notificationInbox`, `user-dropdown-button`, `helpButton`).
- Nav items: Content, Campaigns, My approvals, Social inbox, Analytics, Channels.
- Content header uses breadcrumbs (`navBarBreadcrumbs`) and primary actions (`reviewPostsButton`, `approveAllButton`) rather than a separate dense Linear command bar.
- Sidebar collapse transition **150ms linear**.

Company dashboard (`/dashboard`): full-width white `navBody` (no 256px rail). Workspace **cards** + “New workspace”. Mobile 390: hamburger (`hamburgerMenuButton`), no page overflow.

## Content model (archived live + docs)

View language: **Calendar, Feed, Grid, List**, plus **My approvals** and custom views. Feed is not a URL sibling of `/calendar/{id}` (archived: `/feed/{id}` 404). Grid/List may be plan-gated.

Post object: media-first preview, channel, time, approval chip, comment count, team-only marker. Detail is a **modal + right drawer** (Feedback comments / Suggestions; activity log). Approvals sit **next to the content**.

Statuses (observed, not OMA copy): Not approved yet, Pending, Approved by {user}, Partially approved, Draft, Scheduled, Published, Failed to publish, team-only.

## Binding rebuild sequence (docs only)

P1 tokens + type + shell + nav + base components + motion → P2 Command Center / Brands / Intelligence / Strategy → P3 Campaigns / Content views / Composer → P4 Requests / Briefs / Tasks → P5 Deliverables / Reviews / Schedule → P6 Analytics / Team / Activity / Settings → P7 full visual parity + owner preview.

## Conflicts with previous OMA visual system

| Previous OMA (DEC-013 / golden)        | Planable app (DEC-017)                                                     |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Inter / Noto as product face           | System UI stack (`-apple-system, system-ui, Segoe UI, Roboto…`)            |
| OMA Violet `#6658E8`                   | App primary action `rgb(22, 119, 255)`                                     |
| Linear 56px top bar, 240px rail        | 256px rail; chrome inside the rail                                         |
| Frame.io dark review as visual system  | Light operational chrome; content preview in-modal                         |
| 120–240ms “Linear motion” as authority | Measured 150ms linear (sidebar), 300ms cubic-bezier(0.4,0,0.2,1) (actions) |

Arabic and RTL were **not** present on the live English session. OMA must still ship EN/AR; treat Arabic as an OMA adaptation of these metrics (`Noto Sans Arabic` allowed as glyph coverage, not a second visual system).
