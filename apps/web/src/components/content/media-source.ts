/** Which store the media library shows: OMA storage or the workspace's own WorkDrive. */
export type MediaSource = 'oma' | 'workdrive';

const SOURCE_KEY = 'oma-ml-source';

const isSource = (v: unknown): v is MediaSource => v === 'oma' || v === 'workdrive';

/** Last choice: `?media_source=` first, then the remembered choice (local, then legacy session). */
export function readStoredSource(): MediaSource | null {
  if (typeof window === 'undefined') return null;
  try {
    const q = new URL(window.location.href).searchParams.get('media_source');
    if (isSource(q)) return q;
  } catch {
    /* ignore */
  }
  for (const store of ['localStorage', 'sessionStorage'] as const) {
    try {
      const v = window[store].getItem(SOURCE_KEY);
      if (isSource(v)) return v;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Remember the choice across sessions and mirror it in the URL (shareable, survives reload). */
export function persistSource(next: MediaSource) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOURCE_KEY, next);
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
 * Initial source: the remembered choice when that store is usable, otherwise the workspace
 * mode, otherwise whichever store exists. `null` when the workspace status is unknown and
 * nothing was remembered (the server then picks and reports `source`).
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
  if (stored === 'workdrive' && workdrive) return 'workdrive';
  if (stored === 'oma' && oma) return 'oma';
  if (ws.mode === 'USER_WORKDRIVE' && workdrive) return 'workdrive';
  if (oma) return 'oma';
  if (workdrive) return 'workdrive';
  return stored ?? 'oma';
}
