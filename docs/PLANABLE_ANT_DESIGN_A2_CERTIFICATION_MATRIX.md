# Planable Ant Design A2 certification matrix

**Stage:** `CERTIFY_OMA_PLANABLE_ANT_DESIGN_SURFACE_MIGRATION`  
**A2 CI:** [36313580459](https://github.com/burhanbakri1-spec/oma-ai/actions/runs/36313580459) `success` on `4a61e04`  
**Live Planable this session:** `REFERENCE_UNAVAILABLE` (CDP `127.0.0.1:9333` was closed)  
**Token baseline:** `OFFICIAL_DOC_VERIFIED` from `docs/PLANABLE_DESIGN_TOKENS_SPEC.md` (live measurements dated 2026-09-16)

## Integrity

| Gate                                    | Result                                    |
| --------------------------------------- | ----------------------------------------- |
| Direct `antd` imports in product pages  | 0. Exceptions: provider and `packages/ui` |
| Inventory `MIGRATE`                     | 0                                         |
| Page-local generic control visuals      | 0                                         |
| Unexplained duplicate primitives        | 0                                         |
| Runtime legacy aliases                  | 0                                         |
| `#6658E8` and `#121419` as UI authority | 0                                         |
| High / medium style gaps                | 0 / 0                                     |

`SelectField`, `DateField`, and acknowledgement `CheckboxField` stay native elements inside `@oma/ui` so existing journeys can use `selectOption`, `fill`, and `check`. `OmaSelect` stays Ant Design Select so menus and the A1 dropdown evidence remain.

## Functional preservation

The full Playwright suite on CI run 36313580459 passed, including EN desktop, AR desktop, tablet, and mobile. That run covers login, command center, brand and strategy journeys, campaigns, content scheduling separation, requests, Kanban persistence, deliverables, reviews, and schedule. No new skips or retries were added.

## Responsive capture

Non-destructive screenshots of the owner preview are in gitignored `artifacts/planable-ant-design-a2-certification/`. Company Members at 390px initially overflowed (scroll width 480). The members table scroller now uses `contain: paint`, and a follow-up measure was scroll width 390 on a 390 viewport. No hydration errors were captured. A React missing-key warning appeared during the burst, and HTTP 429 came from the capture itself, not from a single user action.

## Evidence level

| Pattern                                                 | Level                                  |
| ------------------------------------------------------- | -------------------------------------- |
| Color, type, 32px control, 6px radius, 150/300ms motion | `OFFICIAL_DOC_VERIFIED`                |
| Ant Button, Input, Modal, Drawer, `OmaSelect` menu      | `OMA_ADAPTATION`                       |
| Native select, date, and checkbox adapters              | `OMA_ADAPTATION`                       |
| Kanban drag                                             | `OMA_ADAPTATION` (`@dnd-kit` retained) |
| Fresh live Planable remeasure                           | `REFERENCE_UNAVAILABLE`                |
