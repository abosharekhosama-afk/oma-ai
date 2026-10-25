'use client';

import Link from 'next/link';
import { useT } from '../../lib/use-locale';

export type ErrorKind = 'notFound' | 'server' | 'network' | 'forbidden' | 'generic';

/** Classify an api() error (status 0 = network) into a UI error kind. */
export function errorKindOf(err: unknown): ErrorKind {
  const status = (err as { status?: number } | null)?.status;
  if (status === 0 || (typeof navigator !== 'undefined' && navigator.onLine === false))
    return 'network';
  if (status === 404) return 'notFound';
  if (status === 403) return 'forbidden';
  if (typeof status === 'number' && status >= 500) return 'server';
  return 'generic';
}

/**
 * Calm, Planable-style error panel (404 / 500 / offline / API) with retry.
 * Text comes from `errors.page.<kind>.title|body` in en/ar.
 */
export function ErrorState({
  kind = 'generic',
  onRetry,
  code,
  homeHref = '/app',
  compact = false,
  detail,
}: {
  kind?: ErrorKind;
  onRetry?: () => void;
  code?: string;
  homeHref?: string;
  compact?: boolean;
  detail?: string | null;
}) {
  const t = useT();
  return (
    <section
      className={`oma-error-state${compact ? ' oma-error-state--compact' : ''}`}
      role="alert"
      data-testid={`error-state-${kind}`}
    >
      {code ? <p className="oma-error-state__code">{code}</p> : null}
      <h2 className="oma-error-state__title">{t(`errors.page.${kind}.title`)}</h2>
      <p className="oma-error-state__body">{t(`errors.page.${kind}.body`)}</p>
      {detail ? <p className="oma-error-state__detail">{detail}</p> : null}
      <div className="oma-error-state__actions">
        {onRetry ? (
          <button
            type="button"
            className="oma-error-state__btn oma-error-state__btn--primary"
            onClick={onRetry}
            data-testid="error-state-retry"
          >
            {t('errors.retry')}
          </button>
        ) : null}
        <Link className="oma-error-state__btn" href={homeHref}>
          {t('errors.goHome')}
        </Link>
      </div>
    </section>
  );
}
