# Decision packets — Feature 003

**Feature:** `003-strategy-organic-paid-plans`
**Authority:** [`../spec.md`](../spec.md)
**Rule:** Packets are **UNRESOLVED** until Owner decides. Spec interims are fail-closed honesty rules, not silent Owner resolutions.

| ID           | File                                                                               | Status     | Blocks                                          |
| ------------ | ---------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| `DP-003-001` | [dp-003-001-brand-profile-gate.md](./dp-003-001-brand-profile-gate.md)             | UNRESOLVED | Submit/`IN_REVIEW` / approve eligibility nuance |
| `DP-003-002` | [dp-003-002-approval-granularity.md](./dp-003-002-approval-granularity.md)         | UNRESOLVED | Whether Organic/Paid need separate approvals    |
| `DP-003-003` | [dp-003-003-current-strategy-pointer.md](./dp-003-003-current-strategy-pointer.md) | UNRESOLVED | Current-approved strategy pointer semantics     |

Non-decisions (already bound by repository authority):

- `DEC-016` product-first / external-integrations-last — RESOLVED
- No live AI / ads / social / analytics in 003 — bound by `DEC-016` + deferred provider DECs
- Organic ≠ Paid — Foundation invariant
