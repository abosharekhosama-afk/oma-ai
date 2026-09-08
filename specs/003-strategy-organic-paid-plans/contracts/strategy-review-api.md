# Contract: Strategy Review & Approval API

**Feature**: `003-strategy-organic-paid-plans`
**Status**: `READY_FOR_REVIEW`
**Base**: `/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId`

Package approval = Owner `DP-003-002` Option A.

---

## Commands

| Method | Path               | Capability         | Effect                                                                                                                                              |
| ------ | ------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/submit`          | `strategy.submit`  | `DRAFT` → `IN_REVIEW`; requires Approved profile link + track rules                                                                                 |
| `POST` | `/request-changes` | `strategy.approve` | `IN_REVIEW` → `CHANGES_REQUESTED`                                                                                                                   |
| `POST` | `/reject`          | `strategy.approve` | `IN_REVIEW` → `REJECTED`                                                                                                                            |
| `POST` | `/approve`         | `strategy.approve` | Package approve → `APPROVED`; supersede prior approved version of **same** strategy; write `StrategyApprovalRecord`; **does not** set Brand current |
| `GET`  | `/comments`        | `strategy.read`    |                                                                                                                                                     |
| `POST` | `/comments`        | `strategy.comment` |                                                                                                                                                     |
| `GET`  | `/decisions`       | `strategy.read`    | Review decision history                                                                                                                             |
| `GET`  | `/approval`        | `strategy.read`    | Approval record if approved                                                                                                                         |

---

## Approve body (minimum)

```json
{
  "rowVersion": 3,
  "comment": "string",
  "unknownsAcknowledged": true,
  "idempotencyKey": "optional-if-header-absent"
}
```

Server re-validates:

- Actor is human with `strategy.approve` (AI/system denied).
- Linked Approved profile still APPROVED and same brand.
- Enabled tracks complete; disabled have rationale.
- Package snapshot frozen.

---

## Notifications (via outbox)

| Event type                                | Typical recipients                      |
| ----------------------------------------- | --------------------------------------- |
| `strategy.submitted`                      | Users with `strategy.approve` on tenant |
| `strategy.comment_added`                  | Participants / editors                  |
| `strategy.changes_requested`              | Editors                                 |
| `strategy.approved` / `strategy.rejected` | Editors + watchers                      |
| `strategy.current_changed`                | Watchers                                |

Deep links re-authorize on open.

---

## Audit event types (minimum)

`strategy.created`, `strategy.profile_linked`, `strategy.submitted`, `strategy.approved_package`, `strategy.rejected`, `strategy.changes_requested`, `strategy.archived`, `strategy.version_superseded`, `strategy.current_set`, `strategy.current_cleared`, `strategy.track_enablement_changed`
