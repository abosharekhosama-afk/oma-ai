'use client';

import { useEffect, useState } from 'react';
import { useT } from '../../lib/use-locale';

/** Thin, calm banner shown while the browser is offline. */
export function OfflineBanner() {
  const t = useT();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="oma-offline-banner" role="status" data-testid="offline-banner">
      {t('errors.offlineBanner')}
    </div>
  );
}
