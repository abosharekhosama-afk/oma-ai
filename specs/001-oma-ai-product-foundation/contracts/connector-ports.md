# Contract: Connector & Provider Ports

**Status:** `APPROVED IMPLEMENTATION BASELINE`
**Sequencing:** `DEC-016` — **PRODUCT-FIRST / EXTERNAL-INTEGRATIONS-LAST** (`docs/PRODUCT_DELIVERY_SEQUENCING.md`)

**Note:** Interfaces only — no provider SDKs, credentials, or live third-party calls while provider DECs are `DEFERRED_TO_FINAL_INTEGRATION_PHASE` (or otherwise open). Production defaults to **refusing** adapters; tests/review may use fixtures/recording adapters. UI must show not-connected/not-configured honesty states.

## Shared connection rules

- Every connection is `tenant_id`-bound
- Secrets via `secret_ref` only
- OAuth/state verification required for OAuth providers
- Webhooks: signature verify, dedupe, reorder-safe reconcile
- External delivery/file bytes remain provider-authoritative when so decided
- **Final integration phase only:** live crawl/browser, live AI, WorkDrive bytes, Meta, ESP, CDN/object-storage, analytics, and other production third-party APIs/SDKs
- **Not deferred by DEC-016:** internal PostgreSQL, Redis, BullMQ (`DEC-014`)

## Ports

### `WebsiteConnectorPort` (`DEC-004` — open + `DEFERRED_TO_FINAL_INTEGRATION_PHASE`)

- `validateSource(input) → ValidationResult`
- `startIngestion(runId) → void`
- `getProgress(runId) → IngestionProgress`
- Never present blocked content as analyzed (`FR-014`)
- Live vendor wiring blocked until final integration phase; Feature 002 `T200`–`T201` stay unchecked

### `ObjectStoragePort` / `WorkDrivePort` (`DEC-003` — open + `DEFERRED_TO_FINAL_INTEGRATION_PHASE`)

- `putObject` / `getObject` / `deleteObject` / `headObject` as needed
- WorkDrive-specific: `mapFolder`, `syncApproved`, `reconcile`
- OMA stores refs/checksums/status; duplicate bytes only with documented exception

### `AiProviderPort` (`DEC-007` — open + `DEFERRED_TO_FINAL_INTEGRATION_PHASE`)

- `generate(request) → proposal + provenance metadata`
- Must support timeout/refusal/quota failures without destroying durable work
- No permission grants or approvals
- Live provider wiring blocked until final integration phase; Feature 002 `T202`–`T203` stay unchecked

### `PaidMediaConnectorPort` (`DEC-006` — open + `DEFERRED_TO_FINAL_INTEGRATION_PHASE` for live Meta)

- `listAccounts`, `createDraft`, `activate` (capability-gated), `reconcileWebhook`
- Idempotent external mutations; no spend without authorized command (`FR-095`)

## Projection rule

OMA entities store **intent + approval + mapping**; provider status is a projection with freshness, not overwritten approval history.
