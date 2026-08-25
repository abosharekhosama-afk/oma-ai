# Contract: Connector & Provider Ports

**Status:** `DRAFT FOR APPROVAL`
**Note:** Interfaces only — no provider SDKs selected while `DEC-003`–`DEC-007` open

## Shared connection rules

- Every connection is `tenant_id`-bound
- Secrets via `secret_ref` only
- OAuth/state verification required for OAuth providers
- Webhooks: signature verify, dedupe, reorder-safe reconcile
- External delivery/file bytes remain provider-authoritative when so decided

## Ports

### `WebsiteConnectorPort` (`DEC-004` gates implementation)

- `validateSource(input) → ValidationResult`
- `startIngestion(runId) → void`
- `getProgress(runId) → IngestionProgress`
- Never present blocked content as analyzed (`FR-014`)

### `ObjectStoragePort` / `WorkDrivePort` (`DEC-003` gates ownership)

- `putObject` / `getObject` / `deleteObject` / `headObject` as needed
- WorkDrive-specific: `mapFolder`, `syncApproved`, `reconcile`
- OMA stores refs/checksums/status; duplicate bytes only with documented exception

### `AiProviderPort` (`DEC-007` gates vendor)

- `generate(request) → proposal + provenance metadata`
- Must support timeout/refusal/quota failures without destroying durable work
- No permission grants or approvals

### `PaidMediaConnectorPort` (`DEC-006` gates launch authority)

- `listAccounts`, `createDraft`, `activate` (capability-gated), `reconcileWebhook`
- Idempotent external mutations; no spend without authorized command (`FR-095`)

## Projection rule

OMA entities store **intent + approval + mapping**; provider status is a projection with freshness, not overwritten approval history.
