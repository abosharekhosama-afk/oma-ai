# Reference Pattern Matrix — Inputs for Feature 002

This matrix prepares **inputs only**. It does not compare against OMA code and resolves nothing.
Where an OMA requirement has no reference precedent, that absence is recorded as *reference
coverage* — a statement about what the references do and do not demonstrate — and never as a gap in
OMA to close. No implementation, design-system or UI decision is authorized by this file.

`DEC-013` governs which reference may inform which domain, and it is unchanged. References
authorize pattern study only — never copied layouts, colours, icons, copy or assets.

Columns: **Pattern** is the reference behaviour, with its status. **OMA surface** is the Feature 002
surface the pattern could inform. **Why it matters** states the product property behind the pattern.
**Divergence to preserve** records where OMA's spec already requires different behaviour, so a later
phase cannot mistake a reference pattern for an OMA requirement.

---

## Semrush → OMA website scan and evidence surfaces

| # | Pattern | Status | Evidence | OMA surface | Why it matters | Divergence to preserve |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | A single-URL entry precedes all configuration | `LIVE_VERIFIED` | `EV-SEM-001` | Connect Website | The first commitment is one address, not a form | OMA also requires an explicit authorization attestation at connect time (`FR-BWI-006`) |
| S2 | Crawl scope is chosen before any volume bound, with subdomain inclusion as its own explicit switch | `DOC_VERIFIED` | `EV-SEM-002` | Scan setup | *What counts as the site* is a decision, not a default | — |
| S3 | Per-attempt page limit and cumulative budget are two separate visible numbers | `DOC_VERIFIED` | `EV-SEM-002`, `EV-SEM-004` | Scan setup, coverage summary | One number bounds this run; the other bounds the account. Conflating them hides exhaustion | `NFR-BWI-004` requires limits visible **before** start |
| S4 | Crawl source is an explicit choice, and a URL-list upload reports the parsed count back before starting | `DOC_VERIFIED` | `EV-SEM-002` | Scan setup | The operator confirms what will be fetched before work begins | 002 is public-HTTPS crawl only (`SR-002-004-MODE`); no commerce or file source |
| S5 | The resolved crawler identity is displayed and copyable | `DOC_VERIFIED` | `EV-SEM-002` | Scan attempt provenance | Provenance of the fetcher is operator-visible, not buried in configuration | `FR-BWI-019a` goes further: the connector mode is recorded **on the attempt** and read back from that record, so reconfiguration cannot restate history |
| S6 | Fetch mode changes the result, and the product says so | `DOC_VERIFIED` | `EV-SEM-002` | Scan attempt, discovered pages | The same site yields different observations under a different fetch mode, so mode must travel with the data | While no live crawl vendor is selected, no OMA surface may present fixture output as a live fetch (`FR-BWI-019a`) |
| S7 | Rate limiting is an operator-facing courtesy trade-off with a robots-respecting option | `DOC_VERIFIED` | `EV-SEM-002` | Scan setup | Politeness is a product decision, not hidden infrastructure | OMA always respects robots; it is not an option (`FR-BWI-011`) |
| S8 | URL include/exclude and parameter rules with documented matching semantics | `DOC_VERIFIED` | `EV-SEM-002` | Scan setup, canonical handling | Ambiguous matching silently over-excludes, so the semantics must be stated | — |
| S9 | Progress separates "fetching" from "finishing", and the counter stopping is documented as normal | `DOC_VERIFIED` | `EV-SEM-010` | Scan progress | A stalled counter reads as a hang unless the product explains the final phase | Supports OMA's distinct `Crawling` / `Extracting` / `Analyzing` states (§9.2) |
| S10 | Failure names a cause and a remedy, and hands the operator an artifact to act on | `DOC_VERIFIED` | `EV-SEM-004` | Scan failure, partial failure | An actionable reason beats a generic error | `FR-BWI-013` requires actionable, non-secret-leaking reasons |
| S11 | Blocked resources are never reported as successfully analysed | `DOC_VERIFIED` | `EV-SEM-004` | Coverage summary, discovered pages | Coverage honesty | Exactly `FR-BWI-011` and edge case 10 |
| S12 | A headline coverage figure sits above a severity breakdown, with pages classified by fetch outcome | `DOC_VERIFIED` | `EV-SEM-013` | Brand overview, discovered pages | One readable figure, with the classification that produced it one click away | OMA has no issue-severity model in 002; adding one would be UI without a domain behind it |
| S13 | A derived score is explicitly stale until recomputed | `DOC_VERIFIED` | `EV-SEM-016` | Coverage summary, brand overview | A number must never look fresher than its inputs | Reinforces OMA never presenting a stale figure as current |
| S14 | Every finding resolves to the concrete source URLs that produced it | `DOC_VERIFIED` | `EV-SEM-016` | Evidence side panel | Traceability is the product, not a detail | `FR-BWI-023` adds excerpt, hash, confidence and information state per item |
| S15 | A per-page view combines that page's attributes with its own findings | `DOC_VERIFIED` | `EV-SEM-008` | Discovered pages detail | The page and its findings are one context | — |
| S16 | Aggregates click through to the pages behind them | `DOC_VERIFIED` | `EV-SEM-006` | Coverage summary | No dead-end statistics | — |
| S17 | A metric states the sampled subset it was computed over | `DOC_VERIFIED` | `EV-SEM-017` | Coverage summary | Sampling disclosed rather than implied | Supports OMA's partial-coverage disclosure |
| S18 | Comparison is expressed as what was fixed and what newly appeared between two identified runs | `DOC_VERIFIED` | `EV-SEM-012` | Version comparison | Change between two named runs, not a vague trend | OMA compares field-level values with evidence references, which the reference does not do (`REFERENCE_LIMITED`) |
| S19 | A configuration change that breaks comparability raises an explicit notice | `DOC_VERIFIED` | `EV-SEM-002` (surface `SEM-C-018`) | Rescan, version comparison | Unlike runs must not be compared silently | — |
| S20 | Stop-and-save presents an unfinished crawl as the current audit | `DOC_VERIFIED` | `EV-SEM-011` | — | Recorded as an **anti-pattern for OMA** | OMA marks an incomplete run `Partial` with mandatory incompleteness disclosure before approval (`FR-BWI-029a`) |
| S21 | A re-run replaces previous results | `DOC_VERIFIED` | `EV-SEM-012` | — | Recorded as an **anti-pattern for OMA** | A rescan creates a new Draft and never replaces an Approved version (`FR-BWI-030`, `FR-BWI-031`) |
| S22 | Robots bypass is gated behind proof of site ownership | `DOC_VERIFIED` | `EV-SEM-002` | — | Recorded for completeness | OMA does not bypass robots at all; attestation plus audit is the 002 boundary (`FR-BWI-010`, `FR-BWI-011`) |

## Jasper Brand IQ → OMA brand intelligence profile

Every row is `DOC_VERIFIED` at best. Nothing was observed inside a signed-in Jasper session, so no
row may be treated as proof of internal product behaviour.

| # | Pattern | Status | Evidence | OMA surface | Why it matters | Divergence to preserve |
| --- | --- | --- | --- | --- | --- | --- |
| J1 | Brand information lives in separately named components, not one monolithic record | `DOC_VERIFIED` | `EV-JAS-001`, `EV-JAS-002` | Brand intelligence profile sections | Named sections make completeness legible | `FR-BWI-026` fixes OMA's own section set; the reference's component names are not adopted |
| J2 | A voice is derived from the brand's own writing, with a bounded example count | `DOC_VERIFIED` | `EV-JAS-004` | Brand intelligence editor | Derived guidance is grounded in supplied material | Tone-of-voice fields are `DEFERRED_ADVANCED` in 002 (`FR-BWI-020c`) |
| J3 | The derived description is presented as generated content the human inspects and corrects | `DOC_VERIFIED` | `EV-JAS-004` | Insight claims | A derivation is a proposal, not a fact | `FR-BWI-021`, `FR-BWI-028`: AI output is labelled and can never self-approve |
| J4 | A with-context versus without-context comparison shows exactly what the brand context changed | `DOC_VERIFIED` | `EV-JAS-004` | Insight review | Attribution of AI influence is visible | — |
| J5 | An empty field means "the source did not surface this", explicitly distinguished from "this does not exist" | `DOC_VERIFIED` | `EV-JAS-008` | Unknown/missing fields | The single most directly reusable pattern for OMA's Unknown handling | `FR-BWI-020`, `FR-BWI-022`: absence is `Unknown` and AI must never promote it to a Fact |
| J6 | Editability follows provenance — URL-derived assets cannot be edited in place | `DOC_VERIFIED` | `EV-JAS-006` | Evidence, observations | Derived material is not silently rewritten | OMA keeps observations immutable and records corrections as new human decisions with actor and prior value |
| J7 | An automatic setup is documented as a starting point requiring review, not a guaranteed import | `DOC_VERIFIED` | `EV-JAS-009` | AI proposal states | The vendor's own documentation refuses to overclaim | Matches OMA's `Draft` → `Needs review` shape |
| J8 | A rejection carries a per-item reason rather than a bare failure | `DOC_VERIFIED` | `EV-JAS-010` | Insight decisions | A reviewer learns why | — |
| J9 | Documentation names an accountable verifier for claims, disclaimers and specifications, on a cadence | `DOC_VERIFIED` | `EV-JAS-008` | Approval summary | Accountability is assigned, not assumed | OMA enforces this as a server-side capability, not a recommendation (`FR-BWI-029`) |
| J10 | A URL source has a stated cache window and is fetched at generation time | `DOC_VERIFIED` | `EV-JAS-005` | Freshness cues | Freshness is stated rather than implied | `FR-BWI-023` requires discovery time and freshness cues per item |
| J11 | A failed fetch offers named remedies including pasting content directly | `DOC_VERIFIED` | `EV-JAS-005` | AI-unavailable state, manual completion | A dead end is never the only outcome | `FR-BWI-028b`: humans complete and approve the profile without AI |
| J12 | Several brands are supported by scoping components into groups | `DOC_VERIFIED` | `EV-JAS-008`, `EV-JAS-012` | Brand workspace organisation | Multi-brand without duplicating a profile object | **This is workspace-internal grouping, not tenancy.** OMA's tenant boundary is server-resolved and unrelated (`FR-BWI-001`, `FR-BWI-005`) |
| J13 | *Who may use* brand context is separated from *who may change it*, with an audit trail | `DOC_VERIFIED` | `EV-JAS-013`, `EV-JAS-017` | Capability model | The read/edit split is a product decision | OMA splits further into read, edit, decide and approve (§3) |
| J14 | Automatically attached context is still disclosed and overridable | `DOC_VERIFIED` | `EV-JAS-010` | AI availability banner | Automation stays visible | — |
| J15 | Per-claim confidence and per-claim citation display | `UNKNOWN` | `EV-JAS-007` | Insight claims | Recorded as **not provable** | Citation appears only as a marketing claim with no documented surface. OMA's evidence-per-claim and confidence requirements are stricter than anything provable here and must be proven by OMA's own tests |

## Linear → OMA shell, navigation, panels and density

| # | Pattern | Status | Evidence | OMA surface | Why it matters | Divergence to preserve |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | A three-zone shell of navigation, content and an optional detail panel | `LIVE_VERIFIED`, measured | `EV-LIN-001` | Global shell, intelligence workspace | The detail panel is a peer of the list, not a replacement | OMA's shell serves one product domain; destination count must stay honest to what exists |
| L2 | Navigation grouped by scope — personal, workspace, team | `LIVE_VERIFIED` | `EV-LIN-001` | Global shell | Scope is legible from the navigation itself | OMA's brand/tenant context must be visible whenever switching affects tenant-scoped work |
| L3 | Administrative entries demoted behind progressive disclosure | `LIVE_VERIFIED` | `EV-LIN-001` | Global shell | Daily destinations are not diluted by settings | — |
| L4 | A repeatable page skeleton: context, saved-view tabs, view controls, then data | `LIVE_VERIFIED` | `EV-LIN-001` | Brand list, discovered pages, insight lists | One learnable page shape across a product | — |
| L5 | Group headers carry their own counts | `LIVE_VERIFIED` | `EV-LIN-001` | Discovered pages, insights | Volume is readable without counting rows | — |
| L6 | The same object is addressable as a panel and as a deep-linkable full page | `LIVE_VERIFIED` | `EV-LIN-001` | Evidence side panel, insight detail | Context preserved for browsing, addressability preserved for sharing | `FR-BWI-019` requires deep links and refresh to remain correct |
| L7 | Filters are additive from one dialog, with per-option counts shown before applying | `LIVE_VERIFIED` | `EV-LIN-002` | Discovered pages, insight filters | The operator knows whether a filter returns anything | — |
| L8 | Density is user-controlled — grouping, ordering and which properties appear on a row | `LIVE_VERIFIED` | `EV-LIN-002` | Discovered pages, insight lists | Density is a preference, not a fixed layout | — |
| L9 | Shortcuts are taught inline inside the command surface the operator already uses | `LIVE_VERIFIED` | `EV-LIN-003` | Global shell | The keyboard model is discoverable without a manual | `NFR-BWI-005` requires keyboard access for critical actions |
| L10 | Calm is partly achieved by not animating; measured transitions were zero-duration at the observed viewport | `LIVE_VERIFIED`, measured | `EV-LIN-004` | All surfaces | Restraint is a measured property here, not an impression | Measured at one viewport only. Any broader claim is `INFERENCE`. OMA's own motion budget stays in `DESIGN_REFERENCE_STRATEGY` §5 |
| L11 | Every empty state names what is missing and offers the next action; some teach the shortcut | `LIVE_VERIFIED` | `EV-LIN-006` | Every 002 surface | An empty state is an instruction, not a blank | `FR-BWI-033` makes empty, loading, error and permission-denied states mandatory |
| L12 | No spinner on fast local transitions | `LIVE_VERIFIED`, measured | `EV-LIN-004` | List navigation | A spinner on an instant transition is noise | OMA still requires explicit loading states for genuinely asynchronous scan work |
| L13 | Hover and selection are painted behind the row and selection is additionally exposed in the DOM, not by colour alone | `LIVE_VERIFIED`, measured | `EV-LIN-004` | All lists | Non-colour status signalling | Directly serves OMA's rule that colour is never the only status signal |
| L14 | Theme is an account preference defaulting to the system setting | `LIVE_VERIFIED` (read only) | `EV-LIN-007`, `EV-LIN-008` | Surface model | Theme belongs to the person | OMA's light-first operational surface plus dark review canvas is a contextual model, not a user theme |
| L15 | On small viewports the product reduces to a few destinations plus a create action | `DOC_VERIFIED` | `EV-LIN-009` | Responsive behaviour | Reduce rather than compress | `NFR-BWI-005` responsiveness is not proven by this baseline; only the observed collapse behaviour was seen |

## Planable → OMA review, decision and approval surfaces

| # | Pattern | Status | Evidence | OMA surface | Why it matters | Divergence to preserve |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | Approval governance is a property of the workspace, chosen at creation, with an option to have none | `LIVE_VERIFIED` (option set) + `DOC_VERIFIED` | `EV-PLA-001`, `EV-PLA-006` | Brand workspace setup | Governance is configured once, not per item | OMA's 002 approval topology is a single internal Version approve capability; `DEC-009` stays open |
| P2 | A personal queue separates what awaits me, what I responded to, and what is settled | `LIVE_VERIFIED` | `EV-PLA-002` | Needs-review surface | The reviewer's own state of play is legible | — |
| P3 | Bulk actions are disabled at zero rather than hidden | `LIVE_VERIFIED` | `EV-PLA-002` | Approval summary | The capability stays discoverable when unavailable | `FR-BWI-033` requires a permission-denied state that does not fake success |
| P4 | Each empty section carries its own sentence, not a shared blank | `LIVE_VERIFIED` | `EV-PLA-002` | Needs-review surface | Specific emptiness is informative | — |
| P5 | One item reviewed with status, content, prior discussion and the decision control in one stable surface | `LIVE_VERIFIED` | `EV-PLA-003` | Insight review, evidence panel | Deciding requires context in place | — |
| P6 | Sequential review with item-of-total progress, where skipping is a legitimate non-decision | `LIVE_VERIFIED` | `EV-PLA-002` | Insight review | Reviewing many items without forcing a verdict on each | — |
| P7 | Status lives on three independent axes — approval, publication, discussion — never blended | `LIVE_VERIFIED` | `EV-PLA-004` | Brand status, scan status, review status | One badge vocabulary must never mean two things | OMA already keeps brand lifecycle, scan attempt and profile version as three composed machines (§9) |
| P8 | "Partially approved" is a first-class state, not an absence of approval | `LIVE_VERIFIED` | `EV-PLA-004` | Partial disclosure | Partial truth deserves its own name | OMA's `Partial` additionally gates approval behind explicit disclosure |
| P9 | A blocked state always exposes its reason | `LIVE_VERIFIED` (option set) + `DOC_VERIFIED` | `EV-PLA-004`, `EV-PLA-016` | Scan failure, blocked pages | A blocked icon without a reason is a dead end | — |
| P10 | Requesting review over a set is a different mode from deciding on one item | `LIVE_VERIFIED` | `EV-PLA-004` | Insight decide versus version approve | The distinction OMA enforces as two capabilities | `FR-BWI-029b`: Insight decide can never approve or reject a whole version |
| P11 | Approval is attributed to a named actor on the artifact itself | `LIVE_VERIFIED` + `DOC_VERIFIED` | `EV-PLA-003`, `EV-PLA-008` | Approval summary, version history | Accountability is visible where the decision landed | `FR-BWI-029d` additionally requires an audit event with correlation id |
| P12 | A reviewer proposes exact replacement content; it stays inert until the owner disposes of it | `LIVE_VERIFIED` (empty state) + `DOC_VERIFIED` | `EV-PLA-003`, `EV-PLA-010` | Insight accept/reject/edit | The closest reference analogue to OMA's per-insight disposition | OMA records the disposition with actor, timestamp and prior value references |
| P13 | Resolving a comment hides it behind a toggle rather than deleting it | `DOC_VERIFIED` | `EV-PLA-009` | Review history | Review history survives resolution | Approved versions preserve review history (`FR-BWI-030`) |
| P14 | Internal deliberation is partitioned from client-visible discussion at the data level | `DOC_VERIFIED` | `EV-PLA-011` | Review collaboration | Visibility is structural, not conventional | Client-facing exposure is out of 002 scope; recorded as a later input |
| P15 | Drafts are hidden by default and revealed deliberately | `DOC_VERIFIED` | `EV-PLA-011`, `EV-PLA-015`, `EV-PLA-014` (surface `PLA-024`) | Review readiness | A reviewer never sees work before it is offered | — |
| P16 | The strongest external participant is capped strictly below the approval boundary | `DOC_VERIFIED` | `EV-PLA-012`, `EV-PLA-014` | Approval authority | An unauthenticated link must never carry decision authority | Reinforces `FR-BWI-005`: a client-supplied identifier is never sufficient authority |
| P17 | History is reachable from the object it belongs to | `LIVE_VERIFIED` (activity) + `DOC_VERIFIED` (versions) | `EV-PLA-003`, `EV-PLA-019` | Version index | Not only the newest item exposes the past | — |
| P18 | Review work arrives as a notification that deep-links to the deciding surface | `LIVE_VERIFIED` | `EV-PLA-005` | Notifications, deep links | The path from prompt to decision is one hop | `FR-BWI-019` requires deep-link re-entry to stay correct; cross-tenant notification leakage is forbidden |
| P19 | Immutability after approval is a reversible setting | `DOC_VERIFIED` | `EV-PLA-006` | — | Recorded as an **anti-pattern for OMA** | OMA's approved version is immutable by construction; corrections create a new version (`FR-BWI-030`) |
| P20 | Restoring a previous version overwrites the current one | `DOC_VERIFIED` | `EV-PLA-019` | — | Recorded as an **anti-pattern for OMA** | OMA never restores over an approved artifact |
| P21 | Whole-version rejection, and any pre-approval completeness gate | `UNKNOWN` | `PLA-A-010`, `05-journey-catalog.md` J-08 | Approve/reject version, approval summary | Recorded as **not provable** | No reject command was observed and no reference gates approval on completeness. OMA's `FR-BWI-029` reject path and `FR-BWI-029a` disclosure gate are original OMA behaviour and must be proven by OMA's own tests |

---

## Patterns Feature 002 needs that no in-scope reference provides

Recorded so a later phase does not go looking for a precedent that does not exist in this baseline:

| OMA requirement | Reference status |
| --- | --- |
| Incompleteness disclosure with explicit confirmation before approval (`FR-BWI-029a`) | `UNKNOWN` in all four references |
| Whole-version reject as a distinct authorized command (`FR-BWI-029`) | `UNKNOWN` |
| Per-claim information state across `OBSERVED` / `AI_INFERRED` / `USER_CONFIRMED` / `USER_CORRECTED` / `STALE` (`FR-BWI-027`) | `UNKNOWN`; Jasper's empty-field semantics are the nearest partial precedent |
| Per-claim confidence and per-claim evidence linkage (`FR-BWI-023`) | `UNKNOWN`; Semrush links findings to source URLs but not claims to confidence |
| Field-level version comparison with evidence references (`US-BWI-05`) | `REFERENCE_LIMITED`; Semrush compares counts, not field values |
| Worker re-authorization mid-flight (`FR-BWI-017`) | `UNKNOWN` |
| Tenant isolation and no existence leakage (`FR-BWI-003`–`FR-BWI-005`) | `UNKNOWN`; single-account inspection only, and cross-tenant probing was neither attempted nor permitted |
| Human edit versus late AI write conflict surfacing (`FR-BWI-030`, edge case 19) | `UNKNOWN` |
| Arabic and RTL behaviour | `UNKNOWN`; not inspected in any reference |
| Re-authorization on evidence panel open (`FR-BWI-025`) | `UNKNOWN` |

No gap resolution, prioritisation or implementation follows from this table in this phase.
