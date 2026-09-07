# Development OS — Cost & Token Policy

**Status:** FINAL (cost hardening)  
**Owner:** Development OS / Cursor Parent orchestration  
**Companion:** [`.cursor/rules/opencode-orchestrator.mdc`](../.cursor/rules/opencode-orchestrator.mdc) · [`scripts/dev-os/cost/`](../scripts/dev-os/cost/) · [`.cursor/agents/routing-registry.json`](../.cursor/agents/routing-registry.json)

## Principle

**QUALITY_FIRST · NO_DUPLICATE_INTELLIGENCE**

Useful reasoning is allowed. Repeated reasoning, replayed context, model panels, and silent paid fallbacks are not.

Do **not** impose an arbitrary tiny token ceiling that degrades difficult work.

## Economic resources (separate)

| Pool | Use |
|------|-----|
| **A — ChatGPT subscription → OpenCode / Codex route** | Default heavy implementation, reference inspection, Codex escalation |
| **B — Cursor subscription / Included / On-Demand** | Orchestration + rare specialist escalation |

Do not replace A with a metered OpenAI API key. Do not silently move OpenCode work onto B.

## Execution tiers

### TIER 0 — Deterministic tools (first)

git · rg/find · JSON/CSV · typecheck · lint · tests · build · CI · schema/Prisma · artifact validate · log parse · diff classify.

Do not invoke a premium model merely to run these.

### TIER 1 — OpenCode default heavy work

Repository exploration · normal implementation · refactors · test writing · routine debug · reference artifacts · Reference Inspector · mechanical verification · evidence preparation.

```
opencode run --agent oma-coder "<narrow task>"
```

Auth: existing ChatGPT-subscription OpenCode route. **Not** OpenAI API pay-as-you-go.

If OpenCode route is unavailable / rate-limited / unauthenticated:

```
BLOCKED_BY_OPENCODE_ROUTE
```

or `BLOCKED_BY_OPENCODE_LIMIT` / `BLOCKED_BY_OPENCODE_RUNTIME`.

**No silent Cursor premium fallback.**

### TIER 2 — Cursor high-value specialist

Default Cursor premium calls per work stage: **0**.  
Normal justified maximum: **1**.  
Second specialist only with recorded `WHY_TWO_SPECIALISTS_REQUIRED` and non-overlapping responsibility.

## Hard no-fan-out

Forbidden by default for one parent task / stage:

Fable + Sol + Sonnet + Opus + Grok + Gemini + Composer (or equivalent panel).

- `CURSOR_PREMIUM_PARALLEL_FAN_OUT` = **0**
- `CURSOR_PREMIUM_SEQUENTIAL_REDUNDANT_FAN_OUT` = **0**
- Same-role retry without new evidence = **DENY**

“Double check / another opinion / more professional” is **not** justification.

## Model inherit safety

`model: inherit` is **not** assumed cheap.

`INHERIT_FROM_HIGH_COST_PARENT` = **NOT AUTOMATIC**.

Classify each agent in `.cursor/agents/routing-registry.json`:

`SAFE_TO_INHERIT` · `PIN_TO_COST_EFFICIENT_MODEL` · `SPECIALIST_EXPLICIT_MODEL` · `NO_MODEL_CALL_REQUIRED`

## Context hygiene

**MINIMUM NECESSARY CONTEXT.**

Workers receive: task ID · Spec requirement IDs · relevant files · relevant diff · reference artifact IDs · SoT · tenant/permission constraints · acceptance criteria · unresolved question.

Do **not** routinely send: entire repo · entire chat · entire roadmap · all phase reports · all screenshots · all specs.

### Evidence packet (before premium)

Compact handoff schema: [`scripts/dev-os/cost/evidence-packet.schema.json`](../scripts/dev-os/cost/evidence-packet.schema.json)

```
DECISION · QUESTION · RELEVANT_FILES · RELEVANT_DIFF · SPEC_IDS · REFERENCE_IDS · CONSTRAINTS · FACTS · UNKNOWN · RISKS
```

Discover once → compress → reason on evidence.

## Retry control

Retry only when at least one changes: new evidence · corrected input · changed environment · fixed config · smaller scope · different justified route.

Same worker + same context + same failure → **STOP**.

## Verification without model panels

Preferred: implementation → deterministic tests → integration → Playwright → artifact aggregation → **ONE** independent model review when materially justified.

Verifier / False Completion / Convergence may be governance gates without three premium calls.

## Reference reuse

Reference Inspector → structured artifacts → compact evidence → Cursor Parent.

Do not re-inspect already verified surfaces unless evidence is stale, contradictory, or a specific missing fact is required.

## Compact stage commands

Prefer:

```
MODE · SCOPE · CURRENT_PHASE · TARGET_OUTCOME · SPECIAL_CONSTRAINTS · STOP_CONDITION
```

then reference durable owners (`AGENTS.md`, workflow, Spec, plan, tasks, reference protocol) instead of replaying mega-prompts.

## TOKEN_WASTE_AUDIT (permanent gate)

Run before final completion of substantial work:

```
npm run dev-os:token-waste
```

Substantial stages must be started via the stage runner so the ledger is automatic:

```
npm run dev-os:stage -- --stage REFERENCE_DISCOVERY -- <command>
```

`LEDGER_CAPTURE: AUTOMATIC` for substantial stages — workers do **not** need to remember `--ledger`.  
`TOKEN_WASTE_AUDIT` resolves ledger from: `--ledger` → `DEV_OS_LEDGER` → `.dev-os/ledgers/CURRENT.json` → newest ledger → else `NOT_OBSERVABLE`.

Checks (observable only; never invent counts):

A overlapping premium work · B excess context · C full-history resent · D deterministic work via models · E useless retries · F OpenCode→Cursor silent fallback · G re-inspected verified surfaces · H multi-reviewer without distinct roles · I high-cost inherit chain · J excessive specialists in one turn · K re-running completed stages · L wholesale report replay

Required for PASS:

- `UNJUSTIFIED_PREMIUM_CALLS` = 0  
- `UNJUSTIFIED_MODEL_FAN_OUT` = 0  
- `USELESS_RETRIES` = 0  
- `SILENT_PAID_FALLBACK` = 0  

Unavailable telemetry → `NOT_OBSERVABLE` (not a fabricated pass). Missing Cursor billing data must **not** fail legitimate engineering; observable policy violations still fail.

## Usage ledger

```
npm run dev-os:usage-ledger -- --csv <path>
```

Records stage · worker · model · purpose · calls · context strategy · retries · tokens · billing class · cost when export is available.

## Cost anomaly warnings (relative)

| Signal | Code |
|--------|------|
| Stage launches >1 Cursor premium specialist | `COST_WARNING_FAN_OUT` |
| Same worker retries >1 without new evidence | `COST_WARNING_RETRY` |
| Full-context packet resent repeatedly | `COST_WARNING_CONTEXT_REPLAY` |
| OpenCode unavailable + Cursor premium auto-starts | `POLICY_VIOLATION` |
| Large cache-read amplification in export | `COST_WARNING_CACHE_AMPLIFICATION` |

## Unenforceable Cursor runtime limitations

Cursor does not expose a hard programmatic API that blocks the Parent from calling `Task` with multiple premium agents.

```
PARENT_TASK_VM_HARD_BLOCK: NOT_PLATFORM_ENFORCEABLE
```

Compensating controls:

1. always-applied orchestrator rule  
2. agent routing registry + frontmatter `DEFAULT_INVOCATION: 0`  
3. deterministic validators and routing tests  
4. automatic substantial-stage usage ledger (`dev-os:stage`)  
5. `TOKEN_WASTE_AUDIT` before DONE  

Any bypass by a human or Parent that ignores rules is a **policy violation**, not a missing feature claim.

## Propagation

After merge to Imkan One `main`, propagate OS-only files to ISP / OMA AI when those repos share the same Development OS template — do not mix product state.
