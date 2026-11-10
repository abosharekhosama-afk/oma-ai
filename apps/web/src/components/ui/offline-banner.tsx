'use client';

import { useEffect, useRef, useState } from 'react';
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
 * The single app-wide network connectivity indicator: a bar under the header.
 * Other online/offline widgets should defer to this banner.
 */
export function OfflineBanner() {
  const t = useT();
  const [offline, setOffline] = useState(false);
  const [backOnline, setBackOnline] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    let hideTimer: number | undefined;
    const showBackOnline = () => {
      if (!wasOffline.current) return;
      wasOffline.current = false;
      setBackOnline(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setBackOnline(false), 3200);
    };

    const sync = () => {
      const isOff = typeof navigator !== 'undefined' && !navigator.onLine;
      setOffline(isOff);
      if (isOff) {
        wasOffline.current = true;
        setBackOnline(false);
        return;
      }
      invalidateApiCache('/api/v1/');
      emitNetworkRecovered();
      showBackOnline();
    };
    const onNetFail = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        wasOffline.current = true;
        setOffline(true);
        setBackOnline(false);
      }
    };
    const onNetOk = () => {
      if (typeof navigator === 'undefined' || navigator.onLine) {
        setOffline(false);
        showBackOnline();
      }
    };

    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    window.addEventListener(NETWORK_FAILURE_EVENT, onNetFail);
    window.addEventListener(NETWORK_RECOVERED_EVENT, onNetOk);
    return () => {
      window.clearTimeout(hideTimer);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      window.removeEventListener(NETWORK_FAILURE_EVENT, onNetFail);
      window.removeEventListener(NETWORK_RECOVERED_EVENT, onNetOk);
    };
  }, []);

  if (!offline && !backOnline) return null;

  return (
    <div
      className={`oma-offline-banner${offline ? '' : ' oma-offline-banner--online'}`}
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      data-state={offline ? 'offline' : 'online'}
    >
      <span className="oma-offline-banner__dot" aria-hidden="true" />
      <span>{offline ? t('errors.offlineBanner') : t('errors.onlineBanner')}</span>
      {offline ? (
        <button
          type="button"
          className="oma-offline-banner__retry"
          onClick={() => {
            invalidateApiCache('/api/v1/');
            if (typeof navigator === 'undefined' || navigator.onLine) {
              setOffline(false);
              wasOffline.current = true;
              setBackOnline(true);
              emitNetworkRecovered();
            } else {
              window.location.reload();
            }
          }}
          data-testid="offline-banner-retry"
        >
          {t('errors.retry')}
        </button>
      ) : null}
    </div>
  );
}

/** @deprecated Use OfflineBanner — kept as an alias so older imports stay the same component. */
export const NetworkConnectivityBanner = OfflineBanner;
