# Contract: Tenant Context & Authorization

**Status:** `APPROVED IMPLEMENTATION BASELINE`
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
2. `POST /api/v1/tenants` is authorized when **either**:
   - the actor has `platform.tenant.create` (Platform Owner / ops provisioning), **or**
   - the actor is authenticated with **zero ACTIVE memberships** (self-serve first company under `DEC-015` Option A).
3. Actors with one or more ACTIVE memberships who lack `platform.tenant.create` MUST receive `403 PERMISSION_DENIED` on additional self-serve tenant create.
4. Tenant creation attaches an initial Company Owner membership with the default Company Owner profile grants, writes audit/outbox, and MUST set the new tenant as the caller’s session Active Tenant when a session is present.
5. `platform.support.access` is never implied by tenant membership; it is separately granted and always audited.

## Post-auth membership routing (`DEC-015`)

Server resolves ACTIVE memberships only (`INVITED` / `SUSPENDED` / `REMOVED` never qualify):

1. Zero ACTIVE memberships → Company Onboarding (create or accept invitation).
2. Exactly one ACTIVE membership and no valid Active Tenant → auto-activate that tenant.
3. Multiple ACTIVE memberships and no valid Active Tenant → searchable company selector.
4. Valid Active Tenant → proceed.
5. Stale/invalid `session.active_tenant_id` is cleared server-side.

Forbidden: public company directory, join-by-name search, domain auto-join, silent membership creation.

## Membership administration

| Method | Path                                    | Capability / gate                                        |
| ------ | --------------------------------------- | -------------------------------------------------------- |
| POST   | `/api/v1/tenants`                       | `platform.tenant.create` **or** zero ACTIVE memberships |
| GET    | `/api/v1/tenants/current`               | active membership                                        |
| POST   | `/api/v1/tenants/current/invitations`   | `membership.invite`                                      |
| POST   | `/api/v1/invitations/accept`            | authenticated; token + email-match policy                |
| POST   | `/api/v1/memberships/{id}/suspend`      | `membership.manage`                                      |
| POST   | `/api/v1/memberships/{id}/remove`       | `membership.manage`                                      |
| PUT    | `/api/v1/memberships/{id}/capabilities` | `capability.assign`                                      |
| POST   | `/api/v1/memberships/{id}/profiles`     | `capability.assign`                                      |

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
