# Planable Ant Design A2 surface matrix

Planable remains the UI/UX authority. Ant Design MIT is the component implementation. OMA keeps product copy, tenancy, and workflows.

| Surface                                            | Controls                                                                       | Evidence       |
| -------------------------------------------------- | ------------------------------------------------------------------------------ | -------------- |
| Login / Register / Onboarding / Select company     | Button, Input, PasswordInput                                                   | OMA_ADAPTATION |
| Company members                                    | Button, Input                                                                  | OMA_ADAPTATION |
| Command Center and shell search                    | Button, Input, Dialog                                                          | OMA_ADAPTATION |
| Brand Intelligence and Strategy                    | Button, Input, TextArea, SelectField, DateField                                | OMA_ADAPTATION |
| Campaigns and Content                              | Button, Input, TextArea, SelectField, DateField, Segmented, Tabs               | OMA_ADAPTATION |
| Requests, briefs, tasks                            | Button, Input, TextArea, SelectField, CheckboxField; Kanban drag stays dnd-kit | OMA_ADAPTATION |
| Deliverables, reviews, schedule                    | Button, Input, TextArea, DateField                                             | OMA_ADAPTATION |
| Analytics, team, activity, settings, notifications | Button, Input, SelectField, Tag                                                | OMA_ADAPTATION |

Token contract stays in `packages/ui/src/antd-theme.ts` and `packages/ui/src/tokens.css`: canvas `#F5F6F7`, surface `#FFFFFF`, ink `#333333`, primary `#1677FF`, control height 32px, radius 6px. Those measured values are `OFFICIAL_DOC_VERIFIED` from `docs/PLANABLE_DESIGN_TOKENS_SPEC.md`. This migration did not open a new live Planable session.

Direct `antd` imports in product pages: provider only (`apps/web/src/components/ui/oma-antd-provider.tsx`). Adapters live in `packages/ui/src/controls.tsx`.

`pnpm ui:ant-migration-inventory -- --check` must report `"migrate": 0`.
