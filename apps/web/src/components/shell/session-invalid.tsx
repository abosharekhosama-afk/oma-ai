'use client';

import { useEffect, useState } from 'react';
import { resetSessionInvalidFlag } from '../../lib/api';
import { useT } from '../../lib/use-locale';
import { loginUrlFor, SESSION_OK_KEY } from '../../lib/session';

/**
 * Listens for oma:session-invalid (from api 401) and shows a professional
 * overlay with re-login CTA + automatic redirect to /login.
 */
export function SessionInvalidOverlay() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [loginHref, setLoginHref] = useState('/login?reason=session');

  useEffect(() => {
    function onInvalid(e: Event) {
      void e;
      try {
        window.sessionStorage.removeItem(SESSION_OK_KEY);
      } catch {
        /* ignore */
      }
      setLoginHref(loginUrlFor(window.location));
      setOpen(true);
    }
    window.addEventListener('oma:session-invalid', onInvalid);
    return () => window.removeEventListener('oma:session-invalid', onInvalid);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      window.location.replace(loginHref);
    }, 1500);
    return () => window.clearTimeout(id);
  }, [open, loginHref]);

  if (!open) return null;

  return (
    <div
      className="oma-session-invalid"
      role="alertdialog"
      aria-modal="true"
      data-testid="session-invalid"
    >
      <div className="oma-session-invalid__card">
        <div className="oma-session-invalid__icon" aria-hidden>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
            <path d="M12 7v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="1" fill="currentColor" />
          </svg>
        </div>
        <h2 className="oma-session-invalid__title">{t('session.expiredTitle')}</h2>
        <p className="oma-session-invalid__body">{t('session.expiredBody')}</p>
        <a
          className="oma-session-invalid__btn"
          href={loginHref}
          onClick={() => resetSessionInvalidFlag()}
        >
          {t('session.signInAgain')}
        </a>
        <p className="oma-session-invalid__hint">{t('session.redirecting')}</p>
      </div>
    </div>
  );
}
