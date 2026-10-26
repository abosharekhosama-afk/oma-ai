# DEC-003 — Imkan WorkDrive file ownership

**Status:** RESOLVED (2026-10-26, branch `feat/workdrive-storage`)

## Decision

- **File bytes live in the tenant's own Imkan WorkDrive.** OMA never keeps media bytes at rest. Uploads are streamed through the OMA API into WorkDrive with an integration API key (`wdk_…`). The key stays on the server.
- **OMA owns the metadata.** The `MediaAsset` row stores the tenant, brand, kind, WorkDrive file id, folder, name, mime type, size, sha256, status and source. WorkDrive keeps version history.
- **Per tenant.** Each workspace connects its own WorkDrive organisation (`WorkDriveConnection`: base URL plus the AES-256-GCM-encrypted key). A key can be confined to a root folder.
- **Layout:** `OMA/{brand-slug}/{posts|logos|deliverables}`. When the key's root folder is already named `OMA`, the leading segment is not repeated.
- **No destructive sync.** A file deleted in WorkDrive stays referenced in OMA. It is marked `MISSING` and the UI shows a "missing file" warning. Restoring it in WorkDrive flips it back to `READY`. OMA never deletes WorkDrive files on its own.
- **Compatibility.** `BrandWorkspace.logoUrl`, `ContentItem.previewAssetUrl` and deliverable `assetUrl` keep working. When linked, they hold the stable link `/api/v1/media/{id}/view`, which redirects to a fresh signed WorkDrive URL. The id is in `logoAssetId` / `previewAssetId` / `assetId`.
- **Not connected:** the refusing object-storage adapter remains. Logos fall back to data URLs, and the UI shows a "connect WorkDrive" state.

## Implementation

- Ports: `ObjectStoragePort` and `WorkDrivePort` are implemented by `workDriveObjectStorage` / `workDrivePort` in `packages/domain/src/workdrive/adapters.ts`.
- API: `apps/api/src/media/*`. Worker: `apps/worker/src/media/media-jobs.ts`.
- Setup: `docs/workdrive-setup.md`.
