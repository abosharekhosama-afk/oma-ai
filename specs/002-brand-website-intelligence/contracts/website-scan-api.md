# Contract: Website Scan API

**Feature**: `002-brand-website-intelligence`
**Status**: `DRAFT FOR REVIEW` — documentation only
**Tenant**: Server session; brand scoped.

---

## Capabilities

| Method | Path                                    | Capability           |
| ------ | --------------------------------------- | -------------------- |
| `POST` | `/brands/:brandId/scans`                | `brand.scan.control` |
| `GET`  | `/brands/:brandId/scans/:scanId`        | `brand.read`         |
| `GET`  | `/brands/:brandId/scans`                | `brand.read`         |
| `POST` | `/brands/:brandId/scans/:scanId/cancel` | `brand.scan.control` |
| `POST` | `/brands/:brandId/scans/:scanId/retry`  | `brand.scan.control` |

Async progress also visible via Foundation `GET /jobs/:jobRunId` with `job.read` when exposed; brand scan GET is primary UX source.

---

## `POST /api/v1/brands/:brandId/scans`

Start a public crawl scan.

**Headers:** `Idempotency-Key` required.
**Body:**

```json
{
  "trigger": "START",
  "config": {
    "max_pages": 50,
    "max_depth": 3,
    "max_duration_seconds": 600
  }
}
```

Config fields optional within server caps; server clamps to budgets.

**Transaction (API):**

1. Load brand + VALID `WebsiteSource` under `tenantWhere`.
2. Create `ScanAttempt` `QUEUED` + `JobRun` + `OutboxEvent` with payload `{ job_run_id, scan_attempt_id, tenant_id, brand_id, correlation_id, actor_user_id, idempotency_key }`.
3. Commit.
4. Return `202`.

**Response `202`:**

```json
{
  "data": {
    "scan_attempt_id": "01…",
    "job_run_id": "01…",
    "status": "QUEUED",
    "progress_percent": 0,
    "ai_availability": "NOT_CONFIGURED"
  }
}
```

**Errors:**

| Code                    | When                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `WEBSITE_NOT_CONNECTED` | No VALID source                                                                                                  |
| `BRAND_ARCHIVED`        | Archived                                                                                                         |
| `CONFLICT_STATE`        | Another **non-terminal** ScanAttempt already exists for this brand (**at most one** in-flight attempt per brand) |
| `IDEMPOTENCY_KEY_REUSE` | Same key different body                                                                                          |
| `PERMISSION_DENIED`     | Missing capability / inactive membership                                                                         |

**Audit:** `brand.scan.started`.

**Rate limits:** Per-tenant scan start budget; reject with `RATE_LIMITED`.

---

## `GET /api/v1/brands/:brandId/scans/:scanId`

**Response `200`:**

```json
{
  "data": {
    "id": "01…",
    "status": "CRAWLING",
    "progress_percent": 42,
    "pages_fetched": 10,
    "pages_failed": 1,
    "pages_skipped": 2,
    "ai_availability": "NOT_CONFIGURED",
    "coverage": {
      "required_missing": [],
      "unknown_fields": ["brand.description"],
      "failed_pages": [{ "url": "…", "reason": "TIMEOUT" }],
      "skipped_pages": [{ "url": "…", "reason": "ROBOTS" }]
    },
    "job_run_id": "01…",
    "error_code": null,
    "started_at": "…",
    "finished_at": null,
    "profile_version_id": null
  }
}
```

Survives refresh/re-login (`FR-BWI-019`).

---

## `GET /api/v1/brands/:brandId/scans`

List attempts newest-first; cursor pagination; filter `status`.

---

## `POST /api/v1/brands/:brandId/scans/:scanId/cancel`

**Headers:** `Idempotency-Key` recommended.
**Body:** `{ "reason"?: string }`

**Behavior:** Set `cancel_requested_at`; worker observes and ends in `CANCELLED`; JobRun cancelled/dead per foundation pattern. If already terminal, idempotent return current status.

**Response `200`:** updated scan.
**Audit:** `brand.scan.cancelled`.
**Approve rule:** Cancelled attempts **cannot** approve (`FR-BWI-029c`).

---

## `POST /api/v1/brands/:brandId/scans/:scanId/retry`

**Headers:** `Idempotency-Key` required.
**Body:** `{ "config"?: object }`

**Behavior:** Creates **new** `ScanAttempt` linked via `parent_attempt_id`; does not reopen parent. Parent must be `FAILED` | `PARTIAL` | `CANCELLED` (or product-allowed set).

**Response `202`:** same shape as start.
**Audit:** `brand.scan.retried`.

---

## Worker mid-flight denial

If membership suspended or capability revoked:

- JobRun → `DEAD` / failed with `PERMISSION_DENIED`
- ScanAttempt → `FAILED` with sanitized `error_code: PERMISSION_DENIED`
- No successful crawl writes after denial check
- Audit: `brand.scan.permission_denied_midflight`

---

## Late result rule (API surface)

No client API mutates Approved versions. If a late job completion arrives after approval, worker creates Draft-only artifacts; clients discover via new scan/profile resources, never changed Approved GET payloads.
