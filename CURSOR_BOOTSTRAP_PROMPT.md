# Paste this entire prompt into Cursor Agent

You are the setup orchestrator for a new project named **OMA AI**.

## Fixed setup values

```text
PROJECT_NAME=OMA AI
PROJECT_SLUG=oma-ai
DEFAULT_BRANCH=main
GITHUB_VISIBILITY=private
MODE=SETUP_ONLY
```

Use the currently authenticated GitHub account as `GITHUB_OWNER`. If a different owner is explicitly supplied in the same chat, use that exact owner. Never guess an organization.

## Outcome

Create the local `oma-ai` project folder, initialize Git and the current official GitHub Spec Kit Cursor integration, install the OMA AI project-specific Spec Kit/agent workflow files, create a **private** GitHub repository named `oma-ai`, make the first commit, push `main`, verify the result, and stop before product implementation.

## Non-negotiable boundaries

- This is `SETUP_ONLY`. Do not create product code, `src/`, database schema, routes, APIs, UI screens, design system, navigation, package manifest, infrastructure, `plan.md`, or `tasks.md`.
- Do not choose a framework, database, cloud, AI provider, queue, storage implementation, or deployment architecture.
- Do not import product specs or business logic from other IMKAN ONE applications.
- Treat the product boundary as resolved: create a separate `oma-ai` repository and preserve OMA AI as an independent deployable product under IMKAN with its own product experience. Do not copy IMKAN ONE shell, navigation, colors, motion, or business logic.
- Treat `DEC-002` as resolved: OMA owns the initial account, login/session, user, tenant/company, membership, and capability boundary. Do not add IMKAN SSO or identity/company synchronization; any future integration requires a separate approved specification and mapping contract.
- Inspect installed tools and authentication before any install or reconfiguration. Never reinstall a working tool.
- Never ask the user to paste tokens, passwords, API keys, or GitHub credentials into chat or files.
- Do not create or modify a remote repository until the exact authenticated GitHub owner and target repository availability are verified read-only.
- Never delete, overwrite, force-push, or attach to an existing local folder/remote repository without explicit confirmation.
- Use no premium model or paid external service. Creating the requested private GitHub repository is the only authorized external mutation.

## Phase 1 — Read-only preflight

1. Report the current working directory and identify the intended parent directory for `oma-ai`.
2. Check for an existing local target using an exact path, not a glob.
3. Inspect, without installing:

   ```bash
   git --version
   gh --version
   gh auth status
   specify --version
   specify integration list
   cursor-agent --version
   opencode --version
   codex --version
   node --version
   npm --version
   npx --no-install playwright --version
   ```

   A missing optional tool is not permission to install it. `git`, `gh`, and `specify` are required for this setup; Cursor/OpenCode/Codex/Playwright versions are recorded for later workflow planning.

4. Resolve the GitHub account with a read-only command such as:

   ```bash
   gh api user --jq .login
   ```

5. Resolve the exact remote target with:

   ```bash
   gh repo view "<resolved-owner>/oma-ai"
   ```

6. Apply these stop rules:

   - If `oma-ai` already exists locally and is non-empty, inspect it and stop with options; do not merge or overwrite.
   - If the remote `owner/oma-ai` already exists, stop and report its URL/visibility/default branch; do not reuse, rename, delete, or push.
   - An authenticated `not found` result for that exact repository means the remote name is available. Any network, permission, rate-limit, or ambiguous lookup failure is `BLOCKED`, not proof of availability.
   - If `gh` is not authenticated, pause and ask the user to complete `gh auth login` manually, then resume with preflight. Do not accept credentials in chat.
   - If a required tool is missing, report the exact missing tool and proposed official install command, then wait for approval before installing.
   - If the installed `specify` syntax differs, inspect `specify init --help` and `specify integration list`; use the installed version's documented syntax rather than guessing.

Before any mutation, print one compact preflight table with tool versions, GitHub owner, local target, remote target, and `READY`/`BLOCKED` verdict.

## Phase 2 — Create the local project safely

Only after preflight is `READY`:

1. Create the exact child directory `oma-ai` under the reported parent.
2. Enter it and initialize Git with branch `main` if Spec Kit did not already do so:

   ```bash
   git init -b main
   ```

3. Initialize the installed official Spec Kit Cursor integration **before** applying the OMA overlay. Prefer:

   ```bash
   specify init --here --force --non-interactive --integration cursor-agent
   ```

   Use only flags confirmed by the installed CLI. Do not run Spec Kit init twice. Preserve all generated managed files.

## Phase 3 — Install the OMA AI foundation overlay

Use this source order:

1. If the supplied `oma-ai-foundation` directory or attached files are available in Cursor context, copy the files below byte-for-byte into the new project while preserving hidden paths.
2. If some supplied files are unavailable, create only the missing files from the contracts in this prompt and the canonical OMA AI baseline below. Do not replace a more complete supplied file with a summary.
3. If the full product specification is not supplied and cannot be recreated without losing listed requirements, stop and ask for `specs/001-oma-ai-product-foundation/spec.md`; do not invent product code.

Required project-specific tree:

```text
oma-ai/
├── README.md
├── AGENTS.md
├── docs/
│   ├── CURSOR_WORKFLOW.md
│   └── DESIGN_REFERENCE_STRATEGY.md
├── .specify/
│   └── memory/
│       └── constitution.md
├── specs/
│   └── 001-oma-ai-product-foundation/
│       ├── spec.md
│       └── checklists/
│           └── requirements.md
├── .agents/
│   └── skills/
│       ├── oma-spec-first/SKILL.md
│       ├── oma-deliver-change/SKILL.md
│       └── oma-verify-change/SKILL.md
└── .cursor/
    ├── rules/
    │   └── oma-orchestrator.mdc
    └── agents/
        ├── oma-spec-auditor.md
        └── oma-verifier.md
```

Do not remove or overwrite Spec Kit's managed templates, scripts, integration metadata, or `speckit-*` skills generated in Phase 2. The OMA files complement them.

### File contracts

- `AGENTS.md`: small durable contract shared by Cursor, Codex, and OpenCode. It enforces Spec-first, domain/SoT mapping, server-authoritative tenant/capability/state rules, AI human approval, traceability, E2E proof, convergence, and no false completion.
- `.specify/memory/constitution.md`: governing product/engineering principles and gates. It remains technology-independent.
- `specs/001-oma-ai-product-foundation/spec.md`: complete baseline product specification; no stack or schema.
- `requirements.md`: quality checklist with unresolved decision gates.
- `.agents/skills/*`: concise Agent Skills with only `name` and `description` YAML frontmatter and imperative instructions. Folder and skill names must match.
- `.cursor/rules/oma-orchestrator.mdc`: thin always-applied Cursor-only orchestration; point to `AGENTS.md` instead of duplicating the full rules.
- `.cursor/agents/*`: exactly two focused, read-only agents using `model: inherit`: `oma-spec-auditor` and `oma-verifier`.
- `docs/CURSOR_WORKFLOW.md`: mode classification, task sequence, worker routing, handoff contract, cost/context rules, Spec Kit gates, and false-completion audit.
- `docs/DESIGN_REFERENCE_STRATEGY.md`: OMA's independent product boundary, approved seven-product reference hierarchy, working color/surface inputs, screen archetypes, motion language, integration UX, and originality rule.
- `README.md`: Arabic setup/use guide and exact open decisions before technical planning.

### Canonical OMA AI product baseline

The product is a multi-company AI-assisted content operations platform with this traceable chain:

```text
Website/Product sources
→ Evidence and confirmed brand/product facts
→ Insights, competitors, references, and recommendations
→ Approved strategy
→ Separate Organic plan and Paid plan
→ Briefs
→ Production tasks for designers, copywriters, editors, photographers, video teams, reviewers, and media buyers
→ Kanban/state workflow
→ Versioned uploads, comments, changes, and exact-version approval
→ Imkan WorkDrive mapping/synchronization
→ Client pricing/request/progress/review portal
→ Approved Meta campaign draft/activation and future paid-platform connectors
```

OMA AI is an independent product under the IMKAN ecosystem. It owns its application experience, information architecture, visual language, motion, and design tokens. Its IMKAN relationship is expressed through approved endorsement and explicit integrations, not through copying IMKAN ONE.

The approved design-reference hierarchy is:

- Planable as the content/visual North Star;
- Linear as the interaction, density, and motion reference;
- Frame.io only for focused exact-version media review;
- Adobe Workfront, Jasper Brand IQ, Semrush, and Smartly only as functional references for their named domains;
- no additional canonical reference unless a later decision adds it;
- a light-first operational workspace, a dark media-review focus surface, and OMA Violet `#6658E8` plus Signal Teal `#12A7A1` as working inputs that require prototype and accessibility validation.

The specification must include:

- actors/capability profiles: Platform Owner, Company Owner, Strategist, Production Manager, Reviewer/Approver, Copywriter, Designer, Video Editor, Photographer/Videographer, Media Buyer, Client Viewer, Pricing/Finance Operator, and Integration Service;
- journeys from website connection through strategy, plan-to-task conversion, Kanban production, version review, WorkDrive, client portal, Meta, notifications, and dashboards;
- server-authoritative multi-tenancy and capabilities; client company IDs never grant authority;
- explicit ownership/source-of-truth map for identity/company, source snapshots/catalog projection, strategy/plans, tasks, deliverables, WorkDrive bytes, pricing/order, campaign intent, and external delivery status;
- AI provenance, confidence/unknowns, editable versions, and mandatory accountable human approval;
- Organic and Paid as separate plans under one strategy;
- traceability from evidence to insight to plan item to brief to task to deliverable version to approval to publication/campaign;
- persisted Kanban ordering and valid drag/drop transitions with concurrency conflict handling;
- immutable approved versions and new-version revision behavior;
- idempotency, duplicate submission, stale write, partial external failure, webhook verification, retry, and reconciliation;
- notifications with correct recipients and tenant-safe re-authorized deep links;
- EN/AR, LTR/RTL, responsive, keyboard alternative, accessible status, loading/empty/error/conflict/permission states;
- real E2E definition of done: action → request → authorization → durable mutation/integration → response → UI → refresh/re-login → persisted result;
- canonical state families:
  - request: `DRAFT`, `SUBMITTED`, `NEEDS_CLARIFICATION`, `QUOTED`, `COMMERCIAL_APPROVED`, `IN_PRODUCTION`, `DELIVERED`, `CLOSED`, `REJECTED`, `EXPIRED`, `CANCELLED`;
  - strategy/plan: `DRAFT`, `GENERATING`, `AI_GENERATED`, `IN_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`, `REJECTED`, `SUPERSEDED`, `GENERATION_FAILED`, `ARCHIVED`, `CANCELLED`;
  - task: `NEW_REQUEST`, `ASSIGNED`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`, `COMPLETED`, `CANCELLED`;
  - deliverable version: `UPLOADED`, `IN_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`, `REJECTED`, `SUPERSEDED`, `WITHDRAWN`;
  - campaign: `DRAFT`, `READY_FOR_APPROVAL`, `CHANGES_REQUESTED`, `APPROVED`, `ACTIVATING`, `SCHEDULED`, `ACTIVE`, `PAUSED`, `PARTIAL`, `FAILED`, `COMPLETED`, `CANCELLED`.

Open decisions must be recorded, not guessed:

- `DEC-001 RESOLVED`: separate private repository named `oma-ai`; runtime integration is not implied.
- `DEC-002 RESOLVED`: OMA owns initial accounts, login/sessions, users, tenants/companies, memberships, and capabilities; future IMKAN federation is a separate integration change.
- `DEC-003`: WorkDrive byte/metadata/version ownership.
- `DEC-004`: public crawl vs commerce connector/API for release one.
- `DEC-005`: packages/quote/payment/billing ownership.
- `DEC-006`: Meta draft/schedule/launch authority and spend approval limits.
- `DEC-007`: AI providers and data retention/region/logging/cost policy.
- `DEC-008`–`DEC-012`: company/brand structure, approval topology, first content types/channels, client-visible state mapping, and legal/commercial retention rules.
- `DEC-013 RESOLVED`: use exactly Planable, Linear, Frame.io, Adobe Workfront, Jasper Brand IQ, Semrush, and Smartly in their approved roles.

The spec verdict is `READY FOR PLATFORM FOUNDATION PLAN`, but this command remains `SETUP_ONLY`. Readiness is not authorization: do not create a technical plan or implementation tasks in this run.

## Phase 4 — Validate the setup

Perform read-only or local validation:

1. Print the project tree including hidden project directories, excluding `.git` internals.
2. Confirm required files exist and are non-empty.
3. Validate every Agent Skill folder name matches its YAML `name`, uses lowercase hyphenated names, and has a specific description.
4. Validate Cursor `.mdc` frontmatter and the two subagent frontmatters.
5. Run Markdown/YAML validation if already available; do not add a dependency solely for this.
6. Run:

   ```bash
   git diff --check
   git status --short
   ```

7. Search staged candidates for likely secrets and private keys. Do not print secret values; report only path/type and stop if found.
8. Confirm there is no product code, `plan.md`, `tasks.md`, schema, package manifest, `.env`, credential, or remote mutation yet.
9. Confirm `DEC-001`, `DEC-002`, and `DEC-013` are recorded as resolved; OMA owns its initial identity/tenant boundary; future IMKAN federation is deferred; and the exact seven-product reference hierarchy is preserved.

Fix only setup-file validation errors. Do not “fix” unresolved product decisions by choosing answers.

## Phase 5 — Create the private GitHub repository and push

Only after Phase 4 passes:

1. Stage the generated Spec Kit files and the exact OMA foundation files. Review the staged list before committing.
2. Create the first commit:

   ```bash
   git commit -m "chore: initialize OMA AI spec-first workflow"
   ```

3. Reconfirm the authenticated owner and remote non-existence immediately before creation.
4. Create and push the requested private repository without force:

   ```bash
   gh repo create "<resolved-owner>/oma-ai" --private --source=. --remote=origin --push
   ```

5. Verify:

   ```bash
   git remote -v
   git branch --show-current
   git status --short
   gh repo view "<resolved-owner>/oma-ai" --json nameWithOwner,url,visibility,defaultBranchRef
   ```

The final local worktree must be clean, the branch must be `main`, the remote visibility must be `PRIVATE`, and the pushed commit must match local `HEAD`.

## Final report and stop

Return:

- local absolute project path;
- GitHub repository URL, owner, visibility, default branch, and first commit hash;
- actual detected versions of Git, GitHub CLI, Spec Kit, Cursor Agent, OpenCode, Codex, Node, npm, and Playwright (or `not installed`);
- exact created/preserved file tree;
- validation commands and results;
- confirmation that no product code/architecture/plan/tasks were created;
- decision status for `DEC-001` through `DEC-013`, highlighting resolved OMA independence in `DEC-002` and the approved seven-product hierarchy in `DEC-013`;
- the single next question: **“هل أبدأ الآن مرحلة `/speckit-plan` لأساس OMA AI المستقل بعد اكتمال إنشاء المستودع؟”**

Then stop. Do not begin `/speckit-plan`, `/speckit-tasks`, or implementation.
