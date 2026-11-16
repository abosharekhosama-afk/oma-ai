# DEC-026: Multi-level approval (ordered levels, assigned approvers, per-level decisions)

- Status: Accepted (Phase 2 · Planable W2). Every default here can be overridden.
- Date: 2026-11-16
- Builds on: DEC-022 (approval settings), DEC-025 (lock and reset on edit)

## Context

`multi_level` used to mean "REQUIRED with N approvals from anyone". It had no
order, no assignment, and no record of who decided what at which step. Planable's
multi-level approval is a sequence of named steps, each with its own approvers.

## Decision

### Policies

| Mode          | Behaviour                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `none`        | No approval. Requesting approval returns 409 `error.approvals_disabled`. AI copy still needs a review (DEC-024).            |
| `optional`    | Approval is advisory. Scheduling is not blocked.                                                                            |
| `required`    | One approval round with `requiredApprovers` (default 1) before scheduling.                                                  |
| `multi_level` | Ordered **levels**. If none are configured, this falls back to the `required` counter with at least 2 approvers, as before. |

### Levels

- Each level has a name (EN/AR, at most 60 characters), `min_approvals` (1–5,
  default **1**) and optional `approver_user_ids`. An **empty list means anyone
  with `content.approve`**. At most **5** levels and 20 approvers per level.
  Assigned approvers must be active workspace members, and a level needs at
  least `min_approvals` assigned approvers.
- **Workspace plan:** `GET` and `PUT /api/v1/workspace/approval-levels`.
  **Brand plan:** `GET` and `PUT /api/v1/brands/:brandId/approval-levels`.
  A `PUT` replaces the whole list; an empty list clears it. Both `PUT` routes
  require **`tenant.manage`**, because who approves is governance.
- **Which plan applies:** the brand plan applies when the brand has its own
  approval override with mode `multi_level` _and_ has levels. Otherwise the
  workspace plan applies. With no levels at all, the counter applies.

### Rounds

- `request-approval` **freezes** the plan on the post (`ContentItem.approvalLevels`)
  and starts a round (`approvalRoundStartedAt`). Changing settings never changes
  a round already in flight.
- In level mode, `approver_required` is the number of levels and
  `approver_approved` is the number of completed levels. The state is
  `PARTIALLY_APPROVED` until the last level completes, then `APPROVED`.
- Levels are decided **strictly in order**.
  - Approving with `level` other than the current one returns 409
    `error.approval_level_not_reached`. So does a user who is assigned only to a
    later level.
  - A user not assigned to the plan gets 403 `error.approval_not_assigned`.
  - A user who already approved this level gets 409 `error.already_approved`.
    This is enforced by a unique key on (post, round, level, user), so
    concurrent submits are safe. The level count is recomputed after each insert.
- The same person may approve more than one level if they are assigned to each
  of them.
- `request-changes` and `reject` during a level round need someone who can decide
  at _some_ level of the plan. Otherwise the API returns 403. The decision is
  recorded at the current level.
- Every decision is stored in `ContentApprovalDecision`, also in counter mode.
  `GET /content/:id/approval` returns the per-level stepper: status
  `done | current | waiting | changes_requested | rejected`, the approval count
  and the decisions with approver names. Content rows carry the compact
  `approval_levels { total, completed, current }`.
- An edit during review restarts the round (DEC-025): earlier decisions no longer
  count.

## Defaults (override-able)

- Workspaces start on `optional`, with no levels (unchanged).
- `min_approvals = 1`. An empty approver list means anyone with `content.approve`.
- One person may serve on several levels. Alternative: strict separation of
  duties.
- Level settings require `tenant.manage`. Alternative: `content.update`, as for
  brand content preferences.
- Multi-level is not plan-gated in this PR. A `PlanFeature` gate is follow-up work.
