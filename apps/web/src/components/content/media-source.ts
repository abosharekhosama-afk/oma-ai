/** Which store the media library shows: OMA storage or the workspace's own WorkDrive. */
export type MediaSource = 'oma' | 'workdrive';

const SOURCE_KEY = 'oma-ml-source';

const isSource = (v: unknown): v is MediaSource => v === 'oma' || v === 'workdrive';

/**
 * Explicit per-page choice: `?media_source=` first, then this tab's session choice. The choice
 * is deliberately NOT kept across sessions — every fresh open follows the workspace storage
 * setting, so a WorkDrive browse once can never silently redirect later uploads.
 */
export function readStoredSource(): MediaSource | null {
  if (typeof window === 'undefined') return null;
  try {
    const q = new URL(window.location.href).searchParams.get('media_source');
    if (isSource(q)) return q;
  } catch {
    /* ignore */
  }
  try {
    const v = window.sessionStorage.getItem(SOURCE_KEY);
    if (isSource(v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** Remember the choice for this tab only and mirror it in the URL (survives reload). */
export function persistSource(next: MediaSource) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SOURCE_KEY, next);
    // Drop the old cross-session choice that used to override the workspace setting.
    window.localStorage.removeItem(SOURCE_KEY);
  } catch {
    /* ignore */
  }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('media_source') === next) return;
    url.searchParams.set('media_source', next);
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch {
    /* ignore */
  }
}

/**
 * Initial source. The workspace storage setting wins (OMA storage for OMA / sync-backup modes,
 * WorkDrive for the WorkDrive mode) whenever that store is usable. A remembered choice is only
 * used when the workspace status is unknown or the configured store is unusable. `null` when the
 * workspace status is unknown and nothing was remembered (the server then picks).
 */
export function resolveInitialSource(
  stored: MediaSource | null,
  ws: {
    mode?: string | null;
    byos_connected?: boolean;
    internal_available?: boolean;
  } | null,
): MediaSource | null {
  if (!ws) return stored;
  const oma = Boolean(ws.internal_available);
  const workdrive = Boolean(ws.byos_connected);
  if (ws.mode === 'USER_WORKDRIVE' && workdrive) return 'workdrive';
  if ((ws.mode === 'OMA_INTERNAL' || ws.mode === 'SYNC_BACKUP') && oma) return 'oma';
  if (stored === 'workdrive' && workdrive) return 'workdrive';
  if (stored === 'oma' && oma) return 'oma';
  if (oma) return 'oma';
  if (workdrive) return 'workdrive';
  return stored ?? 'oma';
}
