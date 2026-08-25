# Contract: Authentication & Session

**Status:** `DRAFT FOR APPROVAL`
**Owner:** OMA Identity (`DEC-002`)
**Non-goals:** IMKAN SSO, social login providers (future), passwordless-only (optional later)

## Principles

- OMA owns accounts, credentials, sessions, and revocation
- Session cookie is opaque; server stores only hash
- Cookie flags: `HttpOnly`, `Secure` (non-local), `SameSite=Lax` or `Strict` per threat review
- Client-supplied user/tenant ids never authenticate

## Endpoints (logical)

| Method | Path | Auth | Capability | Behavior |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | no | — | Create user; start verification policy |
| POST | `/api/v1/auth/login` | no | — | Verify credentials; create session; set cookie; rotate on success |
| POST | `/api/v1/auth/logout` | yes | — | Revoke session; clear cookie |
| GET | `/api/v1/auth/me` | yes | — | Current user + memberships summary + active tenant |
| POST | `/api/v1/auth/password/change` | yes | — | Rehash; revoke other sessions per policy |
| POST | `/api/v1/sessions/revoke` | yes | — | Revoke listed own sessions |

Exact verification (email link) flow is implementation-detail within OMA ownership.

## Session lifecycle

```text
LOGIN_SUCCESS → Session(ACTIVE, expires_at)
  → REFRESH/USE extends last_seen (optional sliding)
  → LOGOUT | ADMIN_REVOKE | USER_SUSPEND | EXPIRY → REVOKED/EXPIRED
```

## Web ↔ API topology (foundation default)

- Serve the Next.js web app and NestJS API behind a **same-origin reverse proxy** (`/api/*` → API).
- Session cookie: `HttpOnly`, `Secure` (non-local), `Path=/`, `SameSite=Lax`, host-only to the site origin.
- Do not rely on cross-site credentialed CORS as the primary browser auth path.

## CSRF

Because authentication uses cookies on the site origin, state-changing browser requests must include a **CSRF token** (synchronized token or double-submit cookie pattern) validated by the API in addition to `SameSite=Lax`.

## Idempotency note

`register` / `login` do not require client `Idempotency-Key` by default; servers must still prevent duplicate harmful side effects via unique email constraints and safe session rotation.

## Suspension

When user or membership is suspended/removed:

- Existing sessions fail authorization on next request
- Prefer immediate server-side revoke for membership loss affecting active tenant

## Future IMKAN federation

Separate mapping contract only; cannot mint OMA capabilities from external claims alone (`FR-010`).
