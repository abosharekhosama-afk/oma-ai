'use client';

import { useEffect } from 'react';
import { api } from '../../lib/api';
import { refreshSession } from '../../lib/account-api';
import { refreshDelayMs } from '../../lib/session';

type Me = { session_expires_at?: string | null };

/**
 * Keeps an active session alive: refreshes the sliding session shortly before it expires
 * (and when the tab becomes visible again). If refresh fails with 401 the api layer raises
 * `oma:session-invalid`, which redirects to login preserving the return URL.
 */
export function SessionKeeper() {
  useEffect(() => {
    let timer: number | undefined;
    let expiresAt: string | null = null;
    let stopped = false;

    const arm = () => {
      window.clearTimeout(timer);
      const delay = refreshDelayMs(expiresAt);
      if (delay === null || stopped) return;
      timer = window.setTimeout(() => void doRefresh(), delay);
    };
    const doRefresh = async () => {
      try {
        expiresAt = await refreshSession();
      } catch {
        return; // 401 → session-invalid overlay handles redirect
      }
      arm();
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const delay = refreshDelayMs(expiresAt);
      if (delay === 0) void doRefresh();
    };

    api<Me>('/api/v1/auth/me')
      .then((me) => {
        expiresAt = me.session_expires_at ?? null;
        arm();
      })
      .catch(() => undefined);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}
