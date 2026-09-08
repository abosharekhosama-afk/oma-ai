# Contract: Strategy Capability Codes

**Feature**: `003-strategy-organic-paid-plans`
**Status**: `READY_FOR_REVIEW`
**Integration:** Extend Foundation capability registry + API route requirements (keep in sync). Do not create a parallel ACL.

---

## Codes

| Code                     | Description                                                      | Sensitive |
| ------------------------ | ---------------------------------------------------------------- | --------- |
| `strategy.read`          | List/read strategies, versions, comments, evidence link metadata | No        |
| `strategy.create`        | Create strategy + initial draft                                  | Yes       |
| `strategy.edit`          | Edit draft foundation, enablement, clone draft                   | Yes       |
| `strategy.organic.edit`  | Edit Organic track                                               | Yes       |
| `strategy.paid.edit`     | Edit Paid planning track                                         | Yes       |
| `strategy.evidence.link` | Attach/detach Feature 002 evidence links                         | Yes       |
| `strategy.comment`       | Comment on versions                                              | Soft      |
| `strategy.submit`        | Submit draft to `IN_REVIEW`                                      | Yes       |
| `strategy.approve`       | Request changes / reject / **package approve**                   | Yes       |
| `strategy.archive`       | Archive strategy                                                 | Yes       |
| `strategy.compare`       | Compare versions                                                 | No        |
| `strategy.set_current`   | Set/clear Brand `currentApprovedStrategyId`                      | Yes       |

---

## Separation rules

- `strategy.approve` does **not** imply `strategy.set_current`.
- `strategy.set_current` does **not** approve or supersede versions.
- AI/system principals MUST NOT receive `strategy.approve` or `strategy.set_current`.
- Holding only `strategy.read` never mutates.

---

## Planned profile grants (implement-time seed; interim)

| Foundation profile   | Suggested grants                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `COMPANY_OWNER`      | All `strategy.*`                                                                                                    |
| Strategist           | create, read, edit, organic.edit, paid.edit, evidence.link, comment, submit, approve, compare, set_current, archive |
| Reviewer             | read, comment, approve, compare                                                                                     |
| Contributor / viewer | `strategy.read` (+ comment if desired)                                                                              |

Deny-by-default for unspecified routes.

---

## Mid-flight

Any future async work must re-check membership ACTIVE + required capability and fail closed (`PERMISSION_DENIED`).
