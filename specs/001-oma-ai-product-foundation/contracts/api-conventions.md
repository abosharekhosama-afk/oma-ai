# Contract: API Conventions

**Status:** `DRAFT FOR APPROVAL`
**Audience:** `apps/api`, `packages/api-client`, E2E

## Versioning

- Base path: `/api/v1`
- Additive non-breaking changes preferred; breaking changes require `/api/v2`
- Deprecation announced via `Deprecation` / `Sunset` headers when needed

## Identifiers & time

- Resource ids: opaque ULID/UUIDv7 strings
- Timestamps: UTC ISO-8601 with offset `Z`
- Optimistic concurrency: `If-Match` with version or body `version` field; conflicts → `409 CONFLICT_VERSION`

## Request validation

- Validate at trust boundary (Zod/DTO)
- Unknown fields: reject or strip per endpoint policy (document per route; default reject on commands)
- Max body size enforced globally

## Pagination & filtering

- Cursor pagination default: `?cursor=&limit=` (limit capped, default 25, max 100)
- Offset pagination only where justified
- Filters: explicit allowlists; always AND with server tenant predicate
- Sort: allowlisted fields only

## Idempotency

- Unsafe methods that create side effects accept `Idempotency-Key` header where double-submit is possible
- Replay returns stored response for same key+actor+tenant+request hash; mismatch → `409 IDEMPOTENCY_KEY_REUSE`

## Error envelope

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Human-readable, localizable key preferred",
    "message_key": "errors.permission_denied",
    "details": [],
    "correlation_id": "…",
    "request_id": "…"
  }
}
```

Common codes: `UNAUTHENTICATED`, `PERMISSION_DENIED`, `NOT_FOUND`, `VALIDATION_FAILED`, `CONFLICT_VERSION`, `IDEMPOTENCY_KEY_REUSE`, `RATE_LIMITED`, `CONFLICT_STATE`.

- `404` vs `403`: use `PERMISSION_DENIED`/`NOT_FOUND` without leaking cross-tenant existence (`FR-008`)

## Localization

- `Accept-Language: en, ar`
- Error `message_key` resolved by clients; server may include fallback `message`

## Security headers (API)

- Correlation id accepted or generated: `X-Correlation-Id`
- Rate limit response headers when limited
- No stack traces in production bodies
