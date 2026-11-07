'use client';

import { useEffect, useState } from 'react';
import { invalidateApiCache } from '../../lib/api';
import { useT } from '../../lib/use-locale';

export const NETWORK_FAILURE_EVENT = 'oma:network-failure';
export const NETWORK_RECOVERED_EVENT = 'oma:network-recovered';

export function emitNetworkFailure() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NETWORK_FAILURE_EVENT));
}

export function emitNetworkRecovered() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NETWORK_RECOVERED_EVENT));
}

/**
 * Centralized, app-wide Network Connectivity Indicator.
 * Single source of truth for browser offline state and transient API network drops.
 */
export function OfflineBanner() {
  const t = useT();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => {
      const isOff = typeof navigator !== 'undefined' && !navigator.onLine;
      setOffline(isOff);
      if (!isOff) {
        invalidateApiCache('/api/v1/');
        emitNetworkRecovered();
      }
    };
    const onNetFail = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setOffline(true);
      }
    };
    const onNetOk = () => {
      if (typeof navigator === 'undefined' || navigator.onLine) {
        setOffline(false);
      }
    };

    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    window.addEventListener(NETWORK_FAILURE_EVENT, onNetFail);
    window.addEventListener(NETWORK_RECOVERED_EVENT, onNetOk);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      window.removeEventListener(NETWORK_FAILURE_EVENT, onNetFail);
      window.removeEventListener(NETWORK_RECOVERED_EVENT, onNetOk);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="oma-offline-banner"
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
    >
      <span className="oma-offline-banner__dot" aria-hidden="true" />
      <span>{t('errors.offlineBanner')}</span>
      <button
        type="button"
        className="oma-offline-banner__retry"
        onClick={() => {
          invalidateApiCache('/api/v1/');
          if (typeof navigator === 'undefined' || navigator.onLine) {
            setOffline(false);
            emitNetworkRecovered();
          } else {
            window.location.reload();
          }
        }}
        data-testid="offline-banner-retry"
      >
        {t('errors.retry')}
      </button>
    </div>
  );
}

/** Alias for semantic imports across the app. */
export const NetworkConnectivityBanner = OfflineBanner;
