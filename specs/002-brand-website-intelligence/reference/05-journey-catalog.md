# Journey Catalog — Feature 002 Reference Coverage

Nine journeys relevant to Feature 002. Each step carries its own coverage classification, because a
journey is rarely uniformly provable end to end.

| Classification | Meaning |
| --- | --- |
| `LIVE_VERIFIED` | The step was observed in an authenticated reference session. |
| `DOC_VERIFIED` | An official documentation page describes the step; the live surface was not observed. |
| `REFERENCE_LIMITED` | Access, plan gating or the read-only policy prevented verification. |
| `REFERENCE_LIMITED_NEEDS_SANDBOX_DATA` | The step exists but requires data or entitlement the OMA-owned account lacks. |
| `UNKNOWN` | No official source establishes the step at all. |

This catalog records **reference** behaviour. It is not an OMA journey specification, and OMA's own
divergences are noted where they matter so no reader mistakes a reference step for an OMA decision.

---

## J-01 — Configure a website scan
**Primary reference:** Semrush · **Feature 002 journey:** US-BWI-01 / US-BWI-02 setup

| Step | Coverage | Evidence | Notes |
| --- | --- | --- | --- |
| Reach the audit entry point | `LIVE_VERIFIED` | `EV-SEM-001` | A single-field domain entry precedes all configuration. |
| Select the crawl scope | `DOC_VERIFIED` | `EV-SEM-002`, `EV-SEM-003` | Scope is chosen before any volume bound, and subdomain inclusion is a separate explicit checkbox. |
| Set a page limit | `DOC_VERIFIED` | `EV-SEM-002`, `EV-SEM-004` | Per-audit limit and cumulative monthly budget are separate numbers, both visible to the operator. |
| Choose a crawl source | `DOC_VERIFIED` | `EV-SEM-002` | Four sources; a URL-list upload reports the parsed count back before starting. |
| Configure crawler identity and rate | `DOC_VERIFIED` | `EV-SEM-002` | The resolved user-agent string is shown and is copyable so the operator can reproduce the fetch. |
| Set URL include/exclude and parameter rules | `DOC_VERIFIED` | `EV-SEM-002` | Matching semantics are documented, including that a missing trailing slash broadens the exclusion. |
| Handle robots and protected areas | `DOC_VERIFIED` | `EV-SEM-002` | Robots bypass is gated behind ownership verification. **OMA divergence:** 002 does not bypass robots (`FR-BWI-011`) and relies on attestation (`FR-BWI-010`). |
| Set a schedule | `DOC_VERIFIED` | `EV-SEM-002`, `EV-SEM-005` | A manual-only option exists alongside recurring options. |
| See validation and errors during setup | `DOC_VERIFIED` | `EV-SEM-002`, `EV-SEM-004` | Named causes with remedies; a failed crawl yields a downloadable log. |
| Observe the live configuration UI | `REFERENCE_LIMITED_NEEDS_SANDBOX_DATA` | `EV-SEM-001` | Requires an active subscription and a provisioned project. Field-level validation copy, defaults and error styling remain unverified. |

**Journey verdict:** structurally `DOC_VERIFIED`; the live surface is `REFERENCE_LIMITED_NEEDS_SANDBOX_DATA`.

---

## J-02 — Start and monitor a scan
**Primary reference:** Semrush · **Feature 002 journey:** US-BWI-02

| Step | Coverage | Evidence | Notes |
| --- | --- | --- | --- |
| Start the crawl | `DOC_VERIFIED` | `EV-SEM-002`, `EV-SEM-013` | Concurrency and budget ceilings are enforced and reported as named limits. No crawl was started. |
| Observe queued state | `UNKNOWN` | — | No queued-state label is documented and the live app was unreachable. |
| Observe progress | `DOC_VERIFIED` | `EV-SEM-010`, `EV-SEM-011` | A page counter plus a details dropdown, with a documented final stage during which the counter stops while work continues. This is why OMA separates `Crawling`, `Extracting` and `Analyzing`. |
| Stop a running crawl | `DOC_VERIFIED` | `EV-SEM-011` | Only offered after a minimum page count. Stop-and-save presents the unfinished crawl as current. **OMA divergence:** an incomplete run is `Partial` with mandatory disclosure (`FR-BWI-029a`). |
| See completion | `DOC_VERIFIED` | `EV-SEM-013` | Completion yields a health figure and a page classification. |
| See failure | `DOC_VERIFIED` | `EV-SEM-004`, `EV-SEM-002` (surface `SEM-C-018`) | Named causes: blocked crawler, `noindex`, DNS/offline host, size ceiling, budget or concurrency exhaustion, zero pages crawled. Blocked resources are never reported as analysed. |
| Re-run | `DOC_VERIFIED` | `EV-SEM-012`, `EV-SEM-013` | Results are replaced. **OMA divergence:** a rescan creates a new Draft (`FR-BWI-031`). |
| See last-updated state | `REFERENCE_LIMITED` | `EV-SEM-012`, `EV-SEM-013` | Crawl dates exist in the comparison surface, but a "last updated" header label is not documented. Not asserted. |
| Observe live runtime states | `REFERENCE_LIMITED_NEEDS_SANDBOX_DATA` | `EV-SEM-001` | No running crawl was ever observable. |

**Journey verdict:** `DOC_VERIFIED` with one `UNKNOWN` step and no live runtime observation.

---

## J-03 — Review discovered pages and issues
**Primary reference:** Semrush · **Feature 002 journey:** US-BWI-03

| Step | Coverage | Evidence | Notes |
| --- | --- | --- | --- |
| See an overview with coverage | `DOC_VERIFIED` | `EV-SEM-013`, `EV-SEM-015` | A headline figure over a severity breakdown, with pages classified by fetch outcome into healthy, broken, has-issues, redirects and blocked. |
| See findings by severity | `DOC_VERIFIED` | `EV-SEM-016` | Three tiers, with the lowest explicitly excluded from the headline figure. |
| Browse crawled pages | `DOC_VERIFIED` | `EV-SEM-008` | A configurable column set including canonical, status code, crawl depth and per-page issue count. |
| Filter, search and sort | `DOC_VERIFIED` | `EV-SEM-008`, `EV-SEM-016` | Filters are combinable across issue status, crawl depth and HTTP status. |
| See statistics and thematic groupings | `DOC_VERIFIED` | `EV-SEM-006`, `EV-SEM-017` | Aggregates click through to the affected pages; one theme states the sampled subset it was computed over. |
| See remediation guidance | `DOC_VERIFIED` | `EV-SEM-016` | Attached to the finding, and available even for findings not currently present. |
| See a stale derived score | `DOC_VERIFIED` | `EV-SEM-016` | Hiding an issue changes the score only after a re-run, and the product says so. Directly relevant to OMA never presenting a derived figure as fresher than its inputs. |
| Observe the live results UI | `REFERENCE_LIMITED_NEEDS_SANDBOX_DATA` | `EV-SEM-001` | Never rendered. |

**Journey verdict:** `DOC_VERIFIED`; no live results surface observed.

---

## J-04 — Inspect evidence behind a finding
**Primary references:** Semrush, Linear · **Feature 002 journey:** evidence side panel, `FR-BWI-023`, `FR-BWI-025`

| Step | Coverage | Evidence | Notes |
| --- | --- | --- | --- |
| Open a finding's affected sources | `DOC_VERIFIED` | `EV-SEM-016` | Every finding resolves to the concrete URL list that produced it. |
| See per-page attributes beside its findings | `DOC_VERIFIED` | `EV-SEM-008` | A single-page view combines attributes with that page's findings and their remediation links. |
| Reach the live source | `DOC_VERIFIED` | `EV-SEM-008` | An affordance opens the actual page externally. |
| Inspect detail without losing list position | `LIVE_VERIFIED` | `EV-LIN-001` | Linear's detail panel is a peer of the list, and the same object is also addressable as a full page. |
| Re-authorize on evidence open | `UNKNOWN` | — | No reference exposes its authorization behaviour on panel open. OMA's `FR-BWI-025` requirement has no reference precedent and must be proven in OMA's own tests. |
| See source freshness and extraction method | `DOC_VERIFIED` in part | `EV-SEM-008`, `EV-JAS-005` | Semrush surfaces crawl depth, status and load time per page; Jasper documents a cache window and fetch-at-generation semantics for URL sources. Neither exposes a per-claim extraction-method label. |
| See a rendered snapshot of the source page | `UNKNOWN` | — | Not documented in any in-scope reference. Consistent with OMA deferring snapshots under `DEC-003`. |

**Journey verdict:** partially `DOC_VERIFIED`, partially `LIVE_VERIFIED`, with two `UNKNOWN` steps that OMA must prove independently.

---

## J-05 — Organize a brand profile
**Primary reference:** Jasper Brand IQ · **Feature 002 journey:** US-BWI-04, `FR-BWI-026`

| Step | Coverage | Evidence | Notes |
| --- | --- | --- | --- |
| See brand information split into named sections | `DOC_VERIFIED` | `EV-JAS-001`, `EV-JAS-002` | Six separately named components rather than one monolithic record. |
| Define a brand voice | `DOC_VERIFIED` | `EV-JAS-004` | Named fields, a bounded example count, and an explicit on-brand versus off-limits vocabulary. |
| Organize supporting knowledge | `DOC_VERIFIED` | `EV-JAS-006` | Named, tagged, visibility-scoped assets whose editability depends on their source type. |
| Support several brands | `DOC_VERIFIED` | `EV-JAS-008`, `EV-JAS-012` | Achieved by grouping components, not by duplicating a bundled profile. **This is workspace-internal grouping, not a tenancy boundary.** |
| Observe the live editor | `AUTH_REQUIRED` / `REFERENCE_LIMITED` | `EV-JAS-018` | No signed-in session exists; signup was refused. Layout, in-app labels and interaction are unobserved. |

**Journey verdict:** `DOC_VERIFIED` in structure; **no step is `LIVE_VERIFIED`**.

---

## J-06 — Edit brand information and handle unknowns
**Primary reference:** Jasper Brand IQ · **Feature 002 journey:** `FR-BWI-020`, `FR-BWI-022`, `FR-BWI-028b`

| Step | Coverage | Evidence | Notes |
| --- | --- | --- | --- |
| Derive information from sources | `DOC_VERIFIED` | `EV-JAS-004`, `EV-JAS-005`, `EV-JAS-008` | A crawl-not-scrape statement for URL sources, and attribute auto-population from attached sources. |
| See an empty field as "the source did not surface this" | `DOC_VERIFIED` | `EV-JAS-008` | The strongest documented precedent for OMA treating absence as `Unknown` rather than inventing a value. |
| Close a gap manually | `DOC_VERIFIED` | `EV-JAS-008` | Edit details, swap or add sources, or re-map attributes. |
| Fall back to manual entry when a fetch fails | `DOC_VERIFIED` | `EV-JAS-004` | Named remedies include pasting example text directly, which is the reference analogue of OMA's manual completion path. |
| See a confidence value per claim | `UNKNOWN` | — | Not documented. OMA's confidence and information-state taxonomy is stricter than any in-scope reference. |
| See a citation per claim | `UNKNOWN` | `EV-JAS-007` | Appears only as a marketing claim with no documented citation surface. Not evidence. |
| Observe the live editing flow | `AUTH_REQUIRED` / `REFERENCE_LIMITED` | `EV-JAS-018` | Unobserved. |

**Journey verdict:** `DOC_VERIFIED` for the unknown-handling principle; two `UNKNOWN` steps; nothing live.

---

## J-07 — Review an item-level insight and decide on it
**Primary references:** Planable, Jasper · **Feature 002 journey:** US-BWI-04, `FR-BWI-029b`

| Step | Coverage | Evidence | Notes |
| --- | --- | --- | --- |
| Reach a personal review queue | `LIVE_VERIFIED` | `EV-PLA-002` | Three counted sections separating what awaits me, what I responded to, and what is settled, each with its own empty-state sentence. |
| Arrive from a notification | `LIVE_VERIFIED` | `EV-PLA-005` | Approval requests occupy their own tab and deep-link straight to the deciding surface. |
| Review one item with full context | `LIVE_VERIFIED` | `EV-PLA-003` | Status, content, prior discussion and the decision control in one stable surface. |
| Review many items sequentially | `LIVE_VERIFIED` | `EV-PLA-002` | Item-of-total progress with previous, next and skip, where skipping is a legitimate non-decision. |
| Comment and pin feedback to a span | `LIVE_VERIFIED` (comments) + `DOC_VERIFIED` (annotations) | `EV-PLA-003`, `EV-PLA-009`, `EV-PLA-010` | Nothing was posted. |
| Propose an exact edit and dispose of it | `LIVE_VERIFIED` (empty state) + `DOC_VERIFIED` | `EV-PLA-003`, `EV-PLA-010` | The closest reference analogue to OMA's per-insight accept, reject or edit disposition: a proposal is inert until a human disposes of it. |
| Keep internal deliberation separate from client-visible discussion | `DOC_VERIFIED` | `EV-PLA-011` | Partitioned at the data level, not by convention. |
| Reject an individual item | `UNKNOWN` | `PLA-A-010` | **No reject action was observed anywhere.** The sequential flow offers only approve and skip. OMA's explicit per-insight reject has no proven reference precedent. |
| See AI output marked as a proposal | `DOC_VERIFIED` | `EV-JAS-004`, `EV-JAS-009` | A with-versus-without comparison, and documentation that an automatic setup is a starting point requiring review. |

**Journey verdict:** largely `LIVE_VERIFIED`, with per-item rejection `UNKNOWN`.

---

## J-08 — Approve or reject a whole version
**Primary reference:** Planable · **Feature 002 journey:** `FR-BWI-029`, `FR-BWI-029a`, `FR-BWI-030`

| Step | Coverage | Evidence | Notes |
| --- | --- | --- | --- |
| Configure whether approval is required | `LIVE_VERIFIED` (option set) + `DOC_VERIFIED` (behaviour) | `EV-PLA-001`, `EV-PLA-006` | Four workflows from hidden through optional to required and multi-level. Governance is a property of the scope, chosen at creation. |
| Request approval over a set | `LIVE_VERIFIED` | `EV-PLA-004` | A distinct selection mode, separate from deciding on one item — the same separation OMA draws between insight decide and version approve. |
| See who may approve | `DOC_VERIFIED` | `EV-PLA-006`, `EV-PLA-013` (see `06-role-permission-matrix.md`) | A dedicated approve permission, separable from edit and publish. |
| Approve with visible attribution | `LIVE_VERIFIED` (control and resulting status) + `DOC_VERIFIED` | `EV-PLA-003`, `EV-PLA-008` | The approving actor is named on the item itself. |
| See a partially-approved state | `LIVE_VERIFIED` | `EV-PLA-004` | A first-class filter value, not an absence of approval — the shape of OMA's Partial disclosure. |
| See incompleteness disclosed before approving | `UNKNOWN` | — | **No reference surfaces a pre-approval incompleteness gate.** Semrush instead presents an unfinished crawl as current, and Planable's approval carries no completeness precondition. OMA's `FR-BWI-029a` disclosure requirement is an original OMA behaviour with no reference precedent and must be proven in OMA's own tests. |
| Reject a whole version | `UNKNOWN` | `PLA-A-010` | No reject command was observed. |
| Prevent change after approval | `DOC_VERIFIED` | `EV-PLA-006` | A reversible lock-after-approval setting. **OMA divergence:** the approved version is immutable by construction and a correction creates a new version (`FR-BWI-030`). |
| Cap external participants below the approval boundary | `DOC_VERIFIED` | `EV-PLA-012`, `EV-PLA-014` | Account-less guests may comment and suggest but explicitly cannot approve. |

**Journey verdict:** substantially covered, but the two behaviours most central to OMA's approval gate — pre-approval incompleteness disclosure and whole-version rejection — are `UNKNOWN` in every in-scope reference.

---

## J-09 — Compare versions and read history
**Primary references:** Semrush, Planable · **Feature 002 journey:** US-BWI-05

| Step | Coverage | Evidence | Notes |
| --- | --- | --- | --- |
| Compare two identified runs | `DOC_VERIFIED` | `EV-SEM-012` | Selected by date, reporting what was fixed and what newly appeared between them — the shape of OMA's draft-versus-approved comparison. |
| See a trend over time | `DOC_VERIFIED` | `EV-SEM-012` | A date-ranged graph across four metric groups. |
| Read an item's activity history | `LIVE_VERIFIED` | `EV-PLA-003` | Entries naming actor, action and relative time, reachable from the item itself. |
| List previous versions | `DOC_VERIFIED` | `EV-PLA-019`, `EV-PLA-013` | Reachable from the object rather than only from the newest item. |
| Restore a previous version | `DOC_VERIFIED` | `EV-PLA-019` | **OMA divergence:** restoring over an artifact is exactly what OMA forbids for an approved version; corrections create a new version and preserve review history. |
| See a configuration change that breaks comparability | `DOC_VERIFIED` | `EV-SEM-002` (surface `SEM-C-018`) | A settings change plus re-run raises an explicit notice rather than silently comparing unlike runs. |
| Field-level differences with evidence references | `REFERENCE_LIMITED` | `EV-SEM-012` | Semrush compares issue counts, not field-level values with evidence links. OMA's field-level comparison requirement is not proven by any reference. |
| History retention limits | `DOC_VERIFIED` | `EV-SEM-013`, `EV-SEM-017`, `EV-JAS-017` | Bounded retention with advance notice before removal, and a bounded audit-log window. Relevant to `DEC-012`, not to 002 behaviour. |

**Journey verdict:** `DOC_VERIFIED` with one `REFERENCE_LIMITED` step; the restore direction is a deliberate OMA divergence.

---

## Journeys deliberately not attempted

The read-only policy forbids the data creation these would require, and no sandbox data existed:

- Running an actual website crawl in Semrush, which would create external load and consume budget.
- Creating a Planable workspace or item to observe a full create-to-approve loop end to end.
- Exercising Planable suggestion acceptance or version restore, both of which mutate content.
- Any Jasper journey whatsoever, since no account exists.

Each is recorded as `REFERENCE_LIMITED_NEEDS_SANDBOX_DATA` in `08-coverage-summary.md`. No outcome
was invented for any of them.
