# Data Model: OMA AI Platform Foundation

**Feature:** `001-oma-ai-product-foundation`
**Status:** `APPROVED IMPLEMENTATION BASELINE` — conceptual/logical model for foundation only
**Not:** physical SQL DDL, Prisma schema file, or product-slice entities beyond stubs needed for boundaries

Physical schema is authorized only after stack approval and `/speckit-tasks`.

## 1. Conventions

| Topic         | Rule                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Identifiers   | Opaque ULIDs/UUIDv7 strings; never sequential public IDs                                            |
| Timestamps    | Store UTC `timestamptz`; API emits ISO-8601                                                         |
| Soft delete   | Prefer status flags (`SUSPENDED`, `REMOVED`) over hard delete for memberships/users; audit retained |
| Tenant column | Every tenant-scoped table includes `tenant_id` NOT NULL; composite indexes lead with `tenant_id`    |
| Concurrency   | `version` integer (optimistic) on mutable aggregates                                                |
| Immutability  | Audit rows and approved version records are append-only / immutable                                 |
| Localization  | User-facing labels not stored as sole state; canonical codes are English enums                      |

## 2. Foundation entities

### User

| Field                       | Notes                                      |
| --------------------------- | ------------------------------------------ |
| `id`                        | Canonical OMA user id                      |
| `email`                     | Unique, normalized                         |
| `email_verified_at`         | Nullable until verified                    |
| `password_hash`             | Nullable if future passwordless; never log |
| `name`                      | Display                                    |
| `preferred_locale`          | `en` \| `ar` (extensible)                  |
| `preferred_dir`             | derived or override `ltr`/`rtl`            |
| `status`                    | `ACTIVE` \| `SUSPENDED` \| `DELETED`       |
| `created_at` / `updated_at` |                                            |

**Relationships:** 1:N Session; N:M Tenant via Membership.
**Validation:** email format; password policy at trust boundary.
**IMKAN note:** optional future `external_subject_mappings` — not required for foundation.

### Session

| Field                                      | Notes                                                 |
| ------------------------------------------ | ----------------------------------------------------- |
| `id`                                       |                                                       |
| `user_id`                                  |                                                       |
| `token_hash`                               | Store hash of session secret only                     |
| `active_tenant_id`                         | Nullable until selected; must be a membership of user |
| `ip` / `user_agent`                        | Optional telemetry; minimize PII                      |
| `created_at` / `expires_at` / `revoked_at` |                                                       |
| `last_seen_at`                             |                                                       |

**Transitions:** `ACTIVE` → `REVOKED` \| `EXPIRED`.
**Rules:** revoke all on password change/suspend per policy; rotating session id on login.

### Tenant (Company workspace)

| Field                                   | Notes                                 |
| --------------------------------------- | ------------------------------------- |
| `id`                                    | Canonical OMA tenant/company id       |
| `name`                                  |                                       |
| `slug`                                  | Unique optional                       |
| `status`                                | `ACTIVE` \| `SUSPENDED` \| `ARCHIVED` |
| `default_locale`                        |                                       |
| `created_at` / `updated_at` / `version` |                                       |

**Foundation naming rule:** Tenant **is** the single company workspace. Do **not** create a separate Company registry in foundation. Spec §8 language about “companies/workspaces” is satisfied by this one entity until `DEC-008` defines multi-brand/agency topology.

**DEC-008:** Multi-brand under one tenant or agency cross-company assignment requires a later mapping entity — do not invent now.

### Membership

| Field                                       | Notes                                             |
| ------------------------------------------- | ------------------------------------------------- |
| `id`                                        |                                                   |
| `tenant_id`                                 |                                                   |
| `user_id`                                   |                                                   |
| `status`                                    | `INVITED` \| `ACTIVE` \| `SUSPENDED` \| `REMOVED` |
| `invited_email`                             | For invites before user exists                    |
| `invited_by` / `invited_at` / `accepted_at` |                                                   |
| `removed_at` / `suspended_at`               |                                                   |
| `version`                                   |                                                   |

**Unique:** (`tenant_id`, `user_id`) among non-removed rows.
**Rules:** `REMOVED`/`SUSPENDED` deny access immediately (`FR-006`–`007`); history preserved.

### CapabilityProfile

Assignable bundle of capability codes (Strategist, Production Manager, etc.). Stored as configuration so FR-004 profiles are explicit without hardcoding security on job titles.

| Field              | Notes                                                               |
| ------------------ | ------------------------------------------------------------------- |
| `id`               |                                                                     |
| `code`             | Stable profile code e.g. `STRATEGIST`                               |
| `name_key`         | i18n key                                                            |
| `capability_codes` | Array of machine codes                                              |
| `tenant_id`        | Nullable for system-wide defaults; tenant may clone/customize later |
| `is_system`        | Platform-defined defaults immutable except by platform policy       |

### CapabilityGrant

| Field                                      | Notes                                                       |
| ------------------------------------------ | ----------------------------------------------------------- |
| `id`                                       |                                                             |
| `membership_id`                            |                                                             |
| `tenant_id`                                | Denormalized for query isolation                            |
| `capability_code`                          | Machine code from foundation catalog / later slice catalogs |
| `scope`                                    | Optional JSON for object-scoped grants later (`DEC-009`)    |
| `source_profile_code`                      | Nullable; set when grant expanded from a profile            |
| `granted_by` / `granted_at` / `revoked_at` |                                                             |

**Profiles:** assigning a CapabilityProfile expands to CapabilityGrant rows (or equivalent effective-grant view). Runtime checks use **codes**, never profile names alone (`FR-003`–`004`).

**Foundation catalog (minimum):** `tenant.manage`, `membership.invite`, `membership.manage`, `capability.assign`, `audit.read`, `job.read`, `notification.read`, `platform.tenant.create`, `platform.support.access` — see `plan.md`.

### Invitation

May be modeled as Membership in `INVITED` status or separate row. Prefer Membership+token table:

| Field                        | Notes |
| ---------------------------- | ----- |
| `id`                         |       |
| `membership_id`              |       |
| `token_hash`                 |       |
| `expires_at`                 |       |
| `accepted_at` / `revoked_at` |       |

### AuditEvent

| Field                           | Notes                               |
| ------------------------------- | ----------------------------------- |
| `id`                            |                                     |
| `occurred_at`                   |                                     |
| `actor_user_id`                 | Nullable for system                 |
| `actor_type`                    | `USER` \| `SYSTEM` \| `INTEGRATION` |
| `tenant_id`                     | Nullable for platform-level         |
| `action`                        | Stable code                         |
| `target_type` / `target_id`     |                                     |
| `before_ref` / `after_ref`      | Pointers/hashes, not huge payloads  |
| `correlation_id` / `request_id` |                                     |
| `ip`                            | Optional                            |

**Rules:** append-only; no user delete API (`FR-009`, `FR-104`).

### IdempotencyRecord

| Field                                   | Notes      |
| --------------------------------------- | ---------- |
| `tenant_id`                             |            |
| `actor_user_id`                         |            |
| `key`                                   | Client key |
| `request_hash`                          |            |
| `response_status` / `response_body_ref` |            |
| `created_at` / `expires_at`             |            |

**Unique:** (`tenant_id`, `actor_user_id`, `key`) or route-specific tuple.

### OutboxEvent

| Field          | Notes                                |
| -------------- | ------------------------------------ |
| `id`           |                                      |
| `tenant_id`    | Nullable if platform                 |
| `event_type`   |                                      |
| `payload_ref`  |                                      |
| `created_at`   |                                      |
| `published_at` |                                      |
| `status`       | `PENDING` \| `PUBLISHED` \| `FAILED` |
| `attempts`     |                                      |

Written in same transaction as domain mutation.

### JobRun

| Field                         | Notes                                                                     |
| ----------------------------- | ------------------------------------------------------------------------- |
| `id`                          |                                                                           |
| `tenant_id`                   |                                                                           |
| `queue`                       |                                                                           |
| `job_type`                    |                                                                           |
| `status`                      | `QUEUED` \| `RUNNING` \| `SUCCEEDED` \| `FAILED` \| `CANCELLED` \| `DEAD` |
| `payload_ref`                 |                                                                           |
| `actor_user_id`               | For re-authz                                                              |
| `correlation_id`              |                                                                           |
| `error_code` / `error_detail` | Sanitized                                                                 |
| `started_at` / `finished_at`  |                                                                           |
| `idempotency_key`             | Optional; unique when set (prevents duplicate JobRun rows on retry)       |
| BullMQ `job_run_id` payload   | Required; Worker updates only the correlated `JobRun.id`                  |

### Notification (skeleton)

Authoritative **intent** to notify is emitted by the originating domain via transactional outbox. The Notification consumer **materializes** durable recipient rows (delivery projection). Opening a deep link re-authorizes against live membership/visibility (`FR-096`–`099`).

| Field                       | Notes                      |
| --------------------------- | -------------------------- |
| `id`                        |                            |
| `tenant_id`                 |                            |
| `recipient_user_id`         |                            |
| `type`                      |                            |
| `object_type` / `object_id` |                            |
| `deep_link_path`            | Re-authorized on open      |
| `read_at`                   |                            |
| `dedupe_key`                |                            |
| `source_outbox_event_id`    | Provenance to origin event |
| `created_at`                |                            |

### ConnectorConnection (boundary stub)

| Field                         | Notes                                                 |
| ----------------------------- | ----------------------------------------------------- |
| `id`                          |                                                       |
| `tenant_id`                   | Required                                              |
| `provider`                    | `WEBSITE` \| `WORKDRIVE` \| `META` \| `AI` \| future  |
| `status`                      | `DISCONNECTED` \| `CONNECTED` \| `ERROR` \| `REVOKED` |
| `external_account_ref`        | Provider account id projection                        |
| `scopes`                      |                                                       |
| `secret_ref`                  | Pointer to secret store — never plaintext             |
| `last_sync_at` / `last_error` |                                                       |

No provider-specific campaign/file schemas beyond this until DECs close.

### AiGenerationProvenance (boundary stub)

| Field                       | Notes                          |
| --------------------------- | ------------------------------ |
| `id`                        |                                |
| `tenant_id`                 |                                |
| `purpose`                   |                                |
| `input_snapshot_refs`       |                                |
| `provider_code`             | Abstract until `DEC-007`       |
| `model_code`                | Nullable until provider chosen |
| `confidence` / `unknowns`   |                                |
| `output_ref`                |                                |
| `created_by` / `created_at` |                                |
| `approval_state`            | Never auto `APPROVED`          |

### FileObjectRef (boundary stub)

| Field                                | Notes                                            |
| ------------------------------------ | ------------------------------------------------ |
| `id`                                 |                                                  |
| `tenant_id`                          |                                                  |
| `storage_backend`                    | Abstract enum (`OBJECT_PORT`, later `WORKDRIVE`) |
| `external_ref`                       |                                                  |
| `checksum` / `content_type` / `size` |                                                  |
| `created_by` / `created_at`          |                                                  |

Byte ownership semantics deferred (`DEC-003`).

## 3. Explicitly out of foundation physical model

Do not create authoritative schemas yet for: crawl snapshots, strategies, Organic/Paid plans, briefs, tasks/boards, deliverable versions, pricing/orders, WorkDrive folder trees, Meta campaign graphs — except optional **forward-compatible** nullable FKs only when a foundation entity truly needs them (prefer none).

## 4. State families referenced (canonical codes from spec)

Foundation implements machinery; product machines apply in later slices:

- Membership: `INVITED` → `ACTIVE` → `SUSPENDED`/`REMOVED`
- Session: active until revoked/expired
- JobRun: queued/running/terminal set above
- Spec §9 request/strategy/task/deliverable/campaign machines remain product truth for later modules

## 5. Integrity invariants

1. `session.active_tenant_id` must reference an `ACTIVE` membership for that user.
2. Capability grants cannot outlive membership.
3. Tenant-scoped queries always include `tenant_id` from server context.
4. Audit events are immutable.
5. Outbox row for a mutation is atomic with the mutation.
6. Canonical OMA ids never replaced by external IMKAN ids.
