# OMA AI Cursor Workflow

## Purpose

Use Cursor as a thin orchestrator that routes only the context needed for the current task. Keep product truth in Spec Kit, durable repository rules in `AGENTS.md`, and repeatable procedures in `.agents/skills/`.

## Task modes

| Mode | Use when | Allowed output |
| --- | --- | --- |
| `SPEC_ONLY` | Product behavior, scope, roles, states, journeys, integrations, or decisions are being defined | Specs, checklists, decision updates; no product code |
| `IMPLEMENT` | Approved spec, plan, and tasks exist | Targeted code and tests for the selected task |
| `BUG` | Existing behavior is broken | Reproduction, root cause, smallest fix, regression proof, spec sync if behavior changes |
| `REVIEW` | Validating a change or completion claim | Findings and evidence; edits only when explicitly requested |

## Cursor sequence

1. **Intake** — Restate the requested outcome and classify the mode.
2. **Load** — Read `AGENTS.md`, the constitution, and only the smallest relevant spec/skill. For product-shell, UI, interaction, or visual work, also read `docs/DESIGN_REFERENCE_STRATEGY.md`.
3. **Inspect** — Use the built-in Explore subagent for large or noisy repository discovery. Capture actual versions, scripts, architecture, tests, and dirty worktree state.
4. **Map** — Name domain owner, storage owner, authoritative writer, readers, tenant gate, permissions, events, and consumers.
5. **Gate** — Ask only questions whose answers materially change behavior, architecture, security, cost, or external actions.
6. **Plan** — Produce a bounded plan with files, contracts, migrations, tests, and rollback/risk notes. No plan while blocker decisions are open.
7. **Route** — Keep small work in the parent. Use one focused worker for a coherent implementation slice. Use a second only for independent verification or research.
8. **Implement** — Preserve the repository's patterns; never create parallel sources of truth.
9. **Verify** — Run deterministic checks, then real E2E for the affected journey. Invoke `oma-verifier` before claiming completion.
10. **Converge** — Compare code, tests, UI, spec, plan, and tasks; append or complete remaining work until aligned.
11. **Sync and report** — Update the smallest spec and report evidence, gaps, and decisions.

## Agent routing

| Need | Preferred route | Constraint |
| --- | --- | --- |
| Repository search and architecture discovery | Cursor built-in Explore | Read-only; return paths and evidence, not guesses |
| Browser journey and UI inspection | Cursor built-in Browser + project E2E runner | Never treat screenshots alone as persistence proof |
| Product/SoT/permission audit | `oma-spec-auditor` | Read-only and independent of implementer |
| Routine bounded implementation | OpenCode, when installed/authenticated and suitable | Parent provides exact spec/task/files/tests and reviews the result |
| Architecture, risky migration, hard debugging, convergence | Codex | Explicit bounded handoff; parent verifies the returned work |
| Completion verification | `oma-verifier` | Read-only by default; skeptical evidence report |

Do not delegate a one-file or obvious task merely to use another agent. Never launch several agents on the same change. Default maximum is two active subagents.

## Handoff contract

Every worker handoff must include:

- outcome and mode;
- exact spec and acceptance IDs;
- in-scope and out-of-scope boundaries;
- files/directories allowed to change;
- owner/SoT/tenant/permission constraints;
- required tests and E2E journey;
- prohibited external actions and secrets;
- expected return format: changed files, evidence, risks, unresolved items.

The parent must inspect the diff and run the required checks. A worker's “done” statement is never completion evidence.

## Cost and context rules

- Start in the parent agent with the currently selected model.
- Use `inherit` for custom Cursor subagents; do not hard-pin a premium model.
- Prefer one precise prompt over repeated broad prompts.
- Load skills on demand; do not paste the full product spec into every handoff.
- Stop a worker that expands scope or repeats failed attempts without new evidence.

## Spec Kit gates

For a new feature:

1. `specify/clarify`: define what and why; resolve material ambiguity.
2. `plan`: choose architecture only after repository inspection and blocker decisions.
3. `tasks`: create dependency-ordered, independently verifiable tasks.
4. `analyze`: check cross-artifact consistency and requirement coverage.
5. `implement`: execute one coherent slice at a time.
6. `converge`: compare implementation to spec/plan/tasks and close real gaps.

Use the command/skill names exposed by the installed Spec Kit integration. Cursor integrations may expose hyphenated skills such as `/speckit-plan` rather than dotted slash commands.

## OMA AI pre-plan gate

`DEC-001`, `DEC-002`, and `DEC-013` are resolved: create a separate private repository named `oma-ai`, use an OMA-owned identity/tenant boundary, and apply the approved seven-product reference hierarchy. Do not introduce IMKAN SSO or identity/company synchronization during initial planning; that requires a later specification and mapping contract. Platform-foundation or design-system planning may begin only after repository inspection and explicit authorization. Resolve each of `DEC-003` through `DEC-007` before planning its affected slice, or explicitly defer it behind a safe boundary.

## UI reference gate

For every UI plan or change:

1. Name the screen archetype from `docs/DESIGN_REFERENCE_STRATEGY.md`.
2. Name one primary reference behavior and its OMA-specific adaptation.
3. Map visible states to the authoritative domain state; distinguish AI proposal, human approval, OMA state, and external provider state.
4. Use OMA's original tokens, copy, components, icons, imagery, and layout. Do not combine the visual systems of functional references.
5. Define EN/AR, LTR/RTL, responsive, keyboard, focus, contrast, reduced-motion, loading, empty, error, permission, stale, and conflict behavior before implementation.

## False-completion audit

Before “done,” ask:

- Does the real user journey work, or only a component/demo?
- Is every read/write tenant-scoped and permission-checked server-side?
- Does refresh/re-login preserve the result?
- Are state transitions valid under concurrent or repeated actions?
- Is the approved deliverable version unambiguous and immutable?
- Are notifications routed to the correct actor and deep link?
- Are external failures visible, retryable, and reconciled?
- Are AI claims traceable to source snapshots and human approval?
- Do EN/AR, RTL/LTR, responsive, keyboard, loading, empty, and error states work?
- Does the screen follow the approved OMA reference hierarchy and original token/surface rules rather than copying or mixing reference products?
- Do the spec, plan, tasks, implementation, and tests describe the same behavior?

Any “no” is remaining work or an explicitly documented blocker.
