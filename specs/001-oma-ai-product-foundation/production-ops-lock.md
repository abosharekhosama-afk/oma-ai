# Production ops lock (workspaces)

**Status:** Implemented (2026-10-24) — internal production path, not external publish.

## Surfaces on production API + DB

| Route | Data source | Notes |
|-------|-------------|--------|
| `/app/campaigns` | `campaign-api`, `content-api` (all brands content for counts/links) | No demo disclosure |
| `/app/campaigns/:id` | Campaign + content + `ops-api` tasks/deliverables for campaign | |
| `/app/content` | `content-api` lifecycle (approve, schedule, comments) | |
| `/app/requests` | `WorkRequest` via `ops-api` | Brief encoded in description until Brief domain |
| `/app/tasks` | `WorkTask` via `ops-api`, kanban DnD | |
| `/app/deliverables` | `WorkDeliverable` via `ops-api` | |
| `/app/deliverables/:id` | Review workflow POST `/review` | |
| `/app/reviews` | Queue over deliverables | |
| `/app/schedule` | All brands content, schedule/unschedule/archive | No live publish (DEC-016) |

## Lifecycle (verified target)

`Request → convert-to-task → Task → convert-to-deliverable → review → Content approve → schedule`

E2E: `tests/e2e/production-ops-surfaces.e2e.ts`, `tests/e2e/stage4-requests-tasks.e2e.ts`, `tests/e2e/w1-content-workflow.e2e.ts`.

## DB

Apply migrations including `20261023180000_work_ops_demo_parity` before QA.

## Deferred

- External publishing, WorkDrive bytes, dedicated Brief entity, assigned reviewer field, DEC-017 visual owner sign-off.
