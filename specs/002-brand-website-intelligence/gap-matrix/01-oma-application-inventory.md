# OMA Application Inventory — as it actually runs

What the application at `1a7453c` does when driven through a browser. This records observed
behaviour, not specified behaviour. Where a control exists but was not proven to work, it says so.

**Served commit:** `1a7453c` · **Actor unless stated:** platform owner with an active company ·
**Evidence:** `RT-*` ids from [`00-runtime-root-cause.md`](./00-runtime-root-cause.md)

## Navigation inventory

| Zone | Observed content | Evidence |
| --- | --- | --- |
| Sidebar rail | Brand mark `OMA`, product name, endorsement line `OMA AI by IMKAN`, one section `WORKSPACE` with two destinations: `Home` → `/app`, `Brand Intelligence` → `/app/brands`. Active destination carries `aria-current="page"`. | `RT-15` |
| Top bar | Company selector (label `Company`), language selector (`English` / `العربية`), `Sign out`. | `RT-06`, `RT-08` |
| Brand workspace tabs | `Overview`, `Website`, `Scan`, `Discovery`, `Intelligence` — rendered inside a brand context. | `RT-15` |
| Organization context | Present only as the company selector. No company name shown elsewhere, no company settings, no member management surface. | `RT-08` |
| Settings | **None.** No settings destination exists anywhere in the web app. | `RT-15` |
| Notifications | **None in the shell.** `GET /api/v1/notifications` exists in the API; no UI surfaces it. | Repository search |

### Route status

| Route | Reachable by clicking | Status |
| --- | --- | --- |
| `/` | Entry point | Renders a landing page; does not redirect an unauthenticated visitor to `/login` (`RT-06`, `01-root-unauth.png`) |
| `/login`, `/register` | Yes, cross-linked | Working (`RT-06`) |
| `/app` | Sidebar `Home` | Working |
| `/app/brands` | Sidebar `Brand Intelligence` | Working |
| `/app/brands/new` | `Create brand` button in list and empty state | Working (`RT-19`) |
| `/app/brands/{brandId}` | Brand row in list | Working |
| `/app/brands/{brandId}/connect` | `Website` tab | Working |
| `/app/brands/{brandId}/scans/new` | `Scan` tab | Working |
| `/app/brands/{brandId}/scans/{scanId}` | Submitting scan setup | Working |
| `/app/brands/{brandId}/discovery/pages` | `Discovery` tab | Working |
| `/app/brands/{brandId}/discovery/products` | `Discovery` tab | Working |
| `/app/brands/{brandId}/profiles` | `Intelligence` tab | Working |
| `/app/brands/{brandId}/profiles/{versionId}` | Version row | Working |
| `/app/brands/{brandId}/profiles/{versionId}/compare` | `Version comparison` link | Working |

**Direct-only routes:** none. Every existing route is reachable by clicking.

**Missing routes** — capabilities the API supports with no web surface at all:

| Missing surface | Backing API | Impact |
| --- | --- | --- |
| Create company | `POST /api/v1/tenants` (verified `201`, `RT-11`) | A self-registered user can never obtain a company. Blocking. |
| Invite a member / accept an invitation | `POST /api/v1/tenants/current/invitations` | No second human can be brought into a company. |
| Member and capability administration | `apps/api/src/tenant/membership.controller.ts`, `capability.controller.ts` | Roles cannot be observed or changed by a user. |
| Notifications | `apps/api/src/notifications/notifications.controller.ts` | Review work cannot arrive as a prompt; no deep-link entry from a notification. |
| Audit history | `apps/api/src/audit/audit.controller.ts` | Decision history is recorded but not readable in product. |

**Dead routes:** none observed.

**Permission visibility:** the owner actor sees every control. No permission-denied state was
reached, because no non-owner actor exists to test with — there is no invitation UI to create one.
`PermissionDenied` and `SelectCompany` components exist and `SelectCompany` was observed rendering.

## Surface inventory

Status vocabulary: `WORKING` proven end-to-end in the browser; `WORKING_UNPROVEN_DEPTH` renders and
routes but some inner behaviour was not exercised; `MISSING` no surface exists; `DEFECT` renders but
misbehaves.

| ID | Surface | Route | Component | API | Capability | Tenant scope | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `OMA-S01` | Landing | `/` | `app/page.tsx` | — | public | n/a | `WORKING_UNPROVEN_DEPTH` — no redirect for signed-out users | `RT-06` |
| `OMA-S02` | Login | `/login` | `(auth)/login/page.tsx` | `POST /auth/login` | public | n/a | `WORKING` | `RT-06` |
| `OMA-S03` | Register | `/register` | `(auth)/register/page.tsx` | `POST /auth/register` + `login` | public | n/a | `DEFECT` — succeeds but leaves the user with no company | `RT-10` |
| `OMA-S04` | Post-login landing | `/app` | `(app)/app/page.tsx` | `GET /auth/me`, `GET /brands` | member | session tenant | `WORKING` | `RT-06`, `RT-09` |
| `OMA-S05` | Global shell | all `/app/*` | `components/shell/app-shell.tsx` | — | member | — | `WORKING` | `RT-15` |
| `OMA-S06` | Company selector | shell top bar | `shell/tenant-switcher.tsx` | `GET /auth/me`, `POST /tenants/active` | member | — | `DEFECT` — functionally correct, unusable at 219 duplicate-named options with no search | `RT-08`, `RT-13` |
| `OMA-S07` | Select-a-company state | `/app`, scoped pages | `shell/select-company.tsx` | — | member | — | `WORKING` | `RT-06` |
| `OMA-S08` | No-membership state | shell top bar | `shell/empty-membership.tsx` | — | authenticated | — | `WORKING` as a message, but it is a dead end with no action | `RT-10` |
| `OMA-S09` | Create company | — | — | `POST /tenants` | member | — | `RECONNECT` — API works; no UI | `RT-11` |
| `OMA-S10` | Brand list | `/app/brands` | `brands/page.tsx` | `GET /brands?q=` | `brand.read` | tenant | `WORKING` — search, per-brand status badge, website line | `RT-09` |
| `OMA-S11` | Brand list empty state | `/app/brands` | same | — | `brand.read` | tenant | `WORKING` — names what is missing and offers `Create brand` | `RT-19` |
| `OMA-S12` | Create brand | `/app/brands/new` | `brands/new/page.tsx` | `POST /brands` | `brand.create` | tenant | `WORKING` — single `Brand name` field; created brand persists across refresh and appears in the list | `RT-19` |
| `OMA-S13` | Brand overview | `/app/brands/{id}` | `[brandId]/page.tsx` | `GET /brands/{id}` | `brand.read` | tenant | `WORKING` | `RT-19` |
| `OMA-S14` | Connect website | `/app/brands/{id}/connect` | `connect/page.tsx` | `POST/GET /brands/{id}/website` | `brand.website.connect` | tenant | `WORKING` — URL field plus an authorization attestation checkbox; redirects to overview on success | `RT-19` |
| `OMA-S15` | Scan setup | `/app/brands/{id}/scans/new` | `scans/new/page.tsx` | `POST /brands/{id}/scans` | `brand.scan.start` | tenant | `WORKING` — concrete crawl bounds (`Maximum pages 50`, `Maximum depth 3`, `Maximum duration 600 seconds`) plus acknowledgement; no editable scope/include-exclude | `RT-25` |
| `OMA-S16` | Scan attempt | `/app/brands/{id}/scans/{scanId}` | `scans/[scanId]/page.tsx` | `GET /brands/{id}/scans/{scanId}` | `brand.scan.read` | tenant | `WORKING` — reached terminal `PARTIAL`; connector-mode disclosure; `Retry scan` works and creates a new attempt; cancel present only while non-terminal | `RT-19`, `RT-25` |
| `OMA-S17` | Discovered pages | `/app/brands/{id}/discovery/pages` | `discovery/pages/page.tsx` | `GET …/pages` | `brand.discovery.read` | tenant | `WORKING` — 10 rows, fixture-mode banner | `RT-19` |
| `OMA-S18` | Products and services | `/app/brands/{id}/discovery/products` | `discovery/products/page.tsx` | `GET …/products` | `brand.discovery.read` | tenant | `WORKING` — 8 rows | `RT-19` |
| `OMA-S19` | Version index | `/app/brands/{id}/profiles` | `profiles/page.tsx` | `GET …/profiles` | `brand.profile.read` | tenant | `WORKING` — status badge and `AI unavailable` badge per version | `RT-20` |
| `OMA-S20` | Intelligence editor | `/app/brands/{id}/profiles/{versionId}` | `profiles/[versionId]/page.tsx` + `brand/profile-sections.tsx` | `GET/PATCH …/profiles/{versionId}` | `brand.profile.read` / `.edit` | tenant | `DEFECT` — sections render as labelled fields with `Fact` / `Required` / `Optional` badges, but one section heading leaks a raw i18n key | `RT-20`, `RT-21` |
| `OMA-S21` | Evidence side panel | same route | `brand/evidence-side-panel.tsx` | `GET …/evidence/{id}` | `brand.evidence.read` | tenant | `WORKING` — nine `View evidence` triggers; panel opens | `RT-20` |
| `OMA-S22` | Insight decisions | same route | `brand/insight-decision-controls.tsx` | `POST …/insights/{id}/accept|reject` | `brand.insight.decide` | tenant | `WORKING_UNPROVEN_DEPTH` — controls render only for `AI_INFERRED` + `PENDING` insights; under the fixture connector every insight is `OBSERVED`, so accept/reject was never executed | `RT-20`, `RT-22` |
| `OMA-S23` | Approval summary | same route | `brand/approval-summary.tsx` | `POST …/approve`, `…/reject` | `brand.profile.approve` | tenant | `WORKING` — both gates enforced, approval persists, section disappears after approval | `RT-23` |
| `OMA-S24` | Partial-coverage disclosure | same route | `brand/approval-summary.tsx` | — | `brand.profile.approve` | tenant | `WORKING` — `PARTIAL` scan raised `PARTIAL_ACK_REQUIRED` server-side and the UI required the acknowledgement before enabling approval | `RT-23` |
| `OMA-S25` | Whole-version reject | same route | `brand/approval-summary.tsx` | `POST …/reject` | `brand.profile.approve` | tenant | `WORKING_UNPROVEN_DEPTH` — `Reject version` control present and distinct from per-insight reject; the command itself was not executed | `RT-20` |
| `OMA-S26` | Version comparison | `…/profiles/{versionId}/compare` | `compare/page.tsx` | `GET …/compare` | `brand.profile.read` | tenant | `WORKING` — field-level table with per-side information state; correct `No approved version to compare against.` state before approval | `RT-23` |
| `OMA-S27` | Review collaboration | `…/profiles/{versionId}` | `brand/review-collaboration.tsx` | — | `brand.profile.read` | tenant | `WORKING_UNPROVEN_DEPTH` — section renders; no comment was posted | `RT-20` |
| `OMA-S28` | AI-unavailable banner | `…/profiles/{versionId}` | `brand/ai-unavailable-banner.tsx` | — | — | tenant | `WORKING` — `AI unavailable` badge shown on the version | `RT-20` |
| `OMA-S29` | Connector-mode banner | scan and discovery | `brand/connector-mode-banner.tsx` | — | — | tenant | `WORKING` — `Demo fixture — no live connector` | `RT-19` |
| `OMA-S30` | Not-found state | `/app/brands/{unknown}` | `[brandId]/page.tsx` | `GET /brands/{id}` → `404` | `brand.read` | tenant | `WORKING` — `Not found` with `Back to brands` | `RT-24` |
| `OMA-S31` | Cross-tenant denial | `/app/brands/{foreignId}` | same | `404` | `brand.read` | other tenant | `WORKING` — server returned `404`, UI showed `Not found`; no existence leakage | `RT-24` |
| `OMA-S32` | Permission-denied state | any scoped page | `shell/permission-denied.tsx` | `403` | — | tenant | `UNPROVEN` — component exists; no non-owner actor could be created to trigger it | — |
| `OMA-S33` | Loading states | all client pages | inline `role="status"` | — | — | — | `WORKING` | `RT-20` |
| `OMA-S34` | Arabic / RTL | all | `lib/locale-context.tsx` | — | — | — | `WORKING` — `dir=rtl lang=ar`, 191/191 key parity, no untranslated UI except the leaked section key | `RT-18`, `RT-21` |
| `OMA-S35` | Responsive | all | `globals.css` | — | — | — | `WORKING` at 1440, 1024 and 390 with no horizontal overflow | `RT-09` |

## Action inventory

An action counts as proven only when it reached the API, changed the database, returned, rendered,
and survived a refresh. A rendered button proves nothing.

| ID | Action | Reaches API | Changes DB | Renders result | Survives refresh | Survives re-login | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `OMA-A01` | Register | yes | yes (`User` only) | yes | yes | yes | `WORKING_BUT_INSUFFICIENT` — creates no company (`RT-10`) |
| `OMA-A02` | Sign in via form | yes | yes (`Session`) | yes | yes | yes | `WORKING` (`RT-06`) |
| `OMA-A03` | Sign out | yes | yes | yes | yes | — | `WORKING` |
| `OMA-A04` | Select active company | yes | yes (`Session.activeTenantId`) | yes, full reload | yes | **no** — a multi-company user must reselect on every login | `PARTIAL` (`RT-13`) |
| `OMA-A05` | Create company | — | — | — | — | — | `RECONNECT` — no UI (`RT-11`, `G-001`) |
| `OMA-A06` | Create brand | yes | yes | yes | yes | yes | `WORKING` (`RT-19`) |
| `OMA-A07` | Search brands | yes | n/a | yes | n/a | n/a | `WORKING` |
| `OMA-A08` | Connect website | yes | yes | yes | yes | yes | `WORKING` (`RT-19`) |
| `OMA-A09` | Start scan | yes | yes | yes | yes | yes | `WORKING`, reached `PARTIAL` (`RT-19`) |
| `OMA-A10` | Cancel scan | yes | yes | yes | yes | yes | `WORKING` — control present only while non-terminal; code and E2E exercise it (`RT-25`, `brand-q-bwi-04`) |
| `OMA-A11` | Retry scan | yes | yes | yes | yes | yes | `WORKING` — observed on `PARTIAL`; creates a new attempt (`RT-25`) |
| `OMA-A12` | Open evidence | yes | no | yes | n/a | n/a | `WORKING` (`RT-20`) |
| `OMA-A13` | Edit a profile field | — | — | — | — | — | `UNPROVEN` — edit inputs render for editable insights; no edit was submitted |
| `OMA-A14` | Accept an insight | — | — | — | — | — | `UNPROVEN` — control renders only for `AI_INFERRED` + `PENDING`; unreachable under the fixture connector (`RT-22`) |
| `OMA-A15` | Reject an insight | — | — | — | — | — | `UNPROVEN` — same condition |
| `OMA-A16` | Submit for review | — | — | — | — | — | `UNPROVEN` — the version was already `NEEDS_REVIEW`, so the control was absent |
| `OMA-A17` | Approve version | yes | yes | yes | yes | yes | `WORKING` — both gates enforced (`RT-23`) |
| `OMA-A18` | Acknowledge partial coverage | yes | yes, sent as `acknowledge_incomplete` | yes | yes | yes | `WORKING` (`RT-23`) |
| `OMA-A19` | Reject version | — | — | — | — | — | `UNPROVEN` — control present, command not executed |
| `OMA-A20` | Compare versions | yes | no | yes | n/a | n/a | `WORKING` (`RT-23`) |
| `OMA-A21` | Switch language | yes (cookie) | no | yes | yes | yes | `WORKING` (`RT-18`) |
| `OMA-A22` | Invite a member | — | — | — | — | — | `RECONNECT` — API exists (`membership.controller`); no UI (`G-018`) |
| `OMA-A23` | Read audit history | — | — | — | — | — | `RECONNECT` — API exists; no UI |

Audit writes were confirmed to exist in code for login, tenant switch, registration and approval. No
UI reads them back, so audit visibility is unproven in product.

## Journeys

| # | Journey | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Register → shell | Reaches the shell, then dead-ends with no company | `RT-10` |
| 2 | Sign in → shell | Works; a multi-company user lands on select-a-company | `RT-06` |
| 3 | Shell → Brand Intelligence by clicking | Works | `RT-15` |
| 4 | Empty state → create brand | Works | `RT-19` |
| 5 | Create brand → API → DB → UI | Works | `RT-19` |
| 6 | Refresh → same brand | Works | `RT-19` |
| 7 | Re-login → same brand | Works, after reselecting the company | `RT-19` |
| 8 | Connect website | Works | `RT-19` |
| 9 | Start and monitor scan to terminal | Works, reached `PARTIAL` | `RT-19` |
| 10 | Pages, products, evidence | Works | `RT-19`, `RT-20` |
| 11 | Manual profile without AI | Version created with `AI unavailable`; manual editing not exercised | `RT-20` |
| 12 | Insight decision | Not reachable under the fixture connector | `RT-22` |
| 13 | Partial-approval disclosure | Works, server-gated | `RT-23` |
| 14 | Whole-version reject | Control present, not executed | `RT-20` |
| 15 | Approved immutability | Works — approval persists and the approval section disappears | `RT-23` |
| 16 | Rescan → new draft | Not exercised | — |
| 17 | Version comparison | Works | `RT-23` |
| 18 | Authorized vs unauthorized roles | Not testable — no second actor can be created | — |
| 19 | Cross-tenant denial | Works — `404`, no existence leakage | `RT-24` |
| 20 | Arabic RTL and responsive | Works at 1440, 1024, 390 | `RT-09`, `RT-18` |

## Roles observed in product

**One.** Only the company owner was observable, because no invitation surface exists. The capability
model, the `CapabilityProfile`/`CapabilityGrant` schema and `CapabilitiesGuard` are all implemented,
and integration tests cover the capability union across duplicate memberships — but no role boundary
is demonstrable through the running product. Recorded as `UNPROVEN`, not as absent.

## Additional runtime evidence ids

| ID | Source | Establishes |
| --- | --- | --- |
| `RT-19` | `probe-tenant-journeys.mjs` G-02..G-14 | Create-brand through create-scan journey via UI only. |
| `RT-20` | `probe-approval.mjs` A-01..A-09 | Version index, editor sections, evidence panel, decision controls. |
| `RT-21` | i18n catalogue check plus `profile-sections.tsx:112` | The `evidence_refs` section heading has no message key in either catalogue. |
| `RT-22` | `insight-decision-controls.tsx:21` plus observed insight states | Accept/reject render only for pending AI-inferred insights. |
| `RT-23` | `probe-approve-gate.mjs` E-01..E-12 | Server eligibility, both approval gates, approval persistence, immutability, comparison. |
| `RT-24` | `probe-approval.mjs` A-19, `probe-tenant-journeys.mjs` G-25 | Not-found and cross-tenant denial. |
| `RT-25` | `probe-scan-controls.mjs` S-00..S-09 | Scan attempt surfaces `Retry scan` on `PARTIAL`; clicking creates a new attempt id; cancel correctly absent on a terminal scan; brand overview shows `Latest scan PARTIAL` with pages/products/intelligence links but no click-through coverage figure; scan setup discloses `Maximum pages 50`, `Maximum depth 3`, `Maximum duration 600 seconds` before start. |
