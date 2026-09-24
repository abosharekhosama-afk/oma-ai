# Planable surface to Ant Design component map

Planable remains the UI/UX authority. Ant Design is the implementation base. This map does not claim Planable ships a particular Ant Design version.

| Planable surface             | OMA call site                            | Ant Design piece                                      | Status                   |
| ---------------------------- | ---------------------------------------- | ----------------------------------------------------- | ------------------------ |
| Modal                        | `components/ui/dialog.tsx`               | `Modal`                                               | MIGRATED_A1              |
| Drawer                       | `components/ui/drawer.tsx`               | `Drawer`                                              | MIGRATED_A1              |
| Button / icon button         | `@oma/ui/controls`                       | `Button`                                              | MIGRATED_A1              |
| Input / textarea             | Create Brand, composer, request, task    | `Input`, `Input.TextArea`                             | MIGRATED_A1              |
| Select                       | Content filters, composer, task priority | `Select` via `OmaSelect`                              | MIGRATED_A1              |
| Date picker                  | Content filters and composer             | `DatePicker`                                          | MIGRATED_A1              |
| Checkbox                     | Task checklist                           | `Checkbox`                                            | MIGRATED_A1              |
| Tabs / segmented             | Content composer and view switcher       | `Tabs`, `Segmented`                                   | MIGRATED_A1              |
| Dropdown / menu              | `OmaSelect` and notification popover     | `Select`, `Popover`                                   | WRAPPED_A1               |
| Tooltip                      | `components/ui/tooltip.tsx`              | `Tooltip`                                             | MIGRATED_A1              |
| Tag / badge / avatar         | Available from `@oma/ui/controls`        | `Tag`, `Badge`, `Avatar`                              | WRAPPED_A1               |
| Empty / result / skeleton    | `components/ui/empty-state.tsx`          | `Empty`, `Result`, `Skeleton`                         | WRAPPED_A1               |
| Message / notification       | `components/ui/toast.tsx`                | `App.useApp().notification`                           | MIGRATED_A1              |
| Create Brand                 | `components/brand/create-brand-form.tsx` | `Form.Item`, `Input`, `Button`, `Modal`               | MIGRATED_A1              |
| Content composer             | `content/content-client.tsx`             | `Input`, `TextArea`, `Select`, `DatePicker`, `Button` | MIGRATED_A1              |
| Create Request               | `requests/page.tsx`                      | Shared `Modal` plus field adapters                    | MIGRATED_A1              |
| Task drawer                  | `tasks/tasks-client.tsx`                 | Shared `Drawer` plus field adapters                   | MIGRATED_A1              |
| Notifications                | `shell/notifications-bell.tsx`           | `Popover`, `Button`                                   | MIGRATED_A1              |
| Request filters, kanban move | request list and task board              | remaining `<select>` / `oma-btn`                      | DEFERRED_A2              |
| Tables and dense lists       | portfolio, campaigns, requests           | page markup                                           | DEFERRED_A2              |
| Calendar card                | FullCalendar path                        | domain geometry                                       | RETAINED_DOMAIN_SPECIFIC |
| Composer editor              | Lexical                                  | editor, not control chrome                            | RETAINED_DOMAIN_SPECIFIC |
| Kanban drag                  | dnd-kit                                  | drag behavior                                         | RETAINED_DOMAIN_SPECIFIC |

Locked theme tokens live only in `packages/ui/src/antd-theme.ts`.
