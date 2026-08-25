# Feature Specification: OMA AI Product Foundation

**Feature key:** `001-oma-ai-product-foundation`
**Status:** Draft — product definition
**Created:** 2026-08-25
**Updated:** 2026-08-25
**Technical plan:** Not started
**Implementation:** Not authorized

## 1. Product definition

OMA AI is a multi-company, AI-assisted content operations platform. It takes a company from website and product understanding through strategy, organic and paid content planning, production assignment, deliverable review, asset management, and approved distribution or paid-media activation.

OMA AI must provide one traceable operating chain:

`Website/Product sources → Evidence → Insights → Strategy → Organic plan + Paid plan → Briefs → Tasks → Deliverable versions → Review/Approval → WorkDrive → Publication/Campaign`

The product serves both the internal production team and client companies. A company can request and price content from its portal, follow progress, review outputs, and—when authorized—approve distribution or paid advertising.

### 1.1 Product promise

Turn fragmented research, strategy documents, chat messages, files, and ad-platform actions into one accountable production system where every person knows:

- what must be produced;
- why it is being produced;
- which evidence and objective informed it;
- who owns the next action;
- which version is under review or approved;
- what reached a publishing or paid-media platform;
- what remains blocked, failed, or awaiting approval.

### 1.2 Product principles

- AI accelerates research and proposes decisions; authorized humans remain accountable.
- Organic and Paid are separate execution tracks under one approved strategy.
- Kanban is a view of an explicit workflow, not the source of business rules.
- Every generated plan item must be convertible into an executable, owned task.
- Every deliverable and approval must retain version and audit history.
- External systems remain authoritative for the facts they own.
- Tenant separation is invisible to normal users and impossible to bypass.
- OMA AI is an independent product under IMKAN with one original, coherent experience; reference products inform patterns but are not copied.

### 1.3 Product and IMKAN boundary

OMA AI is a separately deployable product and repository within the IMKAN ecosystem. It owns its product experience, information architecture, workflow presentation, visual language, motion language, and design tokens. It is not an embedded copy of IMKAN ONE and does not inherit IMKAN ONE screens, navigation, colors, transitions, or business logic unless a later explicit integration contract requires a narrowly defined shared surface.

The IMKAN relationship is expressed through approved brand endorsement, such as `OMA AI by IMKAN`, and explicit integrations such as WorkDrive. The initial product uses an OMA-owned login, identity, company, membership, session, and capability boundary. Any future IMKAN identity federation is a separate integration change and does not transfer ownership of OMA workflow state, replace canonical OMA identifiers, or require visual parity.

The approved global reference hierarchy is defined in `docs/DESIGN_REFERENCE_STRATEGY.md` and governed by resolved `DEC-013`. Palette, component, and surface details remain subject to prototype and accessibility validation in the later design-system specification.

## 2. Goals and success outcomes

### 2.1 Goals

- **G-001:** Reduce the time from company intake to a reviewable, evidence-backed content strategy.
- **G-002:** Convert approved Organic and Paid plans into production work without manual re-entry.
- **G-003:** Give contributors complete task context, references, deadlines, and feedback in one place.
- **G-004:** Give managers reliable assignment, workload, review, approval, and bottleneck visibility.
- **G-005:** Give client companies a self-service path to understand pricing, request content, and track delivery.
- **G-006:** Preserve an auditable chain from source insight to final asset and distribution/campaign outcome.
- **G-007:** Connect approved files to Imkan WorkDrive without duplicate or ambiguous file ownership.
- **G-008:** Prepare and, when explicitly authorized, activate paid creative on Meta first, with future channels added through the same connector boundary.

### 2.2 Product success measures

Initial numeric targets are `TBD` and require baseline data. The product must measure:

- **M-001:** Median time from website connection to first reviewable strategy.
- **M-002:** Percentage of approved plan items converted to tasks without manual duplicate entry.
- **M-003:** Median task cycle time by content type and team.
- **M-004:** First-review approval rate and average revision rounds.
- **M-005:** Percentage of deliverables with complete strategy-to-asset traceability.
- **M-006:** Client request conversion from pricing view to approved production order.
- **M-007:** On-time completion rate and blocked-work duration.
- **M-008:** WorkDrive sync success and reconciliation rate.
- **M-009:** Paid activation success, failure recovery, and creative-to-campaign linkage.
- **M-010:** Cross-tenant security incidents: target zero.

## 3. Scope

### 3.1 In scope for the product baseline

- Company and workspace context with capability-based access.
- Public website connection and/or authorized commerce connector, subject to `DEC-004`.
- Crawl/import snapshot, product extraction, brand profile, evidence, competitor references, and recommendations.
- AI-assisted strategy with independent Organic and Paid plans.
- Human clarification, editing, review, approval, and version history for AI outputs.
- Brief generation and conversion of approved plan items to linked tasks.
- Kanban board with persisted ordering, assignment, deadlines, dependencies, priority, blockers, and valid drag-and-drop transitions.
- Contributor workspace for designers, editors, photographers, copywriters, and other production roles.
- Deliverable upload/versioning, comments, review, revision requests, approval, and completion.
- Imkan WorkDrive synchronization boundary.
- Client company portal for pricing, content request, quote/approval, and progress/review visibility.
- Meta paid-media connection, campaign draft, authorization, status sync, and reconciliation; exact launch scope depends on `DEC-006`.
- Notifications, tenant-safe deep links, audit history, dashboards, search, filters, and exports allowed by role.
- English/Arabic and LTR/RTL responsive experience.
- An independent OMA AI product shell and coherent experience following the approved `DEC-013` reference hierarchy.

### 3.2 Deferred unless explicitly promoted

- Direct publishing to every organic social channel.
- Full marketing attribution across websites, CRM, sales, and offline conversions.
- Automatic budget optimization without human limits and approval.
- Marketplace of external freelancers or agencies.
- Payroll, HR attendance, or general-purpose project management unrelated to content.
- Full accounting, tax, invoicing, or payment processing until ownership is decided.
- Training proprietary foundation models.
- Legal clearance of claims, trademarks, music, likeness, or regulatory content; OMA may support checklists but does not replace accountable review.

### 3.3 Non-goals

- OMA AI is not a generic file drive; WorkDrive or another approved storage owner holds file bytes.
- OMA AI is not a replacement for Meta's delivery, billing, auction, or policy systems.
- OMA AI is not an autonomous agency that publishes or spends without accountable approval.
- OMA AI is not “a board with AI chat”; strategy, evidence, traceability, versions, and approvals are first-class domains.
- OMA AI is not a visual clone of IMKAN ONE, Planable, Linear, Frame.io, or any other reference product.

## 4. Actors and capability profiles

Security is capability-based. The following are assignable profiles, not hardcoded universal roles.

| Actor/profile | Primary responsibilities | Typical capabilities |
| --- | --- | --- |
| Platform Owner | Operate OMA AI across permitted tenants | Tenant administration, global configuration, support audit; no silent client impersonation |
| Company Owner | Represent a client company | Manage company profile, submit/approve requests, view company work, approve strategy/deliverables/spend if granted |
| Strategist | Research and plan content | Manage sources, evidence, insights, competitors, strategy, Organic/Paid plans and briefs |
| Production Manager | Turn plans into production | Create boards/tasks, assign work, manage capacity, review or route approvals |
| Reviewer/Approver | Make accountable content decisions | Comment, request changes, approve a specific version within assigned scope |
| Copywriter | Produce written content | View assigned context, create/upload copy versions, respond to feedback |
| Designer | Produce static/graphic assets | View assigned context, upload versions, respond to feedback |
| Video Editor | Produce edited video | View assigned context, upload versions/proxies, respond to feedback |
| Photographer/Videographer | Produce source media | View shot list and task details, upload source/selects, respond to feedback |
| Media Buyer | Prepare and manage paid activation | Manage paid plan details, ad account mapping, campaign drafts, approvals, launch/sync if granted |
| Client Viewer | Follow progress without operational control | View permitted requests, milestones, approved assets, comments, and reports |
| Pricing/Finance Operator | Manage commercial offer | Manage packages, quote, commercial approval, and payment state only if this domain belongs to OMA |
| Integration Service | Perform machine-to-machine work | Narrow connector scopes, background sync, signed webhook processing, no interactive privileges |

One person may hold several profiles within one tenant. Capabilities must not leak across tenants or companies.

## 5. Domain ownership and source-of-truth map

The repository, product, and identity boundaries are resolved: OMA AI starts in a separate private repository named `oma-ai` as an independent deployable product under IMKAN. OMA owns its initial login, identity, tenant/company, membership, session, and capability domains. The following ownership intent is binding while technical placement is pending.

| Domain | Logical owner | Authoritative writer/state | Consumers | Boundary note |
| --- | --- | --- | --- | --- |
| Login identity, session, tenant/company master | OMA Platform | OMA authentication and identity domain | All OMA modules | Future IMKAN federation uses an explicit external mapping; IMKAN identifiers are not canonical OMA authority |
| OMA workflow capabilities | OMA AI | OMA-owned membership/capability policy | All OMA domains | Future external identity claims never grant or bypass OMA capabilities |
| Website source and crawl snapshot | OMA Website Intelligence | OMA ingestion workflow | Strategy, catalog, audit | Store snapshot/version and source URL evidence |
| Product/catalog projection | `TBD by DEC-004` | Commerce source when connected; OMA extraction when public-only | Strategy, briefs, client portal | Preserve source and freshness; do not overwrite external catalog silently |
| Brand profile | OMA Strategy | Authorized OMA users; AI may propose | Strategy, briefs, generation | Separate observed facts from confirmed brand rules |
| Competitor/reference evidence | OMA Strategy | OMA research workflow + human curation | Strategy and briefs | Record URL/source, capture time, and uncertainty |
| Strategy and plans | OMA Strategy | Authorized strategists/approvers | Production, client portal, paid media | Organic and Paid remain distinct children |
| Briefs and production tasks | OMA Production | Production managers and permitted contributors | Boards, notifications, reporting | Keep links back to plan objective |
| Deliverable metadata/versions/reviews | OMA Production | Contributors and approvers through workflow commands | Client portal, WorkDrive, publishing | Approved version is immutable |
| File bytes/folders | `TBD by DEC-003` | Prefer WorkDrive when selected as storage owner | OMA metadata and authorized users | OMA stores stable references/checksums/status, not duplicate bytes |
| Pricing/quote/order | `TBD by DEC-005` | OMA commercial domain or approved shared system | Client portal, production intake, reporting | Payment/accounting must not be inferred |
| Campaign intent, approvals, creative mapping | OMA Paid Media | Authorized OMA users | Meta/future connectors, reporting | OMA owns intent and approval trail |
| Ad delivery/spend/status | External ad platform | Meta or future channel | OMA sync/reporting | External platform remains delivery truth |
| Notification event | Originating OMA domain | Transactional event/outbox | Notification service/UI | Deep link and recipient are tenant-scoped |
| Audit history | OMA platform/security boundary | Append-only system actions | Authorized audit viewers | No user-editable audit deletion |

## 6. Core user scenarios and acceptance

### US-001 — Connect a company website and create a verified intelligence snapshot (P1)

**As a** Company Owner or Strategist,
**I want** to connect a website and identify its products, brand signals, and public evidence,
**so that** OMA can begin strategy work from current, inspectable information.

**Independent test:** Connect an authorized test website, run ingestion, review extracted pages/products/evidence, correct at least one field, refresh and re-login, and confirm the accepted snapshot and correction remain associated with the correct company only.

**Acceptance scenarios:**

1. **Given** a permitted actor submits a valid source, **when** ingestion is accepted, **then** OMA creates a tenant-scoped source record and asynchronous run with visible progress.
2. **Given** pages and products were discovered, **when** the run completes, **then** each extracted fact links to source URL, snapshot time, and extraction confidence/status.
3. **Given** robots/terms/authentication or connector permissions block access, **when** ingestion cannot continue, **then** OMA shows the exact reason and safe recovery path without claiming analysis completed.
4. **Given** an authorized user corrects an extracted field, **when** they confirm it, **then** OMA preserves observed and confirmed values with actor/time history.
5. **Given** a user from another tenant knows the source or product identifier, **when** they request it, **then** access is denied without revealing its existence.

### US-002 — Produce an evidence-backed strategy with Organic and Paid plans (P1)

**As a** Strategist,
**I want** AI to propose a strategy, briefs, references, competitors, and recommendations,
**so that** I can review a professional plan faster without losing accountability.

**Independent test:** From an accepted snapshot, generate a strategy; inspect cited evidence and assumptions; edit and approve it; verify separate Organic and Paid child plans, version history, and no auto-approval.

**Acceptance scenarios:**

1. **Given** sufficient company evidence exists, **when** strategy generation starts, **then** OMA records the input snapshot/version and shows generation progress/failure.
2. **Given** AI proposes facts or recommendations, **when** a strategist reviews them, **then** factual claims show their sources and hypotheses are visually distinct.
3. **Given** the strategy is generated, **when** opened, **then** Organic and Paid plans are separate, linked structures under the same strategy.
4. **Given** an approver requests changes, **when** a new version is submitted, **then** prior strategy, comments, and decision history remain available.
5. **Given** no authorized human has approved the plan, **when** a user attempts production conversion or paid activation, **then** OMA blocks the action.

### US-003 — Convert an approved plan into executable briefs and tasks (P1)

**As a** Production Manager,
**I want** approved plan items converted into structured work,
**so that** teams can execute without retyping or losing strategic context.

**Independent test:** Select approved Organic and Paid plan items, preview generated briefs/tasks, assign different contributor types, confirm creation once, and verify every task links to its source plan item and objective.

**Acceptance scenarios:**

1. **Given** selected plan items are approved, **when** conversion is previewed, **then** OMA shows the exact tasks, briefs, dependencies, roles, and dates before committing.
2. **Given** conversion is confirmed twice because of retry, **when** the same idempotency key is used, **then** only one set of tasks exists.
3. **Given** a task was generated, **when** a contributor opens it, **then** they can see the brief, objective, audience, format, channel, references, inputs, due date, required output, and review path permitted to them.
4. **Given** a plan item changes after tasks exist, **when** the change is approved, **then** OMA identifies impacted tasks and requires an explicit update decision rather than silently overwriting them.

### US-004 — Manage production through a valid Kanban workflow (P1)

**As a** Contributor or Production Manager,
**I want** to move work through clear states and see ownership/blockers,
**so that** production progress is trustworthy.

**Independent test:** Assign a task, move it via drag-and-drop through permitted states, attempt an invalid and unauthorized transition, simulate a stale concurrent move, refresh, and confirm persisted order/history.

**Acceptance scenarios:**

1. **Given** an actor has transition capability, **when** they drag a card to a valid column, **then** the server validates and persists state/order and records actor/time.
2. **Given** a transition is invalid or unauthorized, **when** attempted, **then** the card returns to its authoritative position and the UI explains the failure.
3. **Given** two users act on a stale task version, **when** the second mutation arrives, **then** OMA detects the conflict and offers refreshed state rather than losing work.
4. **Given** a task is blocked, **when** a blocker is recorded, **then** owner, reason, dependency, age, and next action are visible to permitted users.

### US-005 — Upload, review, revise, and approve a specific deliverable version (P1)

**As a** Contributor and Reviewer,
**I want** versioned delivery and precise feedback,
**so that** everyone knows which output is approved.

**Independent test:** Upload version 1, request changes with comments, upload version 2, approve version 2, then upload version 3 and confirm version 2 remains the approved version until another explicit approval.

**Acceptance scenarios:**

1. **Given** a contributor is assigned, **when** they upload an allowed file, **then** OMA creates a new immutable version with uploader, time, checksum/reference, and task link.
2. **Given** a reviewer requests changes, **when** they submit feedback, **then** the review targets a specific version and returns the task/deliverable to the defined revision state.
3. **Given** a reviewer approves a version, **when** approval succeeds, **then** OMA records the approver, capability, decision, time, and exact version.
4. **Given** a later version exists, **when** users view the task, **then** OMA distinguishes latest, under-review, approved, and superseded versions.

### US-006 — Request and track content from the client portal (P1)

**As a** Company Owner,
**I want** to see pricing/options, request content, and follow its production,
**so that** I can buy and approve content without internal operational access.

**Independent test:** A company user selects a package or requests a quote, submits requirements, approves the commercial offer, sees linked production milestones, reviews a permitted deliverable, and cannot see internal-only notes or another company's work.

**Acceptance scenarios:**

1. **Given** an active pricing option is visible to the company, **when** the owner configures a request, **then** OMA shows inclusions, exclusions, quantity/unit, turnaround assumptions, price/quote behavior, and approval terms.
2. **Given** the request is submitted, **when** internal clarification or quote is required, **then** both sides see the correct next action without exposing internal-only data.
3. **Given** a request is commercially approved, **when** production intake occurs, **then** OMA links the request/order to its strategy/brief/tasks rather than duplicating disconnected records.
4. **Given** progress changes, **when** the company views its portal, **then** it sees a client-safe status derived from authoritative internal state.

### US-007 — Synchronize approved assets with Imkan WorkDrive (P1)

**As a** Production Manager,
**I want** approved assets stored or linked through WorkDrive,
**so that** file ownership and access remain consistent across the Imkan environment.

**Independent test:** Approve a deliverable, sync it to the mapped WorkDrive location, retry the sync, revoke access or simulate failure, then reconcile and verify one stable asset mapping and correct permissions.

**Acceptance scenarios:**

1. **Given** the WorkDrive mapping is valid, **when** an approved version is synchronized, **then** OMA records one stable external reference and sync evidence.
2. **Given** the same sync is retried, **when** the idempotency key/external mapping matches, **then** OMA does not create a duplicate asset.
3. **Given** access is revoked or a folder is missing, **when** sync fails, **then** the approved OMA version remains intact and the failure is actionable and retryable.
4. **Given** a user lacks WorkDrive permission, **when** they follow a file link, **then** OMA does not grant broader access or leak the location.

### US-008 — Prepare and authorize paid-media activation (P1/P2 boundary)

**As a** Media Buyer or Company Approver,
**I want** an approved Paid plan and creative mapped to Meta campaign objects,
**so that** paid distribution is controlled, traceable, and recoverable.

**Independent test:** Connect a test ad account, map an approved creative, create a campaign draft, request spend approval, attempt unauthorized launch, authorize the permitted launch/schedule path, receive status updates, and reconcile a duplicate webhook.

**Acceptance scenarios:**

1. **Given** a valid tenant-bound Meta connection, **when** a media buyer creates a draft, **then** OMA links campaign intent to the Paid plan, target, objective, creative version, budget proposal, and external account.
2. **Given** spend or launch approval is missing, **when** launch is attempted, **then** OMA blocks the external mutation.
3. **Given** approval exists and the actor has launch capability, **when** activation is requested, **then** OMA uses an idempotent command and records the external identifiers and response.
4. **Given** Meta reports asynchronous status or error, **when** a signed webhook/sync is processed, **then** OMA updates the external-state projection without rewriting its approval history.
5. **Given** a creative is replaced after campaign mapping, **when** a new version is approved, **then** OMA requires an explicit remap/update action.

### US-009 — Receive actionable notifications and deep links (P2)

**As any** permitted participant,
**I want** notifications for actions that require me,
**so that** work does not stall and links open the correct company/object context.

**Independent test:** Trigger assignment, review request, change request, approval, due-date risk, sync failure, and campaign failure; verify recipient, deduplication, read state, tenant-safe deep link, and access revocation behavior.

### US-010 — See operational and client-safe dashboards (P2)

**As a** manager or company owner,
**I want** an appropriate view of requests, plans, throughput, blockers, approvals, and outcomes,
**so that** I can make decisions without accessing data outside my role.

**Independent test:** Compare dashboards for Platform Owner, Production Manager, Company Owner, and Contributor; verify totals derive from authoritative states, filters survive refresh, and data is tenant/role scoped.

## 7. Functional requirements

### 7.1 Tenant, company, identity, and access

- **FR-001:** The system MUST associate every domain record, query, job, event, file reference, notification, and integration connection with an authoritative tenant/company context where applicable.
- **FR-002:** The system MUST derive tenant/company authority from authenticated server-side context; client-supplied identifiers MAY select among already authorized contexts but MUST NOT grant access.
- **FR-003:** The system MUST enforce capabilities at the server for reads, writes, transitions, uploads/downloads, exports, approvals, connection management, publishing, and paid actions.
- **FR-004:** The system MUST support assigning multiple capability profiles to one person within a tenant without granting the same capabilities in other tenants.
- **FR-005:** The system MUST distinguish platform support/administration from tenant membership and MUST audit any approved cross-tenant support access.
- **FR-006:** The system MUST support active, invited, suspended, and removed membership behavior, including immediate denial of future access after suspension/removal.
- **FR-007:** The system MUST preserve resource ownership and history when a member is removed, while preventing that member from future access.
- **FR-008:** The system MUST expose permission-denied states without revealing whether an unauthorized cross-tenant resource exists.
- **FR-009:** The system MUST record actor, tenant, action, target, before/after state reference, timestamp, and request/correlation identifier for privileged and workflow-changing actions.
- **FR-010:** OMA AI MUST own the initial account, login/session, user, tenant/company, membership, and capability boundary. A future IMKAN federation or migration MUST use an explicit subject/company mapping, preserve canonical OMA identifiers and audit history, and MUST NOT bypass OMA authorization or create competing active sources of truth.

### 7.2 Company intake and website intelligence

- **FR-011:** An authorized actor MUST be able to create or update a company intake profile containing business goals, markets, audiences, languages, channels, constraints, and brand inputs.
- **FR-012:** The system MUST support adding one or more website/product sources with source type, ownership/authorization assertion, scope, locale, and inclusion/exclusion settings.
- **FR-013:** The system MUST validate source URLs/connectors and protect against unsafe network targets, credential exposure, malicious redirects, and unauthorized private-network access.
- **FR-014:** The system MUST respect applicable access controls, robots instructions, rate limits, and connector/platform terms; blocked content MUST NOT be represented as analyzed.
- **FR-015:** Ingestion MUST run as an observable job with queued/running/partial/succeeded/failed/cancelled state, progress, timestamps, and actionable error detail.
- **FR-016:** The system MUST store immutable source snapshots or equivalent version references sufficient to reproduce which evidence informed an output, subject to retention policy.
- **FR-017:** The system MUST extract and normalize relevant company, brand, category, page, product/service, offer, price-display, imagery, copy, and contact/channel signals supported by the source.
- **FR-018:** Every extracted fact MUST record its source, capture time, extraction method, confidence/verification state, and current freshness state.
- **FR-019:** The system MUST distinguish `OBSERVED`, `AI_INFERRED`, `USER_CONFIRMED`, `USER_CORRECTED`, and `STALE` information.
- **FR-020:** Authorized users MUST be able to accept, correct, reject, merge, or mark unknown extracted information without destroying the original observation.
- **FR-021:** A later source refresh MUST produce a comparison/diff and MUST NOT silently overwrite confirmed brand rules or approved plan inputs.
- **FR-022:** The system MUST support identifying and curating competitors and references, with URL/source, rationale, capture time, market relevance, and evidence status.
- **FR-023:** The system MUST separate competitor fact from OMA recommendation and from user-entered opinion.
- **FR-024:** The system MUST detect insufficient or contradictory evidence and request clarification instead of fabricating a complete analysis.
- **FR-025:** Authorized users MUST be able to export or remove source data according to retention, tenant, and legal policy without corrupting dependent audit references.

### 7.3 Strategy, Organic plan, Paid plan, and briefs

- **FR-026:** An authorized strategist MUST be able to create a strategy from selected company profile and source snapshot versions.
- **FR-027:** The system MUST record strategy objective, target audience, market/locale, positioning, message themes, content pillars, funnel assumptions, channels, constraints, measurement approach, and time horizon.
- **FR-028:** AI-generated strategy MUST identify evidence-backed statements, assumptions, unknowns, risks, recommendations, and confidence.
- **FR-029:** Strategy versions MUST be immutable after submission for review; changes MUST create a new version or explicit draft revision.
- **FR-030:** The system MUST support strategy states and authorized transitions defined in section 9.
- **FR-031:** Every strategy MUST support a distinct `ORGANIC` plan and a distinct `PAID` plan; either may be intentionally empty with a recorded rationale.
- **FR-032:** The Organic plan MUST support content pillars, channel, format, theme/topic, audience, funnel stage, objective, message/CTA, cadence/calendar, owner role, dependencies, and success measure.
- **FR-033:** The Paid plan MUST support objective, funnel stage, audience assumption, offer, creative angle, format/variant, placement/channel, budget recommendation or constraint, schedule, landing destination, KPI, and approval requirements.
- **FR-034:** Paid budget and expected performance MUST be clearly labeled as user input, observed history, benchmark, or AI estimate; estimates MUST NOT be presented as guarantees.
- **FR-035:** The system MUST support reference assets and competitor examples linked to a plan item with rationale and usage/licensing caution.
- **FR-036:** The system MUST generate or edit a structured brief from an approved or reviewable plan item without losing the originating objective/evidence links.
- **FR-037:** A brief MUST support deliverable type, audience, channel, dimensions/duration where known, key message, copy requirements, visual direction, shot list when applicable, mandatory elements, exclusions, references, source assets, due date, review path, and definition of accepted output.
- **FR-038:** Authorized reviewers MUST be able to comment, request changes, approve, reject, archive, and compare strategy/plan/brief versions within their capability.
- **FR-039:** Approval MUST target an exact version and record actor, role/capability, decision, timestamp, comment, and any conditions.
- **FR-040:** The system MUST block task conversion, client delivery, publishing, or paid activation when the required upstream approval is absent, expired, or invalidated.
- **FR-041:** When approved upstream content changes, the system MUST identify affected briefs, tasks, deliverables, schedules, and campaigns and require an explicit propagation decision.
- **FR-042:** The system MUST support cloning a strategy/plan/brief as a new draft while preserving origin and preventing inherited approval.
- **FR-043:** The system MUST provide a client-safe presentation of approved strategy and plan content while withholding internal-only notes, cost details, or evidence restricted by role.

### 7.4 Production projects, boards, tasks, and delivery

- **FR-044:** An authorized manager MUST be able to create a production project/board linked to a client request, strategy, plan, campaign, or approved standalone brief.
- **FR-045:** The system MUST preview plan-to-task conversion before committing and show tasks, roles, dependencies, dates, and source links.
- **FR-046:** Plan-to-task conversion MUST be idempotent and MUST prevent duplicate task creation from retries or double submission.
- **FR-047:** A task MUST include title, type, source plan/brief, company, objective, description, acceptance criteria, inputs, references, required output, priority, assignee/team, reporter/owner, due date, dependencies, blockers, status, and version.
- **FR-048:** The system MUST support content task types including strategy/copy, static design, photography, videography, video editing, motion, review, publishing, and paid-media preparation, with extensible type-specific fields.
- **FR-049:** Contributors MUST see all information required to complete assigned work and only information permitted by their capabilities.
- **FR-050:** The system MUST support assignee changes, watchers, mentions, comments, attachments/references, checklist items, dependencies, and activity history.
- **FR-051:** Task status and order MUST be server-authoritative and follow the state machine in section 9.
- **FR-052:** Drag-and-drop MUST request a valid transition and persisted order; on rejection/conflict, the UI MUST restore authoritative state and explain the result.
- **FR-053:** The system MUST prevent silent overwrites from stale edits or concurrent transitions and MUST offer refreshed state/retry where safe.
- **FR-054:** A task MAY be marked blocked only with a reason; dependency, owner, next action, and blocked-since time SHOULD be captured when known.
- **FR-055:** The system MUST support reusable board/workflow templates without making tenant-specific data globally visible.
- **FR-056:** The system MUST expose workload, due-date risk, blocked duration, review queues, and throughput to authorized managers.
- **FR-057:** A permitted contributor MUST be able to upload or link a deliverable as a new version associated with a task and brief.
- **FR-058:** Each deliverable version MUST record immutable version identity, uploader, time, file reference, checksum/size/type where available, preview/proxy references where applicable, notes, and review state.
- **FR-059:** Reviews and annotations MUST target a specific version and preserve author, time, resolution, and visibility scope.
- **FR-060:** A revision request MUST preserve the reviewed version and create an explicit next action; it MUST NOT mutate the file in place.
- **FR-061:** Approval MUST identify one exact deliverable version. A later upload MUST NOT silently replace or revoke that approval.
- **FR-062:** Task completion rules MUST be configurable by task type and MAY require approved deliverable, resolved checklist, mandatory metadata, and downstream handoff.
- **FR-063:** The system MUST distinguish internal comments/attachments from client-visible ones and enforce that distinction server-side.
- **FR-064:** Bulk assignment, date, or transition actions MUST validate each selected task independently and report partial results without hiding failures.
- **FR-065:** Search, filters, saved views, and board ordering MUST remain tenant-scoped and persist according to user/workspace policy.

### 7.5 Client portal, pricing, request, and commercial approval

- **FR-066:** Authorized client users MUST be able to view active content packages or request a custom quote according to `DEC-005`.
- **FR-067:** A pricing option MUST show currency, unit/quantity, included deliverables, exclusions, revision allowance, assumptions, indicative turnaround, validity, and whether the price is fixed or estimated.
- **FR-068:** A client request MUST capture selected option/quote type, goals, channels, content types, quantities, campaign dates, audience, source materials, constraints, references, and required approvals, with save-as-draft behavior.
- **FR-069:** Submission MUST validate required inputs, prevent accidental duplicates, and create a durable request state/history.
- **FR-070:** Internal users MUST be able to request clarification, propose/update a quote, accept/reject scope, and record commercial approval within capability.
- **FR-071:** Client users MUST see a client-safe lifecycle derived from authoritative request and production states, including clear next action.
- **FR-072:** Commercial approval MUST NOT itself imply strategy, content, publishing, or ad-spend approval.
- **FR-073:** When an approved request enters production, OMA MUST link it to the resulting strategy/brief/project/tasks and preserve commercial scope traceability.
- **FR-074:** Client users MUST be able to review and act on only the deliverables and comments explicitly exposed to them.
- **FR-075:** Cancellation, expiry, refund/payment, and scope-change behavior MUST follow the selected commercial owner and policy; unavailable behavior MUST be shown, not inferred.

### 7.6 Imkan WorkDrive and asset references

- **FR-076:** OMA MUST connect to WorkDrive using an approved tenant-bound identity and the least required scopes.
- **FR-077:** The system MUST map OMA company/project/task/deliverable context to an authorized WorkDrive location according to a deterministic naming/mapping policy decided in the technical plan.
- **FR-078:** File synchronization MUST be idempotent and retain stable external file/folder identifiers, version/checksum evidence, sync state, last attempt, and error.
- **FR-079:** OMA MUST NOT duplicate authoritative file bytes unless an approved cache/processing exception is documented with retention and security behavior.
- **FR-080:** A WorkDrive deletion, move, permission change, or version conflict MUST be detected or reconciled and MUST NOT silently invalidate an OMA approval record.
- **FR-081:** OMA MUST enforce its own access decision before exposing a WorkDrive link and MUST NOT assume possession of a link grants permission.
- **FR-082:** Sync failure MUST be visible, retryable where safe, and separable from the content approval state.
- **FR-083:** The selected ownership contract from `DEC-003` MUST name which system owns original uploads, working files, approved masters, previews/proxies, and retention/deletion.

### 7.7 Meta and future paid-media connectors

- **FR-084:** An authorized actor MUST be able to connect a tenant-owned Meta business/ad account through an approved authorization flow and select only accounts/assets they are permitted to use.
- **FR-085:** The system MUST bind each external connection and selected ad account to one tenant context and prevent cross-tenant reuse.
- **FR-086:** OMA MUST store campaign intent separately from the external delivery projection and preserve Paid-plan, brief, and approved-creative links.
- **FR-087:** A campaign draft MUST support objective, account, destination, audience inputs, placement, schedule, budget/bid constraints as applicable, tracking inputs, and one or more approved creative versions.
- **FR-088:** OMA MUST validate required upstream approvals, actor capability, connection health, external-account scope, and spend limits before any external create/update/launch action.
- **FR-089:** External mutations MUST use idempotency/reconciliation controls and record request correlation, external IDs, response state, and failure detail without logging secrets.
- **FR-090:** OMA MUST verify incoming webhooks/events, deduplicate them, retain event time, and reconcile out-of-order or missing updates.
- **FR-091:** External policy rejection, authorization expiry, rate limit, partial creation, and account restriction MUST produce actionable states and safe retry/remediation paths.
- **FR-092:** Replacing an approved creative, changing material targeting/budget, or invalidating an upstream approval MUST require a new authorized action according to policy.
- **FR-093:** OMA MUST show that spend, delivery, reach, clicks, conversions, and platform status are reported by the external platform and may be delayed or adjusted.
- **FR-094:** Future ad platforms MUST implement the same connector contract without forcing Meta-specific identifiers into shared strategy/production domains.
- **FR-095:** No production environment campaign may be launched, paused, deleted, or spend-adjusted by tests, demos, AI autonomy, or background retry without an explicit approved command and environment safeguards.

### 7.8 Notifications, deep links, dashboards, and audit

- **FR-096:** The system MUST generate notification events for assignment, mention, clarification, review request, change request, approval/rejection, due-date risk, blocker, sync failure, and paid-media failure where applicable.
- **FR-097:** Each notification MUST resolve recipients by tenant membership, capability, assignment/watcher rules, and object visibility at delivery time.
- **FR-098:** Notifications MUST be deduplicated, record read/unread state, and contain a tenant-safe deep link to the exact actionable object/version.
- **FR-099:** Revoked users MUST NOT receive new notifications or access an object through an old deep link.
- **FR-100:** Operational dashboards MUST derive counts and cycle times from authoritative states and expose filter context/freshness.
- **FR-101:** Client dashboards MUST use client-safe state mappings and MUST NOT expose internal notes, other clients, hidden costs, or restricted evidence.
- **FR-102:** Authorized users MUST be able to filter/search by company, project, plan, task, assignee, type, status, date, channel, and campaign as their scope permits.
- **FR-103:** Exports MUST apply the same tenant, permission, field-visibility, and audit rules as on-screen access.
- **FR-104:** Audit viewers MUST be able to follow state, approval, version, integration, and permission history without editing it.
- **FR-105:** The system MUST distinguish current state, historical event time, and external provider event time.

### 7.9 AI assistance and governance

- **FR-106:** AI actions MUST state their purpose, selected inputs/snapshots, expected output type, and user-visible progress/result state.
- **FR-107:** The system MUST retain sufficient provenance to explain which sources and versions informed an AI proposal, subject to data-retention policy.
- **FR-108:** AI-generated factual claims MUST include support or be labeled as assumptions/unknowns; unsupported claims MUST NOT be promoted to confirmed company facts.
- **FR-109:** Users MUST be able to edit, accept, reject, regenerate, and compare AI output without destroying earlier versions.
- **FR-110:** AI MUST NOT grant permissions, approve its own output, launch campaigns, authorize spend, delete authoritative data, or bypass a workflow gate.
- **FR-111:** The system MUST protect secrets, personal data, client-confidential information, unpublished assets, and restricted evidence from unauthorized model/provider exposure.
- **FR-112:** AI provider/model changes MUST preserve product-level output contracts and record behavior-relevant version information allowed by policy.
- **FR-113:** Generation failure, timeout, refusal, unsafe output, or quota exhaustion MUST leave durable work intact and offer a safe retry/manual path.
- **FR-114:** The system SHOULD support feedback on AI usefulness and corrections so quality can be measured without treating user content as training data unless explicitly permitted.

### 7.10 Independent product experience and design coherence

- **FR-115:** OMA AI MUST operate as an independent product under the IMKAN ecosystem with its own application shell, information architecture, visual language, motion language, and design tokens.
- **FR-116:** The OMA/IMKAN relationship MUST be expressed through approved endorsement and explicit integrations; the system MUST NOT require visual or interaction parity with IMKAN ONE unless a later approved contract names a specific shared surface.
- **FR-117:** The product experience MUST follow one documented reference hierarchy. A primary content/visual reference and interaction reference MAY influence the base experience; functional references MUST remain limited to their assigned domains.
- **FR-118:** OMA UI, copy, components, icons, imagery, layouts, and tokens MUST be original. Reference study MUST NOT result in copied proprietary assets, trademarks, or complete screen arrangements.
- **FR-119:** Intelligence, strategy, content planning, production, client, asset, and paid-media areas MUST feel like one product through shared tokens, hierarchy, navigation rules, state language, and interaction behavior.
- **FR-120:** Operational workspaces SHOULD be light-first. A media-review surface MAY use a dark focus canvas when it improves review accuracy, provided navigation, tokens, versions, approvals, and accessibility remain coherent with the base product.
- **FR-121:** Content objects MUST support the views appropriate to their job—such as calendar, feed/grid preview, list, or board—without forcing every object into every view. Feedback and approval SHOULD remain contextual to the exact content or version.
- **FR-122:** Motion MUST communicate hierarchy, state change, progress, drag/drop validity, or spatial continuity and MUST respect reduced-motion preferences. Decorative motion MUST NOT disguise unconfirmed server state or external actions.
- **FR-123:** The active company/brand context and the distinction between AI proposal, human approval, OMA state, and external provider state MUST remain visually unambiguous.
- **FR-124:** Before UI implementation, each screen plan MUST name its archetype, primary reference behavior, OMA adaptation, represented source of truth/state, EN/AR and RTL/LTR behavior, responsive behavior, keyboard path, focus, contrast, and non-color status treatment.

## 8. Conceptual entities

These are product concepts, not database tables. Physical models are defined only in the approved technical plan.

| Entity | Purpose and key relationships |
| --- | --- |
| Tenant/Organization | OMA-owned security and ownership boundary; contains memberships, companies/workspaces, settings, and connections and may later retain an explicit external IMKAN mapping |
| Company Profile | Confirmed business, brand, market, audience, locale, channel, and constraint context |
| Membership/Capability Grant | Actor-to-tenant access and permitted actions; may combine profiles |
| Website Source | Public URL or authorized connector configuration, scope, ownership assertion, and health |
| Ingestion Run/Snapshot | Versioned acquisition job and exact evidence set used downstream |
| Page Evidence | Source URL/content reference, captured time, extraction status, and supported facts |
| Product/Service Projection | Normalized product/service view with source/freshness and confirmation state |
| Brand Fact/Rule | Observed, inferred, confirmed, corrected, or stale brand information |
| Competitor/Reference | Curated external subject/evidence with rationale, source, capture time, and restrictions |
| Insight/Recommendation | Evidence-linked finding, hypothesis, risk, opportunity, or recommended action |
| Strategy Version | Immutable submitted/reviewed strategic proposal and approval history |
| Content Plan | `ORGANIC` or `PAID` child of a strategy version |
| Plan Item | Planned content/campaign unit linked to objective, audience, channel, timing, and measures |
| Brief Version | Structured production instruction linked to plan item/evidence and approval state |
| Client Request | Company-originated content need and request lifecycle |
| Pricing Package/Quote | Commercial scope, units, price/estimate, validity, inclusions, and approval |
| Production Project/Board | Execution container linked to request/strategy/plan |
| Workflow Definition | Allowed task states/transitions and required capabilities/conditions |
| Task | Owned work unit linked to source brief/plan/request and production context |
| Dependency/Blocker | Relationship and explanation preventing progress |
| Deliverable | Logical output for a task; contains multiple immutable versions |
| Deliverable Version | Exact file/reference and review target |
| Review/Decision | Comment, change request, approval, rejection, actor/capability, and target version |
| WorkDrive Mapping | Stable OMA-to-WorkDrive folder/file reference and sync/reconciliation state |
| External Connection | Tenant-bound authorization to Meta/WorkDrive/future provider; secret material remains protected |
| Campaign Intent | OMA-owned paid objective, budget proposal/constraints, schedule, mapping, and approvals |
| External Campaign Projection | Provider-owned IDs, delivery/status metrics, freshness, and last sync |
| Notification | Recipient/action/object/deep-link/read/deduplication record |
| Audit Event | Append-only security/workflow/integration event with correlation |

### 8.1 Mandatory relationship invariants

- A plan belongs to exactly one strategy version and has exactly one type: `ORGANIC` or `PAID`.
- A generated brief or task retains its originating plan item; approved standalone work records an explicit exception source.
- A deliverable version belongs to one logical deliverable and cannot move between tenants/tasks.
- An approval targets one exact version of a strategy, plan/brief, deliverable, quote, or campaign intent.
- A campaign creative mapping targets one approved deliverable version, not an unqualified “latest file.”
- An external connection belongs to one tenant boundary even if the provider user can access several accounts.
- A notification cannot grant access; its deep link is re-authorized when opened.
- Deleting or archiving a parent must preserve audit and referential history required by policy.

## 9. Canonical states and transitions

Canonical state codes are English. The UI localizes labels; for example `NEW_REQUEST` = “طلب جديد”, `IN_PROGRESS` = “قيد التنفيذ”, and `APPROVED` = “مقبول/معتمد” according to context.

### 9.1 Client request lifecycle

| State | Meaning | Typical permitted next states |
| --- | --- | --- |
| `DRAFT` | Client is preparing the request | `SUBMITTED`, `CANCELLED` |
| `SUBMITTED` | New request awaiting intake | `NEEDS_CLARIFICATION`, `QUOTED`, `COMMERCIAL_APPROVED`, `REJECTED`, `CANCELLED` |
| `NEEDS_CLARIFICATION` | Client/internal answer is required | `SUBMITTED`, `QUOTED`, `CANCELLED` |
| `QUOTED` | Commercial offer awaits client action | `COMMERCIAL_APPROVED`, `NEEDS_CLARIFICATION`, `REJECTED`, `EXPIRED`, `CANCELLED` |
| `COMMERCIAL_APPROVED` | Scope/price approved; not content/spend approval | `IN_PRODUCTION`, `CANCELLED` subject to policy |
| `IN_PRODUCTION` | Linked production is active | `DELIVERED`, `CANCELLED` subject to policy |
| `DELIVERED` | Client-visible delivery made | `CLOSED`, `IN_PRODUCTION` for an authorized revision |
| `CLOSED` | Commercial/production request concluded | Terminal except approved reopen policy |
| `REJECTED` | Offer/request declined | Terminal or clone as new draft |
| `EXPIRED` | Quote validity ended | Terminal or issue a new quote version |
| `CANCELLED` | Request stopped with reason | Terminal or clone as new draft |

### 9.2 Strategy/plan lifecycle

| State | Meaning | Typical permitted next states |
| --- | --- | --- |
| `DRAFT` | Human-authored or prepared input | `GENERATING`, `IN_REVIEW`, `ARCHIVED` |
| `GENERATING` | AI generation job is running | `AI_GENERATED`, `GENERATION_FAILED`, `CANCELLED` |
| `AI_GENERATED` | Proposal exists; no approval implied | `DRAFT`, `IN_REVIEW`, `ARCHIVED` |
| `IN_REVIEW` | Immutable version awaits decision | `CHANGES_REQUESTED`, `APPROVED`, `REJECTED` |
| `CHANGES_REQUESTED` | New revision is required | `DRAFT`, `ARCHIVED` |
| `APPROVED` | Exact version approved | `SUPERSEDED`, `ARCHIVED` |
| `REJECTED` | Submitted version rejected | `DRAFT`, `ARCHIVED` |
| `SUPERSEDED` | A newer version is approved | `ARCHIVED` |
| `GENERATION_FAILED` | Generation did not produce a usable version | `GENERATING`, `DRAFT`, `CANCELLED` |
| `ARCHIVED` / `CANCELLED` | No active workflow | Terminal unless explicit restore policy |

### 9.3 Task lifecycle

| State | Meaning | Typical permitted next states |
| --- | --- | --- |
| `NEW_REQUEST` | Work exists but is not assigned/accepted | `ASSIGNED`, `CANCELLED` |
| `ASSIGNED` | Owner is assigned and work is ready | `IN_PROGRESS`, `BLOCKED`, `CANCELLED` |
| `IN_PROGRESS` | Work is actively being produced | `BLOCKED`, `READY_FOR_REVIEW`, `CANCELLED` |
| `BLOCKED` | A recorded blocker prevents progress | Prior valid working state, `CANCELLED` |
| `READY_FOR_REVIEW` | Required output is submitted | `CHANGES_REQUESTED`, `APPROVED`, `IN_PROGRESS` if submission withdrawn by policy |
| `CHANGES_REQUESTED` | Reviewer requires a new revision | `IN_PROGRESS`, `BLOCKED`, `CANCELLED` |
| `APPROVED` | Required output/version is approved | `COMPLETED`, `CHANGES_REQUESTED` only through an explicit approval invalidation policy |
| `COMPLETED` | All completion conditions and handoffs are satisfied | Terminal or controlled reopen |
| `CANCELLED` | Work stopped with reason | Terminal or clone as new task |

The board MAY show a simplified subset of columns, but stored states and history remain canonical. A client-safe label MAY aggregate several internal states without changing them.

### 9.4 Deliverable version lifecycle

| State | Meaning | Typical permitted next states |
| --- | --- | --- |
| `UPLOADED` | New immutable version exists | `IN_REVIEW`, `WITHDRAWN` |
| `IN_REVIEW` | Version is the active review target | `CHANGES_REQUESTED`, `APPROVED`, `REJECTED` |
| `CHANGES_REQUESTED` | Version remains historical; new version required | `SUPERSEDED` when replacement arrives |
| `APPROVED` | Exact version accepted | `SUPERSEDED` only when another version receives explicit approval |
| `REJECTED` | Version not accepted | `SUPERSEDED` when replacement arrives |
| `SUPERSEDED` | Another version is the active/approved successor | Terminal |
| `WITHDRAWN` | Uploader withdrew before decision according to policy | Terminal |

### 9.5 WorkDrive synchronization lifecycle

`NOT_MAPPED → PENDING → SYNCING → SYNCED`

From `PENDING` or `SYNCING`, the system may enter `FAILED_RETRYABLE`, `FAILED_ACTION_REQUIRED`, or `CANCELLED`. A previously `SYNCED` mapping may become `STALE`, `MISSING`, or `PERMISSION_REVOKED` after reconciliation. Sync state never changes content approval by itself.

### 9.6 Paid campaign lifecycle

| State | Meaning | Typical permitted next states |
| --- | --- | --- |
| `DRAFT` | OMA intent is being prepared | `READY_FOR_APPROVAL`, `CANCELLED` |
| `READY_FOR_APPROVAL` | Validated proposal awaits accountable approval | `CHANGES_REQUESTED`, `APPROVED`, `CANCELLED` |
| `CHANGES_REQUESTED` | Material update required | `DRAFT`, `CANCELLED` |
| `APPROVED` | Exact intent/budget/creative mapping approved | `ACTIVATING`, `CANCELLED` subject to policy |
| `ACTIVATING` | Idempotent external mutation is in flight | `SCHEDULED`, `ACTIVE`, `FAILED`, `PARTIAL` |
| `SCHEDULED` | Provider accepted future activation | `ACTIVE`, `PAUSED`, `FAILED`, `CANCELLED` according to provider/policy |
| `ACTIVE` | Provider reports active delivery | `PAUSED`, `COMPLETED`, `FAILED` |
| `PAUSED` | Provider reports paused | `ACTIVE`, `COMPLETED`, `FAILED` |
| `PARTIAL` | Some external objects exist; reconciliation required | `ACTIVATING`, `FAILED`, `CANCELLED` only after reconciliation policy |
| `FAILED` | Action/provider rejected or could not reconcile | `DRAFT`, `ACTIVATING`, `CANCELLED` as safely allowed |
| `COMPLETED` | Provider reports campaign concluded | Terminal |
| `CANCELLED` | OMA intent stopped; external cleanup status remains explicit | Terminal |

## 10. Capability matrix

Exact grants are tenant-configurable. `✓` means typical, `Scoped` means only assigned/exposed objects, and `Approval` means a separately granted accountable capability is required.

| Capability area | Company Owner | Strategist | Production Manager | Contributor | Reviewer | Media Buyer | Client Viewer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Manage company/brand inputs | ✓ | ✓ | View | Scoped input | View | View | View |
| Manage website sources | Approval/configurable | ✓ | View | — | View | View | — |
| Create/edit strategy | Comment/approval | ✓ | View | — | Review | Paid fields | View approved/exposed |
| Approve strategy/plan | Approval | If granted | If granted | — | Approval | Paid approval if granted | — |
| Create project/tasks | — | From plan if granted | ✓ | — | — | Paid tasks if granted | — |
| Assign/manage board | — | Scoped | ✓ | Own task transitions | Review queue | Scoped | — |
| Upload deliverables | Client inputs only | Scoped | ✓ | Assigned tasks | — | Paid assets if assigned | Client inputs only |
| Internal comments | — | ✓ | ✓ | Scoped | ✓ | ✓ | — |
| Client-visible comments | ✓ | If granted | If granted | If granted | If granted | If granted | ✓ |
| Request changes/approve asset | Approval | If granted | If granted | — | Approval | If granted | If exposed/granted |
| Manage pricing/quote | Accept/decline | — | View scope | — | — | — | View |
| Connect WorkDrive | If granted | — | If granted | — | — | — | — |
| Connect Meta/ad account | Approval/configurable | — | — | — | — | ✓ | — |
| Prepare campaign draft | View/approve | Paid input | View | — | Review | ✓ | View exposed |
| Launch/change spend | Approval | — | — | — | Approval if assigned | Approval + execute | — |
| View operational dashboards | Company-safe | Strategy scope | ✓ | Own work | Review scope | Paid scope | Company-safe |
| Export/audit | Company-safe | Scoped | Scoped | Own data if allowed | Scoped | Paid scope | Company-safe if allowed |

No UI matrix substitutes for server-side capability checks.

## 11. Integration contracts

### 11.1 Website/commerce connector contract

Each connector MUST expose:

- connection validation and authorization state;
- selected source scope and exclusions;
- acquisition job with cursor/progress and rate-limit behavior;
- immutable snapshot/version identity;
- normalized pages/products/assets with source references;
- freshness and change detection;
- retry/cancel/reconcile behavior;
- removal/export behavior;
- connector-specific limitations without leaking them into shared strategy entities.

### 11.2 WorkDrive connector contract

The connector MUST expose tenant-bound authorization, folder/file selection or deterministic mapping, upload/link/version operations, stable external IDs, checksum/version evidence where available, permission check, retry, reconciliation, and deletion/move conflict reporting.

### 11.3 Paid-media connector contract

Each channel connector MUST expose connection/account discovery, validation, creative requirements, draft mapping, preflight validation, idempotent mutation, external IDs, signed event ingestion or polling, normalized status projection, metrics freshness, failure classification, and reconciliation. Shared product domains MUST use channel-neutral concepts; provider-specific fields remain in the adapter boundary.

## 12. Edge cases and required failure behavior

- A website redirects across domains, loops, serves different locales, blocks bots, requires login, or contains millions of pages.
- Product data is contradictory across structured data, visible text, variants, currencies, or languages.
- A source refresh removes or changes a product used by an approved plan.
- Competitor/reference pages disappear or change after strategy approval.
- AI generation times out, returns unsafe content, loses a citation, or produces inconsistent Organic/Paid items.
- Two reviewers decide on the same version at nearly the same time.
- A contributor uploads a replacement while the previous version is under review.
- A task is moved offline/stale or reordered simultaneously by two managers.
- An assignee is suspended or leaves while owning active/blocked work.
- A client quote expires while a request is being clarified.
- Internal state changes do not map one-to-one to client-visible state.
- WorkDrive upload succeeds but OMA response times out, or the inverse.
- A WorkDrive file is moved/deleted or permission is revoked outside OMA.
- Meta creates some campaign objects but rejects another; retry must not duplicate the successful objects.
- OAuth token expires between preflight and mutation.
- Webhooks are duplicated, delayed, out of order, forged, or associated with a disconnected account.
- An approved creative becomes incompatible with a placement or external policy.
- Currency/timezone/locale changes alter display but not stored intent/history.
- A deep link is opened after role, tenant membership, object visibility, or version state changed.

For every case, the product MUST preserve durable accepted work, avoid privilege escalation or duplicate external actions, show authoritative current state, and provide a safe next step.

## 13. Non-functional requirements

### Security and privacy

- **NFR-001:** Deny access by default and enforce tenant/capability scope server-side on every path, including background work and exports.
- **NFR-002:** Encrypt data in transit and apply approved protection at rest; sensitive connector tokens and secrets must use dedicated secret storage.
- **NFR-003:** Apply SSRF, redirect, DNS rebinding, content-size, file-type, malware, and decompression protections to website and file ingestion according to threat model.
- **NFR-004:** Minimize personal/confidential data sent to AI and external providers and apply configurable retention/deletion policy.
- **NFR-005:** Redact secrets and sensitive payloads from logs, traces, errors, prompts, screenshots, fixtures, and analytics.
- **NFR-006:** Security-relevant actions and external mutations must be attributable and auditable.

### Reliability and data integrity

- **NFR-007:** User and integration mutations must tolerate retries and duplicate submissions without duplicate tasks, files, approvals, charges, or campaigns.
- **NFR-008:** Concurrent edits and transitions must detect stale versions and prevent silent lost updates.
- **NFR-009:** Long-running ingestion, generation, upload, sync, and campaign actions must have durable job state, bounded retries, cancellation where safe, and recovery after process restart.
- **NFR-010:** External and internal state must be reconcilable using stable identifiers and correlation history.
- **NFR-011:** Backup, restore, retention, archival, and deletion objectives must be defined in the technical plan and tested before production readiness.

### Performance and scale

- **NFR-012:** The technical plan must set measurable budgets for interactive latency, board operations, search, upload/preview, generation progress, dashboard freshness, and background throughput using expected tenant/content volumes.
- **NFR-013:** Large boards, catalogs, activity streams, versions, and search results must paginate or virtualize without returning unbounded tenant data.
- **NFR-014:** Slow external services must not block unrelated interactive work; users must see progress and may safely leave/re-enter the flow.
- **NFR-015:** Rate limits, quotas, queue capacity, and backpressure must be observable and must not cause cross-tenant starvation.

### Usability, localization, and accessibility

- **NFR-016:** All user-facing product copy must support English and Arabic with correct LTR/RTL layout and mixed-direction content handling.
- **NFR-017:** Dates, times, timezones, currency, numbers, pluralization, and status labels must be locale-safe while preserving canonical stored meaning.
- **NFR-018:** Required desktop and mobile journeys must be responsive and usable with keyboard, visible focus, semantic labels, and non-color status indicators.
- **NFR-019:** Loading, empty, partial, stale, conflict, permission-denied, offline/retry, and provider-error states must be intentionally designed.
- **NFR-020:** Drag-and-drop must have an accessible non-pointer alternative.

### Observability and operations

- **NFR-021:** Every request/job/integration mutation must carry a correlation identifier across logs, events, retries, and external mapping where possible.
- **NFR-022:** Operational telemetry must distinguish product failure, permission denial, user validation, provider failure, retry, and reconciliation outcome.
- **NFR-023:** Alerts and dashboards must be tenant-safe and avoid including confidential content unless explicitly authorized.
- **NFR-024:** Production readiness must define health checks, queue lag, sync freshness, webhook failure, error budgets, support diagnostics, and incident ownership.

### Maintainability and portability

- **NFR-025:** Provider-specific website, WorkDrive, Meta, AI, notification, and storage behavior must remain behind explicit contracts.
- **NFR-026:** Shared domains must not depend on Meta-specific or WorkDrive-specific identifiers as their primary identity.
- **NFR-027:** Product behavior, permissions, states, events, and integration boundaries must remain synchronized with the smallest relevant spec.
- **NFR-028:** The implementation must use the repository's approved conventions and the smallest justified dependency surface.

## 14. Reporting and measurement definitions

- Cycle time begins and ends at canonical state events, not client display labels.
- Approval rate targets an exact submitted version and decision event.
- “On time” compares the completion/approval rule selected for the task type with its authoritative due time/timezone.
- AI generation time excludes human review time but includes queued and failed/retried generation visibility.
- WorkDrive sync success requires a resolvable, authorized external mapping, not merely a successful local request.
- Paid activation success requires reconciled external identifiers/status, not only an accepted OMA command.
- Client progress is a projection; operational reports retain canonical internal states.
- Every dashboard metric must expose definition, time range, timezone, filters, freshness, and data source to authorized users.

## 15. Proposed delivery slices

This is product dependency order, not an implementation plan. Scope requires approval during planning.

### Slice 0 — Foundation decisions and repository truth

- Apply resolved `DEC-001` and `DEC-002` by creating the separate `oma-ai` repository with an OMA-owned identity, tenant/company, membership, session, and capability boundary.
- Inspect the actual repository, installed tools, and authentication. Do not add an IMKAN identity dependency; future integration is a separate change.
- Approve domain/SoT map, threat model scope, roles/capabilities, and initial success baselines.
- Apply resolved `DEC-013` as the canonical reference hierarchy in the later base UI design-system plan.

### Slice 1 — Company intelligence to approved strategy

- Company intake and website source.
- Observable snapshot/evidence/product projection.
- Confirm/correct facts.
- Evidence-backed strategy with separate Organic/Paid plans.
- Human version review and approval.

### Slice 2 — Approved plan to production completion

- Briefs, plan-to-task conversion, assignments, dependencies, Kanban.
- Task state machine and accessible drag/drop alternative.
- Deliverable versions, internal review, changes, approval, notifications, audit.

### Slice 3 — WorkDrive asset handoff

- Approved ownership contract.
- Folder/file mapping, idempotent sync, permission-safe access, failure/reconciliation.

### Slice 4 — Client pricing/request portal

- Packages/custom quote boundary.
- Request/clarification/commercial approval.
- Linked production intake and client-safe progress/review.

### Slice 5 — Meta paid-media activation

- Tenant-bound connection and account mapping.
- Paid plan/approved creative to campaign draft.
- Spend/launch approval, activation scope selected by `DEC-006`, status sync, webhook/reconciliation.

### Slice 6 — Optimization and additional channels

- Outcome reporting and strategy feedback loops.
- Additional paid/organic connectors through shared contracts.
- Automation only within approved human and spend boundaries.

## 16. Assumptions

- The user connecting a website has authority to analyze it or relies only on legally accessible public information.
- A human remains responsible for strategy, brand, legal, content, publishing, and spend decisions.
- Meta is the first paid-media target; other platforms are future adapters.
- Imkan WorkDrive exists as a target integration, but its exact API, file ownership, and permission contract have not yet been inspected.
- OMA AI will serve more than one company and therefore requires strict multi-tenancy even if the first pilot has one company.
- EN/AR and RTL/LTR are baseline requirements, not a later translation pass.
- OMA AI is an independent product under IMKAN and is not visually or behaviorally required to match IMKAN ONE.
- OMA AI owns its initial accounts, users, tenants/companies, memberships, sessions, and capability grants; IMKAN federation is deferred to a separately specified future integration.
- The seven-product reference hierarchy in `docs/DESIGN_REFERENCE_STRATEGY.md` is approved. Palette, component, and contextual-surface details remain working design inputs pending prototype and accessibility validation.
- Numeric performance, availability, storage, retention, and business KPI targets require real expected volumes and operating baselines.

## 17. Open decisions

### DEC-001 — Repository boundary `RESOLVED 2026-08-25`

**Decision:** Create a separate private GitHub repository named `oma-ai` with its own project folder and Spec Kit/agent workflow foundation.

**Reason:** The user explicitly requested a new project folder and GitHub repository named after OMA AI.

**Boundary:** This also records that OMA is an independent product under IMKAN, with its own application and product experience. It does not choose the technical stack. Identity and tenant ownership are resolved separately in `DEC-002`.

### DEC-002 — OMA-owned identity, tenant, and company boundary `RESOLVED 2026-08-25`

**Decision:** OMA AI owns its initial accounts, authentication/login boundary, sessions, users, tenants/companies, memberships, and capability grants. The product has no initial dependency on IMKAN ONE SSO, user registry, company registry, shell, or permission system.

**Reason:** The user instructed that OMA AI must be treated as fully independent now and that any IMKAN integration will be handled later.

**Future integration boundary:** IMKAN SSO, account linking, company synchronization, or migration requires a new specification and approved mapping contract. It must preserve canonical OMA identifiers and history, prevent duplicate identities/companies, define conflict and unlink behavior, and never allow external claims to bypass OMA capabilities.

**Impact:** The global authentication/tenant planning blocker is closed. This decision does not authorize implementation or select an authentication technology.

### DEC-003 — WorkDrive ownership `BLOCKER BEFORE FILE IMPLEMENTATION`

**Question:** Which system owns bytes for original inputs, working files, review proxies, and approved masters? Does OMA upload directly to WorkDrive, receive events from it, or sync after local staging?

### DEC-004 — Initial website connection `BLOCKER BEFORE INGESTION PLAN`

**Question:** Does release one support public URL crawl only, one named commerce connector/API, or both? What authorization and crawl-scope rules apply?

### DEC-005 — Pricing, quote, payment, and billing `BLOCKER BEFORE CLIENT COMMERCIAL PLAN`

**Question:** Are packages fixed-price, configurable units, custom quotes, or a combination? Does OMA own payment/invoice state or reference another authoritative system?

### DEC-006 — Meta activation authority `BLOCKER BEFORE PAID IMPLEMENTATION`

**Question:** Does release one stop at export/draft, create paused campaigns, schedule, or launch active campaigns? Which actors approve budget and execute external spend, and what limits require reapproval?

### DEC-007 — AI providers and data policy `BLOCKER BEFORE AI TECHNICAL PLAN`

**Question:** Which providers/models may process public website data, confidential company data, and unpublished assets? What retention, regional, logging, cost, and fallback rules apply?

### DEC-008 — Client/company structure

**Question:** Is each customer a single company/tenant, can one tenant manage several brands/companies, and can an agency team work across explicitly assigned client companies?

### DEC-009 — Approval topology

**Question:** Which objects require internal approval, client approval, or both; must approvals be sequential; and who may invalidate/reopen an approval?

### DEC-010 — Initial content types and channels

**Question:** Which content types and Organic channels are required in the first release, and which need type-specific briefs, previews, or review tools?

### DEC-011 — Client-visible progress mapping

**Question:** Which internal states/comments/dates are visible to company owners and viewers, and which must remain internal?

### DEC-012 — Commercial/legal/retention rules

**Question:** Required currencies, taxes/invoice boundary, cancellation/refund terms, asset retention, source snapshot retention, and audit retention by market.

### DEC-013 — Product experience and global reference hierarchy `RESOLVED 2026-08-25`

**Decision:** Use Planable as the primary visual reference for content planning, calendars, previews, and collaboration; Linear for interface density, speed, side panels, and restrained motion; Frame.io for exact-version image/video review; Adobe Workfront for request, planning, production, and approval workflow; Jasper Brand IQ for brand intelligence, voice, tone, and style; Semrush for website, competitor, and evidence analysis; and Smartly for connecting approved content to paid-media planning and execution.

**Boundary:** Planable and Linear govern the base experience only within their named roles. Frame.io governs focused review only. Workfront, Jasper, Semrush, and Smartly are functional references and must not introduce competing navigation or color systems. No additional product is part of the canonical hierarchy unless a later decision adds it.

**Palette note:** The light/dark surface model and OMA Violet `#6658E8` plus Signal Teal `#12A7A1` are working design inputs, not copied reference colors. They require prototype, contrast, EN/AR, and RTL/LTR validation during design-system planning.

**Impact:** The reference-hierarchy blocker is closed. A design-system specification may begin after repository inspection and explicit authorization; this decision does not authorize UI implementation.

### DEC-014 — Platform foundation technical stack `RESOLVED 2026-08-25`

**Decision:** Approve the following as the **`APPROVED IMPLEMENTATION BASELINE`** for the OMA AI platform foundation only: TypeScript (strict), Node.js Active LTS, NestJS API, Next.js App Router web, PostgreSQL, Prisma, Redis, BullMQ workers, pnpm monorepo, server-side sessions, Vitest, Playwright, and a modular monolith with separately runnable workers.

**Reason:** The user explicitly approved this architecture and stack after reviewing the foundation technical plan on branch `001-oma-ai-product-foundation` (plan commit `9bf7525de72f76e79519f4cefce6f00a9951b691`).

**Boundary:** This does **not** choose AI providers, WorkDrive byte ownership, website crawl vs commerce connector, Meta launch authority, pricing/billing ownership, production email/SMS vendors, cloud hosting, or CDN/object-storage products. Those remain gated by `DEC-003`–`DEC-012` and later slice plans. Future IMKAN identity federation remains a separate specification under `DEC-002`.

**Impact:** Gate B is closed for platform-foundation tasks. `/speckit-tasks` may create foundation `tasks.md`. Product code and dependency installation still require an explicit `/speckit-implement` (or equivalent) authorization.

## 18. Definition of Done for any OMA AI slice

A slice is complete only when all applicable items are true:

- Spec, plan, tasks, implementation, tests, and user-visible behavior converge.
- Every acceptance scenario has evidence or an explicit unavailable-environment blocker.
- Tenant isolation and role/capability negative tests pass.
- State transitions, history, concurrency, retry, idempotency, and refresh/re-login persistence pass.
- AI output shows provenance/uncertainty and cannot self-approve.
- The exact approved strategy/brief/deliverable/campaign version remains identifiable.
- Notifications reach the correct actor and open a re-authorized deep link.
- External connection failure, expiry, retry, duplicate event, partial success, and reconciliation are handled.
- EN/AR, RTL/LTR, required viewports, keyboard path, loading, empty, error, and permission states are verified.
- UI changes follow the approved OMA reference hierarchy, original tokens/assets, named screen archetype, reduced-motion behavior, and contextual light/review surface rules.
- Real repository lint, typecheck, tests, build, and E2E applicable to the change pass.
- No secrets, tenant identifiers, external account IDs, mock-only completion paths, or unapproved dependencies are introduced.
- Domain ownership and source-of-truth documentation is synchronized.
- Remaining limits, deferred scope, migrations, and operations risks are reported plainly.

## 19. Readiness status

Repository setup is complete. Platform-foundation architecture and stack are an `APPROVED IMPLEMENTATION BASELINE` under `DEC-014`. Resolved `DEC-013` governs the reference hierarchy. Each functional product slice must resolve its named blocker decisions (`DEC-003`–`DEC-012`) before planning that slice. Foundation `tasks.md` may be generated under `/speckit-tasks`. Product implementation and dependency installation require an explicit implementation authorization after tasks are approved.
