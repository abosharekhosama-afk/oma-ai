# Production ops lock (workspaces)

**Status:** Implemented (2026-10-24) — internal production path, not external publish.

## Surfaces on production API + DB

| Route                   | Data source                                                         | Notes                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `/app/campaigns`        | `campaign-api`, `content-api` (all brands content for counts/links) | No demo disclosure                                                                                                          |
| `/app/campaigns/:id`    | Campaign + content + `ops-api` tasks/deliverables for campaign      |                                                                                                                             |
| `/app/content`          | `content-api` lifecycle (approve, schedule, comments)               |                                                                                                                             |
| `/app/requests`         | `WorkRequest` via `ops-api`                                         | Brief readiness is columns on the request (objective, audience, key message). A description marker remains a legacy reader. |
| `/app/tasks`            | `WorkTask` via `ops-api`, kanban DnD                                |                                                                                                                             |
| `/app/deliverables`     | `WorkDeliverable` via `ops-api`                                     |                                                                                                                             |
| `/app/deliverables/:id` | Review workflow POST `/review`                                      |                                                                                                                             |
| `/app/reviews`          | Queue over deliverables                                             |                                                                                                                             |
| `/app/schedule`         | All brands content, schedule/unschedule/archive                     | No live publish (DEC-016)                                                                                                   |

## Lifecycle (verified target)

`Request → convert-to-task → Task → convert-to-deliverable → review → Content approve → schedule`

E2E: `tests/e2e/production-ops-surfaces.e2e.ts`, `tests/e2e/stage4-requests-tasks.e2e.ts`, `tests/e2e/w1-content-workflow.e2e.ts`.

## DB

Apply migrations including `20261023180000_work_ops_demo_parity` before QA.

## Review and version policy

See `docs/PRODUCTION_LOCK_WORK_OPS.md`. Approved versions are immutable. `addVersion` returns 409 for `APPROVED`, `REJECTED`, `AWAITING_REVIEW`, and `IN_REVIEW`. After `request_changes`, a new version keeps `CHANGES_REQUESTED` until `submit`. Convert-to-task returns 409 `BRIEF_NOT_READY` until the brief core fields are set. `deliverable.review.decide` is required to approve, reject, or request changes.

## Deferred

- External publishing, WorkDrive bytes, a separate `WorkBrief` model, object storage (`DEC-003`), assigned reviewer field, DEC-017 visual owner sign-off.
