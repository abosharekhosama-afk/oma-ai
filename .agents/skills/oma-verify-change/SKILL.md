---
name: oma-verify-change
description: Independently verify an OMA AI implementation or completion claim. Use after implementation, before marking work done, during convergence, or when checking tenant isolation, permissions, state machines, AI provenance, deliverable versions, WorkDrive, notifications, client visibility, or paid-media behavior.
---

# Verify an OMA AI Change

Act as a skeptical verifier. Do not infer success from code presence or another agent's report.

1. Read the relevant acceptance, requirement, plan, and task IDs plus the actual diff.
2. Confirm the change uses the existing domain owner and does not introduce a duplicate source of truth.
3. Trace each affected journey:

   `Action → Request → Authorization → Durable mutation/integration → Response → UI → Refresh/Re-login → Persisted result`

4. Run the repository's real deterministic checks. Then execute the relevant E2E path against a real local/test environment when available.
5. Test applicable negative paths:
   - another tenant and unauthorized role;
   - invalid/stale/concurrent transition;
   - duplicate submission/retry;
   - wrong or superseded version;
   - revoked membership or connector;
   - external timeout, partial success, duplicate/out-of-order webhook, and reconciliation;
   - old notification/deep link after access changes.
6. Verify AI source/provenance, uncertainty, editability, and human approval boundaries.
7. Where UI changed, read `docs/DESIGN_REFERENCE_STRATEGY.md` and verify the named screen archetype, reference adaptation, original OMA tokens/assets, contextual light/review surface rules, EN/AR, RTL/LTR, responsive, keyboard, focus, contrast, reduced motion, loading, empty, error, conflict, permission, and non-color status states.
8. Compare spec, plan, tasks, implementation, tests, and visible behavior for convergence.

Report findings by severity with exact evidence and paths. Separate `PASS`, `FAIL`, `BLOCKED`, and `NOT TESTED`. State whether completion is justified; do not edit unless the caller explicitly requests a fix.
