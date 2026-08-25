# Contract: Tenant Context & Authorization

**Status:** `DRAFT FOR APPROVAL`
**Owner:** OMA Tenant + Authz

## Tenant resolution algorithm

1. Authenticate session → `user_id`.
2. Load `session.active_tenant_id` (if any).
3. Verify `Membership(user_id, tenant_id)` is `ACTIVE`.
4. Load `CapabilityGrant[]` for membership.
5. Attach `RequestContext { userId, tenantId, capabilities, correlationId }`.
6. Reject if route requires tenant and none active → `409 TENANT_REQUIRED` or guided select.

**Forbidden:** trusting `X-Tenant-Id`, body `tenantId`, or route param as authority. Those MAY select among already-authorized memberships only after server check (`FR-002`).

## Tenant switch

`POST /api/v1/tenants/active { tenant_id }`

- Succeeds only if caller has `ACTIVE` membership
- Updates session row
- Audits switch

## Foundation capability codes

See `plan.md` catalog. Minimum codes used by this contract: `tenant.manage`, `membership.invite`, `membership.manage`, `capability.assign`, `audit.read`, `job.read`, `notification.read`, `platform.tenant.create`, `platform.support.access`.

## Bootstrap & Platform Owner

1. Ops bootstrap provisions the first Platform Owner (not self-serve).
2. `POST /api/v1/tenants` requires `platform.tenant.create`.
3. Tenant creation attaches an initial Company Owner membership with the default Company Owner profile grants.
4. `platform.support.access` is never implied by tenant membership; it is separately granted and always audited.

## Membership administration

| Method | Path | Capability |
| --- | --- | --- |
| POST | `/api/v1/tenants` | `platform.tenant.create` |
| GET | `/api/v1/tenants/current` | active membership |
| POST | `/api/v1/tenants/current/invitations` | `membership.invite` |
| POST | `/api/v1/memberships/{id}/suspend` | `membership.manage` |
| POST | `/api/v1/memberships/{id}/remove` | `membership.manage` |
| PUT | `/api/v1/memberships/{id}/capabilities` | `capability.assign` |
| POST | `/api/v1/memberships/{id}/profiles` | `capability.assign` |

## Capability check

```text
require(capability_code | any_of | all_of)
deny_by_default
```

Return `403` with `PERMISSION_DENIED` without revealing unauthorized resource payloads.

## Cross-tenant access

For any resource fetch by id:

```text
WHERE id = :id AND tenant_id = :ctx.tenantId
```

If zero rows → same denial as not found for foreign tenants (`FR-008`).

## Platform Owner

Cross-tenant support access requires explicit break-glass capability + mandatory audit (`FR-005`); not part of normal membership.
