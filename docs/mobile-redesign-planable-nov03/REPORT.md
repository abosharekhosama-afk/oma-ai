# Planable mobile redesign (Nov 03)

Dedicated phone UI (`<768`) in modern Planable style: dense list rows, compact filters, bottom tab bar, bottom sheets. Desktop (`≥768`) unchanged.

## Branches
- Backup: `backup-before-mobile-redesign-nov03` @ `8a714fa`
- Work: `feat/mobile-redesign-planable-nov03`
- Base: `004-oma-complete-product-demo`

## Screens / areas redesigned
- Shell: compact header (~50px), `⋯` overflow, **bottom tab bar** (Home / Content / Campaigns / Analytics / More→drawer), nav drawer
- List pages: requests, deliverables, tasks, campaigns, brands, notifications, team, analytics, media, home
- Filters: icon + bottom sheet (requests/tasks); status tabs as compact chips
- Detail: deliverable/request detail (sticky action affordances via CSS)
- Content/calendar, schedule, billing, settings, select-company, auth (base mobile chrome)
- Empty/error inherit denser spacing

## Implementation notes
- Rewrote `mobile-nov02.css` as Planable redesign (removed compact-same-design / keep-tables approach)
- `useIsMobile` hook; mobile list-row markup on requests/deliverables; force list (not giant grid) on phone
- Filter drawers use `placement="bottom"` on mobile
- Desktop pixel diff ≈ 0% on home/requests/brands/content/deliverables @ 1440

## Verify
- typecheck pass
- eslint on touched TS (unused var fixed)
- production build pass

## Not done / follow-ups
- Not every detail page got a bespoke sticky action bar component (CSS hooks present; some details still use desktop action layouts)
- Composer / media folder / invite / onboarding / member profile got shell-level treatment more than deep one-off layouts
- Brand cards denser (~list) but still show CTA row; could go fully single-line later
- Filter sheets are bottom-placed Ant drawers; grabber styling present but varies by page
- Noor Media parity seed not loaded; used OMA Demo Agency realistic lock-seed data
