# Development Workflow — Routing Map (OMA AI)

**DEVELOPMENT_OS_GOLDEN_VERSION:** `1.0.0`  
**Cost policy:** [`DEVELOPMENT_OS_COST_POLICY.md`](./DEVELOPMENT_OS_COST_POLICY.md)  
**Golden contract:** [`DEVELOPMENT_OS_GOLDEN_BASELINE.md`](./DEVELOPMENT_OS_GOLDEN_BASELINE.md)  
**Project orchestrator:** [`.cursor/rules/oma-orchestrator.mdc`](../.cursor/rules/oma-orchestrator.mdc)  
**Cost orchestrator:** [`.cursor/rules/opencode-orchestrator.mdc`](../.cursor/rules/opencode-orchestrator.mdc)

## Compact command form

```
MODE · SCOPE · CURRENT_PHASE · TARGET_OUTCOME · SPECIAL_CONSTRAINTS · STOP_CONDITION
```

Durable governance lives in repository owners — do not paste the entire OS into every prompt.

## Tiers

| Tier | Route                                                      | Default                   |
| ---- | ---------------------------------------------------------- | ------------------------- |
| 0    | Deterministic tools/scripts                                | First when sufficient     |
| 1    | OpenCode `oma-coder`                                       | Default heavy             |
| 1    | OpenCode `reference-inspector`                             | Default reference         |
| 1    | Codex CLI (`scripts/ai/codex-worker.sh`)                   | Escalation only           |
| 2    | Cursor specialists (`oma-spec-auditor`, `oma-verifier`, …) | Default **0** / max **1** |

## Worker map

| Work                                     | Worker                                       |
| ---------------------------------------- | -------------------------------------------- |
| Normal implementation / refactor / tests | `oma-coder`                                  |
| External reference evidence              | `reference-inspector` via `pnpm ref:inspect` |
| Application E2E                          | Playwright `pnpm test:e2e`                   |
| Spec ownership disputes                  | `oma-spec-auditor` (escalation)              |
| Completion claim review                  | `oma-verifier` (escalation)                  |
| Hard architecture / migrations           | Codex escalation                             |

## Forbidden

- Silent paid fallback when OpenCode fails
- Premium parallel or redundant sequential fan-out
- Forwarding whole-repo / whole-history to specialists by default
- Importing People / ISP product rules into OMA

## Stage ledger

Substantial stages: `pnpm dev-os:stage -- <command>` — ledger automatic under `.dev-os/ledgers/`.
