# Planable Ant Design migration inventory

Labels: `MIGRATED_A1`, `WRAPPED_A1`, `RETAINED_DOMAIN_SPECIFIC`, `DEFERRED_A2`, `REMOVE_AFTER_A2`.

## Shared primitives

| Surface                         | Class                    | Remaining CSS                                                |
| ------------------------------- | ------------------------ | ------------------------------------------------------------ |
| `packages/ui/src/antd-theme.ts` | MIGRATED_A1              | Single theme source                                          |
| `packages/ui/src/controls.tsx`  | MIGRATED_A1              | Thin Ant Design adapters                                     |
| `OmaAntdProvider`               | MIGRATED_A1              | Registry, locale, direction, dayjs, App                      |
| Dialog / Modal                  | MIGRATED_A1              | Ant Design focus trap                                        |
| Drawer                          | MIGRATED_A1              | Ant Design focus trap                                        |
| Tooltip                         | MIGRATED_A1              | Replaces the hand-written tooltip                            |
| Toast / notification            | MIGRATED_A1              | `App.useApp()` notification                                  |
| Empty / Result / Skeleton       | WRAPPED_A1               | OMA copy stays; chrome is Ant Design                         |
| `use-focus-trap.ts`             | REMOVE_AFTER_A2          | No remaining importer                                        |
| `tokens.css` / `primitives.css` | DEFERRED_A2              | Temporary chrome for pages not in the A1 pilot               |
| `motion.css`                    | RETAINED_DOMAIN_SPECIFIC | Reduced motion and layout motion, not a second control theme |

## Pilot surfaces

| Surface                                       | Class                    |
| --------------------------------------------- | ------------------------ |
| Create Brand modal                            | MIGRATED_A1              |
| Content composer fields, tabs, actions        | MIGRATED_A1              |
| Content view switcher                         | MIGRATED_A1              |
| Content search and date filters               | MIGRATED_A1              |
| Content select filters                        | MIGRATED_A1              |
| Create Request modal fields and actions       | MIGRATED_A1              |
| Task drawer fields, checklist, comments       | MIGRATED_A1              |
| Notifications popover                         | MIGRATED_A1              |
| Request list filters outside the create modal | DEFERRED_A2              |
| Kanban move `<select>`                        | DEFERRED_A2              |
| Calendar card rendering                       | RETAINED_DOMAIN_SPECIFIC |
| Lexical composer body                         | RETAINED_DOMAIN_SPECIFIC |
| dnd-kit kanban behavior                       | RETAINED_DOMAIN_SPECIFIC |
| Page shells, tables, and dense lists          | DEFERRED_A2              |

## Remaining page CSS

| Kind                                 | Examples                                                            | A1 rule                                                         |
| ------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| Layout and geometry                  | rails, grids, toolbars, calendar cell size, drawer width            | Allowed to remain                                               |
| Domain visualization                 | calendar cards, kanban columns, strategy documents, chart canvases  | Allowed to remain                                               |
| Primitive chrome that A2 must remove | `oma-btn`, `oma-input`, `oma-select` on pages outside the A1 pilots | `REMOVE_AFTER_A2`                                               |
| Shared token sheets                  | `packages/ui` `tokens.css` and `primitives.css`                     | Temporary support for unmigrated markup, not a second Ant theme |

Pilot pages still contain some page-local `oma-btn` controls beside the migrated fields: content filter-sheet trigger, request list filters, kanban move selects, and calendar chrome. Those controls are `DEFERRED_A2`. They do not replace the shared Ant Design theme.
