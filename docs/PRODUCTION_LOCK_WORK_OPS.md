# Production lock — work ops

Executed record for the owner plan “OMA AI — Production Lock & Strengthening”.
This is the durable policy. It does not claim the deliverables path is production locked
until the checklist in the release section is green in CI.

Planable remains the only UI/UX authority. Frame.io and Workfront are logic references only.
This work does not enable live social publish or live AI.

## Phase 0 — UI routes and data loaders

| Route                              | Loader                                       | Production vs demo                                                                         |
| ---------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `/app/requests`                    | `ops-api` `listRequests` / `load` workspace  | Production API. Errors are shown; empty brand failures are not swallowed.                  |
| `/app/requests/:requestId`         | `getRequest` + brief fields on `WorkRequest` | Production API. Legacy `__OMA_BRIEF_V1__` description marker is still read for older rows. |
| `/app/tasks`                       | `loadTasksWorkspace`                         | Production API.                                                                            |
| `/app/deliverables`                | `loadDeliverablesWorkspace`                  | Production API.                                                                            |
| `/app/deliverables/:deliverableId` | `getDeliverableDetail`                       | Production API.                                                                            |
| `/app/reviews`                     | `loadDeliverablesWorkspace`                  | Same deliverable rows, review queue filters.                                               |
| `/app/content`                     | `content-api`                                | Publishing plan (content calendar), not the deliverable package.                           |

## Phase 0 — as-is transitions before this change

Review actions already returned 409 for illegal moves, but `approve` did not set `approvedVersionId` or the version row.

| From                           | Allowed actions                        |
| ------------------------------ | -------------------------------------- |
| `NOT_STARTED`, `DRAFT`         | `submit` → `AWAITING_REVIEW`           |
| `AWAITING_REVIEW`, `IN_REVIEW` | `approve`, `request_changes`, `reject` |
| `CHANGES_REQUESTED`            | `submit`                               |
| `APPROVED`, `REJECTED`         | none                                   |

`addDeliverableVersion` was allowed in every state and always set `reviewStatus=NOT_STARTED` and `status=DRAFT`, including after approval.

## Official version policy (simpler default)

Chosen in `packages/domain/src/work/deliverable-review-policy.ts` and enforced in `OpsService.addDeliverableVersion`.

| Deliverable `reviewStatus`                  | `addVersion`                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| `NOT_STARTED`, `DRAFT`, `CHANGES_REQUESTED` | Allowed. New version is `DRAFT`. Earlier non-approved versions become `SUPERSEDED`. |
| `AWAITING_REVIEW`, `IN_REVIEW`              | **409**. No silent replace while a review is open.                                  |
| `APPROVED`, `REJECTED`                      | **409**. No reopen.                                                                 |

After `request_changes`, a new version **keeps** `reviewStatus=CHANGES_REQUESTED` until an explicit `submit`. It does not reset the deliverable to `NOT_STARTED`. `approvedVersionId` is never cleared by adding a version. `request_changes` is not legal from `APPROVED`, so the first approval stays pinned.

`approve` requires a version (current, else latest). If there is no version and no asset, the API returns 400. On success it sets deliverable `reviewStatus` and `status` to `APPROVED`, `approvedVersionId` to that version, the version row to `APPROVED`, and other non-approved versions to `SUPERSEDED`.

New annotations are rejected with 409 when the deliverable or the target version is `APPROVED`. Resolving an existing annotation stays allowed.

Direct `PATCH` cannot change review status, approval identity, or the asset of an approved or rejected deliverable.

## Brief gate

Option B: columns on `WorkRequest` (`briefObjective*`, `briefAudience*`, `briefKeyMessage*`, `briefReadyAt`).
READY only when objective, audience, and key message are non-empty.
`POST /requests/:id/convert-to-task` returns 409 `CONFLICT_STATE` with `BRIEF_NOT_READY` otherwise.
A legacy description marker that already contains those three fields is copied onto the columns at convert time so older rows are not stuck.

## Capabilities

| Action                                          | Capability                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Review `approve` / `request_changes` / `reject` | `deliverable.review.decide` (`deliverable.review` still counts as the same grant) |
| Review `submit`                                 | `deliverable.write`, `deliverable.update`, or `deliverable.version.create`        |
| `POST` versions                                 | `deliverable.version.create`                                                      |
| Annotations and deliverable comments            | `deliverable.annotate`                                                            |
| `PATCH` deliverable                             | `deliverable.write`                                                               |

Writer can create versions and cannot decide. Approver can decide and annotate and cannot create versions. Contributor (`MEMBER`) can do neither.

## Seed states

`packages/db/prisma/seed-demo.ts` inserts, once per demo tenant:

- Lock seed — draft
- Lock seed — in review
- Lock seed — changes requested
- Lock seed — approved (version `APPROVED`, `approvedVersionId` set)
- Lock seed — brief incomplete
- Lock seed — brief ready

## Phase 4 — not in this change

Object storage is a refusing port (`DEC-003` still open). A local upload store would be a new persistence backend. This change does not add one.

What a later phase needs:

- An approved object-storage adapter (tenant-scoped keys, checksums).
- Allowed MIME types and a max size at the trust boundary.
- Persist the resulting URL on `WorkDeliverableVersion.assetUrl`.
- Review UI already previews `asset_url` for images.

No new credentials were introduced. Live publish and `AI_LIVE_ENABLED` stay off.

## Phase 5

Deliverable, request, and task loaders use the ops API and no longer replace a failed brand fetch with an empty list. Content calendar copy calls the surface a publishing plan. Deliverable copy calls it an internal review package.

## Release checklist

Filled by the implementation agent. CI must still pass on the pull request before any “production locked” claim.

```text
[x] Approve pins approvedVersionId
[x] Approved version status is APPROVED in DB
[x] POST version on APPROVED → 409
[x] Illegal review transition → 409
[x] approve/reject require deliverable.review.decide (or equivalent deliverable.review)
[x] Cross-tenant access denied
[x] CSRF on mutating routes
[x] Audit events written for approve and addVersion
[x] UI does not offer add-version or decide actions the role/state forbids
[ ] Contract tests green in CI (local deliverable-review contract file passed; full `pnpm test` is not green — see verification note)
[x] Brief gate enforced before convert-to-task
[x] No claim of live social publish
```

Do not call this path production locked until the CI box is checked on a green required workflow.

## Local verification note

`pnpm lint`, `pnpm typecheck`, and `pnpm format` passed in this change.
`tests/contract/deliverable-review.contract.test.ts` passed (9 tests), along with the domain policy tests.

`pnpm test` on this branch is not fully green. The remaining failures are present on `004-oma-complete-product-demo` before this change: website scan/discovery contracts (connector refuses; DEC-004 / DEC-016), Planable source-scan and style-inventory guards, MEMBER brand/strategy capability expectations that disagree with the seeded profile, and the demo-mode error string. This change does not turn the website connector on and does not redesign those surfaces.
