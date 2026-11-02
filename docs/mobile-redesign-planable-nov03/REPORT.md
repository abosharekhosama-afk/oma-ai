# Planable mobile redesign (Nov 03)

Dedicated phone UI (`<768`) in modern Planable style: dense list rows, compact filters, bottom tab bar, bottom sheets. Desktop (`≥768`) unchanged.

## Branches
- Backup: `backup-before-mobile-redesign-nov03` @ `8a714fa`
- Work: `feat/mobile-redesign-planable-nov03`
- PR: https://github.com/abosharekhosama-afk/oma-ai/pull/45 (do not merge)

## Fixes in this wave
1. Header primary CTAs are icon-only (`+` / filter) — no empty solid blue square; brand-detail connect also icon-only.
2. Deliverable detail full width (~390 / content ~366 with 12px pad); version preview shows real SVG thumb (Noor Media), not grey empty block; compact file-row fallback when empty.
3. Requests header compact: title + `2 / 2` inline, description hidden, status tabs single horizontal scroll row (`flex-wrap: nowrap` cascade lock beating stage4 wrap), duplicate result-count hidden. Production `next start` + Next badge CSS hide (no floating `N` on More).
4. Deep densify CSS: composer / media / Work Drive / onboarding / invite / brand settings / campaign·task·brand·content sticky action hooks; brand cards single-row denser (facts hidden on phone).
5. Local DB seeded with Noor Media–like Arabic data: brands Yasmeen Bakery / Anaqa Gaza / Amal Academy; Arabic request & deliverable titles; SVG thumbs. Junk Lock brands soft-deleted.

## Screens shot (390 AR+EN after)
home, list-requests/requests, list-deliverables/deliverables, brands/cards-brands, tasks, campaigns, notifications, team, analytics, media, content/calendar-content, billing, settings, onboarding, auth-login, drawer, filters-sheet-requests, detail-deliverable, detail-request, detail-brand, brand-settings; desktop home+requests @1440.

## Verify
- typecheck pass
- eslint on touched TS pass
- production build pass
- screenshots taken against production `next start` (not dev)

## Not done / follow-ups
- No dedicated `/app/tasks/[id]` route (task detail 404) — board-only today
- Campaign list empty in demo tenant (no campaign detail seed)
- Composer / media folder tree / invite-accept / member profile are CSS densified more than bespoke component redesigns
- Brand card primary CTA still text (“ربط الموقع”); could go icon+short label later
- Sticky bottom bars rely on existing action containers being present in markup
- Home brand cards still multi-line Planable tiles (not ultra single-line)
