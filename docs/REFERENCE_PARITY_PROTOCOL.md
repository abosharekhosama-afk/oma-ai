# Reference Intelligence and Parity Protocol

**Status:** Canonical owner of reference inspection, navigation mapping, and parity coverage.
**Scope:** Development-OS infrastructure. This document defines **how** references are inspected and how parity is measured. It never decides **which** reference is authoritative for a product.

This protocol is additive. It does not replace `AGENTS.md`, `.specify/memory/constitution.md`, `docs/CURSOR_WORKFLOW.md`, Spec Kit, `oma-spec-auditor`, `oma-verifier`, the application E2E suite, model routing, or premium-cost controls. Where this document and project governance disagree, project governance wins (see [Project reference authority](#project-reference-authority)).

## 1. Why this exists

Answering "does what we built match the reference?" from memory produces confident, unverifiable claims. This subsystem forces the answer to come from artifacts on disk that record what was actually observed, what could not be observed, and how each observation compares to the current implementation.

The required flow is:

```
REFERENCE TRUTH → STRUCTURED EVIDENCE → SPEC → CODING WORKER → OUR APPLICATION → INDEPENDENT VERIFICATION
```

Never `REFERENCE URL → IMPLEMENTATION`.

## 2. Role separation

| Role | Owns | Must not |
| --- | --- | --- |
| **Cursor parent** | Task classification, context routing, reference strategy, inspection planning, Spec Kit, gap analysis, architecture, SoT/tenant/permission reasoning, worker routing, review, convergence, final status | Perform browser-heavy external-reference investigation |
| **Reference Inspection Worker** | External reference browsing over CDP, navigation/surface/action discovery, role-aware inspection where accessible, structured evidence | Modify application source, spec files, schema, config, or git state |
| **Implementation worker** (OpenCode) | Routine bounded implementation from approved spec and gap items | Browser-heavy reference discovery; inventing reference behavior |
| **Codex** | Hard architecture, risky migration, difficult debugging, convergence | Same prohibitions as the implementation worker |
| **Application E2E** (Playwright) | Proving **our** application works | Standing in as evidence of reference behavior |
| **`oma-verifier`** | Independent completion review | Self-certifying its own implementation |

The parent may invoke inspection commands, run readiness checks, read compact worker output and structured artifacts, request focused additional inspection, and reason over prepared evidence. That is not the same as driving the browser itself.

Cursor is **not** the only agent allowed to write code. Implementation delegation and reference discovery are separate concerns, and the coding worker does not need to browse the reference.

## 3. Two distinct browser systems

| | Reference inspection | Application E2E |
| --- | --- | --- |
| Purpose | Discover external product truth | Prove our application works |
| Target | The reference product | Our application |
| Owner | Reference Inspection Worker | Playwright E2E worker (`pnpm test:e2e`) |
| Evidence value | What the reference does | What we actually built |

These are not interchangeable. Reference inspection is not proof our implementation works; our E2E is not proof of what the reference does. Parity claims need both.

## 4. Project reference authority

Before any inspection, read the project's own reference strategy. In this repository that is `docs/DESIGN_REFERENCE_STRATEGY.md`, governed by `DEC-013`.

Authority types a project may assign:

`FUNCTIONAL_AUTHORITY`, `WORKFLOW_AUTHORITY`, `PLATFORM_SHELL_AUTHORITY`, `NAVIGATION_AUTHORITY`, `VISUAL_REFERENCE`, `BACKEND_LOGIC_REFERENCE`, `SECONDARY_REFERENCE`, `INSPIRATION_ONLY`.

Never globally assume every reference must be cloned or has functional authority. A project may legitimately hold several references with different authority, and conflicting reference truths must never be merged silently.

Access policy is also per reference. `.reference/registry.json` records, for each reference, an `accessPolicy`:

- `PUBLIC_SOURCE_ONLY` — only official public pages and documentation may be used; authenticated inspection is not permitted.
- `AUTHENTICATED_ALLOWED` — the project has authorised inspection of a signed-in session the user owns.

**OMA today:** every `DEC-013` reference is `PUBLIC_SOURCE_ONLY` and `AUTHENTICATED REFERENCE PARITY` is `PENDING`. No OMA-owned reference account exists, so authenticated inspection has no legitimate target in this repository. The subsystem is installed and validated, and it refuses authenticated inspection for these references until a project decision changes the policy.

## 5. Inspection modes

| Mode | Scope |
| --- | --- |
| `PAGE_INSPECTION` | One focused surface |
| `JOURNEY_INSPECTION` | A multi-step workflow end to end |
| `MODULE_INSPECTION` | One bounded module or service area |
| `NAVIGATION_DISCOVERY` | The navigation tree |
| `ROLE_INSPECTION` | Role-specific availability |
| `PARITY_AUDIT` | Compare reference inventory against our implementation |

Default behaviour inspects only the module or journey relevant to the current task. Do not crawl an entire authenticated SaaS product merely because access exists — that costs context, money, and time, and collects private data with no evidentiary value. Full application discovery requires an explicit request for navigation mapping, a full parity audit, or a complete inventory.

## 6. Authentication is a human boundary

If the reference requires login, SSO, MFA, CAPTCHA, or a manual security confirmation, the inspector returns `AUTH_REQUIRED` and stops.

It must never guess credentials, read credentials from the repository, store passwords, solve a CAPTCHA, bypass MFA, or expose cookies and tokens.

After the user authenticates once in the dedicated Chrome profile, the session is reused. Human interaction should be needed only for first authentication, session expiry, MFA, CAPTCHA, or when the provider explicitly demands interaction — not for every inspection.

## 7. Dedicated reference browser

A dedicated local Chrome profile preserves authenticated reference sessions, keeps reference browsing out of the user's normal Chrome, and lets the inspector reattach over CDP.

```bash
pnpm ref:launch          # cross-platform Chrome launch with the reference profile
pnpm ref:preflight       # deterministic readiness check
```

Rules:

- CDP binds to `127.0.0.1` only, on a configurable port. Never expose the debugging endpoint to the network.
- The profile directory, auth state, cookies, storage state, and logs are gitignored and never committed.
- The launcher resolves the Chrome binary per platform (`darwin`, `win32`, `linux`). No Windows-only assumptions, no hardcoded `chrome.exe`, no hardcoded `playwright-mcp.cmd`.

## 8. Readiness and session status

`pnpm ref:preflight` returns exactly one status:

| Status | Meaning |
| --- | --- |
| `READY` | CDP responds, a real browser is attached, and the target session is usable |
| `CDP_READY_NO_AUTH` | Browser reachable, reference origin present but unauthenticated |
| `CDP_READY_AUTHENTICATED` | Browser reachable and an authenticated reference session exists |
| `AUTH_REQUIRED` | Login, SSO, MFA, or CAPTCHA is required — human boundary |
| `SESSION_EXPIRED` | A session existed and is no longer valid |
| `CDP_UNAVAILABLE` | No CDP endpoint, or it is not a browser |
| `REFERENCE_TAB_NOT_FOUND` | Browser reachable, no tab on the required origin |
| `REFERENCE_UNREACHABLE` | The reference origin does not respond |
| `ROLE_UNAVAILABLE` | The requested role cannot be reached with the available session |
| `BLOCKED` | Anything else, with an exact reason |

This vocabulary exists to prevent the misleading claim "no session exists" when the real problem is the wrong profile, the wrong CDP port, or the wrong workspace.

The parent must not compensate for a failed preflight by starting heavy external browser work itself.

## 9. Worker health and recovery

`pnpm ref:smoke` proves, without a browser, that the OpenCode CLI exists, the configured model is reachable, the `reference-inspector` agent definition exists, and the worker returns a deterministic expected response.

When inspection fails, the recovery path is fixed:

```
INSPECTION FAILS → DIAGNOSE WORKER → IDENTIFY MCP/CDP/PATH/CONFIG/MODEL CAUSE
  → FIX WORKER INFRASTRUCTURE ONLY → VERIFY WORKER → VERIFY CDP → RETRY
```

Worker failure is never permission to modify product code, skip reference evidence, move browser work into the parent, or let a coding worker define reference behaviour.

Retries are bounded — three attempts by default, configurable per reference. After exhaustion the status is `BLOCKED` with an exact reason. No unbounded loops.

## 10. Evidence directory

```
.reference/
  registry.json                     # references, authority, access policy (committed)
  _schema/                          # artifact schemas (committed)
  _fixtures/                        # validator fixtures (committed)
  <reference-id>/
    reference-config.json           # committed
    navigation-map.json             # committed when sanitized
    surface-inventory.json
    action-inventory.json
    role-permission-matrix.json
    journey-catalog.json
    parity-matrix.json
    evidence-index.json
    unknowns.json
    coverage-summary.json
    docs/                           # REFERENCE_NAVIGATION.md, REFERENCE_COVERAGE.md
    artifacts/                      # screenshots and raw captures (gitignored)
    logs/                           # JSONL worker logs (gitignored)
  _ours/
    our-navigation-map.json         # our application, generated from routes
    our-surface-inventory.json
```

Do not create a second evidence system. If a project already uses another canonical reference directory, integrate with it.

## 11. Artifact standard

Artifacts are structured functional records, not page screenshots with measurements. The schemas in `.reference/_schema/` define the required shape; the canonical artifact supports meta, navigation, surfaces, visual, measurements, typography, colors, components, fields, controls, actions, actors, roles, permissions, record scopes, settings, prerequisites, states, transitions, workflow, before/after state, validation, errors, loading and empty states, edge cases, notifications, audit, history, upstream, downstream, reports, import, export, bulk actions, unknowns, reference status, and evidence refs.

Not every field applies to every surface. Unknown information stays explicitly `UNKNOWN`. Never fabricate an empty fact to satisfy schema shape.

Do not store massive DOM dumps, CSS bundles, network dumps, or HTML snapshots. Capture structured facts. Collect only what the current task needs, and never commit private third-party data — prefer structure, field names, workflow behaviour, action semantics, and sanitized identifiers.

Decorative UI elements are not actions.

## 12. Reference status vocabulary

`LIVE_VERIFIED`, `DOC_VERIFIED`, `LIVE_AND_DOC_VERIFIED`, `REFERENCE_LIMITED`, `NOT_COVERED`, `NOT_APPLICABLE`, `UNKNOWN`.

Never label inferred behaviour as verified.

When official documentation and the live product are both available they complement each other: documentation establishes supported capability, documented configuration, and official constraints; live inspection establishes the actual accessible surface, navigation, controls, and current behaviour. If they disagree, record `REFERENCE_CONFLICT` and do not silently pick one.

## 13. Parity matrix and coverage

`parity-matrix.json` compares reference to current implementation. Each row records `referenceId`, `referencePath`, `referenceBehavior`, `ourSurface`, `currentBehavior`, `status`, `difference`, `requiredCorrection`, `owner`, `targetPhase`, `evidenceRefs`, `verificationResult`.

Allowed statuses: `MATCH`, `PARTIAL`, `MISSING`, `WRONG_EXISTING_IMPLEMENTATION`, `REBUILD`, `REMOVE`, `RECONNECT`, `INTENTIONAL_DIFFERENCE`, `REFERENCE_LIMITED`, `NOT_APPLICABLE`.

Existing implementation is not automatically correct. Where a project establishes parity authority, existing code can be classified `WRONG_EXISTING_IMPLEMENTATION`, `REMOVE`, `REBUILD`, or `RECONNECT`. It does not win merely by existing. Whether an `INTENTIONAL_DIFFERENCE` is permitted is a project-governance question.

`pnpm ref:parity` derives `coverage-summary.json` and the human-readable documents strictly from artifacts. Counts are never estimated or recalled. The navigation difference report classifies each path as `REFERENCE_ONLY`, `OURS_ONLY`, `MATCHED_PATH`, `PARTIAL_PATH`, `WRONG_LOCATION`, `MISSING_PAGE`, `EXTRA_PAGE`, or `REPLACEMENT_REQUIRED`.

### Coverage claims

Never claim literal `100% parity` while any inaccessible reference area remains. The strongest valid claim is:

```
100_PERCENT_OF_VERIFIED_ACCESSIBLE_REFERENCE_SURFACE_RECONCILED
```

and only when every discovered accessible surface and action in the declared scope is inventoried, classified, compared, and either resolved or explicitly marked `REFERENCE_LIMITED`. Unclassified accessible functionality is a blocker.

## 14. Unknowns

`unknowns.json` is first-class. Each entry records `unknownId`, `reference`, `surface`, `question`, `whyUnknown`, `accessLimitation`, `impact`, `blocking`, and `nextEvidenceNeeded`.

An unknown blocks implementation only when it materially changes behaviour, architecture, security, tenant boundaries, permissions, a state machine, data ownership, an external action, or acceptance criteria. Otherwise document it, defer it safely, and continue with verified scope.

Never invent missing information.

## 15. Reference-driven Spec Kit flow

```
USER REQUIREMENT → PROJECT REFERENCE AUTHORITY → REFERENCE INSPECTION
  → STRUCTURED EVIDENCE → NAVIGATION MAP → SURFACE INVENTORY → ACTION INVENTORY
  → ROLE/PERMISSION MATRIX → JOURNEY CATALOG → GAP MATRIX
  → SMALLEST SPEC KIT FEATURE → PLAN → TASKS → SoT/TENANT/PERMISSION GATES
  → IMPLEMENTATION → DETERMINISTIC TESTS → APPLICATION E2E
  → VERIFIER → FALSE-COMPLETION AUDIT → CONVERGENCE → SPEC SYNC → DELIVERY
```

Spec Kit captures product behaviour; it does not copy the reference implementation. Reference evidence may inform actors, requirements, settings, states, transitions, permissions, validation, lifecycle, history, notifications, upstream and downstream effects, failure behaviour, and acceptance scenarios. It must never be used to replicate reference source code, private schemas, private backend implementation, hidden credentials, internal APIs, or security bypasses.

## 16. Implementation handoff

The handoff contract in `docs/CURSOR_WORKFLOW.md` applies unchanged. For reference-driven work it additionally carries reference IDs and gap item IDs, and the coding worker's input is `SPEC + REFERENCE EVIDENCE + GAP ITEMS + ARCHITECTURE RULES`.

If evidence is insufficient, the coding worker returns `REFERENCE_EVIDENCE_INSUFFICIENT` rather than guessing. Worker completion is never proof.

## 17. False completion for reference-driven work

The existing false-completion audit applies, plus: no accessible in-scope reference surface left unclassified; no required reference action silently omitted; no missing role guessed; no wrong existing implementation preserved without a decision; no backend-only implementation where the reference has required UI; no UI-only implementation without durable behaviour; no client-only permissions; no fake persistence; no reference unknown silently promoted into a requirement; no coding-worker self-certification.

Convergence compares reference evidence, navigation map, surface and action inventories, role matrix, journey catalog, parity matrix, spec, plan, tasks, code, database, API, UI, tests, E2E, and documentation. Any meaningful mismatch is remaining work.

## 18. Cost, context, and model routing

Existing routing in `docs/CURSOR_WORKFLOW.md` stands. For this subsystem specifically:

- Reference inspection uses a low-cost, reliable model. Premium models must not spend context on clicking, navigation, DOM inspection, measurements, screenshots, or routine inventory.
- Premium reasoning may inspect prepared summaries when high-value architecture or product reasoning genuinely requires it.
- Default premium usage remains zero. No model fan-out.
- Detailed worker events and browser logs live on disk as JSONL. The parent receives compact output only: status, reference, target, mode, counts, artifact paths, unknown count, blockers, log path.

## 19. Tool permissions

`--dangerously-skip-permissions` is **not** adopted as a standing rule. The inspector is constrained by an explicit tool allowlist, a restricted working directory, read-only access to application source, and write access limited to `.reference/<id>/` artifacts, docs, and logs.

It must not modify application code, database schema, spec files, project configuration, or git state. The parent owns every later spec, governance, or code change.

If a non-interactive worker mode ever requires a broad confirmation bypass, prefer safer configuration first; if unavoidable, constrain the worker by tool access and directory isolation and document the residual risk here.

## 20. Commands

| Command | Purpose |
| --- | --- |
| `pnpm ref:launch` | Launch Chrome with the dedicated reference profile and local CDP |
| `pnpm ref:preflight` | Deterministic readiness and session status |
| `pnpm ref:smoke` | Reference worker health, no browser required |
| `pnpm ref:inspect` | Inspection orchestrator (`--reference`, `--target`, `--mode`) |
| `pnpm ref:validate` | Validate reference artifacts against schemas |
| `pnpm ref:our-nav` | Build our application's navigation map from routes |
| `pnpm ref:parity` | Derive coverage summary and human-readable documents |
| `pnpm devos:validate` | Validate Development-OS invariants |
| `pnpm devos:doctor` | Report tool and route readiness |

`pnpm devos:validate` fails with `DEVELOPMENT_OS_INVALID` and the exact failing checks when an invariant is missing.

## 21. Required use

When the user asks to document the application's navigation, whether what was built is correct, or what is missing compared to the reference, answer from this subsystem — never from memory. The minimum is a reference navigation map, our navigation map, surface and action comparison, a coverage report, and the unknown/reference-limited report.

If the reference cannot be inspected, return `REFERENCE_BLOCKED` with the exact reason (`AUTH_REQUIRED`, `CDP_UNAVAILABLE`, `ROLE_UNAVAILABLE`, `REFERENCE_OUTAGE`, `MFA_REQUIRED`, `CAPTCHA_REQUIRED`, `UNKNOWN_REFERENCE_URL`). Continue only with documented material, and only where project governance permits `DOC_VERIFIED_ONLY`.
