# OMA × Planable — Forensic Visual Gap Ledger

**Previous A2 visual verdict:** SUPERSEDED_BY_OWNER_EVIDENCE  
**Audit mode:** rendered integrity first (not inventory counts)

## Totals

| Severity      | Before R1 (measured)                 | After R1 (measured on preview)            |
| ------------- | ------------------------------------ | ----------------------------------------- |
| P0            | 3 classes                            | 0 on Content Grid/List/Feed + Reviews key |
| P1            | 2 classes                            | 0 remaining for R1 scope                  |
| P2            | polish remaining                     | open for R2–R6                            |
| REFERENCE_GAP | Feed/List/Saved/Composer on Planable | documented                                |

## P0 — closed by R1

| ID    | Finding                                                                                                             | Planable         | OMA before                    | Fix                                                                                         | After evidence                      |
| ----- | ------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------- |
| P0-01 | Content Grid/List/Feed/Saved/Calendar tiles used Ant `Button` → height locked to 32px → clipping / apparent overlap | dense post cards | list rows 32px; media clipped | `SurfaceButton` + height:auto surface CSS                                                   | grid cards 403px; list rows 49–61px |
| P0-02 | Demo SVGs with control char `0x14` → `naturalWidth=0` broken images                                                 | n/a              | 4 broken `/demo/poster-*.svg` | rewrite clean SVG fixtures                                                                  | broken images = 0                   |
| P0-03 | React missing `key` on Reviews tabs + Content maps                                                                  | n/a              | console warning               | `key={item}` / `key={item.id}`                                                              | no key console errors on content    |
| P0-04 | Acceptance preview served `next dev` (dev badge / Issues)                                                           | n/a              | `nextDevOverlay=true`         | `review-004` defaults to production `next build` + `next start`; `review:004:dev` preserved | verify after production restart     |

## P1 — addressed or deferred

| ID    | Finding                                                   | Status                                                       |
| ----- | --------------------------------------------------------- | ------------------------------------------------------------ |
| P1-01 | Schedule pills / mobile sched cards clipped by Ant Button | Fixed via `SurfaceButton`                                    |
| P1-02 | Task mobile cards clipped by Ant Button                   | Fixed via `SurfaceButton`                                    |
| P1-03 | Shared control typography/spacing vs Planable live tokens | R2 — theme already close; polish continues                   |
| P1-04 | Overlay/drawer transparency reports from Owner            | Ant Modal/Drawer portal in use; re-check on production build |

## REFERENCE_GAP (not product PASS)

- Planable Feed / List / Saved as distinct controls: CONTROL_NOT_FOUND in this workspace session
- Planable Composer: REFERENCE_UNAVAILABLE (read-only — do not create posts)
- Planable Settings: SANDBOX_DATA_REQUIRED

## Gate rule

Stage cannot claim REAL_RENDERED_VISUAL_PARITY until P0=0, P1=0, production preview without Next development overlay, and Owner review.
