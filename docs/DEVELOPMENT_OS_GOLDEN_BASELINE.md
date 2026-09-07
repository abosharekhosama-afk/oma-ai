# Development OS — Golden Baseline Contract

**GOLDEN_BASELINE_ID:** `IMKAN_ONE_DEVELOPMENT_OS_GOLDEN`  
**DEVELOPMENT_OS_GOLDEN_VERSION:** `1.0.0`  
**Machine manifest:** [`scripts/dev-os/golden/golden-baseline.manifest.json`](../scripts/dev-os/golden/golden-baseline.manifest.json)  
**Compare:** `npm run dev-os:golden-compare`

## Purpose

Answer deterministically: **does another repository match the Golden Development OS?**

This is **Development OS architecture only** — not product versioning.

## Implementation source

**IMKAN ONE / People** is the current golden _implementation source_ for the Development OS.

This does **not** make People product logic canonical for ISP or OMA AI.

Forbidden examples of product propagation:

- Zoho People rules → ISP
- People P8 → OMA
- Payroll boundary → ISP
- People capabilities → OMA
- People reference authority → ISP

Only **OS-core** mechanisms may be compared/propagated.

## Core vs project-specific

| CORE (identical across projects)                        | PROJECT-SPECIFIC (never propagate as core) |
| ------------------------------------------------------- | ------------------------------------------ |
| Orchestrator, tiers, OpenCode/Codex/Reference contracts | Product roadmap / phase status             |
| Cost governor, premium-default-zero, no fan-out         | Reference authorities & access policies    |
| Context minimization, evidence packet, retries          | Product specs / tenant / domain SoT        |
| TOKEN_WASTE_AUDIT, usage ledger, stage runner           | Branches, credentials, CDP ports/profiles  |
| Validator / doctor contracts                            | Application modules / product exceptions   |

## Required gates

See manifest `requiredGates`. Notable:

- Cursor premium default **0**
- Premium fan-out **DENIED**
- Silent paid fallback **DENIED**
- Usage ledger **AUTOMATIC** for substantial stages (`npm run dev-os:stage`)
- `PARENT_TASK_VM_HARD_BLOCK` = **NOT_PLATFORM_ENFORCEABLE** (compensating controls listed in manifest)

## Project manifest contract

Schema: [`scripts/dev-os/golden/project-manifest.schema.json`](../scripts/dev-os/golden/project-manifest.schema.json)

Minimum fields: `PROJECT_ID` · `PROJECT_NAME` · `REPOSITORY` · `PRODUCT_SPEC_ROOT` · `PROJECT_ROADMAP_OWNER` · `REFERENCE_AUTHORITIES` · `REFERENCE_ACCESS_POLICIES` · `IMPLEMENTATION_WORKER_NAME` · `REFERENCE_WORKER_NAME` · `APPLICATION_E2E_ROUTE` · `PROJECT_SPECIFIC_RULES` · `CURRENT_PRODUCT_PHASE`

Do not store credentials or session secrets in manifests.

## Convergence (future ISP / OMA)

1. Copy/compare against this golden version using `dev-os:golden-compare`
2. Classify each component: `MATCH` · `MISSING` · `OUTDATED` · `PROJECT_SPECIFIC` · `CONFLICT` · `RUNTIME_NOT_CONFIGURED`
3. Apply **core only** — never overwrite project manifests with People product state

Commands:

```
npm run dev-os:validate
npm run dev-os:golden-compare
npm run dev-os:stage -- --stage IMPLEMENT -- <command>
npm run dev-os:token-waste
```
