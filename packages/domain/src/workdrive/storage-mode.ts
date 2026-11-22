import { brandFolderSlug, mediaFolderSegments, type MediaKind } from './layout';
import { internalMediaSegments } from './storage-path';

/**
 * Single source of truth for "where does a new file go?".
 *
 * The workspace storage setting (`WorkspaceStorageSetting.mode`) decides. A connected
 * WorkDrive never overrides an OMA setting, and OMA storage being unavailable never
 * silently falls back to the user's WorkDrive key. Only an explicit library `source`
 * (the user picking WorkDrive in the media library) or the WorkDrive mode itself write
 * to the user's WorkDrive.
 */
export type StorageModeValue = 'OMA_INTERNAL' | 'USER_WORKDRIVE' | 'SYNC_BACKUP';
export type StorageProviderValue = 'OMA_INTERNAL' | 'USER_WORKDRIVE';
export type LibrarySource = 'oma' | 'workdrive';

/**
 * Effective workspace mode. A saved setting always wins. Workspaces that never saved a
 * setting keep the legacy rule (a WorkDrive connected before platform storage existed
 * keeps writing there) — the storage settings page shows the same effective mode.
 */
export function effectiveStorageMode(input: {
  settingMode?: StorageModeValue | null;
  byosConnected: boolean;
}): StorageModeValue {
  if (input.settingMode) return input.settingMode;
  return input.byosConnected ? 'USER_WORKDRIVE' : 'OMA_INTERNAL';
}

/** Provider the workspace mode writes to by default (SYNC_BACKUP writes to OMA, then backs up). */
export function primaryProviderForMode(mode: StorageModeValue): StorageProviderValue {
  return mode === 'USER_WORKDRIVE' ? 'USER_WORKDRIVE' : 'OMA_INTERNAL';
}

/** Library source shown by default for the workspace mode. */
export function defaultLibrarySource(mode: StorageModeValue): LibrarySource {
  return primaryProviderForMode(mode) === 'USER_WORKDRIVE' ? 'workdrive' : 'oma';
}

export type StorageWriteDecision =
  | { ok: true; provider: StorageProviderValue }
  | { ok: false; reason: 'oma_unavailable' | 'workdrive_unavailable' };

export function decideStorageWriteProvider(input: {
  mode: StorageModeValue;
  source?: LibrarySource | null;
  internalAvailable: boolean;
  byosAvailable: boolean;
}): StorageWriteDecision {
  if (input.source === 'workdrive') {
    return input.byosAvailable
      ? { ok: true, provider: 'USER_WORKDRIVE' }
      : { ok: false, reason: 'workdrive_unavailable' };
  }
  if (input.source === 'oma') {
    return input.internalAvailable
      ? { ok: true, provider: 'OMA_INTERNAL' }
      : { ok: false, reason: 'oma_unavailable' };
  }
  if (input.mode === 'USER_WORKDRIVE') {
    if (input.byosAvailable) return { ok: true, provider: 'USER_WORKDRIVE' };
    // WorkDrive mode with a disconnected WorkDrive: keep files in OMA rather than failing.
    if (input.internalAvailable) return { ok: true, provider: 'OMA_INTERNAL' };
    return { ok: false, reason: 'workdrive_unavailable' };
  }
  // OMA_INTERNAL and SYNC_BACKUP: OMA storage only. Never fall back to the user's key.
  return input.internalAvailable
    ? { ok: true, provider: 'OMA_INTERNAL' }
    : { ok: false, reason: 'oma_unavailable' };
}

/** Folder path for a brand media kind on the chosen provider. */
export function storageFolderSegments(input: {
  provider: StorageProviderValue;
  tenantId: string;
  brand: { id: string; name: string };
  kind: MediaKind;
  /** Scoped platform key rooted at tenants/{tenantId}. */
  scopedRoot?: boolean;
  rootFolderName?: string | null;
}): string[] {
  if (input.provider === 'OMA_INTERNAL') {
    const full = internalMediaSegments({
      tenantId: input.tenantId,
      brandId: input.brand.id,
      kind: input.kind,
    });
    return input.scopedRoot ? full.slice(2) : full;
  }
  return mediaFolderSegments({
    brandSlug: brandFolderSlug(input.brand.name, input.brand.id.slice(-8).toLowerCase()),
    kind: input.kind,
    rootFolderName: input.rootFolderName ?? null,
  });
}
