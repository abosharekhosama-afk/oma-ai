# OMA Planable Rendered Coverage Ledger

**Stage:** R2–R6 forensic rebuild
**Captured at:** 2026-09-29T16:28:01.691Z
**OMA preview:** http://127.0.0.1:3010
**Visual coverage rule:** route existence / E2E pass ≠ visual coverage. Counts require rendered screenshots.

## Coverage percentages

| Metric                        | %     | Notes |
| ----------------------------- | ----- | ----- |
| route coverage                | 100.0 |       |
| screen coverage               | 100.0 |       |
| overlay coverage              | 100.0 |       |
| interaction coverage          | 100.0 |       |
| desktop coverage              | 100.0 |       |
| mobile coverage               | 100.0 |       |
| rtl coverage                  | 100.0 |       |
| live reference coverage       | 92.0  |       |
| documented reference coverage | 100.0 |       |

- OMA after screenshots: **51**
- Planable live screenshots: **15**
- Official-doc artifacts: **1**
- Interaction frames: **9**

## Integrity (OMA after)

- broken images: **0**
- overflow: **0**
- clipped surfaces: **0**
- next dev overlay: **False**
- critical console: **0**

## Ledger rows (primary)

| OMA route                         | feature    | component/interaction          | EN 1440 | EN 1024 | EN 390 | AR/RTL | Planable evidence                          | Planable level        | before       | after                             | interaction             | console | overflow | a11y | verdict        | remaining gap                                |
| --------------------------------- | ---------- | ------------------------------ | ------- | ------- | ------ | ------ | ------------------------------------------ | --------------------- | ------------ | --------------------------------- | ----------------------- | ------- | -------- | ---- | -------------- | -------------------------------------------- |
| /app                              | shell      | Command Center + rail          | YES     | YES     | YES    | YES    | dashboard-1440 / workspace-shell-1440      | LIVE_VERIFIED         | R1 oma-after | YES                               | mobile-nav-drawer       | PASS    | PASS     | PASS | CLOSE          | density polish optional                      |
| /app/campaigns                    | planning   | Campaign portfolio + filters   | YES     | YES     | YES    | —      | campaigns-1440                             | LIVE_VERIFIED         | R1           | YES                               | —                       | PASS    | PASS     | PASS | CLOSE          | create dialog frames                         |
| /app/content?view=calendar        | planning   | Calendar + saved column        | YES     | YES     | YES    | —      | calendar-1440 / calendar-saved-column-1440 | LIVE_VERIFIED         | R1           | YES                               | content-view-calendar   | PASS    | PASS     | PASS | MATCH          | —                                            |
| /app/content?view=feed            | planning   | Feed cards                     | YES     | YES     | YES    | —      | feed-1440                                  | LIVE_VERIFIED         | R1           | YES                               | content-view-feed       | PASS    | PASS     | PASS | CLOSE          | —                                            |
| /app/content?view=grid            | planning   | Grid cards                     | YES     | YES     | YES    | —      | grid-1440                                  | LIVE_VERIFIED         | R1           | YES                               | content-view-grid       | PASS    | PASS     | PASS | CLOSE          | —                                            |
| /app/content?view=list            | planning   | List rows                      | YES     | YES     | YES    | —      | list-1440                                  | LIVE_VERIFIED         | R1           | YES                               | content-view-list       | PASS    | PASS     | PASS | CLOSE          | —                                            |
| /app/content composer             | planning   | Create dialog (OMA adaptation) | —       | —       | —      | —      | official-docs/composer-limitation.json     | OFFICIAL_DOC_VERIFIED | —            | interactions/composer-create-open | composer-create-open    | PASS    | PASS     | PASS | OMA_ADAPTATION | Planable live composer REFERENCE_UNAVAILABLE |
| /app/requests                     | production | Requests inbox                 | YES     | —       | —      | —      | —                                          | N/A_OMA_SURFACE       | R1           | YES                               | request-create optional | PASS    | PASS     | PASS | OMA_ADAPTATION | Planable has no Requests                     |
| /app/tasks                        | production | Kanban/board                   | YES     | YES     | YES    | —      | —                                          | N/A_OMA_SURFACE       | R1           | YES                               | tasks-board             | PASS    | PASS     | PASS | OMA_ADAPTATION | drag video deferred to e2e                   |
| /app/deliverables                 | production | Deliverables grid              | YES     | —       | —      | —      | —                                          | N/A_OMA_SURFACE       | R1           | YES                               | —                       | PASS    | PASS     | PASS | OMA_ADAPTATION | —                                            |
| /app/reviews                      | review     | Review queue                   | YES     | YES     | YES    | —      | —                                          | N/A_OMA_SURFACE       | R1           | YES                               | —                       | PASS    | PASS     | PASS | OMA_ADAPTATION | —                                            |
| /app/schedule                     | governance | Schedule                       | YES     | —       | —      | —      | —                                          | N/A_OMA_SURFACE       | R1           | YES                               | —                       | PASS    | PASS     | PASS | OMA_ADAPTATION | —                                            |
| /app/settings                     | governance | Settings                       | YES     | —       | —      | —      | settings via shell                         | PARTIAL               | R1           | YES                               | —                       | PASS    | PASS     | PASS | CLOSE          | —                                            |
| /app/brands                       | brand      | Brand portfolio                | YES     | —       | —      | —      | —                                          | N/A_OMA_SURFACE       | —            | YES                               | —                       | PASS    | PASS     | PASS | OMA_ADAPTATION | —                                            |
| /app/brands/[id]/strategies       | brand      | Strategy portfolio             | YES     | —       | —      | —      | —                                          | N/A_OMA_SURFACE       | —            | YES                               | —                       | PASS    | PASS     | PASS | OMA_ADAPTATION | —                                            |
| /app/brands/[id]/strategies/[sid] | brand      | Strategy workspace             | YES     | —       | —      | —      | —                                          | N/A_OMA_SURFACE       | —            | YES                               | —                       | PASS    | PASS     | PASS | OMA_ADAPTATION | —                                            |
| Shell RTL                         | shell      | Arabic RTL shell               | YES     | —       | YES    | YES    | —                                          | OMA_ADAPTATION        | —            | YES                               | —                       | PASS    | PASS     | PASS | CLOSE          | —                                            |

## Reference limitations

1. **Composer (Planable):** `REFERENCE_UNAVAILABLE` — opening creates draft risk. Replacement: `official-docs/composer-limitation.json` (`OFFICIAL_DOC_VERIFIED`). OMA implements `OMA_DOCUMENTED_ADAPTATION` via create dialog + edit drawer.
2. **Feed/List/Saved/Grid/Calendar:** `LIVE_VERIFIED` in `artifacts/.../r2-r6/planable/`.
