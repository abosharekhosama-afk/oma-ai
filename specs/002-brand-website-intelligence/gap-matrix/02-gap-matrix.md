# Reference-to-OMA Gap Matrix — Feature 002

Compares the reference evidence baseline in [`../reference/`](../reference/) against the application
as it actually runs at `1a7453c`, the spec, the plan, the tasks, the code, the database, the API and
the test suite.

This phase resolves nothing. It classifies, evidences and orders. No product code, UI, API, schema or
test was changed to produce it.

## How to read a classification

| Classification | Meaning |
| --- | --- |
| `MATCH` | OMA already satisfies the requirement, proven at runtime. |
| `PARTIAL` | Real behaviour exists but is incomplete against the spec or its reference authority. |
| `MISSING` | No surface or behaviour exists. |
| `WRONG_EXISTING_IMPLEMENTATION` | Something exists and behaves incorrectly. |
| `RECONNECT` | The capability exists in the backend but nothing in the product reaches it. |
| `REBUILD` | Existing work must be replaced rather than extended. |
| `REMOVE` | Existing work should be deleted. |
| `INTENTIONAL_DIFFERENCE` | OMA deliberately diverges from a reference pattern; the reference is an anti-pattern here. |
| `REFERENCE_LIMITED` | The reference baseline cannot inform this; OMA's spec is the only authority. |
| `NOT_APPLICABLE` | Out of scope for Feature 002. |

## Reference authority applied

Each reference constrains only its `DEC-013` domain. A behaviour observed in a reference outside its
domain is **not** an OMA requirement, and nothing below treats it as one.

- **Semrush** — website intelligence, evidence, coverage and comparison presentation.
- **Jasper Brand IQ** — brand profile and knowledge organisation. `DOC_VERIFIED` at best, never live.
- **Linear** — shell, density, navigation, panels, motion.
- **Planable** — review, decision, approval and collaboration clarity.

Where OMA's spec governs and no reference applies, the row is marked `REFERENCE_LIMITED` and the FR
is the sole authority.

---

## A. Product entry and tenancy — the blocking cluster

This cluster is why a signed-in user saw nothing. It sits at the Foundation boundary, not inside
Feature 002's domain, but it blocks every Feature 002 journey.

### `G-001` — No way for a user to obtain a company

| Field | Value |
| --- | --- |
| Reference | None. No in-scope reference was inspected for account provisioning; Planable's workspace-creation wizard was observed (`EV-PLA-001`, surface `PLA-005`) but workspace ≠ tenant, and `07-reference-pattern-matrix.md` J12 explicitly forbids reading tenancy from it. |
| Reference authority | `REFERENCE_LIMITED` |
| OMA surface / action | `OMA-S09` create company, `OMA-A05` |
| Spec | **No FR covers this.** Foundation 001 `FR-006` covers invited/active/suspended membership behaviour but never states how a first company comes into being or how a self-registered user obtains one. Feature 002 assumes a company already exists. |
| Existing task | None |
| Files | `apps/api/src/tenant/tenant.controller.ts:11`, `apps/api/src/identity/identity.service.ts:52-78`, `apps/web/src/components/shell/empty-membership.tsx` |
| Current behaviour | Registration creates a `User` only. A fresh account has zero memberships and the shell reads `You have no active company membership.` — a permanent dead end. `POST /api/v1/tenants` works (`201`, `RT-11`) but no web surface calls it. |
| Expected behaviour | Undecidable without a decision. Self-serve company creation and invitation-only provisioning are different security and tenancy postures. |
| Classification | **`RECONNECT`** — gated on a decision, not directly implementable. `POST /api/v1/tenants` already returns `201` (`RT-11`); no web surface calls it. |
| Tenant impact | Defines who may create a tenancy boundary. Maximum. |
| Capability impact | Determines whether a bare authenticated user holds a company-creating capability. |
| State machine | Introduces an account state between registered and member. |
| API / DB | `POST /tenants` already exists; policy, not schema, is missing. |
| UI | A create-company or accept-invitation surface, plus a real no-membership state. |
| EN/AR/RTL | Both locales, new keys required. |
| Responsive / a11y | Standard form requirements. |
| Required correction | **Close the decision first.** Then specify in Foundation 001, then implement. |
| Required tests | E2E: register → obtain a company → reach `/app/brands` with no API shortcut. Security: a user may not create or join a company they were not authorized to. |
| Acceptance evidence | A newly registered account reaching a usable brand list through clicks only. |
| Dependency | Blocks `G-002`, and blocks any honest claim that Feature 002 is usable by a new user. |
| Decision gate | **`DEC-015` (proposed, open):** how does a company come into existence, and who may create or join one — self-serve at registration, Platform-Owner provisioning, invitation-only, or a combination? Touches identity and tenant authority, so `AGENTS.md` forbids planning past it. |
| Order | 1 |
| Parallel | No |

### `G-002` — Registration ends in a dead end

| Field | Value |
| --- | --- |
| Reference | `REFERENCE_LIMITED` |
| OMA surface / action | `OMA-S03`, `OMA-S08`, `OMA-A01` |
| Spec | No FR; same gap as `G-001` |
| Files | `apps/web/src/app/(auth)/register/page.tsx:26-30`, `apps/web/src/components/shell/empty-membership.tsx` |
| Current behaviour | Register succeeds, logs in, redirects to `/app`, and the user can do nothing (`RT-10`). The no-membership message offers no action and no explanation of what to do next. |
| Expected behaviour | Per `FR-BWI-033`'s principle that an empty state must be actionable, and Linear L11 (`EV-LIN-006`) where every empty state names what is missing and offers the next action, this state must tell the user what to do. The action itself depends on `DEC-015`. |
| Classification | **`WRONG_EXISTING_IMPLEMENTATION`** |
| Reference authority | Linear, shell and empty-state domain — in domain |
| Required correction | Make the no-membership state explain the situation and offer the authorized next step. |
| Required tests | E2E: a zero-membership user sees actionable guidance, not a bare sentence. |
| Dependency | `G-001` / `DEC-015` |
| Order | 2 |
| Parallel | No |

### `G-003` — Company selector is unusable at scale

| Field | Value |
| --- | --- |
| Reference | Linear L2 (`EV-LIN-001`) — navigation grouped by scope so scope is legible from navigation itself. Linear L7 (`EV-LIN-002`) — per-option counts before applying. |
| Reference authority | Linear, navigation and density — in domain |
| OMA surface / action | `OMA-S06`, `OMA-A04` |
| Spec | `FR-BWI-002`, Foundation `FR-002` (server-resolved tenant authority — already satisfied) |
| Existing task | Phase VP item VP15 claims `TENANT_REQUIRED` renders as guidance and login activates a sole tenant. Both are true. Neither addresses selection at scale. |
| Files | `apps/web/src/components/shell/tenant-switcher.tsx:33-70` |
| Current behaviour | A flat `<select>` listing every membership, sorted by name. Observed at **219 options**, of which ~160 read `Brand Tenant` and ~37 read `E2E Brand Co` (`RT-07`, `RT-08`). No search, no grouping, no recency, no disambiguation. Selecting one works correctly (`RT-13`). |
| Expected behaviour | A user must be able to find their company. Linear's authority covers exactly this: legible scope and filterable selection. |
| Classification | **`PARTIAL`** |
| Tenant impact | None — authority stays server-resolved. Presentation only. |
| Required correction | Searchable, disambiguated company selection that degrades gracefully at high membership counts. |
| Required tests | E2E: a user with many memberships finds a named company. |
| Acceptance evidence | Company found by typing, not by scrolling 219 rows. |
| Dependency | Independent |
| Order | 6 |
| Parallel | Yes |

### `G-004` — Active company is not remembered across sessions

| Field | Value |
| --- | --- |
| Reference | `REFERENCE_LIMITED` — no in-scope reference demonstrates cross-session workspace persistence. |
| OMA surface / action | `OMA-A04` |
| Spec | No FR states whether the last company should persist. |
| Files | `apps/api/src/identity/identity.service.ts:107-127` |
| Current behaviour | `activeTenantId` lives on the `Session`, so it is `null` on every new login unless the user has exactly one membership. A multi-company user reselects every time (`RT-06`). |
| Expected behaviour | Undetermined. Remembering a last-used company is a convenience with a real security question attached, since it changes what a fresh session can read by default. |
| Classification | **`PARTIAL`**, spec clarification required before implementation |
| Tenant impact | Changes the default read scope of a new session. |
| Required correction | Decide and specify, then implement. Do not implement silently. |
| Dependency | Should be answered together with `DEC-015` |
| Order | 7 |
| Parallel | No |

### `G-005` — Dev and demo data hygiene

| Field | Value |
| --- | --- |
| Reference | `NOT_APPLICABLE` |
| OMA surface / action | Environment, not product |
| Files | `tests/e2e/helpers/brand-api.ts:31-47`, `packages/db/prisma/seed-demo.ts` |
| Current behaviour | Every E2E run creates a tenant owned by the shared bootstrap platform owner and never removes it. The development database holds 3195 tenants and 216 owner memberships (`RT-04`, `RT-07`), which is what buried the seeded demo company. |
| Expected behaviour | Test residue must not accumulate on the account a human uses to view the product. |
| Classification | **`PARTIAL`** |
| Required correction | Isolate E2E ownership from the human demo account, or clean up per run. `artifacts/prune-e2e-memberships.ts` and `artifacts/reset-demo.ts` already exist and are not wired into the E2E lifecycle. |
| Required tests | A repeated E2E run must not grow the demo account's membership count. |
| Dependency | Independent |
| Order | 5 |
| Parallel | Yes |

---

## B. Website scan configuration — Semrush authority

### `G-006` — Crawl limits are disclosed; crawl scope is not configurable

| Field | Value |
| --- | --- |
| Reference | Semrush S2 crawl scope as an explicit decision (`EV-SEM-002`); S3 per-attempt limit and cumulative budget as two visible numbers (`EV-SEM-002`, `EV-SEM-004`); S8 include/exclude and parameter rules with stated matching semantics (`EV-SEM-002`); S7 politeness and robots handling (`EV-SEM-002`). |
| Reference authority | Semrush, crawl configuration — squarely in domain |
| OMA surface / action | `OMA-S15`, `OMA-A09` |
| Spec | `NFR-BWI-004` requires limits visible **before** start. `FR-BWI-011` makes robots non-optional, so S7's toggle is deliberately not adopted. |
| Files | `apps/web/src/app/(app)/app/brands/[brandId]/scans/new/page.tsx` |
| Current behaviour | The surface renders a `Crawl bounds` block with concrete values — `Maximum pages 50`, `Maximum depth 3`, `Maximum duration 600 seconds` — followed by the acknowledgement `I understand these crawl limits.`, then `Start scan` and `Cancel` (`RT-25`). It also carries the connector-mode disclosure. Nothing is editable: no crawl scope, include/exclude rules, user-agent or device choice, or scheduling. |
| Expected behaviour | `NFR-BWI-004` requires the applicable limits to be **visible** before starting. That is satisfied. Editability is not required by any FR. |
| Classification | **`MATCH`** against `NFR-BWI-004`; **`PARTIAL`** against Semrush S2/S3/S8 configurability |
| Required correction | None for the spec. Editable crawl scope is a **scope question**, not a defect, and must not be built on reference authority alone. |
| Required tests | Already satisfiable: assert the concrete bounds render before start. |
| Unknowns | Whether editable crawl scope belongs in 002 at all, given `SR-002-004-MODE` and no selected crawl vendor. |
| Dependency | Any live-crawl-affecting configuration is constrained by `DEC-004` |
| Order | 17 (scope decision, not a fix) |
| Parallel | Yes |

### `G-007` — Scan cancel and retry work through the UI

| Field | Value |
| --- | --- |
| Reference | Semrush S10 failure names a cause and a remedy (`EV-SEM-004`); Planable P9 a blocked state always exposes its reason (`EV-PLA-004`, `EV-PLA-016`). |
| Reference authority | Semrush for scan runtime; Planable for blocked-state clarity — both in domain |
| OMA surface / action | `OMA-A10`, `OMA-A11` |
| Spec | `FR-BWI-013` actionable failure reasons |
| Files | `apps/web/src/app/(app)/app/brands/[brandId]/scans/[scanId]/page.tsx:73-98,119-193` |
| Current behaviour | `canRetry` covers `FAILED`, `PARTIAL` and `CANCELLED`; cancel renders only while non-terminal. On a `PARTIAL` attempt the surface offered `Retry scan`, and clicking it **created a new scan attempt** with a new id, confirmed by the URL change (`RT-25`). Cancel was correctly absent on a terminal attempt. Retry sends an idempotency key. |
| Classification | **`MATCH`** |
| Note | An earlier probe reported these controls as missing. That was a probe defect — it inspected status badges only and never enumerated buttons. Corrected on direct evidence. |
| Required tests | Add UI-path coverage so retry is proven by clicking; `brand-q-bwi-04` currently proves it at the API only. |
| Order | — (no correction) |
| Parallel | n/a |

### `G-008` — Rescan produces a new draft

| Field | Value |
| --- | --- |
| Reference | Semrush S21 — a re-run **replaces** previous results (`EV-SEM-012`). Recorded in the baseline as an anti-pattern. |
| Reference authority | Semrush, in domain, and deliberately refused |
| OMA surface / action | Rescan → new version |
| Spec | `FR-BWI-030`, `FR-BWI-031` |
| Existing task | `tests/e2e/brand-q-bwi-07-rescan.e2e.ts` |
| Current behaviour | Partially proven. Clicking `Retry scan` on a terminal attempt created a **new attempt** rather than replacing the old one (`RT-25`), which is the structural opposite of S21. Approved-version immutability was proven separately (`RT-23`): after approval the approval section stops rendering and the approved state survives refresh. What remains unproven is the full rescan-after-approval path — that a rescan of an already-approved brand yields a new `Draft` while the approved version stays untouched. |
| Classification | **`INTENTIONAL_DIFFERENCE`** for the reference pattern, now supported by runtime evidence; **`PARTIAL`** for OMA's rescan-after-approval journey |
| Required correction | None for the divergence. The rescan-after-approval journey needs UI-level proof. |
| Required tests | E2E through the UI: rescan an approved brand, confirm a new `Draft` appears and the approved version is untouched. |
| Order | 10 |
| Parallel | Yes |

### `G-009` — Coverage presentation and stale-figure honesty

| Field | Value |
| --- | --- |
| Reference | Semrush S12 headline coverage above a severity breakdown (`EV-SEM-013`); S13 a derived score is explicitly stale until recomputed (`EV-SEM-016`); S16 aggregates click through to their pages (`EV-SEM-006`); S17 a metric states the subset it covers (`EV-SEM-017`). |
| Reference authority | Semrush, coverage presentation — in domain |
| OMA surface / action | `OMA-S13`, `OMA-S16`, `OMA-S24` |
| Spec | `FR-BWI-029a` partial disclosure; `FR-BWI-012a` coverage |
| Current behaviour | The approval surface disclosed the partial scan with a named reason and a per-URL failure list, and gated approval on acknowledgement (`RT-23`). The brand overview was not examined for a headline coverage figure, and no click-through from an aggregate to its pages was observed. |
| Classification | **`PARTIAL`** |
| Required correction | Verify whether a coverage figure exists on the brand overview and whether aggregates click through. S12's severity model is explicitly **not** adopted — `07-reference-pattern-matrix.md` S12 records that OMA has no issue-severity domain in 002, so adding one would be UI without a domain. |
| Required tests | E2E: coverage figure present with the subset it was computed over. |
| Unknowns | Whether a headline coverage figure is currently rendered anywhere. |
| Order | 9 |
| Parallel | Yes |

---

## C. Brand intelligence profile — Jasper authority

### `G-010` — A profile section heading leaks a raw translation key

| Field | Value |
| --- | --- |
| Reference | Jasper J1 — brand information lives in separately **named** components (`EV-JAS-001`, `EV-JAS-002`). A key string is not a name. |
| Reference authority | Jasper, profile organisation — in domain, `DOC_VERIFIED` only |
| OMA surface / action | `OMA-S20` |
| Spec | `FR-BWI-026` fixes OMA's section set; `FR-BWI-032` and `NFR-BWI-005` require localized, understandable UI |
| Existing task | Phase VP item VP10 claims enum codes and field keys are localized rather than leaked. That claim is **false for section headings**. |
| Files | `apps/web/src/components/brand/profile-sections.tsx:112`, `packages/i18n/messages/en.json`, `packages/i18n/messages/ar.json` |
| Current behaviour | Sections are keyed by data. The renderer falls back to the raw key: `t(\`brand.profile.section.${key}\`) || key`. Because `t()` already returns the key string when a message is missing, the `|| key` fallback never fires and the literal text `brand.profile.section.evidence_refs` renders as a section heading (`RT-21`). Defined section keys are `overview, catalog, languages, claims, risks, brand, contact, products`; the data produced `evidence_refs`, which has no message in **either** catalogue. |
| Expected behaviour | Every rendered section carries a human name in EN and AR, or is not rendered as a section. |
| Classification | **`WRONG_EXISTING_IMPLEMENTATION`** |
| EN/AR/RTL | Both locales affected identically. |
| Required correction | Two defects, both needed: add the missing message keys, and make the fallback actually detect a missing message instead of relying on `||` against a truthy key string. |
| Required tests | Unit: `t()` missing-key behaviour is distinguishable from a real message. UI/E2E: no rendered heading matches `/^brand\./` in either locale. |
| Acceptance evidence | Every section heading is human-readable in EN and AR. |
| Dependency | Independent |
| Order | 4 |
| Parallel | Yes |

### `G-011` — Insight accept and reject are unreachable in the current mode

| Field | Value |
| --- | --- |
| Reference | Jasper J3 a derivation is a proposal the human inspects (`EV-JAS-004`); J8 a rejection carries a per-item reason (`EV-JAS-010`); Planable P12 a proposal stays inert until the owner disposes of it (`EV-PLA-003`, `EV-PLA-010`). |
| Reference authority | Jasper for proposal semantics, Planable for disposition — both in domain |
| OMA surface / action | `OMA-S22`, `OMA-A14`, `OMA-A15` |
| Spec | `FR-BWI-021`, `FR-BWI-028`, `FR-BWI-029b` |
| Current behaviour | Controls render only when `info_state === 'AI_INFERRED' && review_status === 'PENDING'` (`insight-decision-controls.tsx:21`). Under the fixture connector with no AI provider, every insight is `OBSERVED`, so accept and reject were never reachable at runtime (`RT-22`). |
| Expected behaviour | Correct as designed — a non-AI observation is not a proposal to accept. |
| Classification | **`MATCH`** in logic, **`UNKNOWN`** in runtime proof |
| Required correction | None to behaviour. The journey needs proof through a test AI adapter at the port boundary, which `FR-BWI-028a` permits **in tests only**. |
| Required tests | E2E with a test `AiProviderPort` adapter: an `AI_INFERRED` pending insight is accepted and rejected through the UI, with actor and prior value recorded. |
| Dependency | Must not wire a live AI vendor; `DEC-007` stays open |
| Decision gate | Bounded by `DEC-007` for anything beyond a test adapter |
| Order | 11 |
| Parallel | Yes |

### `G-012` — Unknown versus missing information

| Field | Value |
| --- | --- |
| Reference | Jasper J5 — an empty field means the source did not surface this, explicitly distinguished from this does not exist (`EV-JAS-008`). The single most directly reusable reference pattern for OMA. |
| Reference authority | Jasper, in domain, `DOC_VERIFIED` |
| OMA surface / action | `OMA-S20` |
| Spec | `FR-BWI-020`, `FR-BWI-022`, `FR-BWI-027` |
| Current behaviour | The editor renders per-field badges `Fact`, `Required`, `Optional` and per-insight information-state and discovery-tier badges (`RT-20`). The demo seed carries `unknownRequiredFields`. Whether the UI distinguishes *not found* from *does not exist* was not verified. |
| Classification | **`PARTIAL`** — needs verification, not assumed to be broken |
| Required correction | Verify the distinction is rendered; if it is not, add it. |
| Required tests | E2E: a required field the scan could not observe reads as unknown-because-not-found, distinctly from an optional absent field. |
| Order | 12 |
| Parallel | Yes |

---

## D. Review and approval — Planable authority

### `G-013` — Approval, disclosure and immutability

| Field | Value |
| --- | --- |
| Reference | Planable P8 partially approved is a first-class state (`EV-PLA-004`); P11 approval attributed to a named actor on the artifact (`EV-PLA-003`, `EV-PLA-008`); P19 immutability after approval is a **reversible setting** — anti-pattern (`EV-PLA-006`); P21 whole-version rejection and any pre-approval completeness gate — `UNKNOWN` in every reference. |
| Reference authority | Planable, approval clarity — in domain |
| OMA surface / action | `OMA-S23`, `OMA-S24`, `OMA-A17`, `OMA-A18` |
| Spec | `FR-BWI-029`, `FR-BWI-029a`, `FR-BWI-029d`, `FR-BWI-030` |
| Current behaviour | Proven end-to-end (`RT-23`). The server returned `eligibility.blocking_reasons: ["PARTIAL_ACK_REQUIRED"]` for a `PARTIAL` scan. The UI required both `I confirm this profile summary is accurate for client use.` and `I acknowledge incomplete scan coverage.` before enabling `Approve profile`. Approval succeeded, the badge became `APPROVED`, it survived a hard refresh, and the entire approval section stopped rendering afterwards. |
| Classification | **`MATCH`** — and `INTENTIONAL_DIFFERENCE` against Planable P19, since OMA's immutability is structural rather than a toggle |
| Note | `FR-BWI-029a` is one of the requirements the reference baseline records as having **no precedent in any reference**. It is implemented and now runtime-proven. That is a genuine OMA original, not a copied pattern. |
| Required tests | Already covered by `brand-q-bwi-01` and `-02`; add UI-path coverage so the gate is proven by clicking, not only by API. |
| Order | — (no correction) |
| Parallel | n/a |

### `G-014` — Whole-version reject is present but unexecuted

| Field | Value |
| --- | --- |
| Reference | Planable P21 — `UNKNOWN`. No reference demonstrates whole-version rejection. `REFERENCE_LIMITED`. |
| OMA surface / action | `OMA-S25`, `OMA-A19` |
| Spec | `FR-BWI-029`, `FR-BWI-029b` |
| Existing task | `tests/e2e/brand-q-bwi-09-reject-scope.e2e.ts` |
| Current behaviour | A `Reject version` control renders next to `Approve profile`, distinct from the per-insight reject (`RT-20`). The command was not executed in this phase. |
| Classification | **`PARTIAL`** — control proven present, behaviour unproven at runtime |
| Required correction | None assumed. Prove it. |
| Required tests | E2E through the UI: reject a version, confirm the resulting state, that it is not an approval, and that per-insight reject cannot reject a version. |
| Order | 13 |
| Parallel | Yes |

### `G-015` — Version history and comparison

| Field | Value |
| --- | --- |
| Reference | Planable P17 history is reachable from the object it belongs to (`EV-PLA-003`, `EV-PLA-019`); P20 restoring a previous version overwrites the current one — anti-pattern (`EV-PLA-019`); Semrush S18 comparison as what was fixed and what newly appeared between two identified runs (`EV-SEM-012`). |
| Reference authority | Planable for history, Semrush for comparison — both in domain |
| OMA surface / action | `OMA-S19`, `OMA-S26`, `OMA-A20` |
| Spec | `US-BWI-05`, `FR-BWI-031` |
| Current behaviour | The version index lists versions with status and `AI unavailable` badges. Comparison renders a field-level table with the information state on each side, and correctly states `No approved version to compare against.` before any approval (`RT-20`, `RT-23`). No restore control exists. |
| Classification | **`MATCH`**, and `INTENTIONAL_DIFFERENCE` against Planable P20 — OMA offers no restore-over-current path, which is correct |
| Note | OMA's field-level comparison with evidence references exceeds Semrush, which compares counts. `07-reference-pattern-matrix.md` S18 records this as `REFERENCE_LIMITED`. |
| Order | — |
| Parallel | n/a |

### `G-016` — Review collaboration is a shell without proven behaviour

| Field | Value |
| --- | --- |
| Reference | Planable P13 resolving a comment hides it rather than deleting it (`EV-PLA-009`); P14 internal deliberation partitioned from client-visible discussion at the data level (`EV-PLA-011`). |
| Reference authority | Planable, collaboration — in domain |
| OMA surface / action | `OMA-S27` |
| Spec | `FR-BWI-030` requires review history to survive on approved versions |
| Current behaviour | A `Review collaboration` section renders. No comment was posted, so nothing about comment behaviour, resolution or history survival is proven (`RT-20`). |
| Classification | **`PARTIAL`** |
| Note | P14's internal-versus-client partition is explicitly recorded as out of 002 scope in the baseline; only the internal side applies here. |
| Required tests | E2E: post a comment, resolve it, approve the version, confirm the history survives. |
| Order | 14 |
| Parallel | Yes |

### `G-017` — Review work never arrives as a notification

| Field | Value |
| --- | --- |
| Reference | Planable P18 — review work arrives as a notification that deep-links to the deciding surface (`EV-PLA-005`), `LIVE_VERIFIED`. |
| Reference authority | Planable, review flow — in domain |
| OMA surface / action | Missing surface; `OMA-A23` adjacent |
| Spec | `FR-BWI-019` deep-link re-entry must stay correct; Foundation `FR-097` recipient resolution by membership and capability |
| Files | `apps/api/src/notifications/notifications.controller.ts` exists; no web consumer |
| Current behaviour | The API exposes notifications. The shell has no notification surface at all (`RT-15`). A reviewer has no prompt and no one-hop path to a deciding surface. |
| Classification | **`RECONNECT`** |
| Tenant impact | Cross-tenant notification leakage is forbidden and must be tested, not assumed. |
| Required correction | Surface notifications with tenant-scoped deep links. |
| Required tests | E2E: a review request appears for the right recipient and deep-links to the version; a user in another company never receives or resolves it. |
| Dependency | Needs a second actor, so depends on `G-018` |
| Order | 15 |
| Parallel | No |

---

## E. Roles, isolation and the actor model

### `G-018` — No second actor can exist, so no role boundary is provable

| Field | Value |
| --- | --- |
| Reference | Planable's six roles and three participant types (`06-role-permission-matrix.md`); P16 the strongest external participant is capped strictly below the approval boundary (`EV-PLA-012`, `EV-PLA-014`); Jasper J13 who may use brand context is separated from who may change it (`EV-JAS-013`, `EV-JAS-017`). |
| Reference authority | Planable and Jasper for the read/edit/decide split — in domain |
| OMA surface / action | `OMA-S32`, `OMA-A22` |
| Spec | Foundation `FR-003`, `FR-004`, `FR-006`, `FR-008`; Feature 002 `FR-BWI-029b` |
| Current behaviour | The capability model, guards and schema are implemented and integration-tested. But no invitation surface exists, so **only the owner actor is observable in product** and `PermissionDenied` was never reached (`RT-15`, inventory `OMA-S32`). |
| Classification | **`RECONNECT`** for the invitation surface; **`UNKNOWN`** for every role boundary at runtime |
| Capability impact | Maximum — the entire authorization story is unverified in product. |
| Required correction | An invitation and membership surface, then role-boundary proof. |
| Required tests | E2E: an invited member with read-only capability sees data and is refused approval; a non-member is refused without existence leakage. |
| Dependency | `DEC-015` shapes it, since invitation is one candidate answer to `G-001` |
| Decision gate | `DEC-015` |
| Order | 16 |
| Parallel | No |

### `G-019` — Tenant isolation

| Field | Value |
| --- | --- |
| Reference | `UNKNOWN` in every reference — `07-reference-pattern-matrix.md` records that cross-tenant probing was neither attempted nor permitted, so no reference informs this. `REFERENCE_LIMITED`. |
| OMA surface / action | `OMA-S31` |
| Spec | `FR-BWI-003`, `FR-BWI-004`, `FR-BWI-005`, Foundation `FR-008` |
| Current behaviour | Proven at runtime: with a different company active, requesting a foreign brand returned `404` and the UI rendered `Not found` with no hint that the brand exists (`RT-24`). Backed by `tests/security/` and `brand-q-bwi-05-cross-tenant.e2e.ts`. |
| Classification | **`MATCH`** |
| Note | This is OMA's own requirement with no reference precedent, and it holds. |
| Order | — |
| Parallel | n/a |

---

## F. Shell, density and motion — Linear authority

### `G-020` — Shell is a two-destination rail against a three-zone reference

| Field | Value |
| --- | --- |
| Reference | Linear L1 three-zone shell of navigation, content and an optional detail panel, `LIVE_VERIFIED` and measured (`EV-LIN-001`); L3 administrative entries demoted behind progressive disclosure; L4 a repeatable page skeleton of context, saved-view tabs, view controls, then data. |
| Reference authority | Linear, shell — in domain |
| OMA surface / action | `OMA-S05` |
| Spec | `FR-BWI-035` names the Intelligence workspace archetype |
| Current behaviour | Sidebar with one `WORKSPACE` group and two destinations; brand-level tabs supply the second tier; the evidence side panel supplies the third zone (`RT-15`, `RT-20`). |
| Classification | **`MATCH`** for the zone model, **`INTENTIONAL_DIFFERENCE`** for destination count |
| Note | `07-reference-pattern-matrix.md` L1 already states OMA's destination count must stay honest to what exists. Two destinations is honest for one feature. Inventing more would be padding. |
| Order | — |
| Parallel | n/a |

### `G-021` — No density or view controls on lists

| Field | Value |
| --- | --- |
| Reference | Linear L5 group headers carry their own counts (`EV-LIN-001`); L7 additive filters with per-option counts shown before applying (`EV-LIN-002`); L8 density is user-controlled — grouping, ordering, which properties appear (`EV-LIN-002`). All `LIVE_VERIFIED`. |
| Reference authority | Linear, density — in domain |
| OMA surface / action | `OMA-S10`, `OMA-S17`, `OMA-S18` |
| Spec | No FR requires user-controlled density in 002. |
| Current behaviour | Brand list offers name search only. Discovered pages and products render as lists with no filter, sort, grouping or count headers (`RT-19`). |
| Classification | **`PARTIAL`** — a real gap against the reference, but **not** a spec violation |
| Required correction | Scope decision before work. Filters and counts serve `FR-BWI-012a` coverage legibility; user-configurable density is a preference feature with no FR behind it and should not be built on reference authority alone. |
| Required tests | Whatever is scoped, tested at the level it can fail. |
| Unknowns | Whether 002 should carry density controls at all. |
| Order | 17 |
| Parallel | Yes |

### `G-022` — Keyboard model and shortcut discoverability

| Field | Value |
| --- | --- |
| Reference | Linear L9 shortcuts taught inline inside the command surface (`EV-LIN-003`), `LIVE_VERIFIED` |
| Reference authority | Linear, interaction — in domain |
| Spec | `NFR-BWI-005` requires keyboard access for critical actions |
| Current behaviour | No command menu and no shortcut affordance observed. Keyboard access to individual controls was not measured beyond a `Skip to content` link being present. `tests/e2e/a11y-shell.e2e.ts` exists. |
| Classification | **`PARTIAL`** |
| Required correction | Verify keyboard reachability of critical actions against `NFR-BWI-005`. A command menu is Linear's solution, not an OMA requirement. |
| Required tests | E2E: every critical action reachable and operable by keyboard. |
| Order | 18 |
| Parallel | Yes |

### `G-023` — Motion

| Field | Value |
| --- | --- |
| Reference | Linear L10 calm partly achieved by not animating, measured zero-duration transitions at one viewport (`EV-LIN-004`); L12 no spinner on fast local transitions. |
| Reference authority | Linear, motion — in domain |
| Current behaviour | No motion was measured in OMA in this phase. |
| Classification | **`UNKNOWN`** |
| Note | The baseline explicitly limits L10 to one measured viewport and marks any broader claim an inference. OMA's motion budget lives in `DESIGN_REFERENCE_STRATEGY` §5, not here. |
| Required correction | Measure before asserting anything. |
| Order | 19 |
| Parallel | Yes |

### `G-024` — Landing page does not route a signed-out visitor

| Field | Value |
| --- | --- |
| Reference | `REFERENCE_LIMITED` |
| OMA surface / action | `OMA-S01` |
| Current behaviour | `/` renders a landing page and does not redirect an unauthenticated visitor toward `/login` (`RT-06`). Whether it should is a product choice. |
| Classification | **`PARTIAL`**, low severity |
| Order | 20 |
| Parallel | Yes |

---

## G. Out of scope for this phase

| Item | Classification | Reason |
| --- | --- | --- |
| Frame.io patterns | `NOT_APPLICABLE` | `ACCESS_VERIFIED` but recorded `NOT_APPLICABLE_TO_CURRENT_INSPECTION`; exact-version media review is not a 002 domain. |
| Adobe Workfront patterns | `NOT_APPLICABLE` | `ACCOUNT_LIMITED` and `NOT_APPLICABLE_TO_FEATURE_002`. |
| Semrush severity model (S12) | `INTENTIONAL_DIFFERENCE` | OMA has no issue-severity domain in 002; adding one would be UI without a domain behind it. |
| Semrush robots bypass (S22) | `INTENTIONAL_DIFFERENCE` | `FR-BWI-011` — OMA never bypasses robots. |
| Semrush stop-and-save (S20) | `INTENTIONAL_DIFFERENCE` | `FR-BWI-029a` — an incomplete run is `Partial` with mandatory disclosure. |
| Planable reversible immutability (P19) | `INTENTIONAL_DIFFERENCE` | `FR-BWI-030` — structural immutability. |
| Planable restore-over-current (P20) | `INTENTIONAL_DIFFERENCE` | OMA never restores over an approved artifact. |
| Planable client-visible partition (P14) | `NOT_APPLICABLE` | Client-facing exposure is outside 002. |
| Jasper tone-of-voice fields (J2) | `NOT_APPLICABLE` | `FR-BWI-020c` — `DEFERRED_ADVANCED`. |
| Jasper workspace grouping as tenancy (J12) | `INTENTIONAL_DIFFERENCE` | Workspace grouping is not a tenant boundary. |
| Live crawl vendor wiring | `NOT_APPLICABLE` | `DEC-004` open; T200–T201 stay blocked. |
| Live AI vendor wiring | `NOT_APPLICABLE` | `DEC-007` open; T202–T203 stay blocked. |
| Object storage / WorkDrive bytes | `NOT_APPLICABLE` | `DEC-003` open; T204–T205 stay blocked. |

---

## Counts

Primary classification used for queue and reporting (one per gap):

| Classification | Count | Gap ids |
| --- | --- | --- |
| `MATCH` | 6 | `G-006` (against `NFR-BWI-004`), `G-007`, `G-013`, `G-015`, `G-019`, `G-020` |
| `PARTIAL` | 11 | `G-003`, `G-004`, `G-005`, `G-008`, `G-009`, `G-012`, `G-014`, `G-016`, `G-021`, `G-022`, `G-024` |
| `MISSING` | 0 | — (company acquisition is `RECONNECT` because the create-tenant API already exists) |
| `WRONG_EXISTING_IMPLEMENTATION` | 2 | `G-002`, `G-010` |
| `REBUILD` | 0 | — |
| `REMOVE` | 0 | — |
| `RECONNECT` | 3 | `G-001`, `G-017`, `G-018` |
| `INTENTIONAL_DIFFERENCE` (primary) | 0 | recorded as secondary on `G-008`, `G-013`, `G-015`, `G-020` and on **seven** named reference anti-patterns (`S12`, `S20`, `S21`, `S22`, `P19`, `P20`, `J12`), plus OMA's honest destination-count divergence under `G-020` |
| `REFERENCE_LIMITED` (authority note) | 6 gaps cite it | `G-001`, `G-002`, `G-004`, `G-014`, `G-019`, `G-024` — never the sole primary when a product defect also exists |
| `NOT_APPLICABLE` | 7 | Frame.io, Workfront, P14, J2, live crawl (`DEC-004`), live AI (`DEC-007`), object storage / WorkDrive (`DEC-003`) |
| `UNKNOWN` (primary) | 2 | `G-011` (runtime insight decisions), `G-023` (motion) |

Gap records: **24** (`G-001`–`G-024`). Every one carries at least one evidence id (`RT-*` or `EV-*`) or an explicit `UNKNOWN`.

Secondary notes that do not change the primary count:

- `G-006` also carries a scope-only `PARTIAL` against Semrush S2/S3/S8 editable configurability.
- `G-008` also carries `INTENTIONAL_DIFFERENCE` against Semrush S21 (proven by `RT-25`).
- `G-011` logic is a `MATCH`; only the fixture-mode runtime proof is `UNKNOWN`.

## Decision gates

| Gate | Status | Blocks |
| --- | --- | --- |
| `DEC-015` (proposed) — how a company comes into existence and who may create or join one | **Open, must be opened and closed before implementation** | `G-001`, `G-002`, `G-004`, `G-018`, and transitively `G-017` |
| `DEC-004` | Open | Anything touching live crawl behaviour beyond the already-disclosed fixture limits in `G-006` |
| `DEC-007` | Open | Anything beyond a test adapter in `G-011` |
| `DEC-003` | Open | Not reached by any gap above |

`G-001` is the highest-priority gap **and** it is not implementable. Recording it as a task without
its gate would violate `AGENTS.md`, which forbids planning past an unresolved decision that changes
identity or tenant authority.

## Implementation queue

Ordered by dependency, not by severity alone.

| # | Gap | Action | Parallel | Gate |
| --- | --- | --- | --- | --- |
| 1 | `G-001` | Open and close `DEC-015`; then specify in Foundation 001 | No | `DEC-015` |
| 2 | `G-002` | Actionable no-membership state | No | `DEC-015` |
| 3 | `G-010` | Fix the leaked section key and the fallback | Yes | — |
| 4 | `G-005` | Isolate E2E residue from the demo account | Yes | — |
| 5 | `G-003` | Searchable company selection | Yes | — |
| 6 | `G-004` | Decide active-company persistence | No | with `DEC-015` |
| 7 | `G-009` | Verify coverage presentation on brand overview | Yes | — |
| 8 | `G-008` | Prove the rescan-after-approval journey through the UI | Yes | — |
| 9 | `G-011` | Prove insight decisions via a test port adapter | Yes | `DEC-007` |
| 10 | `G-012` | Verify unknown-versus-missing rendering | Yes | — |
| 11 | `G-014` | Prove whole-version reject through the UI | Yes | — |
| 12 | `G-016` | Prove comment and history survival | Yes | — |
| 13 | `G-017` | Notification surface with tenant-safe deep links | No | after `G-018` |
| 14 | `G-018` | Invitation surface, then role-boundary proof | No | `DEC-015` |
| 15 | `G-021` | Scope filters and counts; do not build density on reference authority alone | Yes | scope decision |
| 16 | `G-022` | Verify keyboard access against `NFR-BWI-005` (`T171`) | Yes | — |
| 17 | `G-006` | Scope whether editable crawl scope belongs in 002 (limits already visible) | Yes | `DEC-004` for live behaviour |
| 18 | `G-023` | Measure motion before asserting (`T172`) | Yes | — |
| 19 | `G-024` | Decide landing routing (`T173`) | Yes | product decision |

Genuinely parallel-eligible and ungated now: `G-010`, `G-005`, `G-003`.

`G-007` is complete — no implementation work.

## What this matrix deliberately does not do

It does not resolve any gap, does not touch product code, does not close a decision, does not expand
Feature 002's scope, and does not convert a reference pattern into an OMA requirement. Where OMA
already exceeds a reference — field-level comparison, structural immutability, per-claim evidence,
tenant isolation — the reference is recorded as the weaker party and OMA's spec stands.
