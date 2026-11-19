# Render — operations stability (scan pipeline)

**Audience:** Owner / ops on Render (API + Worker + Postgres + Redis).  
**Goal:** Keep **ingestion → extraction → analysis → catalog** reliable without OOM or DB pool exhaustion.

## Required topology

| Service        | Role                                                    |
| -------------- | ------------------------------------------------------- |
| **Web**        | Next.js (`apps/web`) — can stay on Vercel or Render     |
| **API**        | NestJS — enqueues scans, serves health                  |
| **Worker**     | **Mandatory** — BullMQ consumers + Playwright JS render |
| **PostgreSQL** | Shared by API + Worker                                  |
| **Redis**      | BullMQ (`BULLMQ_PREFIX=oma` default)                    |

Scans **do not run** on API-only or Web-only deploys.

## Health checks (CHK010)

```bash
API_BASE=https://<your-api-host> scripts/closure-005/ops-smoke.sh
```

Interpret `GET /api/v1/platform/health/queues`:

| Field                          | Healthy                          |
| ------------------------------ | -------------------------------- |
| `worker_alive`                 | `true`                           |
| `worker_heartbeat_age_seconds` | ≤ 90 (default max age)           |
| `ingestion.waiting`            | 0 or draining while `active` ≥ 1 |
| `ingestion.failed`             | 0 or investigated                |

After starting a scan, Worker should consume the ingestion job within **~2 minutes** (manual CHK010).

## Database connection pool (critical)

Prisma opens a pool **per process**. On small Render Postgres (~20 connections), **API + Worker + cron ticks** can exhaust the pool during long scans.

**Recommendation:** append query params to `DATABASE_URL` on **both** API and Worker:

```text
postgresql://user:pass@host/db?schema=public&connection_limit=8&pool_timeout=30
```

Guidelines:

- **API:** `connection_limit=6–10` depending on instance count (one Render API instance → 8 is reasonable).
- **Worker:** `connection_limit=4–6` (ingestion is mostly sequential; lower is safer during Playwright).
- If you see `Timed out fetching a new connection from the connection pool` or `Can't reach database server` during scans: **lower limits**, **upgrade Postgres**, or **disable DB hibernate/sleep** on the DB plan.

Wake the database before proof: run `GET /api/v1/health/ready` and wait for `200`.

## Worker memory & JS render

Playwright is the main OOM source. **Do not** use `BRAND_SCANNER_JS_RENDER_MODE=always` on instances below **1 GB RAM**.

| Variable                             | Render starter recommendation | Risk if wrong                          |
| ------------------------------------ | ----------------------------- | -------------------------------------- |
| `BRAND_SCANNER_JS_RENDER_MODE`       | `auto`                        | `always` + long timeout → OOM          |
| `BRAND_SCANNER_JS_RENDER_TIMEOUT_MS` | `30000`–`60000`               | `1200000` (20 min) holds browser + RAM |
| `BRAND_SCANNER_JS_RENDER_MAX_PAGES`  | `10`–`20`                     | Unlimited renders on large sites       |
| `BRAND_MAX_PAGES`                    | `30`–`50` for proof           | Very high + JS = slow + DB writes      |

Worker plan: **≥ 1 GB RAM** for `auto` JS; **≥ 2 GB** if you raise `JS_RENDER_MAX_PAGES` or run parallel brands.

## Redis & Worker env parity

API and Worker **must share**:

- `REDIS_URL`
- `BULLMQ_PREFIX` (if non-default)
- `DATABASE_URL` (same DB, possibly different `connection_limit`)

Worker-only scan vars (`BRAND_SCANNER_*`, `BRAND_WEBSITE_CONNECTOR=live`) belong on **Worker**, not Web.

## Reduce background DB load during scans

Optional on memory-constrained Worker:

```bash
WORKER_OUTBOX_TICK_MS=3000   # default 1500; slows outbox publisher, fewer DB polls
```

Listening/inbox cron ticks still run; for demo-only tenants without social, load is usually low.

## Worker liveness (heartbeat)

Worker writes Redis key `{BULLMQ_PREFIX}:worker:heartbeat` every 30s (TTL 120s).  
API exposes it on `platform/health/queues`. If `worker_alive` is false:

1. Confirm Worker service is **running** (not crashed loop).
2. Confirm **same Redis** as API.
3. Check Worker logs for OOM / Playwright / Prisma errors.

## Failure triage (Render-specific)

| Symptom                     | Likely cause               | Action                                                        |
| --------------------------- | -------------------------- | ------------------------------------------------------------- |
| Scan stuck `QUEUED`         | Worker down or wrong Redis | Heartbeat + Worker logs                                       |
| Scan `RUNNING` hours        | JS timeout / huge site     | Lower max pages; cancel scan; fix timeout env                 |
| Worker restarts during scan | OOM                        | RAM upgrade; `auto` not `always`; lower `JS_RENDER_MAX_PAGES` |
| Pool timeout mid-scan       | Too many DB clients        | `connection_limit` on API/Worker; wake DB                     |
| `FAILED` after cancel       | Expected if user cancelled | Start new scan                                                |

## Sign-off

When smoke + one real scan succeed, mark **CHK010–CHK011** in `specs/005-scan-analysis-strategy-closure/checklists/requirements.md` and keep evidence in `artifacts/closure-005/`.

See also: [`specs/005-scan-analysis-strategy-closure/quickstart.md`](../specs/005-scan-analysis-strategy-closure/quickstart.md), [`docs/brand-website-scanning.md`](./brand-website-scanning.md).
