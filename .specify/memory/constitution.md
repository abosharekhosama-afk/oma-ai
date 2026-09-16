# OMA AI Constitution

**Version:** 0.3.0
**Status:** Ratified for product definition
**Ratified:** 2026-08-25
**Last amended:** 2026-09-16

This constitution governs OMA AI specifications, plans, tasks, implementation, review, and convergence. It is technology-independent until the architecture plan is approved.

## I. Product truth precedes implementation

- Define and approve user outcomes, actors, permissions, domain ownership, state transitions, failure behavior, and acceptance evidence before functional implementation.
- Update the smallest relevant Spec Kit artifact before changing intended behavior.
- Keep specifications focused on **what** and **why**. Choose stack, schemas, routes, libraries, and deployment in the technical plan only after repository inspection.
- Never use generated code to hide unresolved product or ownership decisions.
- When the request conflicts with the spec or this constitution, surface the conflict and obtain a decision.

**Gate:** No product code, schema, route, module, or implementation task may be created while a blocker decision would materially change it.

## II. One owner and one source of truth per domain

For every domain or shared object, record:

- logical owner;
- physical storage owner;
- authoritative writer;
- permitted readers;
- tenant boundary;
- capability/permission gate;
- emitted events;
- downstream consumers.

Cross-application visibility never transfers ownership. Consumers reference or project authoritative data; they do not silently copy and diverge it. OMA AI must not create parallel identities, company registries, role systems, file stores, catalogs, notification systems, or billing ledgers when an approved shared owner already exists.

**Gate:** Architecture review must reject any unexplained duplicate source of truth.

## III. Tenant isolation and least privilege are server-authoritative

- Resolve tenant/company context from authenticated server-side context. A body, query, route parameter, hidden input, or client state is never sufficient authorization.
- Apply tenant and permission checks to every read, write, search, export, upload, notification, webhook, background job, and external action.
- Model access as capabilities; job titles are assignable profiles, not hardcoded security boundaries.
- Deny by default. Return the least data necessary.
- Record privileged actions and permission changes in an immutable audit trail.

**Gate:** No journey is complete until cross-tenant negative tests and role-boundary tests pass.

## IV. AI proposes; accountable humans decide

- Label AI-generated or AI-assisted content and retain its generation context, source snapshot references, model/provider metadata allowed by policy, timestamp, and confidence/uncertainty.
- Never invent products, competitor facts, references, prices, performance claims, or legal assertions. Unsupported statements must be marked as hypotheses or omitted.
- Require authorized human approval for client-facing strategy, final deliverables, publishing, and advertising spend.
- Allow users to edit, reject, regenerate, and compare AI proposals without losing prior versions or feedback.
- Apply data-minimization and retention rules to prompts, crawled content, uploaded assets, and provider logs.

**Gate:** AI output cannot directly become approved, published, or spend-bearing state without an explicit authorized transition.

## V. End-to-end traceability is a product invariant

Every production item must be traceable through this chain where applicable:

`Source evidence → Insight → Strategy → Organic/Paid plan item → Brief → Task → Deliverable version → Review/Approval → Publication or Campaign`

- Preserve identifiers and links across transformations.
- Show users why a task exists, which plan objective it serves, and which evidence informed it.
- Preserve review comments, requested changes, approvals, and superseded versions.
- Audit automated transformations and external synchronization.

**Gate:** Orphaned deliverables, untraceable recommendations, and unlinked campaign creatives are incomplete.

## VI. Workflows are explicit state machines

- Define canonical states, permitted transitions, transition actor/capability, required inputs, side effects, and terminal states.
- Treat drag-and-drop as a request for a domain transition, not permission to mutate status locally.
- Reject invalid, stale, duplicate, or unauthorized transitions with stable errors and recoverable UI.
- Use optimistic concurrency or equivalent protection where simultaneous edits can overwrite work.
- Preserve state history rather than only the current label.

**Gate:** Each state machine requires positive transition tests, invalid transition tests, permission tests, and refresh persistence proof.

## VII. Files, versions, and approvals preserve integrity

- Separate file-byte ownership from OMA metadata, linkage, version, and approval responsibilities.
- Treat an approved deliverable version as immutable. Any revision creates a new version that links to its predecessor.
- Never silently replace the approved file, detach feedback, or approve an ambiguous “latest” upload.
- Validate file type, size, malware/security policy, ownership, and tenant scope at upload and download boundaries.
- WorkDrive synchronization must be idempotent and reconciled; a link alone is not proof that bytes exist or are accessible.

**Gate:** The approved version must remain identifiable after refresh, re-login, sync retry, and a later revision.

## VIII. Integrations are explicit, idempotent, and observable

- Isolate website ingestion, WorkDrive, Meta, and future ad channels behind connector contracts.
- Store secrets only in approved secret management; never in source, specs, logs, prompts, or client bundles.
- Verify OAuth state, webhook signatures, tenant/account binding, token scope, and expiry.
- Use idempotency keys and external IDs for retries and duplicate event handling.
- Model partial failure, rate limits, permission revocation, provider downtime, and reconciliation.
- Show external status and last synchronization evidence without pretending OMA owns provider delivery truth.
- Never spend money, publish, schedule, delete, or mutate a real external account without an explicit authorized action.

**Gate:** Mock-only success is insufficient for completion of an integration journey; unavailable live verification must be reported as a blocker.

## IX. Accessible bilingual UX is part of correctness

- Support English and Arabic copy, LTR and RTL layouts, and locale-safe dates, numbers, currency, and content direction.
- Provide responsive behavior for the roles and devices named in the feature spec.
- Support keyboard access, focus management, semantic labels, contrast, and non-color status cues.
- Design loading, empty, error, offline/retry, stale, conflict, and permission-denied states.
- Notifications must identify the actor, object, required action, and tenant-safe deep link.
- Preserve user context across refresh, re-login, browser back/forward, and deep-link entry.

**Gate:** Visual presence without usable interaction in EN/AR, RTL/LTR, and required viewport sizes is incomplete.

## X. Completion is evidence, not assertion

“Done” requires proof of the affected real journey:

`Action → Request → Authorization → Durable mutation/integration → Response → UI → Refresh/Re-login → Persisted result`

Verification must include, when relevant:

- lint, typecheck, unit/integration tests, build, and E2E;
- actor and tenant boundaries;
- invalid and concurrent transitions;
- duplicate requests and idempotency;
- notifications and deep links;
- AI provenance and human approval;
- external failure and reconciliation;
- EN/AR, RTL/LTR, responsive, accessibility, and visual review;
- a false-completion audit;
- convergence of spec, plan, tasks, code, and tests.

If an environment, account, credential, service, or dataset is unavailable, record exactly what was and was not verified. Never downgrade “not verified” to “passed.”

## XI. Scope, cost, and agent use remain controlled

- Prefer the smallest coherent change that completes a user outcome.
- Start with the parent agent. Delegate only independent, context-heavy work with a written handoff contract.
- Default to no more than two active subagents.
- Do not use parallel agents to repeat the same work or manufacture confidence.
- Inspect installed tools and authentication before installation or reconfiguration.
- Do not pin premium models or trigger paid external actions without user approval.
- Preserve user changes and unrelated worktree state.

## XII. Specifications evolve with the product

- Keep one authoritative artifact for each behavior; link rather than duplicate.
- Record decisions, superseded behavior, deferred scope, and completion evidence.
- A change request updates or replaces the smallest affected spec while preserving historical intent in version control.
- After implementation, synchronize durable behavior and ownership before final reporting.
- Do not edit managed Spec Kit templates to encode product truth; store project truth in constitution and `specs/` artifacts.

## XIII. OMA design is independent, coherent, and original

- OMA AI is an independent product under the IMKAN ecosystem. It owns its application experience, information architecture, visual language, motion language, and design tokens; it is not required to reproduce IMKAN ONE screens, colors, navigation, or transitions.
- Express the IMKAN relationship through approved brand endorsement and explicit integrations, not through accidental visual or behavioral coupling.
- Use one named UI/UX North Star (`DEC-017`: Planable / `app.planable.io`). Assign every additional reference to functional logic, content model, or analysis model so the product does not become a collage of competing design systems. Linear, Frame.io, Workfront, Jasper, Semrush, Smartly, and ClickUp have **no visual authority**.
- Treat references as pattern evidence only. Use original OMA layouts, components, copy, icons, imagery, and tokens; never copy proprietary assets or complete screen arrangements.
- Keep operational surfaces visually consistent across intelligence, strategy, planning, production, client, and paid-media work. Review stays inside the Planable light operational system unless a later live `app.planable.io` capture proves a distinct media canvas.
- Motion must communicate hierarchy, state, progress, or spatial continuity. It must not obscure server-authoritative state, approval, external spend, or failure.
- Validate the design direction in EN/AR, LTR/RTL, reduced motion, keyboard use, responsive layouts, contrast, and non-color status cues before implementation.

**Gate:** Every UI plan must name its screen archetype, primary Planable behavior, OMA adaptation, represented domain state, and accessibility proof. `DEC-017` must be approved before implementing the base design system. `DEC-013` does not authorize visual implementation.

## Delivery gates

### Gate A — Definition ready

- Outcomes, users, scenarios, functional requirements, non-goals, and success measures are testable.
- Material ambiguities are resolved or explicitly listed as blockers.
- No technical stack is smuggled into the product specification.

### Gate B — Architecture ready

- Repository and toolchain have been inspected.
- Domain and source-of-truth map is approved.
- Tenant, permissions, data retention, integrations, migration, and failure strategy are explicit.
- Constitution check passes.

### Gate C — Tasks ready

- Tasks are dependency-ordered, bounded, and independently verifiable.
- Each task references requirement and acceptance IDs.
- Tests and E2E are implementation work, not cleanup afterthoughts.

### Gate D — Implementation ready for review

- Targeted checks pass.
- Diff contains no unapproved architecture, unrelated edits, secrets, or placeholder behavior.
- Real journey evidence exists.

### Gate E — Converged

- Spec, plan, tasks, code, tests, UI, and integration behavior agree.
- False-completion audit finds no hidden gap.
- Remaining limitations are explicit and accepted.

## Governance

- This constitution overrides lower-level workflow preferences and templates.
- Amendments require a stated reason, affected principles, version change, and migration/impact note.
- Versioning follows semantic intent:
  - **MAJOR:** removes or materially reverses a governing principle;
  - **MINOR:** adds a principle or materially expands a gate;
  - **PATCH:** clarifies wording without changing obligations.
- Every technical plan must include a constitution check.
- Every completion report must identify any exception. An exception requires explicit user approval and must not weaken tenant isolation, secret handling, or external-spend authorization.

## Amendment record

- **0.3.0 — 2026-09-16:** Principle XIII now binds a single UI/UX North Star (`DEC-017` Planable). Linear is no longer an interaction visual reference. Review remains in the Planable light operational system unless later live Planable evidence proves otherwise. Impact: design-system implementation must follow Planable tokens/shell; no product code in this amendment.
- **0.2.0 — 2026-08-25:** Added Principle XIII after the product was confirmed as an independent OMA AI system under IMKAN and a coherent global-reference strategy was requested. Impact: UI specifications must use the OMA reference hierarchy and originality gate; no product code migration is required because implementation has not started.
