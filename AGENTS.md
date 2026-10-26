# OMA AI Repository Instructions

## Authority order

1. The user's current request.
2. `.specify/memory/constitution.md`.
3. The smallest relevant artifact under `specs/`.
4. `docs/DESIGN_REFERENCE_STRATEGY.md` for product-shell, UI, interaction, or visual work.
5. Existing repository architecture, source-of-truth ownership, and tests.
6. `docs/CURSOR_WORKFLOW.md`, `docs/REFERENCE_PARITY_PROTOCOL.md` for reference-driven work, and on-demand skills.
7. Development OS Golden v1.0.0 owners: `docs/DEVELOPMENT_OS_GOLDEN_BASELINE.md`, `docs/DEVELOPMENT_OS_COST_POLICY.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `.cursor/rules/opencode-orchestrator.mdc`, `.cursor/agents/routing-registry.json`, `scripts/dev-os/golden/project-manifest.json`.

Report conflicts instead of silently choosing one source.

## Development OS (Golden v1.0.0)

- Conforms to IMKAN ONE Development OS Golden baseline `1.0.0` for **orchestration/cost/routing only**.
- Default heavy worker: OpenCode `oma-coder`. Reference evidence: OpenCode `reference-inspector`. Codex is escalation only.
- Cursor premium specialists default to **0** invocations; max **1** with justification. No silent paid fallback when OpenCode is unavailable.
- Substantial stages: `pnpm dev-os:stage`. Gates: `pnpm dev-os:validate`, `pnpm dev-os:token-waste`, `pnpm dev-os:golden-compare`.
- Product behavior remains OMA-owned; do not import People/ISP product rules.

## Current product state

- OMA AI is in product-definition mode.
- `specs/001-oma-ai-product-foundation/spec.md` is the current product baseline.
- OMA AI is an independent product under the IMKAN ecosystem, with its own repository, deployable application boundary, information architecture, visual language, motion, and design tokens. It must not copy IMKAN ONE product behavior or visual design by default.
- A separate repository shell named `oma-ai` and an OMA-owned account, login/session, user, tenant/company, membership, and capability boundary are approved (`DEC-001`, `DEC-002`).
- Platform-foundation architecture and stack are an `APPROVED IMPLEMENTATION BASELINE` under `DEC-014` (TypeScript modular monolith: NestJS API, Next.js web, PostgreSQL/Prisma, Redis/BullMQ workers, pnpm, server-side sessions, Vitest, Playwright). Future IMKAN federation, the Planable-token design-system implementation (`DEC-017`, Stage P1+), and slice-specific providers remain gated until those stages are requested.
- **`DEC-017` — PLANABLE_SINGLE_UI_UX_REFERENCE:** Planable (`app.planable.io`) is `PRIMARY_AND_SOLE_UI_UX_AUTHORITY`. Previous visual certifications are `SUPERSEDED`. Visual acceptance remains `REJECTED` until a Planable rebuild is owner-accepted. Spec pack: `docs/decisions/DEC-017-planable-single-ui-ux-reference.md`.
- **`DEC-016` — PRODUCT-FIRST / EXTERNAL-INTEGRATIONS-LAST:** complete provider-neutral product features before the final live third-party integration phase. Keep ports, refusing/fixture adapters, and honest not-configured UI. No provider SDK/credentials/live calls until that phase. Policy: `docs/PRODUCT_DELIVERY_SEQUENCING.md`. `DEC-003` is RESOLVED (WorkDrive owns media bytes; see `docs/decisions/DEC-003-workdrive-file-ownership.md`); `DEC-004`–`DEC-012` remain open; provider DECs carry `DEFERRED_TO_FINAL_INTEGRATION_PHASE` where tagged.
- Do not create product code, schemas, routes, modules, implemented design systems, or navigation until `/speckit-implement` is explicitly authorized for approved tasks. `DEC-004`–`DEC-012` remain blockers for their named slices. Product/design specifications are allowed in `SPEC_ONLY` / planning modes.

## Required workflow

Use this sequence for every non-trivial change:

`REQUEST → SPEC → REPO INSPECTION → DOMAIN/SoT MAP → PLAN → TASKS → IMPLEMENT → VERIFY → CONVERGE → SPEC SYNC → REPORT`

Before editing:

1. Classify the request as `SPEC_ONLY`, `IMPLEMENT`, `BUG`, or `REVIEW`.
2. Read this file, the constitution, and the smallest relevant spec.
3. Inspect the actual repository, tool versions, authentication state, conventions, and existing tests. Never reinstall or replace working tools without need.
4. Identify the logical owner, authoritative writer, storage owner, readers, tenant boundary, permission gate, events, and downstream consumers for every affected domain.
5. Stop for any unresolved decision that changes product behavior, data ownership, security, external spend, or repository architecture.

## Product invariants

- OMA AI must trace every approved output from source evidence and strategy through plan, brief, task, deliverable version, approval, and publication/campaign state.
- Organic and Paid are distinct plans under one approved strategy; do not collapse them into one generic list.
- AI output is a proposal with provenance and confidence, never an invisible final decision.
- A human must approve client-facing strategy, final deliverables, publishing, and ad spend according to capability.
- Status transitions are server-authoritative domain commands; drag-and-drop is only a UI gesture for a valid transition.
- Approved deliverable versions are immutable. Revisions create new versions and preserve review history.
- No user may read, infer, mutate, search, export, or receive notifications for another tenant's data.
- Client-supplied tenant/company identifiers are never sufficient authority. Resolve tenant context from the authenticated server-side context.
- OMA owns the initial account, session, user, tenant/company, membership, and capability boundary. A future IMKAN federation must preserve canonical OMA identifiers and cannot bypass OMA authorization.
- External integrations use explicit adapters, idempotency keys, retry policy, webhook verification, reconciliation, and audit history.
- Do not duplicate WorkDrive file bytes or external ad-platform delivery state when another system is authoritative.
- Keep one coherent OMA experience under resolved `DEC-017`: Planable is the sole UI/UX authority. Linear, Frame.io, Workfront, Jasper, Semrush, and Smartly are functional-logic only and must not contribute visual systems. ClickUp is not adopted.
- Use original OMA tokens, layouts, copy, icons, and assets. References authorize pattern study, never pixel copying or competing visual systems.
- User-facing experiences must support EN/AR, LTR/RTL, responsive layouts, keyboard access, and understandable empty/loading/error states.

## Agent orchestration

- Cursor is the parent orchestrator when work starts in Cursor.
- Use built-in Explore for noisy repository discovery and built-in Browser for our own application.
- External reference products are inspected only by the Reference Inspection Worker, which is read-only with respect to application source. The parent does not drive the reference browser and does not answer reference-parity questions from memory. See `docs/REFERENCE_PARITY_PROTOCOL.md`.
- Use `oma-spec-auditor` before technical planning or when scope/ownership is disputed.
- Use `oma-verifier` after implementation and before claiming completion.
- Start with zero subagents. Use no more than two concurrently, only for independent context-heavy work.
- Do not fan out automatically or duplicate the same task across agents.
- OpenCode may be the default implementation worker only after its installed version and authentication are verified.
- Codex is preferred for difficult architecture, review, migrations, debugging, and convergence work. The parent agent remains accountable for every handoff.
- Do not pin or spend on premium models unless the user explicitly approves the model/cost choice.
- `CI_WAIT_AND_CONTINUE`: when the current authorized stage requires GitHub CI, do not end the task because a run is queued or in progress. After push, follow exactly one workflow run whose `headSha` equals the pushed HEAD. Stay in the same task until that run finishes. Prefer `gh run watch <run-id> --exit-status --interval 30`. If watch is unavailable or disconnects, poll `gh run view <run-id> --json status,conclusion,url,headSha` every 60 seconds and continue until completed. A shell wait during this period is expected. On success, continue to the next stage already authorized by the same command without asking for a new message. On failure, read the failed logs, identify the first causal error, reproduce it locally, fix it without weakening tests, commit, push, and wait on the new run. Maximum 3 CI repair cycles per requested stage; after the third failed corrected run, stop with a precise blocker. Rerun a workflow without a commit only when evidence shows an external GitHub infrastructure failure. Never trigger a duplicate workflow, weaken assertions, add skips or retries to hide failures, use an empty commit to trigger CI, continue after a failed required gate, or start an unauthorized product feature. If a run exceeds 45 minutes, inspect whether it is still progressing; keep waiting when logs show progress, and stop with `CI_STALLED` only when execution is no longer progressing. Authentication, MFA, and CAPTCHA remain a manual stop. This rule supersedes the previous return-immediately remote-monitoring rule. Blocking sleeps longer than 60 seconds remain forbidden; `gh run watch` is allowed for authorized CI continuation. Do not cancel a remote GitHub Actions run unless the user explicitly asks.

## Implementation standards

- Make the smallest coherent change that completes a real user journey.
- For UI work, name the screen archetype and reference behavior, then explain the OMA adaptation before implementation.
- Preserve established architecture and naming; do not create parallel registries, roles, tenants, file stores, notification systems, or domain models.
- Enforce authorization and tenant scope on the server before reads and writes.
- Validate inputs at trust boundaries and return stable, actionable errors.
- Design mutations for retries, duplicate submissions, stale writes, concurrent edits, and partial external failures.
- Never hardcode secrets, tokens, client credentials, tenant IDs, ad account IDs, or environment-specific endpoints.
- Add or update tests at the level where the behavior can fail.

## Proof of completion

Do not mark work done because files, routes, buttons, or tests merely exist. Prove the affected journey:

`user action → request → authorization → persistence/integration → response → UI → refresh/re-login → persisted result`

Also verify relevant role boundaries, tenant isolation, invalid transitions, duplicate actions, deep links/notifications, EN/AR, RTL/LTR, responsive behavior, and external failure handling.

Run the repository's real lint, typecheck, test, build, and E2E commands that apply. Report exact commands and outcomes. If a required environment or credential is unavailable, state what remains unverified and do not claim full completion.

## Spec synchronization

After implementation, update the smallest relevant spec with durable behavior, ownership, states, APIs/contracts, permissions, events, integrations, decisions, deferred scope, and verified completion. Do not rewrite history or duplicate a source of truth.

Finish with:

- scope completed;
- files changed;
- checks run and results;
- decisions/assumptions;
- remaining gaps or blockers.
