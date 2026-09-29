# OMA × Planable — R2–R6 Interaction Parity

| #    | Interaction                                          | Evidence                                   | Duration/easing notes                            | Verdict                                         |
| ---- | ---------------------------------------------------- | ------------------------------------------ | ------------------------------------------------ | ----------------------------------------------- |
| 1    | Sidebar / mobile drawer                              | interactions/mobile-nav-drawer.png         | rail transition 0.15s linear (Planable-aligned)  | CLOSE                                           |
| 2    | Content view switching                               | content-view-{calendar,feed,grid,list}.png | Segmented control; frames captured               | CLOSE                                           |
| 3    | Composer open/close                                  | composer-create-open.png                   | Modal; Escape closes                             | OMA_ADAPTATION                                  |
| 4    | Filters progressive disclosure                       | content-filters-open.png                   | Filters behind sheet (R4)                        | MATCH intent                                    |
| 5    | Notifications                                        | notifications-open.png                     | panel                                            | CLOSE                                           |
| 6    | Tasks board                                          | tasks-board.png                            |                                                  | OMA_ADAPTATION                                  |
| 7–12 | Kanban DnD / review dialogs / reschedule / AR mobile | e2e + reduced-motion CSS                   | honored via prefers-reduced-motion in motion.css | PARTIAL frames; critical e2e covers persistence |

Reduced motion: `packages/ui/src/motion.css` honors `prefers-reduced-motion`.
