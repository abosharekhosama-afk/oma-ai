# Platform Admin & Support Hub — Engineering Design & Action Plan

## Summary

OMA AI needs a **cross-tenant operator plane** beside the existing tenant-scoped product API. This document defines `User.systemRole`, Nest guards/middleware, proposed `/api/v1/admin/*` and `/api/v1/support/*` contracts, and phased delivery through the Next.js `/app/admin` shell.

## Design principles

- **Two axes of authority:** `SystemRole` (platform operator) is orthogonal to tenant `CapabilityProfile` grants (`PLATFORM_OWNER`, `platform.support.access`, etc.). Tenant capabilities never imply super-admin; super-admin does not bypass tenant data reads without an explicit audited support action.
- **Server-authoritative:** Role is resolved from the session + `User.systemRole`, never from client headers.
- **Tenant isolation:** Support tools use scoped lookups and (later) impersonation with immutable audit rows — no blanket cross-tenant list endpoints without filters.
- **Secrets:** Master integration credentials remain in environment / secret store; admin UI shows **configured / missing** only, never values.
- **DEC-016:** Billing/MRR and live provider metrics may use fixtures or aggregated DB until the final integration phase.

## SystemRole vs existing capabilities

| Mechanism                 | Scope                        | Purpose                                     |
| ------------------------- | ---------------------------- | ------------------------------------------- |
| `User.systemRole`         | Global user identity         | Gate `/admin` and `/support` APIs and UI    |
| `PLATFORM_OWNER` profile  | `platform` tenant membership | Legacy bootstrap + `platform.tenant.create` |
| `platform.support.access` | Tenant capability            | Billing ops inside a tenant context         |
| `tenant.manage`           | Tenant capability            | Workspace administration                    |

**Migration rule:** Bootstrap platform owner email → `SUPER_ADMIN`. Existing `platform.support.access` grants remain until support flows are migrated to `/api/v1/support/*`.

## Data model (Phase 0 — this PR)

```prisma
enum SystemRole {
  SUPER_ADMIN
  SUPPORT_SPECIALIST
  USER
}

model User {
  systemRole SystemRole @default(USER)
}
```

**Future (Phase 2):** `SupportImpersonationSession`, `SystemSecretMetadata` (names + rotation hints, not values).

## API surfaces (planned)

### `/api/v1/admin/*` — Super Admin only

| Method | Route                        | Purpose                                        |
| ------ | ---------------------------- | ---------------------------------------------- |
| GET    | `/admin/health`              | Liveness (implemented)                         |
| GET    | `/admin/metrics/overview`    | MRR, active subscriptions, WorkDrive aggregate |
| GET    | `/admin/tenants`             | Paginated tenant list                          |
| POST   | `/admin/tenants`             | Provision tenant                               |
| PATCH  | `/admin/tenants/:id`         | Suspend, plan limits, storage quota            |
| GET    | `/admin/system/secrets`      | Secret **status** map                          |
| PUT    | `/admin/system/secrets/:key` | Rotate metadata / trigger reload (no echo)     |

### `/api/v1/support/*` — Support Specialist + Super Admin

| Method | Route                                | Purpose                                        |
| ------ | ------------------------------------ | ---------------------------------------------- |
| GET    | `/support/health`                    | Liveness (implemented)                         |
| GET    | `/support/lookup`                    | User/brand search (tenant-scoped query params) |
| GET    | `/support/tenants/:tenantId/social`  | Connection + token health (redacted)           |
| GET    | `/support/tenants/:tenantId/storage` | OMA_INTERNAL / USER_WORKDRIVE errors           |
| POST   | `/support/impersonate`               | Start audited impersonation session            |
| DELETE | `/support/impersonate/:id`           | End impersonation                              |
| GET    | `/support/publishing/failures`       | Recent publish/worker failures                 |
| POST   | `/support/publishing/:jobId/retry`   | Retry publish (idempotent)                     |

**Auth stack per route:** `AuthGuard` → `PlatformAdminGuard` or `SupportGuard` → handler. **Global middleware** `PlatformAdminSupportMiddleware` enforces the same roles on path prefix.

## Frontend (Phase 3 — MVP shipped)

- `/app/admin` hub layout (bypasses client AppShell), gated by `system_role` + legacy `platform.support.access`
- Screens: overview, tenants, support, billing (existing)
- `auth/me` exposes `user.system_role`
- Follow-up: Planable polish, operator E2E, structured support diagnostics UI

## Phase plan

### Phase 0 — Foundation (this PR)

- Prisma `SystemRole` + migration
- `PlatformAdminGuard`, `SupportGuard`, `PlatformAdminSupportMiddleware`
- `req.oma.systemRole` from `AuthGuard`
- Stub `GET /admin/health`, `GET /support/health`
- EDD (this document)

### Phase 1 — Super Admin Dashboard API (in progress)

- [x] `GET /admin/metrics/overview` — MRR estimate, subscriptions, WorkDrive reconcile snapshot
- [x] `GET/POST/PATCH /admin/tenants` (+ `GET /admin/tenants/:id`) with audit
- [x] `GET /admin/system/secrets` — configured/missing only (env)
- [x] `WorkspaceStorageSetting.adminStorageLimitBytes` override wired into storage quota checks
- [x] Billing admin routes use shared `requireSuperAdminOperator` (legacy `platform.support.access` fallback)
- [ ] Next.js `/app/admin` shell (Phase 3)

### Phase 2 — Support Hub (in progress)

- [x] `GET /support/lookup` — users, tenants, brands (scoped brand search with `tenant_id`)
- [x] `GET /support/tenants/:id/social` — token health, errors (no secrets)
- [x] `GET /support/tenants/:id/storage` — mode, backup/worker failures
- [x] `GET /support/publishing/failures` + `POST /support/publishing/:id/retry`
- [x] Impersonation: `POST /support/impersonate`, `POST .../assume` (sets session cookie), `DELETE ...`
- [x] `SupportImpersonationSession` model + audit events
- [x] Legacy `platform.support.access` + `SUPPORT_SPECIALIST` / `SUPER_ADMIN`
- [ ] Next.js support UI (Phase 3)

### Phase 3 — Next.js operator UI

- `/app/admin` navigation, role gates, tables, detail drawers
- Wire to Phase 1–2 APIs; empty/error states

## Security checklist

- [x] Default `systemRole = USER` for new users
- [x] Admin/support paths denied without role (middleware + guards)
- [ ] Impersonation audit (Phase 2)
- [ ] Rate limits on lookup endpoints (Phase 2)
- [ ] CI security tests for cross-tenant denial

## References

- `packages/domain/src/authz/capabilities.ts` — `platform.support.access`
- `apps/api/src/bootstrap/bootstrap-platform-owner.ts`
- `specs/001-oma-ai-product-foundation/spec.md` — tenant boundary invariants
