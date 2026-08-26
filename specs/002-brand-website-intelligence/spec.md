# Feature Specification: Brand Website Intelligence

**Feature Branch**: `002-brand-website-intelligence`  
**Created**: 2026-08-26  
**Status**: `SPECIFY_ONLY` — Definition ready for clarify/plan only after named Decision Gates  
**Input**: First product feature after OMA AI Product Foundation — Brand Workspace, website connection, safe async scan, discovery, evidence-backed Brand & Product Intelligence Profile with human approval  
**Parent baseline**: `specs/001-oma-ai-product-foundation/spec.md` — productizes Foundation **US-001** intent as a **Brand Workspace** child of the existing tenant/company (not a parallel company registry).  
**Foundation FR binding (honest subset)**: primarily **FR-012–FR-021** and **FR-024** (sources, safe ingest, observable jobs, extraction, evidence, human correct/accept/reject, refresh without silent overwrite of confirmed rules, insufficient-evidence handling).  
**Explicitly deferred from this slice**: **FR-011** (full company intake profile), **FR-022–FR-023** (competitors), **FR-025** (export/remove source data under full retention/legal policy — hooks only until `DEC-012`).  
**Design references (DEC-013 only)**: Semrush (website/evidence analysis), Jasper Brand IQ (brand intelligence/voice), Linear (density, progress, side panels, restrained motion), Planable (collaboration/review where needed)

---

## 1. Problem statement

Marketing and content teams under a company tenant need a trustworthy, company-scoped understanding of their own brand and product catalog before strategy, organic/paid plans, or content production. Today that understanding is scattered across websites, tribal knowledge, and unverified AI summaries. Without a durable Brand Workspace, evidence chain, and human-approved intelligence version, downstream OMA work cannot prove why recommendations exist and risks inventing products, claims, or brand rules.

## 2. Product outcome

An authorized tenant member can create a Brand Workspace, connect the brand’s official public website, run a safe asynchronous scan, review discovered pages and products with traceable evidence, refine AI-proposed Brand & Product Intelligence as a draft, and approve an immutable profile version.

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
| Insight decide | Accept or reject an individual insight/claim |
| Version approve | Approve an immutable Brand & Product Intelligence Profile version |
| Brand read | View brand workspace, scan progress, evidence, and approved/draft profiles without mutation |
| Brand archive | Archive a brand or request deletion subject to policy |

Membership suspension or capability loss must deny subsequent commands and must cause in-flight workers to re-check and fail closed (see Security and State machine).

## 4. Brand Workspace model (product rules)

- Every Brand Workspace belongs to **exactly one** Foundation tenant/company. No parallel tenancy system may be introduced.
- Brand Workspace is a **child domain under one Foundation tenant**. Whether a customer may operate several brands (or companies) long-term remains governed by open **`DEC-008`**. Until `DEC-008` closes, this slice uses a **safe interim boundary**: the product model MUST NOT forbid a second Brand Workspace under the same tenant, and MUST NOT implement agency cross-tenant brand staffing.
- Each Brand has: display name, lifecycle status, primary website source, connected sources, evidence set, scan attempts, and intelligence profile versions (with a pointer to the current approved version when one exists).
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

The system proposes a Brand & Product Intelligence Profile draft using AI over extracted evidence. Humans edit, accept, or reject insights. AI cannot approve the profile.

**Why this priority**: The approved profile is the feature’s primary product outcome.

**Independent Test**: Produce draft profile with provenance; reject one AI claim; accept another; approve version; AI cannot self-approve.

**Acceptance Scenarios**:

1. **Given** sufficient extracted evidence, **When** analysis completes, **Then** a Draft profile exists distinguishing extracted facts, AI inferences, and user-entered/edited fields, each with evidence or explicit “needs evidence.”
2. **Given** an AI inference without supporting evidence, **When** shown to the reviewer, **Then** it is labeled `AI_INFERRED` (not `OBSERVED`) and cannot be approved as an observed fact.
3. **Given** Insight decide + Insight edit capabilities, **When** the user accepts, rejects, or edits an insight, **Then** the decision is stored with actor, timestamp, and prior value references.
4. **Given** only Brand read capability, **When** the user views the draft, **Then** they cannot mutate or approve it.
5. **Given** Version approve capability and a coherent draft, **When** the user approves, **Then** an immutable Approved version is created and becomes the current approved profile for that brand.

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
3. Connect Website + authorization confirmation.
4. Scan setup (scope summary, limits, robots notice) → start.
5. Live progress through Queued → Crawling → Extracting → Analyzing.
6. Needs review: pages → products → brand intelligence with Evidence side panel.
7. Edit/accept/reject insights.
8. Approval summary → Approve immutable version.
9. Refresh/re-login → Approved profile still present with evidence links.

### Journey B — Partial failure and recovery

Scan reaches Partial/Failed → user reviews succeeded subset → Retry remaining or full retry → continue review → approve only when evidence and claims policy are satisfied.

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

## 8. Functional requirements

### 8.1 Brand Workspace and tenancy

- **FR-BWI-001**: The system MUST create Brand Workspaces only under the authenticated active tenant and MUST NOT introduce a parallel tenant/company registry.
- **FR-BWI-002**: Until `DEC-008` is resolved, the data model and authorization MUST support zero-or-more Brand Workspaces per tenant as an **interim safe boundary** (not a final commercial topology decision). Agency cross-tenant assignment remains out of scope.
- **FR-BWI-003**: Every brand record, source, scan, discovery item, evidence item, insight, and profile version MUST be tenant-scoped and brand-scoped.
- **FR-BWI-004**: Brand list/read/write/search/export/notification paths MUST enforce tenant isolation and capabilities server-side.
- **FR-BWI-005**: Client-supplied tenant or brand identifiers MUST NOT grant access; they may only select among already authorized contexts.

### 8.2 Website connection and safety

- **FR-BWI-006**: Authorized users MUST be able to connect or change a brand’s primary website URL after explicit confirmation that they are authorized to add that website for the company.
- **FR-BWI-007**: The system MUST normalize URLs and validate allowed protocols (HTTPS required for production sources; non-HTTPS MUST be rejected unless a later security decision explicitly allows a controlled exception).
- **FR-BWI-008**: The system MUST block SSRF classes including localhost, private/link-local networks, cloud metadata endpoints, and local file targets.
- **FR-BWI-009**: The system MUST validate redirect chains against host/safety policy and MUST fail closed on disallowed redirects.
- **FR-BWI-010**: Final mandatory domain-ownership verification (DNS/meta token) is **NOT** required in this specification. If later approved, it MUST be additive and MUST NOT rewrite this feature’s core approval semantics. [Assumption: attestation checkbox + audit is sufficient for first slice.]
- **FR-BWI-011**: Scans MUST respect robots.txt, rate limits, and public-only access; the system MUST NOT bypass login, paywall, or bot-protection challenges.
- **FR-BWI-012**: Crawl MUST enforce bounds on pages, depth, duration, and payload size, and MUST prevent crawl loops.
- **FR-BWI-013**: Changing a website source MUST NOT mutate Approved intelligence versions.

### 8.3 Scan jobs and observability

- **FR-BWI-014**: Scans MUST run asynchronously with visible states from the state machine in §9.
- **FR-BWI-015**: Users with Scan control MUST be able to start, cancel, and retry scans according to allowed transitions.
- **FR-BWI-016**: Start/retry commands MUST be idempotent such that duplicate submissions do not create duplicate active jobs for the same brand+intent key.
- **FR-BWI-017**: Jobs MUST be isolated by tenant and brand; workers MUST re-resolve membership and required capabilities at execution time and fail closed on denial.
- **FR-BWI-018**: Sensitive actions (connect website, start/cancel/retry scan, accept/reject insight, approve version, archive) MUST append immutable audit events with actor, tenant, brand, action, target, timestamp, and correlation identifier.
- **FR-BWI-019**: Progress UI MUST remain accurate after refresh, deep link re-entry, and re-login.

### 8.4 Discovery data

- **FR-BWI-020**: When publicly available and in-scope, the system MUST attempt to discover and normalize: brand name and description; industry/categories; products and services; product pages; product names/descriptions/categories; public SKU/identifiers; price, currency, and availability as observed at scan time; attributes, features, and benefits; likely audiences and use cases; value propositions; messaging pillars; tone and recurring vocabulary; languages and markets; public contact and social channels; sitemap and canonical URLs; JSON-LD/structured data; Open Graph/metadata; public image/asset links with metadata only; About/FAQ/Contact/legal pages; and indicators of missing, conflicting, duplicate, or low-quality data.
- **FR-BWI-021**: AI inferences MUST NOT be stored or displayed as if they were directly extracted website facts.
- **FR-BWI-022**: Missing fields MUST be marked unknown/insufficient rather than fabricated.

### 8.5 Evidence and information taxonomy (aligned to Foundation FR-018/FR-019)

- **FR-BWI-023**: Every observation or insight MUST carry, as applicable: source URL; page title; discovery time; extraction type; short evidence excerpt; hash or snapshot identifier; confidence; **Foundation information state** from `{OBSERVED, AI_INFERRED, USER_CONFIRMED, USER_CORRECTED, STALE}`; human review disposition where applicable; freshness cues; and originating scan/profile version identity.
- **FR-BWI-023a**: Product language mapping (non-parallel vocabulary): “Fact” in UX copy maps to `OBSERVED` (and confirmed/corrected derivatives); “Inference” maps to `AI_INFERRED`; “User-entered” maps to user-authored fields that become `USER_CONFIRMED` or `USER_CORRECTED` after save; stale rescans mark superseded observations `STALE` without deleting audit history.
- **FR-BWI-024**: The system MUST NOT retain an unnecessary full website mirror or protected/paywalled content.
- **FR-BWI-025**: Evidence panel access MUST re-authorize tenant/brand/capability on open.

### 8.6 Brand & Product Intelligence Profile

- **FR-BWI-026**: The profile MUST include: brand overview; products and services catalog; audiences and use cases; value propositions; messaging pillars; tone of voice; approved claims; claims needing evidence; discovered visual cues described without copying third-party design systems; languages and markets; initial content opportunities; missing information and risks; and source evidence references.
- **FR-BWI-027**: The system MUST distinguish using Foundation states: `OBSERVED`, `AI_INFERRED`, `USER_CONFIRMED`, `USER_CORRECTED`, and `STALE`; plus explicit rejected / needs-review dispositions for items not yet eligible for profile approval.
- **FR-BWI-028**: AI MUST NOT be able to approve a profile version or auto-promote claims to Approved.
- **FR-BWI-029**: Only users with Version approve capability MAY approve a version; approval targets an exact draft version identity.
- **FR-BWI-029a**: A draft version is eligible for approval only when **all** of the following hold: (1) no unresolved edit conflicts; (2) no item classified for approval as an observed/confirmed **fact** lacks required evidence linkage; (3) every remaining `AI_INFERRED` item is either accepted into a human disposition (`USER_CONFIRMED` / `USER_CORRECTED`), explicitly rejected, or explicitly retained as hypothesis **outside** the approved-claims set; (4) the approver confirms the approval summary. Rejecting all inferences is allowed; inventing facts to clear the gate is not.
- **FR-BWI-030**: Approved versions are immutable; post-approval changes require a new draft/version.
- **FR-BWI-031**: Rescan MUST create a new draft version for review/compare and MUST NOT replace the approved version.

### 8.7 UX surfaces (functional, not visual system design)

- **FR-BWI-032**: The product MUST provide: Brand Workspaces list; Create Brand Workspace; Connect Website; Scan setup and confirmation; Live progress; Partial failure and Retry; Discovered pages review; Products catalog review; Brand Intelligence review; Evidence side panel; Edit/accept/reject insight; Version comparison; Approval summary.
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
| Partial | Attempt finished with incomplete coverage or page-level failures |
| Succeeded | Attempt finished enough to hand a draft profile to review |
| Failed | Terminal failure for this attempt |
| Cancelled | User/system cancelled this attempt |

| From | To | Capability | Notes |
| ---- | -- | ---------- | ----- |
| (none) | Queued | Scan control | Start/retry/rescan; idempotent active-intent key |
| Queued | Crawling | system | Worker start after membership/capability re-check |
| Crawling | Extracting | system | |
| Extracting | Analyzing | system | |
| Analyzing | Succeeded | system | Draft profile version ready for Needs review |
| Crawling / Extracting / Analyzing | Partial | system | Bounded incomplete success; reviewable subset |
| Queued / Crawling / Extracting / Analyzing | Failed | system | Hard failure |
| Queued / Crawling / Extracting / Analyzing | Cancelled | Scan control | Cancel |

Retry/rescan always creates a **new** Scan Attempt identity; it does not rewind a terminal attempt.

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
| Draft | Needs review | system or Discovery review | After Succeeded/Partial analysis produces a reviewable draft |
| Needs review | Needs review | Insight edit/decide | Field decisions; version remains Needs review |
| Needs review | Approved | Version approve | Only if FR-BWI-029a eligibility holds; targets exact version id |
| Approved | Superseded | Version approve (on newer version) | Prior approved remains immutable and addressable |
| Needs review | Rejected | Version approve or Insight decide (policy) | Explicit discard; does not delete evidence observations |

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
- Minimize data sent to AI providers; do not send secrets; redact sensitive values from logs (`DEC-007`, `DEC-012`).
- Retention of evidence excerpts and snapshot identifiers follows future `DEC-012`; until resolved, retain the minimum needed to support review and audit, with deletion/export hooks required before production hardening.
- Audit all sensitive actions (§FR-BWI-018).
- Cross-tenant probes must not leak existence.

## 13. Failure and recovery behavior

- Validation failures are synchronous and non-starting for scans.
- Job failures classify retryable vs terminal where possible; user-visible reasons are actionable and non-secret-leaking.
- Partial success preserves reviewable discoveries and lists failures.
- Cancel stops further work and never yields Approved.
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
| DG-004 | `DEC-004` website connection mode | Crawl vs commerce connector, auth for catalogs | Specify **public-website intelligence** only; commerce/API connector behaviors remain deferred stubs/non-goals |
| DG-007 | `DEC-007` AI providers/policy | Who may process site/brand data, retention, cost | AI is a replaceable proposal step behind a provider boundary; no vendor selected; offline/unavailable AI ⇒ Partial/Failed with clear reason, manual profile editing still possible |
| DG-003 | `DEC-003` file/object storage | Snapshot byte storage if large artifacts needed | Prefer evidence excerpts + identifiers; full artifact store not required to approve a profile if excerpts suffice |
| DG-008 | `DEC-008` company/agency structure | Cross-company brand management | Interim: Brand Workspace child of one tenant; second brand under same tenant not forbidden; agency cross-tenant staffing out of scope — **does not close DEC-008** |
| DG-009 | `DEC-009` approval topology | Multi-step/client approvals | Single internal capability-holder approval of exact version is sufficient for this slice |
| DG-012 | `DEC-012` retention/legal | Evidence/snapshot retention periods | Minimum retention for review/audit; market-specific rules deferred |
| — | Email/crawl/hosting/analytics vendors | Ops providers | No vendor selection in this spec |
| — | IMKAN integration | Identity/company sync | Remains outside; Foundation `DEC-002` stands |

**Planning gate:** `/speckit-plan` for implementation architecture of crawl/AI adapters is **blocked** on at least `DEC-004` and `DEC-007` for production connector choices. Product definition of public-site + human-approved profile may proceed to clarify; implementation authorization requires those gates or an explicit user waiver naming the temporary test doubles permitted.

## 16. Assumptions and dependencies

- Foundation identity, tenant, membership, capability, audit, outbox/jobs patterns, and app shell exist and remain authoritative.
- Users operate inside an already selected active tenant.
- First slice focuses on **public official website** evidence (aligned with user safety requirements); commerce connectors are not required to satisfy the primary outcome.
- Authorization attestation is a user confirmation + audit, not cryptographic domain control, until a later decision.
- Archive-with-active-job default is cancel-then-archive.
- Downstream strategy/content features will consume Approved profile version identifiers later; they are not built here.
- `DEC-013` reference hierarchy is binding for UX pattern language; no new primary reference products are introduced.
- Company-level intake fields from Foundation **FR-011** may exist elsewhere later; this slice’s primary object is **Brand Workspace**, which may carry brand-specific goals/markets only as needed for intelligence review without claiming full company intake completion.

## 17. Out of scope

- Full competitor analysis and competitor workspace productization
- Strategy generation and Organic/Paid plans
- Content calendar, briefs, kanban/task distribution
- Image/video generation and creative review rooms
- Client portal, packaging, pricing, billing
- WorkDrive byte sync and file production pipelines
- Meta / paid-media connectors and publishing
- Choosing AI, crawl, storage, email, hosting, analytics, or IMKAN providers
- Final mandatory domain verification protocol
- Agency multi-tenant brand staffing (`DEC-008`)

## 18. Success criteria

- **SC-BWI-001**: An authorized user can go from empty brand list to an Approved Brand & Product Intelligence Profile for a permitted public website without leaving the OMA product shell.
- **SC-BWI-002**: 100% of claims included in the Approved version’s approved-claims set are either `USER_CONFIRMED` / `USER_CORRECTED` / confirmed `OBSERVED` with openable evidence, or explicitly listed as retained hypotheses outside approved claims; unsupported `AI_INFERRED` text cannot enter the approved-claims set.
- **SC-BWI-003**: Cross-tenant access attempts to brand, scan, evidence, and profile resources fail in automated isolation tests.
- **SC-BWI-004**: Mid-flight membership/capability loss fails the job closed with audit and without false success in automated security tests.
- **SC-BWI-005**: After approval, a rescan leaves the Approved version unchanged and produces a distinct Draft for comparison in acceptance tests.
- **SC-BWI-006**: Primary journeys work in EN and AR (RTL/LTR), on desktop and mobile widths, via keyboard for critical actions, with non-success empty/error/permission states verified.
- **SC-BWI-007**: Duplicate scan starts do not create two active jobs for the same idempotency intent in tests.
- **SC-BWI-008**: Partial scans expose both reviewable successes and actionable failures; cancelled scans never yield Approved.

## 19. Traceability

| Outcome / journey | Requirements | Stories | Gates |
| ----------------- | ------------ | ------- | ----- |
| Create brand + connect site | FR-BWI-001–013, 018 | US-BWI-01 | DEC-004 (mode), DEC-008 interim, safety NFRs |
| Scan progress/cancel/retry | FR-BWI-014–019, NFR-BWI-002–004 | US-BWI-02 | Jobs foundation |
| Discovery review | FR-BWI-020–025 | US-BWI-03 | DEC-004; Foundation FR-012–021 subset |
| AI draft + human decide | FR-BWI-023–029a | US-BWI-04 | DEC-007; Foundation FR-019 taxonomy |
| Approve immutable version | FR-BWI-029–031, 036 | US-BWI-04/05 | DEC-009 (simple) |
| Rescan/compare | FR-BWI-031, §9.2–9.3 | US-BWI-05 | — |
| Archive | §9.1 + US-BWI-06 | US-BWI-06 | DEC-012 |
| UX/a11y/i18n | FR-BWI-032–035, NFR-BWI-005–006 | All | DEC-013 |
| Security isolation | FR-BWI-003–005, 008–009, 017, NFR-BWI-001 | Edge cases 14–16 | Foundation |
| Deferred Foundation FRs | — | — | FR-011, FR-022–023, FR-025 not claimed complete |

## 20. Spec Kit stage boundary

This artifact completes **`SPECIFY_ONLY`**.

Allowed next steps: `/speckit-clarify` (if needed), then `/speckit-plan` only when Decision Gates for the affected adapters are closed or explicitly waived.

Not created by this stage: `plan.md`, `research.md`, `data-model.md`, `contracts/`, `tasks.md`, product code, dependencies, migrations, or UI implementation.
