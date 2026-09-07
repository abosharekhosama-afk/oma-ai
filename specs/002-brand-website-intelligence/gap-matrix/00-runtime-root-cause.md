# Runtime and Root-Cause Audit — Feature 002

Why a signed-in user reached an empty product, established by driving the running application in a
real browser rather than by reading the code alone.

**Branch:** `002-brand-website-intelligence` · **Served commit:** `1a7453c` · **Audited:** 2026-08-30

## Runtime under audit

| Component       | Evidence | Result                                                                                                               |
| --------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL      | `RT-01`  | Local development instance listening on `127.0.0.1:5432`. Non-production.                                            |
| Redis           | `RT-01`  | Local instance on `127.0.0.1:6379`.                                                                                  |
| API             | `RT-02`  | NestJS on `127.0.0.1:3001`; `GET /api/v1/health/live` returned `{"status":"ok"}`.                                    |
| Worker          | `RT-02`  | Health endpoint on `127.0.0.1:3002` returned `200`.                                                                  |
| Web             | `RT-02`  | Next.js 15.5.23 dev server on `127.0.0.1:3000`.                                                                      |
| Served source   | `RT-03`  | `git rev-parse HEAD` = `1a7453c`, worktree clean, dev server compiling from that worktree. Not a stale `main` build. |
| Process hygiene | `RT-03`  | Exactly three `node` listeners, one per service. No duplicate or orphaned stack.                                     |

Every service bound to loopback only. No build ran concurrently with the probes.

## Verdict

The product was **not blank and not broken**. The shell, navigation, routes, API and database all
worked. The signed-in account simply had **no active company**, and the product correctly refuses to
show tenant-scoped work without one.

Two distinct causes produce that state, and they affect different users.

### Cause 1 — `MISSING_DEMO_DATA` (the account that was used)

Classification: **`MISSING_DEMO_DATA`**, with a contributing discoverability defect.

`apps/api/src/identity/identity.service.ts:107-116` selects an active tenant at login only when the
user belongs to exactly one:

```116:116:apps/api/src/identity/identity.service.ts
    const soleTenantId = tenantIds.size === 1 ? [...tenantIds][0] : null;
```

The comment above it states the intent plainly, and the intent is correct: choosing for a
multi-tenant member would be a guess, and tenant authority is server-resolved.

The bootstrap platform owner has **216 active memberships** (`RT-04`). So `activeTenantId` is `null`,
`GET /api/v1/brands` answers `409 TENANT_REQUIRED` (`RT-05`), and `/app` renders the
select-a-company card (`RT-06`, screenshot `11-owner-landing.png`). That card is the entire visible
product until a company is picked.

The 216 memberships are **test residue**, not real data. Tenant names group as roughly 160 rows named
`Brand Tenant` and 37 named `E2E Brand Co` (`RT-07`), because every E2E run creates a tenant against
this same shared bootstrap account (`tests/e2e/helpers/brand-api.ts:31-47`). The switcher therefore
renders **219 options that are mostly indistinguishable by name** (`RT-08`), with no search and no
grouping. A user cannot reasonably find the one seeded demo company in that list.

Proof that the product itself is complete for this journey: selecting the seeded `OMA Demo Agency`
company yields a fully populated experience — four brands with status badges and connected website
URLs — in EN, Arabic RTL, at 1024 and at 390 (`RT-09`, screenshots `60-*`, `61-*`).

### Cause 2 — `UI_MISSING` (every self-registered user)

Classification: **`UI_MISSING`**, blocking.

`register` creates a `User` and nothing else — no `Tenant`, no `Membership`
(`apps/api/src/identity/identity.service.ts:52-78`). A freshly registered account therefore has
**zero memberships** (`RT-10`), and the shell shows `You have no active company membership.`

`POST /api/v1/tenants` exists and works — it returned `201` when called directly (`RT-11`) — but
**no web surface calls it**. The only tenant endpoint referenced anywhere in `apps/web/src` is
`/api/v1/tenants/active`, in `apps/web/src/components/shell/tenant-switcher.tsx:48`. There is no
create-company route, no create-company form, and no invitation-acceptance surface.

Consequence: a self-registered user is in a **permanent dead end**. They can sign in, see the shell,
and do nothing else, forever. This is the harder half of the reported symptom and it is a genuine
product gap rather than a data condition.

### Cause 3 — `TEST_FALSE_POSITIVE` (why this was never caught)

Classification: **`TEST_FALSE_POSITIVE`**.

The E2E suite cannot observe either cause above.

| What is never exercised                     | Evidence                                                                                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reaching the app through the **login form** | `RT-12` — no spec under `tests/e2e/` submits the login form to enter `/app`. `auth-session.e2e.ts` registers instead.                                                                   |
| The **tenant switcher UI**                  | `RT-12` — zero matches for the switcher's label or select across `tests/e2e/`. Every test activates a tenant by `fetch` inside `page.evaluate` (`tests/e2e/helpers/brand-ui.ts:16-27`). |
| **Creating a company**                      | `RT-12` — always `POST /api/v1/tenants` from the test context (`tests/e2e/helpers/brand-api.ts:41`).                                                                                    |
| **Creating a brand through its form**       | `RT-12` — always `apiPost(request, '/api/v1/brands', …)` then a direct `page.goto` to the next route (`tests/e2e/helpers/brand-ui.ts:31-49`).                                           |
| A user with **no company**                  | `RT-12` — every test authenticates as the bootstrap owner and immediately attaches a freshly created tenant.                                                                            |

`auth-session.e2e.ts` is the clearest false positive. It registers a brand-new user and asserts only
that `/app` renders an `h1` reading `Workspace`. That assertion **passes while the user has zero
companies and cannot use the product at all**, because the heading belongs to the shell, not to any
tenant-scoped content.

`installOwnerSession` also injects session cookies directly, so the login form's own redirect
behaviour is never proven from the browser's perspective.

## Causes ruled out, with evidence

Each was tested and disproved. None of these contributed.

| Candidate                 | Result                          | Evidence                                                                                                                                                                     |
| ------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RUNTIME_STALE_PROCESS`   | Ruled out                       | `RT-03` — one process per port, serving the current worktree.                                                                                                                |
| `WRONG_BRANCH_OR_SHA`     | Ruled out                       | `RT-03` — `HEAD` = `origin/002-brand-website-intelligence` = `1a7453c`.                                                                                                      |
| `TENANT_CONTEXT_FAILURE`  | Ruled out                       | `RT-13` — selecting a company through the switcher UI set `active_tenant_id` correctly and every scoped call then succeeded.                                                 |
| `MEMBERSHIP_FAILURE`      | Ruled out                       | `RT-04` — memberships resolve correctly; there are simply too many, and none for a new user.                                                                                 |
| `CAPABILITY_FAILURE`      | Ruled out                       | `RT-14` — with a company active, every capability-gated action was permitted for the owner and no permission-denied state appeared.                                          |
| `NAVIGATION_DISCONNECTED` | Ruled out                       | `RT-15` — clicking `Brand Intelligence` in the sidebar navigated to `/app/brands`; brand-level tabs `Overview, Website, Scan, Discovery, Intelligence` all render and route. |
| `ROUTE_DISCONNECTED`      | Ruled out for the brand journey | `RT-15` — every Feature 002 route resolved. The one genuinely unreachable capability is company creation, recorded above as `UI_MISSING`.                                    |
| `API_FAILURE`             | Ruled out                       | `RT-16` — the only `>=400` responses observed were a deliberate `404` for a nonexistent brand id and the expected `409 TENANT_REQUIRED` before company selection.            |
| `HYDRATION_FAILURE`       | Ruled out                       | `RT-17` — zero `pageerror` and zero console errors across EN, Arabic RTL, 1024 and 390.                                                                                      |
| Locale routing            | Ruled out                       | `RT-18` — `dir=rtl lang=ar` under an Arabic browser locale; all 191 message keys exist in both catalogues.                                                                   |
| Stale `.next`             | Ruled out                       | `RT-03` — dev build regenerated after checkout.                                                                                                                              |

## Runtime evidence index

Probe scripts and raw findings live in the git-ignored `.reference/002-gap-evidence/`.

| ID      | Source                                         | What it establishes                                                                                                                                                                       |
| ------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RT-01` | `lsof` on `5432`/`6379`                        | Real Postgres and Redis, loopback, non-production.                                                                                                                                        |
| `RT-02` | Health requests to `3000`/`3001`/`3002`        | All three services live.                                                                                                                                                                  |
| `RT-03` | `git rev-parse`, `git status`, `lsof`          | Served commit and clean process state.                                                                                                                                                    |
| `RT-04` | Prisma count over `Membership`                 | 216 owner memberships.                                                                                                                                                                    |
| `RT-05` | `GET /api/v1/brands` without an active company | `409 TENANT_REQUIRED`.                                                                                                                                                                    |
| `RT-06` | `probe-journeys.mjs` J-15..J-18                | Owner lands on select-a-company; `11-owner-landing.png`, `12-owner-brands.png`.                                                                                                           |
| `RT-07` | Prisma `groupBy` over `Tenant.name`            | Duplicate-name distribution of test residue.                                                                                                                                              |
| `RT-08` | `probe-tenant-journeys.mjs` G-01               | 219 rendered switcher options.                                                                                                                                                            |
| `RT-09` | `probe-demo-tenant.mjs` D-01..D-04             | Populated demo company across four locale/viewport combinations, no overflow, no console errors.                                                                                          |
| `RT-10` | `probe-journeys.mjs` J-04                      | Fresh registration yields `memberships=0`, `active_tenant=NULL`.                                                                                                                          |
| `RT-11` | `probe-tenant-journeys.mjs` G-00               | `POST /api/v1/tenants` returns `201` with no UI equivalent.                                                                                                                               |
| `RT-12` | Repository search across `tests/e2e/`          | The five never-exercised paths listed above.                                                                                                                                              |
| `RT-13` | `probe-tenant-journeys.mjs` G-01/G-01a         | Switcher UI sets the active company correctly.                                                                                                                                            |
| `RT-14` | `probe-approval.mjs` A-05..A-16                | Capability-gated controls present and functional for the owner.                                                                                                                           |
| `RT-15` | `probe-tenant-journeys.mjs` G-03, G-07         | Sidebar and brand-tab navigation both work by clicking.                                                                                                                                   |
| `RT-16` | Response monitor across all probes             | Only expected `>=400` responses.                                                                                                                                                          |
| `RT-17` | Console/pageerror monitor across all probes    | No client errors.                                                                                                                                                                         |
| `RT-18` | `probe-journeys.mjs` J-19, i18n catalogue diff | RTL applied; EN/AR key parity at 191/191.                                                                                                                                                 |
| `RT-25` | `probe-scan-controls.mjs` S-00..S-09           | `Retry scan` on `PARTIAL` creates a new attempt; cancel absent on terminal; crawl bounds disclosed as concrete numbers; brand overview shows latest scan without aggregate click-through. |

Further surface/action evidence ids `RT-19`–`RT-24` are indexed in
[`01-oma-application-inventory.md`](./01-oma-application-inventory.md).

## What this audit did not touch

No product source, schema, migration, dependency or test was modified. No production data was
reached. Companies and brands created during probing exist only in the local development database and
are named with a `ZZ Gap Probe` / `Probe Brand` prefix so they are trivially identifiable as residue.
