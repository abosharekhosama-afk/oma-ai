# Quickstart Validation Guide — Brand Website Intelligence

**Feature:** `002-brand-website-intelligence`
**Status:** provider-neutral core validation (fixture connector; refusing AI)
**Purpose:** Prove 002 behavior locally and in CI with deterministic fixtures — no public crawl egress.

## Prerequisites

- Node 22+, pnpm 9+
- PostgreSQL and Redis running locally
- Foundation bootstrap user in `.env` (copy from `.env.example`)
- Migrations applied: `pnpm db:migrate:deploy` and `pnpm db:seed`
- Platform owner bootstrapped once: `pnpm --filter @oma/api bootstrap:platform-owner`

## Local demo walkthrough (visible product baseline)

To open the product and walk the journey by hand:

```bash
pnpm db:migrate:deploy
pnpm db:seed                 # system capability profiles
pnpm --filter @oma/api bootstrap:platform-owner
pnpm dev:local               # API + worker + web
NODE_ENV=development pnpm db:seed:demo   # demo tenant and brand fixtures (idempotent)
```

Sign in at `http://127.0.0.1:3000/login` with `BOOTSTRAP_PLATFORM_OWNER_EMAIL` /
`BOOTSTRAP_PLATFORM_OWNER_PASSWORD` from `.env`, then choose **OMA Demo Agency** in
the company selector. Brand Intelligence is reachable from the sidebar.

The seed runs only when `NODE_ENV` or `OMA_ENV` is `development` or `test` **and**
`DATABASE_URL` points at a local host; anything else is refused. The environment name
must be passed explicitly — an unset one is treated as unsafe, not as development.
`DATABASE_URL` itself is read from the workspace `.env`. It grants the
existing bootstrap platform owner a `COMPANY_OWNER` membership in the demo tenant, so
that account gains demo-tenant access — it creates no separate demo login.

It creates one demo tenant with three brands:

| Brand                     | State                                                      |
| ------------------------- | ---------------------------------------------------------- |
| Northwind Services (Demo) | Draft, no website — proves the connect-website entry state |
| Acme Retail (Demo)        | Succeeded scan, pages, products, evidence, draft profile   |
| Globex Group (Demo)       | Partial scan with failed and robots-skipped pages          |

Every seeded record is a fixture. The website source carries the note
`Demo fixture — no live connector configured`; no public crawl and no AI provider run.

> **Stop the dev worker before running the test suites.** A `pnpm dev:local` worker
> shares the Redis queues with the test workers and will consume their scan jobs,
> which surfaces as unrelated contract/integration failures.

## Portable local run (alternate ports)

If port `3000` is taken by another project, pick free ports and export them before starting services:

```bash
export WEB_PORT=3100
export API_PORT=3101
export WORKER_HEALTH_PORT=3102
export WEB_BASE_URL=http://127.0.0.1:${WEB_PORT}
export WEB_ORIGIN=${WEB_BASE_URL}
export API_PUBLIC_URL=http://127.0.0.1:${API_PORT}
export BRAND_FIXTURE_CONNECTOR=1
export MAIL_PROVIDER=recording
export NODE_ENV=test
```

Start API, worker, and web from the repo root (same worktree/branch):

```bash
pnpm --filter @oma/api exec tsx src/main.ts &
pnpm --filter @oma/worker exec tsx src/main.ts &
pnpm --filter @oma/web exec next dev -p "${WEB_PORT}" -H 127.0.0.1 &
```

Wait for readiness:

```bash
curl -sf "${API_PUBLIC_URL}/api/v1/health/ready"
curl -sf "http://127.0.0.1:${WORKER_HEALTH_PORT}/"
curl -sf -o /dev/null "${WEB_BASE_URL}/"
```

Run brand Playwright journeys against the running stack:

```bash
E2E_REUSE_SERVERS=1 pnpm exec playwright test \
  tests/e2e/brand-q-bwi-01-approve.e2e.ts \
  tests/e2e/brand-q-bwi-02-partial-approve.e2e.ts \
  tests/e2e/brand-q-bwi-03-manual.e2e.ts \
  tests/e2e/brand-q-bwi-04-cancel-retry.e2e.ts \
  tests/e2e/brand-q-bwi-05-cross-tenant.e2e.ts \
  tests/e2e/brand-q-bwi-06-midflight.e2e.ts \
  tests/e2e/brand-q-bwi-07-rescan.e2e.ts \
  tests/e2e/brand-q-bwi-08-late-result.e2e.ts \
  tests/e2e/brand-q-bwi-09-reject-scope.e2e.ts \
  tests/e2e/brand-q-bwi-10-concurrency.e2e.ts \
  tests/e2e/brand-q-bwi-11-ssrf.e2e.ts \
  tests/e2e/brand-q-bwi-12-a11y-i18n.e2e.ts \
  tests/e2e/brand-q-bwi-13-capabilities.e2e.ts \
  tests/e2e/brand-responsive.e2e.ts \
  tests/e2e/brand-i18n-rtl.e2e.ts \
  tests/e2e/brand-ui-smoke.e2e.ts
```

Or let Playwright start servers on defaults (`3000`/`3001`/`3002`):

```bash
pnpm exec playwright test tests/e2e/brand-*.e2e.ts
```

Stop only processes you started from this worktree:

```bash
kill %1 %2 %3  # adjust job numbers from your shell
```

## Regression gates (repo root)

```bash
pnpm format && pnpm lint && pnpm typecheck
pnpm test
pnpm test:integration
pnpm --filter @oma/api build && pnpm --filter @oma/worker build && pnpm --filter @oma/web build
pnpm test:e2e
```

## Journey Q-BWI-01 — Create → Connect fixture → Scan → Review → Approve

Automated: `tests/e2e/brand-q-bwi-01-approve.e2e.ts` (UI journey with API session seed only).

1. Create brand in UI → brand detail.
2. Connect `https://acme.test/` (fixture host; no public DNS) with attestation.
3. Start scan from scan setup UI; worker processes via outbox → BullMQ → ingestion processor.
4. Open profile draft, submit for review when needed, approve with disclosure checkboxes.
5. Brand overview shows approved profile pointer after refresh.

## Journey Q-BWI-02 — Partial scan → Disclosure → Confirm → Approve

Automated: `tests/e2e/brand-q-bwi-02-partial-approve.e2e.ts` (API setup; approval eligibility proof).

## Journey Q-BWI-03 — AI not configured → Manual profile → Approve

Automated: `tests/e2e/brand-q-bwi-03-manual.e2e.ts` (refusing AI path).

## Journey Q-BWI-04 — Cancel / Retry

Automated: `tests/e2e/brand-q-bwi-04-cancel-retry.e2e.ts` (UI cancel/retry on scan progress).

## Journey Q-BWI-05 — Cross-tenant denial

Automated: `tests/e2e/brand-q-bwi-05-cross-tenant.e2e.ts`.

## Journey Q-BWI-06 — Membership suspended mid-job

Automated: `tests/e2e/brand-q-bwi-06-midflight.e2e.ts` + `tests/security/scan-midflight-reauthz.security.test.ts`.

## Journey Q-BWI-07 — Rescan after Approved → new Draft

Automated: `tests/e2e/brand-q-bwi-07-rescan.e2e.ts`.

## Journey Q-BWI-08 — Late result does not mutate Approved

Automated: `tests/e2e/brand-q-bwi-08-late-result.e2e.ts`.

## Additional proofs

| ID       | Automated file                                                                        |
| -------- | ------------------------------------------------------------------------------------- |
| Q-BWI-09 | `brand-q-bwi-09-reject-scope.e2e.ts`                                                  |
| Q-BWI-10 | `brand-q-bwi-10-concurrency.e2e.ts`                                                   |
| Q-BWI-11 | `brand-q-bwi-11-ssrf.e2e.ts`                                                          |
| Q-BWI-12 | `brand-q-bwi-12-a11y-i18n.e2e.ts`, `brand-responsive.e2e.ts`, `brand-i18n-rtl.e2e.ts` |
| Q-BWI-13 | `brand-q-bwi-13-capabilities.e2e.ts`                                                  |

## BullMQ production path proof

Integration: `tests/integration/scan-outbox-bullmq-worker.integration.test.ts`
Uses real worker process + Postgres + Redis: API `startScan` → outbox → BullMQ → worker → status API → DB.

## Explicitly not validated in 002 quickstart

- Live public-internet crawl vendor (`BLOCKED_BY_DEC-004`)
- Live third-party AI (`BLOCKED_BY_DEC-007`)
- Full-page object-storage snapshots (`DEC-003`)
- Commerce connectors
- `LIVE-INTEGRATION READY` / `PRODUCTION LAUNCH READY`
