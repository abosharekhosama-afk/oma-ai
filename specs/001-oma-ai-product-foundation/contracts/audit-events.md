# Contract: Audit Events

**Status:** `APPROVED IMPLEMENTATION BASELINE`
**Owner:** OMA Security boundary

## When to write

Must audit at least:

- login success/failure (failure without leaking user existence beyond policy)
- logout / session revoke
- tenant create / suspend
- invitation send/accept
- membership suspend/remove
- capability grant/revoke
- tenant switch
- privileged platform support access
- future: approvals, external mutations, secret access

## Shape

Align with `data-model.md` `AuditEvent`. Payloads store refs/hashes, not secrets or raw credentials.

## Read API

`GET /api/v1/audit-events` — requires `audit.read`; tenant-scoped; cursor pagination; immutable.

## Non-goals

No user-editable audit deletion. No silent omission of privileged actions.
