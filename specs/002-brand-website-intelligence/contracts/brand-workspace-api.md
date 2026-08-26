# Contract: Brand Workspace API

**Feature**: `002-brand-website-intelligence`
**Status**: `DRAFT FOR REVIEW` — documentation only
**Base**: `/api/v1` per Foundation `api-conventions.md`
**Tenant**: Resolved from authenticated server session (`active_tenant_id`); client brand ids select among authorized resources only.

---

## Capabilities

| Method | Path | Capability |
| ------ | ---- | ---------- |
| `GET` | `/brands` | `brand.read` |
| `POST` | `/brands` | `brand.create` |
| `GET` | `/brands/:brandId` | `brand.read` |
| `PATCH` | `/brands/:brandId` | `brand.create` (name/metadata) **or** dedicated edit if split later — plan: same as create for rename until profile grants refined |
| `POST` | `/brands/:brandId/archive` | `brand.archive` |
| `POST` | `/brands/:brandId/website` | `brand.website.connect` |
| `GET` | `/brands/:brandId/website` | `brand.read` |

All routes: `AuthGuard` + CSRF on mutating methods + `CapabilitiesGuard` + active membership.

---

## `GET /api/v1/brands`

**Query:** `cursor`, `limit` (default 25, max 100), `status` (`DRAFT`|`READY_TO_SCAN`|`ACTIVE`|`ARCHIVED`, optional), `q` (name contains, optional).

**Response `200`:**

```json
{
  "data": [
    {
      "id": "01…",
      "name": "Acme",
      "status": "ACTIVE",
      "primary_website_url": "https://example.test",
      "current_approved_profile_version_id": "01…",
      "updated_at": "2026-08-26T12:00:00.000Z"
    }
  ],
  "page": { "next_cursor": null, "limit": 25 }
}
```

**Errors:** `401 UNAUTHENTICATED`, `403 PERMISSION_DENIED`.

**Audit:** none (read).

---

## `POST /api/v1/brands`

**Headers:** `Idempotency-Key` required.

**Body:**

```json
{
  "name": "Acme Brand"
}
```

**Validation:** `name` 1–120 chars, trimmed, non-empty.

**Response `201`:**

```json
{
  "data": {
    "id": "01…",
    "name": "Acme Brand",
    "status": "DRAFT",
    "version": 1,
    "created_at": "…"
  }
}
```

**Errors:** `VALIDATION_FAILED`, `IDEMPOTENCY_KEY_REUSE`, `RATE_LIMITED`.

**Audit:** `brand.created` (actor, tenant, brand_id, correlation_id).

**Side effects:** none beyond row + audit.

---

## `GET /api/v1/brands/:brandId`

**Response `200`:** full workspace summary including website source summary, latest scan attempt id/status, current approved version id, `version` for concurrency.

**Cross-tenant / unknown:** `404 NOT_FOUND` (no existence leak) **or** `403 PERMISSION_DENIED` per Foundation FR isolation policy — **pick one consistent with foundation resource reads** (foundation uses deny without confirming foreign existence).

---

## `PATCH /api/v1/brands/:brandId`

**Headers:** `If-Match: "<version>"` **or** body `version`.

**Body (partial):** `{ "name"?: string, "version": number }`

**Response `200`:** updated brand.

**Errors:** `409 CONFLICT_VERSION`, `409 CONFLICT_STATE` if `ARCHIVED`.

**Audit:** `brand.updated`.

---

## `POST /api/v1/brands/:brandId/archive`

**Headers:** `Idempotency-Key` recommended.

**Body:** `{ "version": number, "reason"?: string }`

**Behavior:**

1. Transaction: if active `ScanAttempt` in non-terminal state → cancel request + mark cancel; then set brand `ARCHIVED`.
2. Reject if already archived → idempotent success or `CONFLICT_STATE`.

**Response `200`:** `{ "data": { "id", "status": "ARCHIVED", "archived_at" } }`

**Audit:** `brand.archived` (+ scan cancel audits if any).

---

## `POST /api/v1/brands/:brandId/website`

Connect or replace primary public HTTPS source.

**Capability:** `brand.website.connect`
**Headers:** `Idempotency-Key` required.

**Body:**

```json
{
  "url": "https://shop.example.test/home",
  "authorization_attested": true,
  "version": 1
}
```

**Validation:**

- `authorization_attested === true` required.
- URL normalize: HTTPS only; reject credentials, non-443 custom ports unless allowlisted later, fragments stripped per policy.
- SSRF pre-check on host (synchronous validation; full DNS recheck at crawl).

**Response `200`:**

```json
{
  "data": {
    "website_source_id": "01…",
    "normalized_url": "https://shop.example.test/home",
    "validation_status": "VALID",
    "brand_status": "READY_TO_SCAN",
    "source_revision": 2
  }
}
```

**If invalid:** `400 VALIDATION_FAILED` with `error.code` e.g. `URL_SCHEME_DENIED`, `URL_SSRF_DENIED`, `URL_CREDENTIALS_DENIED`.

**Behavior:** Replace does **not** mutate Approved profile versions (`FR-BWI-013`). Increments `source_revision`.

**Audit:** `brand.website.connected` / `brand.website.replaced` with attested flag, previous/new URL hashes (avoid logging full secrets — URLs should already be credential-free).

---

## `GET /api/v1/brands/:brandId/website`

**Response `200`:** current source metadata (no crawl secrets).

---

## Rate limits (planned)

- Create brand: per-tenant soft limit (config).
- Website connect: stricter per-user/tenant to reduce SSRF probe abuse.

---

## Error taxonomy (brand-specific)

| Code | HTTP | When |
| ---- | ---- | ---- |
| `BRAND_ARCHIVED` | 409 | Mutate archived |
| `WEBSITE_NOT_CONNECTED` | 409 | Start scan without VALID source |
| `URL_*` | 400 | Validation family |
