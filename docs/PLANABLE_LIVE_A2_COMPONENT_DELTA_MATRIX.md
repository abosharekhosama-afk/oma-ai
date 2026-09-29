# Planable live A2 component delta matrix

> **SUPERSEDED for Owner visual acceptance.** Forensic rebuild:
> `docs/OMA_PLANABLE_FORENSIC_VISUAL_GAP_LEDGER.md`.

Evidence: `artifacts/planable-live-a2-final-comparison/` (gitignored screenshots and raw JSON). Committed notes do not include cookies, tokens, emails, or raw workspace ids.

| Pattern                     | Verdict               | Basis                                                                                         |
| --------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| Font family / 14px body     | MATCH                 | Computed `font-size: 14px` and system stack on both                                           |
| Ink `#333333`               | MATCH                 | `rgb(51, 51, 51)` both                                                                        |
| Canvas `#F5F6F7`            | MATCH                 | `rgb(245, 246, 247)` both                                                                     |
| Surface white rail          | MATCH                 | Sidebar background white, width 256                                                           |
| Border on fields            | CLOSE                 | OMA input border `rgb(226, 227, 229)` at 1px; Planable header search is borderless            |
| Control radius 6px          | MATCH                 | Filter and view selector                                                                      |
| Large primary radius        | CLOSE                 | Compose computed 8px; OMA controls stay 6px                                                   |
| Control height 32px         | MATCH                 | Filter and view selector; OMA input 32px                                                      |
| Compact search              | CLOSE                 | Planable header search 30px tall                                                              |
| Sidebar geometry            | MATCH                 | 256px column                                                                                  |
| Header                      | CLOSE                 | Planable top bar 56px; OMA shell uses the same rail, not a copied top bar                     |
| Table / list density        | OMA_ADAPTATION        | Campaigns opened live; OMA uses its own planning tables                                       |
| Card anatomy                | OMA_ADAPTATION        | Planable grid cards are media posts; OMA cards are planning objects                           |
| Modal / composer            | REFERENCE_UNAVAILABLE | Compose was not opened                                                                        |
| Drawer                      | OMA_ADAPTATION        | Notifications panel opened and closed; OMA drawers stay on Ant Design                         |
| Hover / focus               | CLOSE                 | Search focus captured; no Planable glow on that borderless field                              |
| Overlay scrim               | REFERENCE_UNAVAILABLE | No modal scrim was opened                                                                     |
| Motion                      | CLOSE                 | Planable controls `0.3s` standard easing; OMA uses 150ms and 300ms                            |
| Mobile                      | MATCH                 | Planable shell overflow 0 at 390; OMA command center overflow 0 at 390                        |
| View switcher               | OMA_ADAPTATION        | Live control is Grid (PRO). Calendar opened. Feed, List, and Saved were not separate controls |
| Kanban / reviews / schedule | OMA_ADAPTATION        | Not Planable surfaces; OMA behavior unchanged                                                 |

## Counts

| Verdict               | Count |
| --------------------- | ----- |
| MATCH                 | 8     |
| CLOSE                 | 6     |
| OMA_ADAPTATION        | 6     |
| WRONG                 | 0     |
| MISSING               | 0     |
| REFERENCE_UNAVAILABLE | 2     |

High gaps: 0. Medium gaps: 0. Low gaps: 3.
