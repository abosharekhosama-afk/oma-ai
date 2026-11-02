# Mobile compact same-design (Nov 03)

Replaces the Nov 02 “stacked cards / restyle” mobile pass with a **same-design, compact rearrange** approach: tables stay tables, cards stay cards, filters keep the same controls — tightened for phone. Desktop (≥768px) remains pixel-identical.

## Branches

- Backup (from main tip `c030e22`): `backup-before-mobile-compact-nov03`
- Work branch: `fix/mobile-compact-same-design-nov03`
- Base for PR: `004-oma-complete-product-demo` (same tip as main merge of #43)

## What changed (by area)

### Header
- Single row ~52px (`--oma-m-header`), `flex-wrap: nowrap`, safe-area top padding.
- Center search hidden on phone; search lives in a `⋯` overflow menu (`shell-top-overflow`).
- Compact 40px tap targets; title/breadcrumb truncate (no wrap).
- Desktop: `.oma-top-overflow { display: none }` so chrome is unchanged.

### Sidebar
- Same rail look as desktop, slide-in drawer `min(280px, 82vw)`, overlay mask.
- Closes on nav click; compact item heights (~36px); pinned footer utilities.

### Filters
- Same filter components; forced into a **single horizontally scrollable row** (incl. status/workspace tabs).
- Existing Filter sheet buttons (e.g. deliverables) kept; no oversized controls.
- Compact chip/button heights (~32px visual, ≥40px tap where needed).

### Tables
- Reverted table→stacked-card mobile switches: `.oma-*-desktop` shown, `.oma-*-mobile` hidden.
- Horizontal scroll inside table container; slightly reduced padding/font; sticky first column on requests/deliverables tables.

### Cards
- Same card design; grids go 1 column (<480) / 2 columns (≥480); tighter padding/gaps.

### Modals
- Same design; near full width with safe margins (not forced 100vh restyle).

### Kept from prior mobile work
- No page-level horizontal scroll; 16px inputs (no iOS zoom); safe-area; Arabic wrapping; tap ~40–44px; spacing 4/8; body ~14 / titles ~16–18.

## Verification

- `pnpm --filter @oma/web typecheck` — pass
- eslint on touched TS — pass (CSS files ignored by eslint config)
- `pnpm --filter @oma/web build` — pass (retry after transient `next/font` Google fetch flake)
- Desktop 1440 before/after pixel diff ≈ 0% on brands/content; home/requests <0.01% (noise)
- Audited EN + AR (RTL via `oma_locale`) at 375×812, 390×844, 768; desktop 1440

## Key screenshots (docs/mobile-compact-nov03/shots)

| Area | EN before | EN after | AR after |
|------|-----------|----------|----------|
| Header | `header-375-en-auth-before.png` | `header-375-en-auth-after.png` | `header-375-ar-auth-after.png` |
| Sidebar | `sidebar-375-en-auth-before.png` | `sidebar-375-en-auth-after.png` | `sidebar-375-ar-auth-after.png` |
| Filters | `filters-content-375-en-auth-before.png` | `filters-content-375-en-auth-after.png` | `filters-content-375-ar-auth-after.png` |
| Table | `table-requests-375-en-auth-before.png` | `table-requests-375-en-auth-after.png` | `table-requests-375-ar-auth-after.png` |
| Cards | `cards-brands-375-en-auth-before.png` | `cards-brands-375-en-auth-after.png` | `cards-brands-375-ar-auth-after.png` |
| Desktop | `home-1440-en-auth-before.png` | `home-1440-en-auth-after.png` | — |
| Overflow | — | `header-overflow-375-en-auth-after.png` | — |

Full capture set under `/workspace/mobile-compact-nov03/{before,after,desktop}/`.

## Files touched

- `apps/web/src/styles/mobile-nov02.css` — rewritten compact same-design pass
- `apps/web/src/styles/shell.css` — compact top row / overflow desktop hide
- `apps/web/src/components/shell/shell-chrome.tsx` — overflow `⋯` + search menu; drawer close-on-nav
- `apps/web/src/components/shell/shell-icons.tsx` — `more-h`
- `apps/web/src/components/shell/nav-config.ts` — minor
- `packages/i18n/messages/{en,ar}.json` — `shell.moreActions`
- `docs/mobile-compact-nov03/` — report + key shots
- `scripts/capture-auth-nov03.mjs` — local capture helper

## Not done / notes

- Dedicated generic “Filter” sheet for *every* page with many filters: pages that already had Filter sheets keep them; content uses the compact horizontal chip row. A universal filter-sheet primitive was not newly invented.
- Deliverables defaults to **Grid** (card design by product); list/table mode works when selected. Breadcrumb view toggle is still hard to reach on some phone layouts despite CSS overrides (stage/oct27 hide rules).
- Auth/select-company/login audited; media/Work Drive path covered under `/app/media`.
- Lockfile unchanged (no pnpm lock edits).
