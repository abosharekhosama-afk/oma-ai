# Security hardening notes

## Implemented controls

- API requests use a fixed-window rate limiter. When `REDIS_URL` is configured, counters are atomic and shared across API processes; the limiter falls back to a bounded in-process map during Redis outages. The fallback logs a warning and is not cross-instance. The global limit defaults to 300 requests per IP/method/route per minute and can be set with `RATE_LIMIT_PER_MINUTE`; `0` is reserved for deterministic tests. Login, registration, and recovery endpoints have stricter IP and (for login/recovery request) normalized-account budgets.
- API and Next.js responses set `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`. HSTS should be configured at the TLS-terminating edge. CSP is not enforced here because this Next.js application requires an audited nonce/hash strategy for inline assets; a simplistic policy could break the app without providing reliable protection.
- On each authenticated request, the API verifies that the session's active tenant still has an active membership. If not, it clears that tenant from the user's active sessions and does not attach that tenant scope to the request. Removing a membership also clears that tenant from the user's sessions in the same database transaction.
- Production API source is checked in CI for unsafe raw SQL APIs (`$queryRawUnsafe`, `$executeRawUnsafe`, `Prisma.raw`, `$runCommandRaw`).
- CI runs both production-only and full dependency audits. Dependency overrides live in `pnpm-workspace.yaml` under pnpm 10 so patched versions are actually resolved, following [pnpm's workspace settings](https://pnpm.io/10.x/settings); installation scripts are allow-listed for only the native/database packages required by this workspace.

## SQL injection review

The review found no production SQL injection path: production persistence uses Prisma query-builder operations; the raw query found in the health endpoint is a constant `SELECT 1`. Unsafe raw SQL found in integration migration tests uses test-generated, constrained schema names and is outside production source. Keep user input in Prisma values; if raw SQL becomes necessary, use tagged parameterized queries and never concatenate user-controlled values or identifiers.

The dependency audit initially identified critical and high advisories in Next.js, Vitest/Tinypool, and several transitive packages. The direct packages and vulnerable transitive versions were upgraded or overridden to patched versions. The subsequent full `pnpm audit` reported zero advisories at the time of verification.

## Operational limitations

The Redis-backed rate limiter is distributed while Redis is healthy. During Redis outages, each API process applies its own bounded fallback, so limits are less strict across multiple processes until Redis recovers. Configure trusted proxy handling at the deployment boundary so Express `req.ip` represents the actual client IP, and enforce HSTS at the HTTPS edge. The configured limits are application safeguards, not a substitute for edge/WAF controls or credential-stuffing monitoring.
