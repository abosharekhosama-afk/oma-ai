# Feature Specification: Strategy — Organic & Paid Plans

**Feature Branch**: `003-strategy-organic-paid-plans`
**Created**: 2026-09-08
**Status**: `SPEC_DRAFT` — provider-neutral product specification under Foundation `DEC-016`
**Input**: Evidence-backed marketing strategy with separate Organic and Paid planning tracks
**Parent baseline**: `specs/001-oma-ai-product-foundation/spec.md` — productizes Foundation **US-002**
**Upstream input**: `specs/002-brand-website-intelligence/spec.md` — Brand Workspace and immutable approved Brand & Product Intelligence Profile versions
**Sequencing**: `docs/PRODUCT_DELIVERY_SEQUENCING.md` (`DEC-016` — PRODUCT-FIRST / EXTERNAL-INTEGRATIONS-LAST)
**Foundation FR binding (honest subset)**: primarily **FR-026–FR-043** (strategy/plans/briefs accountability), **FR-097–FR-099** (notifications), audit/tenant/capability invariants; brief→task conversion (**FR-044+**, US-003) remains out of scope for 003
**Design references (DEC-013 only)**: Jasper Brand IQ (strategy canvas / governed brand context), Linear (density, side panels, restrained motion), Planable (collaboration/review patterns where strategy review is content-adjacent). No new external reference discovery for this SPEC stage.

## Clarifications

### Session 2026-09-08 (specify)

- Q: Does 003 require live AI to complete the strategy journey? → A: **No.** Under `DEC-016` / deferred `DEC-007`, the manual/no-AI journey MUST be complete. Optional future AI proposals use `AiProviderPort` only; refusing/unavailable is the production default until the final integration phase.
- Q: Are Paid budget fields real ad spend? → A: **No.** Paid budgets in 003 are **planning records only**. They MUST NOT create, authorize, or imply live ad-platform spend (`DEC-006` remains deferred).
- Q: Are Organic and Paid the same list? → A: **No.** Organic and Paid are **distinct tracks** under one strategy version; either or both may be enabled with recorded rationale when a track is intentionally disabled (Foundation **FR-031**).
- Q: Must 003 invent a parallel auth/tenant/capability/audit/notification system? → A: **No.** Reuse Foundation SoT only.

### Feature-local slice resolutions (do not renumber or close Foundation DECs)

| ID                     | Affirms                                                                          | Explicitly does **not** close                                       |
| ---------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `SR-003-016-EXT`       | 003 ships provider-neutral; no live AI / ads / social / analytics / keyword APIs | `DEC-003`, `DEC-004`, `DEC-006`, `DEC-007`, final integration phase |
| `SR-003-MANUAL`        | Manual create/edit/review/approve is the complete product journey for 003        | Future live AI proposal quality / model policy                      |
| `SR-003-PAID-PLANNING` | Paid fields are planning intent only; no Meta/ad account connection              | `DEC-006` live activation                                           |

### Open Owner decision packets (blocking for plan/implement of named gates only)

| Packet       | Topic                                                            | Status         |
| ------------ | ---------------------------------------------------------------- | -------------- |
| `DP-003-001` | Brand Profile linkage gate (create / submit / approve)           | **UNRESOLVED** |
| `DP-003-002` | Strategy package approval vs separate plan approvals             | **UNRESOLVED** |
| `DP-003-003` | Current-approved strategy pointer when multiple strategies exist | **UNRESOLVED** |

See [`decisions/`](./decisions/).

---

## 1. Problem statement

After Brand Website Intelligence (Feature 002), teams still plan marketing in disconnected docs and chats. Organic and Paid work collapses into one ambiguous list, evidence from the approved brand profile is lost, AI (when present) is treated as decision, and budgets look like live spend. OMA needs a tenant-scoped Strategy Workspace that turns brand intelligence into an accountable strategy with **separate Organic and Paid tracks**, human review, immutable approved versions, and clear boundaries to later execution and integrations.

## 2. Product outcome

An authorized tenant member, working under an active Foundation tenant and a selected Brand Workspace, can:

1. Create and edit a **Strategy** manually (AI optional and unavailable by default under `DEC-016`).
2. Link the strategy to an **immutable approved Brand Profile version** from Feature 002 when one exists, and see a clear blocked/warned path when it does not (exact gate = `DP-003-001`).
3. Maintain **distinct Organic and Paid plans** under the same strategy version, enabling Organic, Paid, or both.
4. Capture goals, audiences, positioning, messages, pillars, channels, funnel stages, formats, cadence/horizon, KPIs, risks/assumptions/dependencies, evidence links, and unknowns.
5. Submit for human review, receive comments/decisions, and produce an **immutable Approved strategy version** with history and comparison.
6. Never confuse brand facts, strategy decisions, Organic planning, Paid planning, future execution, or live platform integrations.

**Required end state:**
`Approved Strategy Version with distinct Organic and/or Paid planning tracks, evidence-linked to Brand Intelligence, without live external integrations`

## 3. Personas and capabilities

Access is **capability-based** (Foundation §4 / §10). Job titles map to profiles elsewhere; 003 authorizes only the intents below. All checks are **server-authoritative**.

| Capability intent | Allows                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Strategy read     | View strategies, plans, comments, versions, and evidence links permitted to the membership   |
| Strategy create   | Create a new strategy draft under the active tenant + selected brand                         |
| Strategy edit     | Edit draft (or editable) strategy and enabled plan track content                             |
| Strategy comment  | Comment / request changes on a strategy version in review                                    |
| Strategy submit   | Submit a draft version into review (`IN_REVIEW`)                                             |
| Strategy approve  | Approve, reject, or request changes on a submitted strategy version (accountable human only) |
| Strategy archive  | Archive a strategy or version per policy                                                     |
| Strategy compare  | Compare two strategy versions                                                                |
| Organic plan edit | Edit Organic track fields when Organic is enabled                                            |
| Paid plan edit    | Edit Paid planning fields when Paid is enabled (planning only — not spend)                   |
| Evidence link     | Attach/detach links to Feature 002 evidence / profile fields without mutating Brand SoT      |

AI systems and adapters MUST NOT hold Strategy approve. Membership suspension or capability loss MUST deny subsequent commands.

## 4. Domain model and ownership (product rules)

### 4.1 Tenancy and workspace

- Every Strategy belongs to **exactly one** Foundation tenant/company and **exactly one** Brand Workspace.
- No parallel tenant, auth, capability, audit, or notification system.
- Client-supplied tenant/brand/strategy IDs NEVER grant access; they only select among already authorized contexts.
- Strategy Workspace lives under Brand Workspace navigation within the existing product shell.

### 4.2 Cross-feature boundaries

| Domain                         | Owner / SoT                        | 003 may…                                       | 003 must not…                                                |
| ------------------------------ | ---------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Brand facts / profile versions | Feature 002 Brand Intelligence     | Read/link immutable approved (or draft) refs   | Rewrite observations, approve profiles, invent website facts |
| Strategy decisions             | OMA Strategy (this feature)        | Author goals, positioning, messages, decisions | Present recommendations as Brand Facts                       |
| Organic plan                   | OMA Strategy — Organic child track | Plan pillars, cadence, channels, community     | Become a content calendar or publish queue                   |
| Paid plan                      | OMA Strategy — Paid child track    | Plan budget/allocation/KPI as **planning**     | Connect ad accounts, launch spend, import live delivery      |
| Briefs / tasks / Kanban        | Future US-003 / US-004             | Leave stable IDs for later linkage             | Create briefs, boards, task production                       |
| Creative review                | Future US-005                      | —                                              | Upload/review creative files                                 |
| Publishing / social            | Future + deferred integrations     | Channel selection as planning labels           | Schedule or publish                                          |
| Live analytics / keyword APIs  | Deferred final integration         | Manual competitor/reference notes              | Call external research/analytics APIs                        |

### 4.3 Organic vs Paid boundary

- **Organic plan**: owned content and community growth planning (pillars, organic channels, frequency, community/growth goals, organic KPIs). No media buy implied.
- **Paid plan**: paid-media **planning** (campaign objectives, paid audiences, budget/allocation, expected KPIs, placements as planning labels). No live spend, no ad-account connection.
- A strategy version records `organicEnabled` and `paidEnabled` (boolean). At least one MUST be enabled to submit for review. When a track is disabled, a **rationale** MUST be stored.
- Organic and Paid MUST remain separate structures (not one typed list collapsed in storage or primary UX). Shared strategy fields (goals, positioning, brand link) live once on the strategy; track-specific fields live on the respective plan.

### 4.4 Fact vs recommendation classification

Every material statement on a strategy version MUST carry a Foundation-aligned information class:

| Class            | Meaning                                                       | May become Approved Fact?       |
| ---------------- | ------------------------------------------------------------- | ------------------------------- |
| `BRAND_LINKED`   | Copied/cited from linked Brand Profile / evidence             | Only as citation of Brand SoT   |
| `USER_AUTHORED`  | Human-entered strategy decision                               | Strategy decision after approve |
| `ASSUMPTION`     | Explicit assumption                                           | No — remains assumption         |
| `UNKNOWN`        | Missing information                                           | No — must stay unknown          |
| `AI_PROPOSAL`    | Optional future AI proposal via port (unavailable by default) | Never without human disposition |
| `RECOMMENDATION` | Suggested action/content direction                            | Never auto-promoted to Fact     |

AI MUST NOT turn `UNKNOWN` into Fact. Recommendations MUST be visually and structurally distinct from Brand-linked facts and approved strategy decisions.

### 4.5 Versioning and immutability

- Editing after submit-for-review on an immutable review target is forbidden; create a new draft version instead.
- **Approved** strategy versions are **immutable**.
- Changing an approved strategy creates a **new Draft** version (never in-place mutation).
- When a newer version is approved, the previously current approved version becomes **`SUPERSEDED`** (exact current-pointer rules = `DP-003-003`).
- Version history and side-by-side comparison are required for authorized readers.

### 4.6 Concurrency and idempotency

- Draft edits use optimistic concurrency (`row_version` / equivalent). Stale writes MUST fail with a conflict that preserves the other editor’s work.
- Submit, approve, reject, request-changes, archive, and enable/disable-track commands MUST be idempotent under a client-supplied or server-derived idempotency key for the same actor+target+intent.
- Duplicate clicks MUST NOT create duplicate versions or double audit decisions.

## 5. Prioritized user stories

### US-SOP-01 — Open Strategy Workspace for a Brand (Priority: P1)

An authorized member selects a Brand under the active tenant and opens its Strategy Workspace list (empty, loading, error, and permission-denied states included).

**Why this priority**: Without a correct tenant/brand-scoped entry, no strategy work can start safely.

**Independent Test**: With Brand A in Tenant 1 and Brand B in Tenant 2, user of Tenant 1 lists only Brand A strategies; cross-tenant ID probing denies without existence leak.

**Acceptance Scenarios**:

1. **Given** Strategy read on Brand A, **When** the user opens Strategy Workspace, **Then** OMA lists that brand’s strategies with status and updated time.
2. **Given** no strategies, **When** the list loads, **Then** an empty state explains how to create the first strategy.
3. **Given** missing Strategy read, **When** the user opens the route, **Then** permission-denied is shown without leaking other brands’ data.

---

### US-SOP-02 — Create manual strategy and link Brand Profile (Priority: P1)

An authorized strategist creates a Draft strategy for a Brand, optionally/requiredly links an immutable approved Brand Profile version per `DP-003-001`, and can proceed with clear messaging when no approved profile exists.

**Why this priority**: Strategy must start from Brand context without inventing brand facts.

**Independent Test**: Create strategy with and without an approved profile; UI and persistence match the unresolved gate’s safe interim rules in §8 until Owner resolves `DP-003-001`.

**Acceptance Scenarios**:

1. **Given** Strategy create, **When** the user creates a strategy with name/time horizon, **Then** a Draft exists under the brand with audit event.
2. **Given** an approved Brand Profile version exists, **When** the user links it, **Then** the strategy stores the exact profile version id and shows read-only brand summary citations.
3. **Given** no approved profile, **When** the user opens create, **Then** OMA shows a clear “no approved Brand Profile” state and applies the interim gate in §8 / `DP-003-001` without pretending Feature 002 data exists.
4. **Given** a linked profile, **When** Feature 002 later approves a newer profile, **Then** the strategy’s linked version remains unchanged until a human explicitly retargets a new Draft.

---

### US-SOP-03 — Author strategy core (goals, audience, positioning, messages) (Priority: P1)

The strategist edits business objectives/goals, target audiences/personas, market positioning, and key messages with provenance and unknowns.

**Why this priority**: Core strategy content is the shared parent of both plan tracks.

**Independent Test**: Fill required core fields manually; refresh/re-login; values persist; classifications remain correct.

**Acceptance Scenarios**:

1. **Given** a Draft, **When** the user saves goals and audiences, **Then** values persist with `USER_AUTHORED` (or linked) classification.
2. **Given** a brand-linked claim, **When** displayed, **Then** it shows Brand Profile/evidence provenance and cannot be silently edited into a contradictory “fact” without changing class to user decision/assumption.
3. **Given** missing market data, **When** the user marks Unknown, **Then** the field remains `UNKNOWN` and is listed in gaps.

---

### US-SOP-04 — Capture competitors/references, pillars, channels, funnel, formats, horizon (Priority: P1)

The strategist records competitor/reference inputs with provenance, content pillars/themes, channel selection, funnel stages, recommended formats, cadence, and time horizon.

**Why this priority**: Planning quality depends on structured strategic inputs before track-specific plans.

**Independent Test**: Add a manual competitor URL note with captured-at and uncertainty; no external fetch occurs.

**Acceptance Scenarios**:

1. **Given** Draft edit, **When** the user adds a competitor/reference with URL/source note and capture time, **Then** OMA stores provenance and does **not** call an external competitor/keyword API.
2. **Given** pillars and channels entered, **When** saved, **Then** they remain available to both tracks as shared inputs where applicable, without merging Organic/Paid items.
3. **Given** time horizon and cadence, **When** saved, **Then** they are planning labels only (no calendar entities created).

---

### US-SOP-05 — Enable Organic and/or Paid tracks and edit Organic plan (Priority: P1)

The strategist enables Organic, Paid, or both, and authors Organic-specific fields: pillars mapping, frequency, organic channels, community and growth goals, organic KPIs.

**Why this priority**: Organic must be independently valuable and distinct from Paid.

**Independent Test**: Enable Organic only; complete Organic fields; Paid remains disabled with rationale; no paid budget fields required.

**Acceptance Scenarios**:

1. **Given** Draft, **When** Organic is enabled and Paid disabled with rationale, **Then** only Organic track is editable and required for submit eligibility.
2. **Given** Organic enabled, **When** the user sets frequency, channels, community/growth goals, and KPIs, **Then** values persist on the Organic plan child.
3. **Given** both disabled, **When** submit is attempted, **Then** OMA blocks with a clear reason.

---

### US-SOP-06 — Edit Paid plan as planning-only (Priority: P1)

The strategist authors Paid planning fields: campaign objectives, funnel stages, audiences, budget, allocation, expected KPIs — clearly labeled as planning, not live spend.

**Why this priority**: Paid planning is a first-class Foundation requirement and must not look like activation.

**Independent Test**: Enter budget 10,000 with currency; UI labels “Planning budget — not live ad spend”; no ad account UI.

**Acceptance Scenarios**:

1. **Given** Paid enabled, **When** budget/allocation/objective/KPI are saved, **Then** each numeric estimate is labeled as user input (not guarantee, not live spend).
2. **Given** Paid enabled, **When** the user looks for ad-account connect, **Then** OMA shows not-connected / deferred integration honesty (no SDK, no OAuth).
3. **Given** Strategy approve capability only (no media launch capability), **When** strategy is approved, **Then** no external paid mutation occurs.

---

### US-SOP-07 — Risks, assumptions, dependencies, evidence links, unknowns (Priority: P1)

The strategist maintains risks, assumptions, dependencies, explicit unknowns, and links back to Feature 002 evidence/profile fields.

**Why this priority**: Accountability and G-001 quality depend on visible gaps and evidence.

**Independent Test**: Link two evidence items from 002; mark one assumption; list unknowns; approve path shows gaps.

**Acceptance Scenarios**:

1. **Given** Draft, **When** the user links Feature 002 evidence, **Then** the link stores brand/evidence identifiers and opens only after re-authorization.
2. **Given** risks/assumptions/dependencies entered, **When** submitted, **Then** reviewers see them without them being reclassified as Facts.
3. **Given** required unknowns remain, **When** submit/approve rules require acknowledgment, **Then** OMA enforces disclosure per §8.

---

### US-SOP-08 — Human review, comments, and decisions (Priority: P1)

Reviewers comment, request changes, approve, or reject. AI cannot approve. Notifications and audit fire.

**Why this priority**: Foundation invariant — AI proposes, humans decide.

**Independent Test**: Submit → comment → request changes → new Draft → resubmit → approve; AI adapter never issues approve.

**Acceptance Scenarios**:

1. **Given** `IN_REVIEW`, **When** a reviewer comments, **Then** comment is tenant-scoped, version-targeted, and auditable.
2. **Given** Strategy approve capability, **When** approve succeeds, **Then** exact version becomes `APPROVED` with actor, capability, time, and comment.
3. **Given** any AI/system actor, **When** approve is attempted, **Then** it is denied.
4. **Given** reject or changes requested, **When** recorded, **Then** prior version history remains and a path to new Draft exists.

---

### US-SOP-09 — Version history, compare, supersede, archive (Priority: P2)

Authorized users compare versions, see superseded history, and archive strategies without destroying audit trails.

**Why this priority**: Durable accountability after first approval.

**Independent Test**: Approve v1; create Draft v2; approve v2; v1 is `SUPERSEDED`; compare v1↔v2 shows diffs.

**Acceptance Scenarios**:

1. **Given** two versions, **When** compare is opened, **Then** field-level differences for strategy and enabled tracks are visible.
2. **Given** archive capability, **When** a strategy is archived, **Then** it leaves active workflows but remains readable per policy with audit.
3. **Given** approved strategy edit intent, **When** user chooses revise, **Then** a new Draft is created from the approved snapshot without mutating it.

---

### US-SOP-10 — Manual complete journey when AI unavailable (Priority: P1)

With AI refusing/unconfigured, the full create→edit→submit→approve journey works. UI shows AI not connected/configured without pretending generation occurred.

**Why this priority**: `DEC-016` / `SR-003-MANUAL` — product-first without providers.

**Independent Test**: Force refusing `AiProviderPort`; complete US-SOP-02 through US-SOP-08.

**Acceptance Scenarios**:

1. **Given** AI unavailable, **When** user opens strategy, **Then** a clear AI-unavailable / not-configured state is shown.
2. **Given** AI unavailable, **When** user completes manual strategy with required fields, **Then** submit and approve still succeed if eligibility holds.
3. **Given** AI unavailable, **When** user triggers “generate”, **Then** OMA refuses safely without creating fake AI content.

---

### US-SOP-11 — EN/AR, LTR/RTL, responsive, accessibility (Priority: P2)

Strategy surfaces support English and Arabic, LTR/RTL, responsive layouts, keyboard access, and understandable empty/loading/error/permission states.

**Why this priority**: Foundation invariant for user-facing product.

**Independent Test**: Switch locale/dir; complete primary review path with keyboard; states remain understandable.

**Acceptance Scenarios**:

1. **Given** AR + RTL, **When** Strategy Workspace renders, **Then** layout mirrors correctly and status labels localize while canonical state codes remain English.
2. **Given** narrow viewport, **When** editing Organic/Paid tracks, **Then** both tracks remain reachable without collapsing into one ambiguous list.
3. **Given** loading/error/denied, **When** shown, **Then** messages are actionable and do not leak cross-tenant data.

---

### Edge cases

- Brand without approved profile (`DP-003-001`).
- Approved Brand Profile superseded in Feature 002 while strategy still links older version — show freshness cue; do not auto-retarget.
- Concurrent editors on same Draft — conflict on stale `row_version`.
- Submit with both tracks disabled — blocked.
- Submit with enabled track missing required fields — blocked with field list.
- Approve without Strategy approve capability — denied.
- Cross-tenant strategy id — deny without existence leak.
- AI returns proposal later (final integration) after human already approved — must not mutate approved version; new Draft only.
- Paid budget entered as zero / negative — validation error.
- Competitor URL unreachable — allowed as manual note; no crawl required in 003.
- Notification recipient lost membership before delivery — skip/fail closed without leaking.

## 6. Requirements

### 6.1 Functional requirements

#### Workspace, tenancy, reuse

- **FR-SOP-001**: Strategies MUST be created only under the authenticated active tenant and a Brand Workspace the actor can access. No parallel tenant registry.
- **FR-SOP-002**: Every strategy, plan track, comment, decision, evidence link, and notification MUST be tenant-scoped and brand-scoped.
- **FR-SOP-003**: Client-supplied tenant/brand/strategy identifiers MUST NOT grant access.
- **FR-SOP-004**: 003 MUST reuse Foundation account, session, membership, capability, audit, and notification systems — MUST NOT create parallel ones.
- **FR-SOP-005**: Capability checks MUST be enforced server-side on every read/write/search/export/notification path.

#### Create, edit, link Brand Profile

- **FR-SOP-010**: Authorized users MUST be able to create a manual Draft strategy for a selected Brand without requiring live AI.
- **FR-SOP-011**: A strategy MUST be able to store a link to an exact Feature 002 Brand Profile version id (immutable pointer). A link to a **Draft** profile MAY exist only as a drafting aid and MUST NOT satisfy the Approved-profile gate for `IN_REVIEW` under the §8.2 interim (or Owner’s `DP-003-001` resolution).
- **FR-SOP-012**: When no approved Brand Profile exists, the UI MUST show an explicit not-ready/missing-profile state. Create/submit/approve eligibility follows `DP-003-001` (interim safe rule in §8 until resolved).
- **FR-SOP-013**: Linking or retargeting a Brand Profile MUST NOT mutate Feature 002 profile bytes or approval state.
- **FR-SOP-014**: Strategy core MUST support: name/title; goals/business objectives; target audiences/personas; market/locale; market positioning; key messages; constraints; content pillars/themes; channel selection; campaign objectives (shared); funnel stages; recommended content formats; cadence; time horizon; KPI definitions and target values; risks; assumptions; dependencies; unknowns/missing information.
- **FR-SOP-015**: Competitor/reference inputs MUST store provenance (source URL or note, capture/recorded time, uncertainty/confidence, information class) and MUST NOT require external research APIs in 003.

#### Organic and Paid tracks

- **FR-SOP-020**: Every strategy version MUST support distinct `ORGANIC` and `PAID` plan tracks (Foundation **FR-031**).
- **FR-SOP-021**: Users MUST be able to enable Organic, Paid, or both; disabling a track MUST require a stored rationale; at least one enabled track is required to enter `IN_REVIEW`.
- **FR-SOP-022**: Organic plan MUST support: mapped pillars/themes; frequency; organic channels; community goals; growth goals; organic KPIs; funnel stage; formats; message/CTA as planning labels; owners/roles as planning labels; dependencies.
- **FR-SOP-023**: Paid plan MUST support: campaign objectives; funnel stages; audience assumptions; offer/angle; format/variant; placement/channel labels; budget; allocation; expected KPIs; planned schedule window (planning label only — not publisher scheduling); landing destination (URL/note as planning intent); approval notes as planning fields.
- **FR-SOP-024**: Paid budget and expected performance MUST be labeled as user planning input (not guarantee, not live spend, not provider-reported).
- **FR-SOP-025**: Organic and Paid MUST NOT be stored or primarily presented as a single undifferentiated list.
- **FR-SOP-026**: 003 MUST NOT create content calendar entities, Kanban boards, tasks, creative uploads, publish jobs, or ad-platform objects.

#### Evidence, classification, AI boundary

- **FR-SOP-030**: Users MUST be able to link strategy items to Feature 002 evidence and/or profile fields; opens MUST re-authorize.
- **FR-SOP-031**: The system MUST distinguish Brand-linked facts, user-authored decisions, assumptions, unknowns, recommendations, and optional AI proposals (§4.4).
- **FR-SOP-032**: Recommendations and AI proposals MUST NOT be presented or stored as approved Brand Facts.
- **FR-SOP-033**: AI MUST NOT approve a strategy or auto-promote recommendations to approved decisions.
- **FR-SOP-034** (`SR-003-016-EXT` / `SR-003-MANUAL`): Until final integration + closed provider DECs, 003 MUST use refusing/`AiProviderPort` only where an AI boundary is represented. No AI SDK, credentials, live model calls, or provider selection in 003 product delivery. Manual journey MUST be complete.
- **FR-SOP-035**: UI MUST show honest **not connected / not configured** states for AI, ad platforms, social publishing, analytics, and keyword/competitor APIs — never pretend live integration exists.

#### Review, states, versions

- **FR-SOP-040**: Canonical strategy version states for 003 are the Foundation §9.2 codes used by this slice: `DRAFT`, `IN_REVIEW` (UX: Needs Review), `CHANGES_REQUESTED`, `APPROVED`, `REJECTED`, `SUPERSEDED`, `ARCHIVED`. Optional future AI states `GENERATING`, `AI_GENERATED`, `GENERATION_FAILED` remain defined by Foundation but are **not required** for the manual 003 journey; if exposed, they MUST fail closed to refusing AI without fake success.
- **FR-SOP-041**: Transitions MUST be server-authoritative; UI gestures never bypass validation.
- **FR-SOP-042**: `IN_REVIEW` and `APPROVED` versions are immutable; changes require a new Draft version.
- **FR-SOP-043**: Authorized reviewers MUST be able to comment, request changes, approve, reject, archive, and compare versions within capability.
- **FR-SOP-044**: Approval MUST target an exact strategy version and record actor, capability, decision, timestamp, and comment. Package-vs-plan granularity = `DP-003-002`.
- **FR-SOP-045**: After an `APPROVED` version, further edits MUST create a new `DRAFT` and MUST NOT mutate the approved artifact.
- **FR-SOP-046**: Approving a newer version MUST mark the prior current approved version `SUPERSEDED` per `DP-003-003`.
- **FR-SOP-047**: Version history MUST preserve comments and decisions across revisions.
- **FR-SOP-048**: Authorized users MUST be able to clone a strategy/version into a new Draft while preserving origin lineage and MUST NOT inherit approval state (Foundation **FR-042**).
- **FR-SOP-049**: If Client Viewer (or equivalent limited) access is granted, approved strategy presentation MUST withhold internal-only notes and non-exposed cost/planning details per capability (Foundation **FR-043**); default 003 MAY withhold client exposure entirely until that grant exists.

#### Concurrency, audit, notifications

- **FR-SOP-050**: Draft updates MUST use optimistic concurrency; conflicts MUST be explicit and non-destructive to the newer server state.
- **FR-SOP-051**: Submit/approve/reject/request-changes/archive/enable-track commands MUST be idempotent for duplicate submission.
- **FR-SOP-052**: Sensitive actions (create, link profile, submit, approve, reject, request changes, archive, enable/disable track, evidence link changes) MUST append immutable audit events with actor, tenant, brand, strategy/version, action, timestamp, and correlation id.
- **FR-SOP-053**: Notifications for submit-for-review, comment, changes requested, approved, rejected MUST resolve recipients by tenant membership, capability, and object visibility at delivery time (Foundation **FR-097**), with deep links that re-authorize.

#### Localization and UX states

- **FR-SOP-060**: User-facing strategy experiences MUST support EN/AR and LTR/RTL.
- **FR-SOP-061**: Layouts MUST be responsive; keyboard access MUST reach primary create/edit/review/approve actions.
- **FR-SOP-062**: Empty, loading, error, and permission-denied states MUST be understandable and safe.
- **FR-SOP-063**: Screen archetype for primary surfaces: **Strategy canvas** (DEC-013: Jasper + Linear). OMA adaptation: original tokens/copy; separate Organic/Paid panels; no pixel copy of reference products.

### 6.2 Non-functional requirements

- **NFR-SOP-001**: Deny by default; tenant/capability on every path including notification deep links.
- **NFR-SOP-002**: No secrets, provider API keys, or live third-party credentials in 003 configuration for deferred integrations.
- **NFR-SOP-003**: Audit and approval history MUST remain readable after archive/supersede per retention policy hooks (full legal retention = Foundation `DEC-012` still open).
- **NFR-SOP-004**: Performance of list/open/compare MUST remain usable for typical agency brand counts without requiring external search providers.

### 6.3 Key entities

- **Strategy**: Tenant+brand-scoped planning root; enablement flags; link to Brand Profile version; pointer rules per `DP-003-003`.
- **Strategy Version**: Immutable snapshot once in `IN_REVIEW`/`APPROVED`/terminal decision states; carries core fields + embedded/child plan track versions.
- **Organic Plan (track)**: Distinct child of a strategy version; organic-only fields.
- **Paid Plan (track)**: Distinct child of a strategy version; paid planning-only fields.
- **Audience/Persona**: Named audience definition under a strategy version.
- **Competitor/Reference Input**: Manual curated input with provenance.
- **Evidence Link**: Pointer to Feature 002 evidence/profile field.
- **KPI Definition**: Metric name, target, unit, track applicability (strategy / organic / paid).
- **Risk / Assumption / Dependency / Unknown**: Structured gap records.
- **Comment / Decision**: Review artifacts targeting an exact version.
- **Audit Event / Notification**: Foundation-owned records referencing strategy objects.

## 7. State machine (003 slice)

Canonical codes are English; UI localizes labels (e.g. `IN_REVIEW` → “Needs Review” / “بانتظار المراجعة”).

| State               | Meaning                              | Typical next states                         |
| ------------------- | ------------------------------------ | ------------------------------------------- |
| `DRAFT`             | Editable human-authored version      | `IN_REVIEW`, `ARCHIVED`                     |
| `IN_REVIEW`         | Immutable; awaits human decision     | `CHANGES_REQUESTED`, `APPROVED`, `REJECTED` |
| `CHANGES_REQUESTED` | Reviewer requires revision           | `DRAFT` (new editable revision), `ARCHIVED` |
| `APPROVED`          | Exact version approved               | `SUPERSEDED`, `ARCHIVED`                    |
| `REJECTED`          | Submitted version rejected           | `DRAFT` (new revision), `ARCHIVED`          |
| `SUPERSEDED`        | Replaced by a newer approved version | `ARCHIVED`                                  |
| `ARCHIVED`          | Inactive; history retained           | Terminal unless explicit restore policy     |

**Guards (all server-side):**

- Enter `IN_REVIEW` only if: actor has Strategy submit; ≥1 track enabled; required fields for enabled tracks present; Brand Profile gate satisfied per `DP-003-001` interim/final rule; concurrency token valid.
- Enter `APPROVED` only if: actor has Strategy approve; version is `IN_REVIEW`; eligibility/disclosure rules satisfied; AI/system actors forbidden.
- `APPROVED`/`IN_REVIEW` content immutable.
- Drag-and-drop or tabs NEVER invent transitions.

Optional Foundation AI states may appear later; under `DEC-016` they MUST NOT be required for success criteria of 003.

## 8. Approval eligibility and interim gates

### 8.1 Always required to approve

- Human actor with Strategy approve capability.
- Target version in `IN_REVIEW`.
- At least one of Organic/Paid enabled with required track fields complete.
- Strategy core required fields complete (goals, at least one audience, positioning or explicit Unknown+acknowledgment, time horizon, at least one KPI definition).
- Explicit acknowledgment of listed unknowns/risks when any `UNKNOWN`/`ASSUMPTION` remains on required themes.
- No live spend or external activation side effects.

### 8.2 Interim Brand Profile gate (until `DP-003-001` resolves)

**Safe interim (does not invent Owner choice beyond fail-closed product honesty):**

- Users MAY create and edit Draft strategies without an approved Brand Profile, with a persistent warning.
- Users MUST NOT enter `IN_REVIEW` without either (a) a linked **Approved** Brand Profile version, or (b) an explicit Owner resolution of `DP-003-001` allowing an alternate path.
- This interim blocks false “evidence-backed” approval packaging while keeping manual drafting unblocked.

### 8.3 Interim approval granularity (until `DP-003-002` resolves)

**Safe interim:** Approving a Strategy Version approves that version’s packaged strategy core + enabled Organic/Paid track contents as one accountable decision for Feature 003. Separate production conversion approvals remain future US-003. If Owner selects separate plan approvals, plan/tasks MUST revise eligibility without renumbering FR-SOP ids.

## 9. Out of scope (003)

- Content calendar / scheduling UI
- Kanban / task production / briefs conversion
- Creative file upload and media review
- Social publishing or scheduling
- Ad-account connection, Meta/live activation, real spend
- Live analytics import; keyword/competitor crawling APIs
- Live AI provider selection, SDKs, credentials
- WorkDrive byte sync; object-storage vendor selection
- Parallel tenant/auth/capability/audit/notification systems
- Closing Foundation `DEC-003`–`DEC-007`, `DEC-008`–`DEC-012`
- Agency cross-tenant staffing models

## 10. Success criteria

- **SC-SOP-001**: A strategist can create a manual strategy for a brand and save core fields in one session without any AI provider configured.
- **SC-SOP-002**: 100% of Approved strategy versions retain an immutable snapshot and actor/capability/timestamp decision record.
- **SC-SOP-003**: In acceptance tests, Organic and Paid remain separately addressable resources/views under one strategy; disabling one never deletes the other’s stored rationale path.
- **SC-SOP-004**: Cross-tenant strategy access attempts return deny without existence leak in security tests.
- **SC-SOP-005**: With refusing AI adapter, generate/propose actions fail closed and the manual approve path still succeeds when eligibility holds.
- **SC-SOP-006**: Paid budget fields never trigger external spend APIs in 003 tests (zero outbound ad-platform calls).
- **SC-SOP-007**: Version compare shows at least strategy core + both track field differences for two human-edited versions.
- **SC-SOP-008**: EN and AR (RTL) primary strategy review path remains completable with keyboard for submit and approve actions.
- **SC-SOP-009**: Every linked Feature 002 evidence open re-checks tenant/brand authorization.
- **SC-SOP-010**: Duplicate submit/approve with same idempotency key creates exactly one decision/version transition.

## 11. Traceability

| Story     | Primary FRs                      | Success criteria     |
| --------- | -------------------------------- | -------------------- |
| US-SOP-01 | FR-SOP-001–005, 060–062          | SC-SOP-004, 008      |
| US-SOP-02 | FR-SOP-010–013, 012              | SC-SOP-001           |
| US-SOP-03 | FR-SOP-014, 031                  | SC-SOP-001           |
| US-SOP-04 | FR-SOP-014–015, 031              | SC-SOP-001           |
| US-SOP-05 | FR-SOP-020–022, 025–026          | SC-SOP-003           |
| US-SOP-06 | FR-SOP-020–021, 023–026, 035     | SC-SOP-003, 006      |
| US-SOP-07 | FR-SOP-030–032                   | SC-SOP-009           |
| US-SOP-08 | FR-SOP-033–035, 040–044, 052–053 | SC-SOP-002, 005, 010 |
| US-SOP-09 | FR-SOP-045–047, 050              | SC-SOP-002, 007      |
| US-SOP-10 | FR-SOP-010, 033–035              | SC-SOP-001, 005      |
| US-SOP-11 | FR-SOP-060–063                   | SC-SOP-008           |

Foundation mapping: productizes **US-002**; does not implement **US-003+**. Feature 002 remains SoT for brand facts.

## 12. Assumptions

- Feature 002 provider-neutral Brand Workspace and profile approval semantics remain accepted on `main`.
- Foundation capability profile names may be extended with Strategy\* intents without replacing the capability model.
- `DEC-016` remains binding; final integration phase is later.
- Competitor pages may change after approval; 003 stores provenance at record time, not continuous monitoring.
- Client-safe redaction of internal cost notes (Foundation **FR-043**) may be a later hardening if Client Viewer exposure is enabled; default 003 may limit Client Viewer to approved summaries only if Strategy read is granted.

## 13. Decision gates

| Gate         | Blocks                                | Status                                           |
| ------------ | ------------------------------------- | ------------------------------------------------ |
| `DP-003-001` | Submit/approve eligibility nuance     | UNRESOLVED — interim §8.2                        |
| `DP-003-002` | Whether plans need separate approvals | UNRESOLVED — interim §8.3                        |
| `DP-003-003` | Current-approved pointer semantics    | UNRESOLVED                                       |
| `DEC-007`    | Live AI proposals                     | Deferred (`DEFERRED_TO_FINAL_INTEGRATION_PHASE`) |
| `DEC-006`    | Live paid activation                  | Deferred                                         |
| `DEC-016`    | Sequencing                            | RESOLVED — product-first                         |

Planning (`/speckit-plan`) may proceed for provider-neutral 003 once Owner resolves or explicitly accepts interims for `DP-003-001`–`DP-003-003`. Live integrations remain forbidden.

## 14. Notifications and audit (minimum event set)

| Event                        | Audit | Notify (typical)       |
| ---------------------------- | ----- | ---------------------- |
| Strategy created             | Yes   | Optional watchers      |
| Brand profile linked/changed | Yes   | Strategist watchers    |
| Submitted for review         | Yes   | Approvers              |
| Comment added                | Yes   | Participants           |
| Changes requested            | Yes   | Editors                |
| Approved / Rejected          | Yes   | Editors + stakeholders |
| Archived / Superseded        | Yes   | Watchers               |
| Track enable/disable         | Yes   | Editors                |

## 15. DEC-016 compliance statement

Feature 003 specification is provider-neutral. It defines ports/honesty states only where an external boundary must be represented. It completes the manual product journey for evidence-backed strategy with distinct Organic and Paid planning tracks. It does **not** select providers, add SDKs, store third-party credentials, perform live AI calls, connect ads/social/analytics, or authorize real spend.
