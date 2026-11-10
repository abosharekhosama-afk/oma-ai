'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useT } from '../../lib/use-locale';
import { StatusPage } from './status-page';

export type ErrorKind =
  'unauthorized' | 'notFound' | 'server' | 'network' | 'forbidden' | 'generic';

/** Classify an api() error (status 0 = network) into a UI error kind. */
export function errorKindOf(err: unknown): ErrorKind {
  const status = (err as { status?: number } | null)?.status;
  if (status === 0 || (typeof navigator !== 'undefined' && navigator.onLine === false))
    return 'network';
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'notFound';
  if (status === 403) return 'forbidden';
  if (typeof status === 'number' && status >= 500) return 'server';
  return 'generic';
}

const KIND_ICON: Record<ErrorKind, string> = {
  unauthorized: '🔒',
  server: '!',
  network: '⌁',
  notFound: '?',
  forbidden: '✕',
  generic: 'i',
};

const DEFAULT_CODE: Partial<Record<ErrorKind, string>> = {
  unauthorized: '401',
  forbidden: '403',
  notFound: '404',
  server: '500',
};

/**
 * Standardized Planable / OMA Error Card (401 / 403 / 404 / 500 / offline / API) with retry.
 * Text comes from `errors.page.<kind>.title|body` in en/ar.
 */
export function ErrorState({
  kind = 'generic',
  onRetry,
  code,
  homeHref = '/app',
  compact = false,
  standalone,
  detail,
  title,
  body,
  action,
  testId,
}: {
  kind?: ErrorKind;
  onRetry?: () => void;
  code?: string;
  homeHref?: string;
  compact?: boolean;
  /** Full-page overlay without app chrome. Defaults to on when the card is not compact. */
  standalone?: boolean;
  detail?: string | null;
  title?: string;
  body?: string;
  action?: ReactNode;
  testId?: string;
}) {
  const t = useT();
  const heading = title || t(`errors.page.${kind}.title`);
  const description = body || t(`errors.page.${kind}.body`);
  const shownCode = code ?? DEFAULT_CODE[kind];
  const isUnauth = kind === 'unauthorized';
  const isStandalone = standalone ?? !compact;

  const card = (
    <section
      className={`oma-error-state oma-plx-error${compact ? ' oma-error-state--compact' : ''}${isStandalone ? ' oma-error-state--standalone' : ''}`}
      role="alert"
      data-testid={testId ?? `error-state-${kind}`}
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
            {isUnauth ? (
              <Link
                className="oma-error-state__btn oma-error-state__btn--primary"
                href="/login"
                data-testid="error-state-login"
              >
                {t('auth.login')}
              </Link>
            ) : null}
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

  if (isStandalone) return <StatusPage>{card}</StatusPage>;
  return card;
}
