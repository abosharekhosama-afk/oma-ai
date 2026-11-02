# Schedule calendar scroll + sidebar footer (2026-11-02)

Verification screenshots for calendar day-column scrolling, laptop sidebar footer visibility, and mobile nav drawer cleanup (no leftover transparent strip).

## After (required)

| File | Viewport | Locale | Shows |
|------|----------|--------|-------|
| `after-laptop-calendar-scrolled-en.png` | 1366×768 | EN | Calendar fills height; day columns scroll vertically |
| `after-laptop-calendar-scrolled-ar.png` | 1366×768 | AR | Same in RTL |
| `after-laptop-sidebar-footer-en.png` | 1366×768 | EN | Account avatar + notifications pinned in rail footer |
| `after-laptop-sidebar-footer-ar.png` | 1366×768 | AR | Same in RTL |
| `after-mobile-calendar-scrolled-en.png` | 390×844 | EN | Horizontal calendar scroll + vertical day-column scroll |
| `after-mobile-calendar-scrolled-ar.png` | 390×844 | AR | Same in RTL |
| `after-mobile-sidebar-open-en.png` | 390×844 | EN | Mobile nav drawer open |
| `after-mobile-sidebar-open-ar.png` | 390×844 | AR | Mobile nav drawer open (RTL) |
| `after-mobile-sidebar-closed-en.png` | 390×844 | EN | Drawer fully gone — no transparent strip |
| `after-mobile-sidebar-closed-ar.png` | 390×844 | AR | Same in RTL |

Capture: `pnpm exec node scripts/capture-schedule-scroll-sidebar-nov02.mjs`
