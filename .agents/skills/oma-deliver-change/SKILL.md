---
name: oma-deliver-change
description: Implement an approved OMA AI feature, task, or bug fix through the repository's Spec Kit workflow. Use only when the relevant product spec is clear and the required technical plan/tasks exist, or when a bounded bug can be fixed without inventing product behavior.
---

# Deliver an OMA AI Change

1. Read `AGENTS.md`, the constitution, the smallest relevant spec, approved plan, and selected task IDs. For UI work, also read `docs/DESIGN_REFERENCE_STRATEGY.md` and confirm `DEC-013` is approved.
2. Confirm no blocker decision affects the work. If one does, stop and switch to `oma-spec-first`.
3. Inspect repository status, architecture, source-of-truth owners, tool versions, scripts, existing tests, and nearby canonical examples.
4. Write a bounded implementation contract:
   - acceptance and requirement IDs;
   - exact in/out scope;
   - files and domains allowed to change;
   - tenant, capability, version, state, event, and integration constraints;
   - migrations and compatibility;
   - tests and E2E proof;
   - rollback or recovery for risky changes.
5. Keep small work in the parent agent. Delegate one coherent slice only when context or specialization justifies it; use no more than two independent agents and avoid duplicate work.
6. Implement the smallest coherent end-to-end change. Preserve established owners and patterns; do not create parallel registries, stores, permissions, workflows, or external state.
7. Enforce tenant/capability checks at the server, validate trust boundaries, protect secrets, and handle stale, duplicate, concurrent, retry, and partial-failure paths.
8. Add or update tests that prove behavior rather than file presence. For UI work, verify the named archetype/reference adaptation, original OMA tokens/assets, contextual surface rules, EN/AR, RTL/LTR, keyboard, focus, contrast, reduced motion, and non-color states.
9. Run repository lint, typecheck, tests, build, and real E2E relevant to the change.
10. Invoke `oma-verify-change`, inspect the diff, fix material findings, and repeat until converged or explicitly blocked.
11. Synchronize the smallest spec with durable implemented behavior and evidence.

For reference-driven work, consume the prepared artifacts in `.reference/` (surface inventory, action inventory, parity matrix gap rows) alongside the spec. Do not browse the reference product yourself, reinterpret an unknown, or classify an inaccessible feature as matched — return `REFERENCE_EVIDENCE_INSUFFICIENT` and stop.

Return changed files, requirements completed, exact checks/results, E2E evidence, decisions, migrations, risks, and remaining unverified work. Never claim full completion when credentials or a real environment were unavailable.
