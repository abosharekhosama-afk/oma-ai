# Feature Specification: Brand Website Intelligence

**Feature Branch**: `002-brand-website-intelligence`
**Created**: 2026-08-26
**Status**: `CLARIFIED` — DP-001–DP-005 applied; plan `APPROVED FOR TASK DECOMPOSITION`; `tasks.md` present (`TASKS_ONLY`); live crawl/AI vendor wiring still gated until `DEC-004`/`DEC-007` close for those choices
**Input**: First product feature after OMA AI Product Foundation — Brand Workspace, website connection, safe async scan, discovery, evidence-backed Brand & Product Intelligence Profile with human approval
**Parent baseline**: `specs/001-oma-ai-product-foundation/spec.md` — productizes Foundation **US-001** intent as a **Brand Workspace** child of the existing tenant/company (not a parallel company registry).
**Foundation FR binding (honest subset)**: primarily **FR-012–FR-021** and **FR-024** (sources, safe ingest, observable jobs, extraction, evidence, human correct/accept/reject, refresh without silent overwrite of confirmed rules, insufficient-evidence handling).
**Explicitly deferred from this slice**: **FR-011** (full company intake profile), **FR-022–FR-023** (competitors), **FR-025** (export/remove source data under full retention/legal policy — hooks only until `DEC-012`).
**Design references (DEC-013 only)**: Semrush (website/evidence analysis), Jasper Brand IQ (brand intelligence/voice), Linear (density, progress, side panels, restrained motion), Planable (collaboration/review where needed)

## Clarifications

### Session 2026-08-26

- Q: For feature 002 release one, is the supported website intelligence mode public URL crawl only? → A: **Yes — Public HTTPS crawl only** for 002 (DP-001 / Option A). Commerce API, store connectors, and login-gated data are out of scope for 002. This is a **slice boundary**, not a global close of `DEC-004`. No crawl vendor selected.
- Q: May 002 plan Brand Intelligence drafts only via `AiProviderPort` with no live AI vendor until `DEC-007` closes? → A: **Yes** (DP-002 / Option A). No AI SDK, keys, third-party sends, model, or assumed region/retention/cost policy. Test adapters only at the provider boundary in tests. If AI is unconfigured: clear unavailable state; usable scan observations → `Partial` → manual review; Failed only when insufficient for a reviewable profile; humans may approve without AI; AI never approves.
- Q: Can an authorized user approve a profile version from a Partial scan if FR-BWI-029a holds? → A: **Yes, with mandatory incompleteness disclosure and explicit confirmation** (DP-003 / Option A). Cancelled / Failed-without-sufficient-data / ineligible / unresolved late results cannot be approved. Late results after approval create a new Draft only.
- Q: Who may reject an entire Profile Version? → A: **Version approve capability only** (DP-004). Insight decide is limited to accept/reject/edit individual insights.
- Q: How should FR-BWI-020 discovery fields be tiered for first release? → A: **Three tiers** (DP-005): `REQUIRED_FOR_APPROVAL`, `DISCOVER_WHEN_AVAILABLE` (Unknown if absent), `DEFERRED_ADVANCED` (backlog). No invented values; AI must not turn Unknown into Fact; coverage gaps visible.

### Feature-local slice resolutions (do not renumber or close Foundation DECs)

| ID | Affirms | Explicitly does **not** close |
| -- | ------- | ----------------------------- |
| `SR-002-004-MODE` | 002 first release = public HTTPS crawl only | `DEC-004` (global mode / commerce / both remains open) |
| `SR-002-007-AI` | 002 AI = `AiProviderPort` only; no live vendor until `DEC-007` | `DEC-007` (providers, models, retention, region, cost, fallback remain open) |

---

## 1. Problem statement

Marketing and content teams under a company tenant need a trustworthy, company-scoped understanding of their own brand and product catalog before strategy, organic/paid plans, or content production. Today that understanding is scattered across websites, tribal knowledge, and unverified AI summaries. Without a durable Brand Workspace, evidence chain, and human-approved intelligence version, downstream OMA work cannot prove why recommendations exist and risks inventing products, claims, or brand rules.

## 2. Product outcome

An authorized tenant member can create a Brand Workspace, connect the brand’s official **public HTTPS** website, run a safe asynchronous **public-crawl** scan, review discovered pages and products with traceable evidence, optionally refine AI-proposed drafts **when an `AiProviderPort` implementation is configured**, otherwise complete the profile manually from observations and evidence, and approve an immutable profile version.

**Required end state:**
`Approved Brand & Product Intelligence Profile backed by traceable website evidence`

That approved version becomes the authoritative brand/product intelligence input for later competitor analysis, strategy, and content features (those features remain out of scope here).

## 3. Personas and capabilities

Access is **capability-based** (not hardcoded UI roles). Job titles may map to capability profiles elsewhere; this feature authorizes only the capabilities below. All tenant and capability decisions are **server-authoritative**.

| Capability intent | Allows |
| ----------------- | ------ |
| Brand create | Create a Brand Workspace under the active tenant |
| Website connect | Link or change the primary website source and confirm authorization to add it |
| Scan control | Start, cancel, or retry a scan job for a brand |
| Discovery review | Review discovered pages, products/services, and categories |
| Insight edit | Edit AI or extracted draft fields before approval |
| Insight decide | Accept, reject, or edit an **individual** insight/claim only — MUST NOT reject or approve an entire Profile Version |
| Version approve | Approve an immutable Brand & Product Intelligence Profile version; **also** reject/discard an entire Profile Version |
| Brand read | View brand workspace, scan progress, evidence, and approved/draft profiles without mutation |
| Brand archive | Archive a brand or request deletion subject to policy |

Membership suspension or capability loss must deny subsequent commands and must cause in-flight workers to re-check and fail closed (see Security and State machine).

## 4. Brand Workspace model (product rules)

- Every Brand Workspace belongs to **exactly one** Foundation tenant/company. No parallel tenancy system may be introduced.
- Brand Workspace is a **child domain under one Foundation tenant**. Whether a customer may operate several brands (or companies) long-term remains governed by open **`DEC-008`**. Until `DEC-008` closes, this slice uses a **safe interim boundary**: the product model MUST NOT forbid a second Brand Workspace under the same tenant, and MUST NOT implement agency cross-tenant brand staffing.
- Each Brand has: display name, lifecycle status, primary website source, connected sources, evidence set, scan attempts, and intelligence profile versions (with a pointer to the current approved version when one exists).
- **002 slice boundary (`SR-002-004-MODE`):** the primary website source for this feature is a **public HTTPS site** only. Commerce APIs, store connectors, and login/paywall content are **not** authoritative sources in 002. This does **not** close global `DEC-004`.
- A website **rescan** MUST NOT replace or silently mutate an already **Approved** intelligence profile version.
- Each rescan produces a new **Draft** intelligence version that can be reviewed and compared to prior versions (including the approved one).
- An **Approved** profile version is **immutable**. Corrections after approval create a new draft/version path; they never rewrite the approved artifact in place.

## 5. Prioritized user stories

### US-BWI-01 — Create Brand Workspace and connect website (Priority: P1)

An authorized member creates a Brand Workspace for their company and connects the brand’s official public website URL, confirming they are authorized to add that source.

**Why this priority**: Without a tenant-scoped brand and validated source, no intelligence journey can start.

**Independent Test**: Create brand, connect URL, refresh/re-login; brand and source remain under the correct tenant only; unauthorized users cannot see it.

**Acceptance Scenarios**:

1. **Given** an active membership with Brand create + Website connect capabilities, **When** the user creates a brand with a name and submits a valid public HTTPS URL with authorization confirmation, **Then** OMA creates a tenant-scoped Brand Workspace in a connectable state with a primary website source and audit record.
2. **Given** a user without Brand create capability, **When** they attempt to create a brand, **Then** the command is denied without revealing other tenants’ brands.
3. **Given** a URL that resolves to a private/local/metadata target or unsafe redirect chain, **When** connection is attempted, **Then** OMA rejects the source with a clear safe reason and does not start a scan.
4. **Given** an already connected brand, **When** an authorized user changes the primary website, **Then** OMA records the change, requires reconfirmation of authorization, and does not alter approved intelligence versions.

---

### US-BWI-02 — Run safe asynchronous website scan with progress (Priority: P1)

An authorized member starts a scan, watches live progress (queued → crawling → extracting → analyzing), and can cancel or retry according to policy.

**Why this priority**: Evidence and discovery depend on a durable, observable, bounded job.

**Independent Test**: Start scan on a permitted test site; observe progress; cancel or complete; job state survives refresh; duplicate start is idempotent.

**Acceptance Scenarios**:

1. **Given** a brand with a validated website source and Scan control capability, **When** the user starts a scan with confirmation, **Then** OMA enqueues a tenant- and brand-scoped job, shows progress, and records correlation/audit metadata.
2. **Given** a scan is running, **When** the user cancels, **Then** the job reaches Cancelled (or an equivalent safe terminal cancel state), stops further fetch work, and does not claim analysis completed.
3. **Given** a Failed or Partial scan, **When** the user retries, **Then** OMA starts a new attempt linked to the brand without duplicating an identical in-flight job (idempotency).
4. **Given** robots.txt or access policy blocks further crawling, **When** the scanner respects the block, **Then** blocked resources are not marked as successfully analyzed; the user sees the reason.
5. **Given** the actor’s membership is suspended mid-flight, **When** the worker re-checks authorization, **Then** the job fails closed with a permission denial, does not write success, and is auditable.

---

### US-BWI-03 — Review discovered pages, products, and categories (Priority: P1)

An authorized reviewer inspects discovered public pages, products/services, and categories with evidence links, merges duplicates where needed, and marks unknowns.

**Why this priority**: Catalog truth is required before brand intelligence can be trusted.

**Independent Test**: After a completed/partial scan, open discovery review; correct one product name; refresh; correction remains with provenance.

**Acceptance Scenarios**:

1. **Given** a scan produced discoveries, **When** a user with Discovery review opens the catalog, **Then** they see pages/products/services/categories with source URLs and confidence/freshness cues.
2. **Given** duplicate product candidates, **When** the reviewer merges or rejects duplicates, **Then** OMA preserves original observations and records the human decision.
3. **Given** a services-only site with no product SKUs, **When** discovery completes, **Then** services are represented without inventing product commerce fields.
4. **Given** a user from another tenant, **When** they attempt to open discovery by identifier, **Then** access is denied without confirming existence.

---

### US-BWI-04 — Generate and human-review Brand & Product Intelligence Profile (Priority: P1)

When an `AiProviderPort` implementation is configured, the system may propose a Brand & Product Intelligence Profile draft over extracted evidence. When AI is unavailable or not configured, authorized humans build the profile manually from observations and evidence. Humans edit, accept, or reject insights. AI cannot approve the profile or any claim.

**Why this priority**: The approved profile is the feature’s primary product outcome and must not depend on a live AI vendor (`SR-002-007-AI`).

**Independent Test**: With AI unavailable, produce a reviewable draft from observations; edit and approve under FR-BWI-029a; with AI configured (test adapter), reject one `AI_INFERRED` claim; AI cannot self-approve.

**Acceptance Scenarios**:

1. **Given** sufficient extracted evidence and AI configured, **When** analysis completes, **Then** a Draft profile exists distinguishing `OBSERVED`, `AI_INFERRED`, and user dispositions, each with evidence or explicit “needs evidence.”
2. **Given** an AI inference without supporting evidence, **When** shown to the reviewer, **Then** it is labeled `AI_INFERRED` (not `OBSERVED`) and cannot be approved as an observed fact.
3. **Given** Insight decide + Insight edit capabilities, **When** the user accepts, rejects, or edits an insight, **Then** the decision is stored with actor, timestamp, and prior value references; the user cannot reject the entire version with Insight decide alone.
4. **Given** only Brand read capability, **When** the user views the draft, **Then** they cannot mutate, approve, or reject the version.
5. **Given** Version approve capability and a draft meeting FR-BWI-029a (including Partial disclosure when applicable), **When** the user approves with required confirmation, **Then** an immutable Approved version is created and becomes the current approved profile for that brand.
6. **Given** AI is not configured or refuses, **When** the scan has usable observations, **Then** the attempt is `Partial` (or equivalent reviewable outcome), the UI shows AI unavailable clearly, and the user can complete and approve the profile manually without AI.
7. **Given** AI is unavailable and observations are insufficient for a reviewable profile, **When** the attempt ends, **Then** the attempt is `Failed` with an actionable reason (not a silent success).
8. **Given** Version approve capability, **When** the user rejects an entire Profile Version, **Then** the version becomes `Rejected` and Insight decide alone cannot perform this transition.

---

### US-BWI-05 — Rescan, compare versions, and protect approved truth (Priority: P2)

After an approved profile exists, a rescan creates a new draft for comparison; approved content is never silently overwritten.

**Why this priority**: Brands change; freshness must not destroy accountability.

**Independent Test**: Approve v1; rescan; compare draft v2 to approved v1; confirm approved v1 unchanged.

**Acceptance Scenarios**:

1. **Given** an Approved profile, **When** a rescan finishes, **Then** a new Draft version is created for review and the Approved version remains unchanged and addressable.
2. **Given** draft and approved versions, **When** the user opens version comparison, **Then** they can see field-level differences with evidence references.
3. **Given** a late AI job result arrives after a human already edited the same field, **When** the system applies concurrency rules, **Then** the human edit is not silently overwritten; conflict is surfaced for resolution.

---

### US-BWI-06 — Archive brand and handle active work safely (Priority: P3)

An authorized actor archives a brand or requests deletion; active scans cannot leave the brand in an inconsistent secret-success state.

**Why this priority**: Lifecycle hygiene without breaking audit/evidence references needed elsewhere.

**Independent Test**: Start scan; archive brand (or attempt); observe cancel/block policy; archived brand hidden from default lists for unauthorized archive bypass attempts.

**Acceptance Scenarios**:

1. **Given** Brand archive capability and an active scan, **When** archive is requested, **Then** OMA either blocks archive until cancel or cancels the job then archives, with explicit user-visible outcome (policy MUST be consistent and documented in Assumptions until product choice is confirmed — default: **cancel-then-archive**).
2. **Given** an archived brand, **When** a user without archive/restore rights lists brands, **Then** the archived brand is not actionable in default create/scan flows.

## 6. End-to-end journeys

### Journey A — First-time brand intelligence (happy path)

1. Open Brand Workspaces list (empty or existing).
2. Create Brand Workspace.
3. Connect public HTTPS Website + authorization confirmation (no commerce connector).
4. Scan setup (scope summary, limits, robots notice) → start.
5. Live progress through Queued → Crawling → Extracting → Analyzing (Analyzing may no-op with AI unavailable).
6. Needs review: pages → products → brand intelligence with Evidence side panel (manual completion if AI unavailable).
7. Edit/accept/reject individual insights (Insight decide/edit).
8. Approval summary (with incompleteness disclosure if Partial) → explicit confirm → Approve immutable version (Version approve).
9. Refresh/re-login → Approved profile still present with evidence links.

### Journey A2 — AI unavailable, usable observations

Scan extracts reviewable observations → AI unavailable banner → attempt `Partial` → manual profile build from evidence → approve under FR-BWI-029a without AI.

### Journey B — Partial failure and recovery

Scan reaches Partial (limits, page failures, and/or AI unavailable with usable data) or Failed → user reviews succeeded subset and coverage → Retry optional → continue review → approve only when FR-BWI-029a + incompleteness confirmation (for Partial) are satisfied. Cancelled never approves.

### Journey C — Rescan after approval

Approved profile in use → Rescan → new Draft → compare → selectively promote changes via new approval (never silent overwrite).

## 7. Edge-case acceptance scenarios

1. **Structured storefront**: Discoverable product pages and categories appear with prices/availability **as observed at scan time**, each with evidence.
2. **Services site without products**: Services catalog populated; product-SKU fields remain empty/not fabricated.
3. **Arabic or multilingual site**: Detected languages/markets recorded; UI remains EN/AR capable; extracted language tags preserved on evidence.
4. **Large catalog beyond limits**: Scan stops at configured page/depth/time/size limits, status Partial or Failed with clear limit reason, partial discoveries reviewable.
5. **No sitemap**: Crawl uses safe public link discovery within limits; absence of sitemap is noted, not a hard failure by itself.
6. **Duplicate pages/products**: Duplicates detectable; reviewer can merge/reject; originals retained as observations.
7. **Product variants**: Variants link to a parent product concept when evidence supports it; otherwise listed separately without forced hierarchy.
8. **Cross-domain redirect**: If redirect leaves allowed host policy, connection/scan fails closed with reason; no open redirect follow into disallowed targets.
9. **Internal/disallowed network target**: Rejected at validation (SSRF protections).
10. **robots.txt disallow**: Disallowed paths not fetched; not marked analyzed.
11. **Partial page failures**: Overall Partial; failed URLs listed with reasons; successes remain reviewable.
12. **Cancel during crawl**: Transitions to Cancelled; no Approved profile created from cancelled run.
13. **Retry after failure**: New attempt; idempotent with respect to duplicate identical in-flight starts.
14. **Membership suspended mid-job**: Worker re-authz → permission failure → no success side effects.
15. **Capability lost mid-job**: Same as suspended for the required scan capability.
16. **Cross-tenant access attempt**: Denied; no existence leak.
17. **Rescan after approval**: New Draft only; Approved immutable.
18. **Archive with active job**: Cancel-then-archive (default) with audit.
19. **Human edit vs late AI write**: Conflict surfaced; no silent overwrite of human decision.
20. **Claim without evidence**: Cannot be approved as `OBSERVED`/`USER_CONFIRMED` fact material; must remain `AI_INFERRED`/needs-evidence or be rejected.
21. **Low-confidence or source-conflicting result**: Flagged for review; cannot auto-approve.
22. **AI unavailable with usable crawl data**: Clear AI-unavailable state; attempt `Partial`; manual profile path remains; human may approve without AI if FR-BWI-029a holds.
23. **AI unavailable without sufficient observations**: Attempt `Failed`; no fake Approved profile.
24. **Partial approval with disclosure**: Incompleteness banner, failed/unscanned pages, missing required fields, coverage summary, available evidence, explicit incompleteness confirmation, audit of approval + warnings; Approved immutable.
25. **Attempt to approve Cancelled / Failed-insufficient / ineligible / unresolved late results**: Denied.
26. **Late results after approval**: Do not mutate Approved; create/update a new Draft only.
27. **Insight decide rejects entire version**: Denied; requires Version approve.
28. **Commerce/login URL as primary source in 002**: Rejected or refused as out of slice boundary (`SR-002-004-MODE`).

## 8. Functional requirements

### 8.1 Brand Workspace and tenancy

- **FR-BWI-001**: The system MUST create Brand Workspaces only under the authenticated active tenant and MUST NOT introduce a parallel tenant/company registry.
- **FR-BWI-002**: Until `DEC-008` is resolved, the data model and authorization MUST support zero-or-more Brand Workspaces per tenant as an **interim safe boundary** (not a final commercial topology decision). Agency cross-tenant assignment remains out of scope.
- **FR-BWI-003**: Every brand record, source, scan, discovery item, evidence item, insight, and profile version MUST be tenant-scoped and brand-scoped.
- **FR-BWI-004**: Brand list/read/write/search/export/notification paths MUST enforce tenant isolation and capabilities server-side.
- **FR-BWI-005**: Client-supplied tenant or brand identifiers MUST NOT grant access; they may only select among already authorized contexts.

### 8.2 Website connection and safety

- **FR-BWI-006**: Authorized users MUST be able to connect or change a brand’s primary website URL after explicit confirmation that they are authorized to add that website for the company.
- **FR-BWI-006a**: For 002 (`SR-002-004-MODE`), the supported source mode is **public HTTPS URL crawl only**. The system MUST NOT treat commerce APIs, store connectors, or authenticated storefront sessions as sources of truth in this feature. Global `DEC-004` remains open for later features.
- **FR-BWI-007**: The system MUST normalize URLs and validate allowed protocols (**HTTPS required** for 002 production sources; non-HTTPS MUST be rejected).
- **FR-BWI-008**: The system MUST block SSRF classes including localhost, private/link-local networks, cloud metadata endpoints, and local file targets.
- **FR-BWI-009**: The system MUST validate redirect chains against host/safety policy and MUST fail closed on disallowed redirects.
- **FR-BWI-010**: Final mandatory domain-ownership verification (DNS/meta token) is **NOT** required in this specification. If later approved, it MUST be additive and MUST NOT rewrite this feature’s core approval semantics. [Assumption: attestation checkbox + audit is sufficient for first slice.]
- **FR-BWI-011**: Scans MUST respect robots.txt, rate limits, and public-only access; the system MUST NOT bypass login, paywall, or bot-protection challenges.
- **FR-BWI-012**: Crawl MUST enforce bounds on pages, depth, duration, and payload size, and MUST prevent crawl loops.
- **FR-BWI-012a**: 002 MUST NOT select or bind a production crawl vendor in plan/implement until a later authorized decision; connector work uses `WebsiteConnectorPort` with test doubles only at the provider boundary in tests.
- **FR-BWI-013**: Changing a website source MUST NOT mutate Approved intelligence versions.

### 8.3 Scan jobs and observability

- **FR-BWI-014**: Scans MUST run asynchronously with visible states from the state machine in §9.
- **FR-BWI-015**: Users with Scan control MUST be able to start, cancel, and retry scans according to allowed transitions.
- **FR-BWI-016**: Start/retry commands MUST be idempotent such that duplicate submissions do not create duplicate active jobs for the same brand+intent key.
- **FR-BWI-017**: Jobs MUST be isolated by tenant and brand; workers MUST re-resolve membership and required capabilities at execution time and fail closed on denial.
- **FR-BWI-018**: Sensitive actions (connect website, start/cancel/retry scan, accept/reject insight, approve version, reject entire version, archive, incompleteness-acknowledged approval) MUST append immutable audit events with actor, tenant, brand, action, target, timestamp, and correlation identifier.
- **FR-BWI-019**: Progress UI MUST remain accurate after refresh, deep link re-entry, and re-login.

### 8.4 Discovery data (tiered — DP-005)

- **FR-BWI-020**: Discovery fields from public pages are organized into three testable tiers. Absence MUST be `Unknown` (or equivalent), never invented. AI MUST NOT convert `Unknown` into `OBSERVED`/`Fact`. Coverage and gaps MUST be visible in review/approval.
- **FR-BWI-020a `REQUIRED_FOR_APPROVAL`**: Minimum set required for profile approval eligibility (with FR-BWI-029a): brand display identity (name as observed or user-confirmed); at least one primary source URL; at least one evidence-backed observation supporting brand identity **or** catalog presence (page and/or product/service); coverage summary; and explicit listing of missing required items when Partial. Without these, approval MUST be denied.
- **FR-BWI-020b `DISCOVER_WHEN_AVAILABLE`**: Extract when present, else `Unknown`: brand description; industry/categories; products and services list; product pages; product names/descriptions/categories; public SKU/identifiers; price, currency, availability as observed at scan time; attributes/features/benefits; languages and markets; public contact and social channels; sitemap/canonical URLs; JSON-LD/structured data; Open Graph/metadata; About/FAQ/Contact/legal page links; indicators of missing/conflicting/duplicate/low-quality data.
- **FR-BWI-020c `DEFERRED_ADVANCED`**: Backlog for later coherent releases inside or beyond 002 — does **not** block first coherent release: likely audiences and use cases; value propositions; messaging pillars; tone and recurring vocabulary; public image/asset deep metadata beyond link+basic metadata; advanced visual-cue catalogs. These MAY appear as optional `AI_INFERRED` proposals only when AI is configured, still requiring human disposition and never auto-approval.
- **FR-BWI-021**: AI inferences MUST NOT be stored or displayed as if they were directly extracted website facts.
- **FR-BWI-022**: Missing fields MUST be marked unknown/insufficient rather than fabricated.

### 8.5 Evidence and information taxonomy (aligned to Foundation FR-018/FR-019)

- **FR-BWI-023**: Every observation or insight MUST carry, as applicable: source URL; page title; discovery time; extraction type; short evidence excerpt; hash or snapshot identifier; confidence; **Foundation information state** from `{OBSERVED, AI_INFERRED, USER_CONFIRMED, USER_CORRECTED, STALE}`; human review disposition where applicable; freshness cues; and originating scan/profile version identity.
- **FR-BWI-023a**: Product language mapping (non-parallel vocabulary): “Fact” in UX copy maps to `OBSERVED` (and confirmed/corrected derivatives); “Inference” maps to `AI_INFERRED`; “User-entered” maps to user-authored fields that become `USER_CONFIRMED` or `USER_CORRECTED` after save; stale rescans mark superseded observations `STALE` without deleting audit history.
- **FR-BWI-024**: The system MUST NOT retain an unnecessary full website mirror or protected/paywalled content.
- **FR-BWI-025**: Evidence panel access MUST re-authorize tenant/brand/capability on open.

### 8.6 Brand & Product Intelligence Profile

- **FR-BWI-026**: The profile MUST include sections for: brand overview; products and services catalog; languages and markets; approved claims; claims needing evidence; missing information and risks; source evidence references; plus optional sections for audiences/use cases, value propositions, messaging pillars, tone of voice, visual cues, and content opportunities when available (`DISCOVER_WHEN_AVAILABLE` / `DEFERRED_ADVANCED` / AI proposals).
- **FR-BWI-027**: The system MUST distinguish using Foundation states: `OBSERVED`, `AI_INFERRED`, `USER_CONFIRMED`, `USER_CORRECTED`, and `STALE`; plus explicit rejected / needs-review dispositions for items not yet eligible for profile approval.
- **FR-BWI-028**: AI MUST NOT be able to approve a profile version or auto-promote claims to Approved.
- **FR-BWI-028a (`SR-002-007-AI`)**: Until `DEC-007` closes, 002 MUST use only `AiProviderPort`. No AI SDK, API keys, third-party data send, model selection, or assumed region/retention/cost policy in product code. Test adapters are allowed **only in tests** at the provider boundary. Live AI wiring remains behind an explicit Decision Gate. Waiver MUST NOT substitute for closing `DEC-007` before production live AI.
- **FR-BWI-028b**: If AI is not configured or refuses: the UI MUST show a clear AI-unavailable state; when usable scan observations exist, the Scan Attempt MUST be `Partial` (or hand a reviewable draft) and MUST NOT block the entire journey; authorized users MUST be able to build the profile manually from observations and evidence; the attempt MUST be `Failed` only when observations are insufficient to create a reviewable profile; humans MAY approve an eligible profile without any AI output.
- **FR-BWI-029**: Only users with **Version approve** capability MAY approve a Profile Version **or reject/discard an entire Profile Version**. Approval targets an exact draft version identity.
- **FR-BWI-029b**: **Insight decide** MUST allow accept/reject/edit of an individual insight only and MUST NOT authorize whole-version Reject or Approve.
- **FR-BWI-029a**: A draft version is eligible for approval only when **all** of the following hold: (1) no unresolved edit conflicts; (2) no unresolved late-arriving results still applying to this version; (3) `REQUIRED_FOR_APPROVAL` fields (FR-BWI-020a) are present or explicitly user-confirmed with evidence where required; (4) no item classified for approval as an observed/confirmed **fact** lacks required evidence linkage; (5) every remaining `AI_INFERRED` item is either accepted into a human disposition (`USER_CONFIRMED` / `USER_CORRECTED`), explicitly rejected, or explicitly retained as hypothesis **outside** the approved-claims set; (6) if the originating Scan Attempt is `Partial`, the approval UI MUST show an incompleteness banner, failed/unscanned pages, missing required fields, coverage summary, and available evidence sources, and the approver MUST explicitly confirm they understand the profile is incomplete; (7) the approver confirms the approval summary. Rejecting all inferences is allowed; inventing facts to clear the gate is not.
- **FR-BWI-029c**: Approval MUST be denied for Profile Versions tied to a `Cancelled` scan, a `Failed` scan without sufficient reviewable data, a draft that fails FR-BWI-029a, a draft lacking basic evidence for required identity/catalog claims, or a draft still receiving unresolved late results.
- **FR-BWI-029d**: Approving a Partial-origin draft MUST append audit events that include the approval action, incompleteness warnings acknowledged, coverage summary reference, actor, tenant, brand, version id, timestamp, and correlation id.
- **FR-BWI-030**: Approved versions are immutable; post-approval changes require a new draft/version. Late results after approval MUST NOT mutate the Approved version; they MUST create or update a new Draft only.
- **FR-BWI-031**: Rescan MUST create a new draft version for review/compare and MUST NOT replace the approved version.

### 8.7 UX surfaces (functional, not visual system design)

- **FR-BWI-032**: The product MUST provide: Brand Workspaces list; Create Brand Workspace; Connect Website; Scan setup and confirmation; Live progress; Partial failure and Retry; AI-unavailable state; Discovered pages review; Products catalog review; Brand Intelligence review; Evidence side panel; Edit/accept/reject insight; Version comparison; Approval summary with incompleteness banner/coverage when Partial.
- **FR-BWI-033**: Each surface MUST define empty, loading, error, and permission-denied states.
- **FR-BWI-034**: Experiences MUST support English and Arabic, LTR and RTL, desktop/tablet/mobile layouts, keyboard access, and reduced-motion preferences.
- **FR-BWI-035**: Screen archetype for this feature is **Intelligence workspace**. Primary reference behaviors: Semrush for evidence/analysis patterns; Jasper Brand IQ for brand voice/intelligence structuring; Linear for density, progress, side panels, and restrained motion; Planable for collaborative review patterns where multi-actor review appears. OMA MUST use original layout, copy, icons, and tokens — references authorize pattern study only (`DEC-013`).

### 8.8 Downstream readiness (non-implementation of downstream features)

- **FR-BWI-036**: An Approved profile version MUST be uniquely addressable so later competitor, strategy, and content features can reference it without copying divergent brand truth.
- **FR-BWI-037**: This feature MUST NOT implement competitor analysis, strategy, organic/paid plans, calendars, briefs, kanban, creative production, client portal, WorkDrive, Meta/ads, publishing, or billing.

## 9. State machines (composed, not conflated)

Three machines run together. A brand MAY simultaneously hold an **Approved** profile version pointer while a **new Scan Attempt** is `Queued`/`Crawling` and a **new Profile Version** is `Draft` / `Needs review`.

### 9.1 Brand Workspace lifecycle

| State | Meaning |
| ----- | ------- |
| Draft | Brand exists; primary source incomplete or invalid |
| Ready to scan | Primary source validated; eligible to start a scan |
| Active | At least one scan has been attempted; brand is in normal use |
| Archived | Hidden from default active workflows; not eligible for new scans until restored by a future policy |

| From | To | Capability | Notes |
| ---- | -- | ---------- | ----- |
| Draft | Ready to scan | Website connect | Successful source validation |
| Ready to scan | Active | Scan control | First scan start accepted |
| Active | Active | — | Remains Active across rescans/approvals |
| Draft / Ready to scan / Active | Archived | Brand archive | Default: cancel active scan attempt then archive |
| Archived | Ready to scan or Active | Brand archive (restore) | Restore rules may be refined later; must re-validate source if needed |

### 9.2 Scan Attempt lifecycle

| State | Meaning |
| ----- | ------- |
| Queued | Scan accepted; waiting to run |
| Crawling | Fetching permitted public pages |
| Extracting | Normalizing pages/products/signals |
| Analyzing | Producing draft intelligence proposals |
| Partial | Attempt finished with incomplete coverage, page-level failures, **and/or AI unavailable while usable observations exist** |
| Succeeded | Attempt finished enough to hand a draft profile to review |
| Failed | Terminal failure for this attempt |
| Cancelled | User/system cancelled this attempt |

| From | To | Capability | Notes |
| ---- | -- | ---------- | ----- |
| (none) | Queued | Scan control | Start/retry/rescan; idempotent active-intent key |
| Queued | Crawling | system | Worker start after membership/capability re-check |
| Crawling | Extracting | system | |
| Extracting | Analyzing | system | Analyzing may call `AiProviderPort` or skip when unconfigured |
| Analyzing | Succeeded | system | Full enough draft for Needs review (AI optional) |
| Crawling / Extracting / Analyzing | Partial | system | Bounded incomplete success, page failures, **and/or AI unavailable with usable observations** |
| Queued / Crawling / Extracting / Analyzing | Failed | system | Hard failure **or** AI unavailable **and** insufficient observations for a reviewable profile |
| Queued / Crawling / Extracting / Analyzing | Cancelled | Scan control | Cancel; never yields Approved |

Retry/rescan always creates a **new** Scan Attempt identity; it does not rewind a terminal attempt.

**Partial → review:** A `Partial` attempt MAY produce a Profile Version in `Needs review`. Approval from Partial is allowed only under FR-BWI-029a/029c (incompleteness disclosure + confirmation).

### 9.3 Intelligence Profile Version lifecycle

| State | Meaning |
| ----- | ------- |
| Draft | Version being generated or not yet opened for structured review |
| Needs review | Human review/edit/accept/reject in progress |
| Approved | Immutable approved artifact |
| Superseded | Previously approved version replaced as *current* by a newer approval (artifact remains readable) |
| Rejected | Version discarded without approval (optional terminal for abandoned drafts) |

| From | To | Capability | Notes |
| ---- | -- | ---------- | ----- |
| Draft | Needs review | system or Discovery review | After Succeeded/Partial produces a reviewable draft (manual or AI-assisted) |
| Needs review | Needs review | Insight edit/decide | Individual insight decisions only; version remains Needs review |
| Needs review | Approved | Version approve | Only if FR-BWI-029a/029c hold; Partial requires incompleteness UI + explicit confirm + audit |
| Approved | Superseded | Version approve (on newer version) | Prior approved remains immutable and addressable |
| Needs review | Rejected | Version approve **only** | Whole-version discard; Insight decide MUST NOT authorize this transition |

**Current approved pointer:** Brand stores which Approved version is current. Rescan MUST NOT clear that pointer when creating a new Draft.

Invalid transitions MUST be rejected with stable errors and no partial unauthorized mutation.

## 10. Key entities (conceptual — not a schema)

- **Brand Workspace**: Tenant-owned brand container (name, status, primary source).
- **Website Source**: Connected official site URL and validation/attestation metadata.
- **Scan Attempt / Run**: Asynchronous bounded job with progress and terminal outcome.
- **Discovered Page**: Public page candidate with URL/canonical/locale signals.
- **Discovered Product/Service**: Catalog item candidate with observed attributes.
- **Evidence Item**: Traceable excerpt/snapshot reference supporting a fact/insight.
- **Insight / Claim**: Fact, inference, or user-entered statement with review state.
- **Intelligence Profile Version**: Draft or approved brand & product intelligence package.
- **Version Comparison**: Diff view between two profile versions.

## 11. Ownership and source of truth

| Domain | Logical owner | Authoritative writer | Readers | Tenant gate | Notes |
| ------ | ------------- | -------------------- | ------- | ----------- | ----- |
| Brand Workspace | OMA Brand Intelligence | Authorized brand commands | Capable tenant members | Active tenant + capability | No parallel tenancy |
| Website Source config | OMA Brand Intelligence | Website connect commands | Capable members | Tenant + brand | External site remains external |
| Crawl bytes / live website | External website | External origin | Connector adapter (read) | Safety policy | OMA does not own the live site |
| Evidence excerpts/snapshot refs | OMA Brand Intelligence | Scan pipeline | Reviewers | Tenant + brand | Minimize stored content (`DEC-012` retention) |
| Extracted observations | OMA Brand Intelligence | Scan extract phase | Reviewers | Tenant + brand | Immutable observations; corrections are new decisions |
| AI draft insights | OMA Brand Intelligence | AI proposal step via approved provider boundary | Reviewers | Tenant + brand | Proposal only (`DEC-007`) |
| Human decisions | OMA Brand Intelligence | Insight edit/decide/approve commands | Capable members | Tenant + brand | AI cannot approve |
| Approved profile version | OMA Brand Intelligence | Version approve command | Downstream OMA features (later) | Tenant + brand | Immutable SoT for approved brand intelligence |
| Job execution authz | OMA Identity/Membership | Foundation membership/capability services | Workers | Re-check at run | Confused-deputy prevention |

## 12. Security, privacy, retention, and audit

- Enforce Foundation tenant isolation, CSRF/session rules, and capability checks on all commands and reads.
- Apply SSRF, redirect, robots, rate, size, and public-only crawl controls (§8.2–8.3).
- Until `DEC-007` closes, 002 MUST NOT send brand/site data to third-party AI providers. When a future provider is authorized, minimize data sent; never send secrets; redact sensitive values from logs (`DEC-007`, `DEC-012`).
- Retention of evidence excerpts and snapshot identifiers follows future `DEC-012`; until resolved, retain the minimum needed to support review and audit, with deletion/export hooks required before production hardening.
- Audit all sensitive actions (§FR-BWI-018).
- Cross-tenant probes must not leak existence.

## 13. Failure and recovery behavior

- Validation failures are synchronous and non-starting for scans.
- Job failures classify retryable vs terminal where possible; user-visible reasons are actionable and non-secret-leaking.
- Partial success preserves reviewable discoveries and lists failures (including AI-unavailable-with-data).
- Cancel stops further work and never yields Approved.
- AI unavailable with insufficient data → Failed with actionable reason; with sufficient data → Partial + manual path.
- Worker authz failure → fail closed, no mail/success façade, auditable.
- Duplicate start → return existing active job or stable idempotent result.
- Human vs late AI conflict → explicit conflict state, no silent overwrite.
- After process restart, job state remains durable and resumable or safely failed per attempt rules (technical plan later; product requires durability and no false success).

## 14. Non-functional requirements

- **NFR-BWI-001**: Deny by default; server-side tenant/capability on every path including workers.
- **NFR-BWI-002**: Interactive brand list and detail views remain usable while scans run in the background (user may leave and return without losing job identity).
- **NFR-BWI-003**: Progress updates for an active scan are visible to authorized users within a near-real-time window appropriate for long jobs (target: user perceives updates without manual full-page redeploy; exact poll/push mechanism is a plan concern).
- **NFR-BWI-004**: Bounded scan limits MUST be enforceable and visible before start.
- **NFR-BWI-005**: EN/AR, LTR/RTL, keyboard, reduced motion, and responsive layouts are required for all FR-BWI-032 surfaces.
- **NFR-BWI-006**: Empty/loading/error/permission-denied states are mandatory and must not fake success.
- **NFR-BWI-007**: Approval and evidence views MUST remain correct after refresh and re-login.
- **NFR-BWI-008**: Concurrent editors MUST not silently lose human decisions (optimistic concurrency or equivalent product behavior).

## 15. Decision Gates (open — do not resolve here)

| Gate | Decision | Affects this feature | Safe functional boundary until resolved |
| ---- | -------- | -------------------- | --------------------------------------- |
| DG-004 | `DEC-004` (still **open globally**) | Crawl vs commerce vs both | **Slice resolution `SR-002-004-MODE`:** 002 = public HTTPS crawl only. Commerce/API deferred to later features. **No crawl vendor selected.** Live crawl vendor wiring blocked until an authorized vendor decision (not a silent waiver). |
| DG-007 | `DEC-007` (still **open globally**) | Providers/models/retention/region/cost/fallback | **Slice resolution `SR-002-007-AI`:** 002 uses `AiProviderPort` only; no SDK/keys/third-party/model/policy assumption. AI unavailable → Partial (usable data) or Failed (insufficient); manual approve allowed. Live AI wiring blocked until `DEC-007` closes. Test adapters tests-only. |
| DG-003 | `DEC-003` file/object storage | Snapshot byte storage if large artifacts needed | Prefer evidence excerpts + identifiers; full artifact store not required to approve a profile if excerpts suffice |
| DG-008 | `DEC-008` company/agency structure | Cross-company brand management | Interim: Brand Workspace child of one tenant; second brand under same tenant not forbidden; agency cross-tenant staffing out of scope — **does not close DEC-008** |
| DG-009 | `DEC-009` approval topology | Multi-step/client approvals | Single internal Version approve capability for approve/reject version; **does not close DEC-009** |
| DG-012 | `DEC-012` retention/legal | Evidence/snapshot retention periods | Minimum retention for review/audit; market-specific rules deferred |
| — | Email/crawl/hosting/analytics vendors | Ops providers | No vendor selection in this spec |
| — | IMKAN integration | Identity/company sync | Remains outside; Foundation `DEC-002` stands |

**Planning readiness:** `/speckit-plan` **MAY** proceed for public-crawl + manual/optional-AI profile journeys behind ports. `/speckit-plan` and implement **MUST NOT** select crawl/AI vendors or ship live third-party wiring until `DEC-004`/`DEC-007` (as applicable) are closed for those choices. Waiver MUST NOT replace a required live-provider decision.

## 16. Assumptions and dependencies

- Foundation identity, tenant, membership, capability, audit, outbox/jobs patterns, and app shell exist and remain authoritative.
- Users operate inside an already selected active tenant.
- **`SR-002-004-MODE`:** 002 first release is public HTTPS crawl only; commerce connectors are out of scope for 002 and do not satisfy or replace this slice’s SoT.
- **`SR-002-007-AI`:** Live AI is optional for completing 002; `AiProviderPort` may be unconfigured; humans can approve without AI.
- Authorization attestation is a user confirmation + audit, not cryptographic domain control, until a later decision.
- Archive-with-active-job default is cancel-then-archive.
- Downstream strategy/content features will consume Approved profile version identifiers later; they are not built here.
- `DEC-013` reference hierarchy is binding for UX pattern language; no new primary reference products are introduced.
- Company-level intake fields from Foundation **FR-011** may exist elsewhere later; this slice’s primary object is **Brand Workspace**, which may carry brand-specific goals/markets only as needed for intelligence review without claiming full company intake completion.
- `DEC-003`–`DEC-012` remain open globally unless separately resolved; slice resolutions above do not renumber or close them.

## 17. Out of scope

- Full competitor analysis and competitor workspace productization
- Strategy generation and Organic/Paid plans
- Content calendar, briefs, kanban/task distribution
- Image/video generation and creative review rooms
- Client portal, packaging, pricing, billing
- WorkDrive byte sync and file production pipelines
- Meta / paid-media connectors and publishing
- Choosing AI, crawl, storage, email, hosting, analytics, or IMKAN providers
- Commerce API / store connector / login-gated catalog as 002 source of truth
- Live AI or live crawl vendor production wiring before `DEC-007` / vendor authorization
- Final mandatory domain verification protocol
- Agency multi-tenant brand staffing (`DEC-008`)

## 18. Success criteria

- **SC-BWI-001**: An authorized user can go from empty brand list to an Approved Brand & Product Intelligence Profile for a permitted **public HTTPS** website without leaving the OMA product shell, **including when AI is unavailable**, using observations and evidence alone.
- **SC-BWI-002**: 100% of claims included in the Approved version’s approved-claims set are either `USER_CONFIRMED` / `USER_CORRECTED` / confirmed `OBSERVED` with openable evidence, or explicitly listed as retained hypotheses outside approved claims; unsupported `AI_INFERRED` text cannot enter the approved-claims set; `Unknown` is never approved as Fact.
- **SC-BWI-003**: Cross-tenant access attempts to brand, scan, evidence, and profile resources fail in automated isolation tests.
- **SC-BWI-004**: Mid-flight membership/capability loss fails the job closed with audit and without false success in automated security tests.
- **SC-BWI-005**: After approval, a rescan or late result leaves the Approved version unchanged and produces a distinct Draft for comparison in acceptance tests.
- **SC-BWI-006**: Primary journeys work in EN and AR (RTL/LTR), on desktop and mobile widths, via keyboard for critical actions, with non-success empty/error/permission states verified.
- **SC-BWI-007**: Duplicate scan starts do not create two active jobs for the same idempotency intent in tests.
- **SC-BWI-008**: Partial scans expose reviewable successes, failed/unscanned pages, and coverage; Partial approval requires incompleteness banner + explicit confirmation + audit; Cancelled and Failed-insufficient never yield Approved.
- **SC-BWI-009**: Insight decide cannot reject an entire Profile Version; Version approve can.
- **SC-BWI-010**: No commerce connector path exists in 002 acceptance suite; public-crawl + port test doubles suffice for gated plan/implement proofs.

## 19. Traceability

| Outcome / journey | Requirements | Stories | Gates |
| ----------------- | ------------ | ------- | ----- |
| Create brand + connect site | FR-BWI-001–013, 018 | US-BWI-01 | `SR-002-004-MODE`; DEC-004 open globally; DEC-008 interim |
| Scan progress/cancel/retry | FR-BWI-014–019, NFR-BWI-002–004 | US-BWI-02 | Jobs foundation; public crawl port |
| Discovery review | FR-BWI-020–020c, 021–025 | US-BWI-03 | Tiered discovery DP-005 |
| AI draft + human decide | FR-BWI-023–028b | US-BWI-04 | `SR-002-007-AI`; DEC-007 open globally |
| Approve / reject version | FR-BWI-029–031, 029a–029d, 036 | US-BWI-04/05 | DP-003/004; DEC-009 interim |
| Rescan/compare / late results | FR-BWI-030–031, §9.2–9.3 | US-BWI-05 | — |
| Archive | §9.1 + US-BWI-06 | US-BWI-06 | DEC-012 |
| UX/a11y/i18n | FR-BWI-032–035, NFR-BWI-005–006 | All | DEC-013 |
| Security isolation | FR-BWI-003–005, 008–009, 017, NFR-BWI-001 | Edge cases 14–16, 28 | Foundation |
| Deferred Foundation FRs | — | — | FR-011, FR-022–023, FR-025 not claimed complete |

## 20. Spec Kit stage boundary

Clarifications: **`CLARIFY_APPLY_ONLY`** for DP-001–DP-005 (session 2026-08-26).

Planning: **`PLAN_ONLY`** artifacts — `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` — plan status **`APPROVED FOR TASK DECOMPOSITION`**.

Tasks: **`TASKS_ONLY`** — `tasks.md` defines provider-neutral implementation work plus blocked Phase BG. No product code, dependencies, migrations, or UI in that stage.

**`PLAN_READINESS`:** `READY_WITH_EXPLICIT_GATES` (tasks drafted; live crawl vendor and live AI wiring remain blocked until `DEC-004`/`DEC-007` close for those choices). No waiver substitutes for required live-provider decisions.

Allowed next step after task review: `/speckit-implement` (not started).
