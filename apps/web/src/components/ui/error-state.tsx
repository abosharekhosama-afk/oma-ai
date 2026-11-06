'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
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

const KIND_ICON: Record<ErrorKind, string> = {
  server: '!',
  network: '⌁',
  notFound: '?',
  forbidden: '✕',
  generic: 'i',
};

/**
 * Social Inbox / Planable error card (404 / 500 / offline / API) with retry.
 * Text comes from `errors.page.<kind>.title|body` in en/ar.
 */
export function ErrorState({
  kind = 'generic',
  onRetry,
  code,
  homeHref = '/app',
  compact = false,
  detail,
  title,
  body,
  action,
}: {
  kind?: ErrorKind;
  onRetry?: () => void;
  code?: string;
  homeHref?: string;
  compact?: boolean;
  detail?: string | null;
  title?: string;
  body?: string;
  action?: ReactNode;
}) {
  const t = useT();
  const heading = title || t(`errors.page.${kind}.title`);
  const description = body || t(`errors.page.${kind}.body`);
  const shownCode = code ?? (kind === 'server' ? '500' : kind === 'notFound' ? '404' : undefined);
  return (
    <section
      className={`oma-error-state oma-plx-error${compact ? ' oma-error-state--compact' : ''}`}
      role="alert"
      data-testid={`error-state-${kind}`}
      data-kind={kind}
    >
      <span className="oma-plx-error__icon" data-kind={kind} aria-hidden>
        {KIND_ICON[kind]}
      </span>
      {shownCode ? <p className="oma-error-state__code">{shownCode}</p> : null}
      <h2 className="oma-error-state__title">{heading}</h2>
      <p className="oma-error-state__body">{description}</p>
      {detail ? <p className="oma-error-state__detail">{detail}</p> : null}
      <div className="oma-error-state__actions">
        {action ?? (
          <>
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
          </>
        )}
      </div>
    </section>
  );
}
