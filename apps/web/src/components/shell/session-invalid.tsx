'use client';

import { useEffect, useState } from 'react';
import { resetSessionInvalidFlag } from '../../lib/api';
import { useT } from '../../lib/use-locale';
import { loginUrlFor, SESSION_OK_KEY } from '../../lib/session';
import { ErrorState } from '../ui/error-state';

/**
 * Listens for oma:session-invalid (from api 401) and shows a standalone
 * status card with re-login CTA + automatic redirect to /login.
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
    <ErrorState
      kind="unauthorized"
      testId="session-invalid"
      title={t('session.expiredTitle')}
      body={t('session.expiredBody')}
      action={
        <>
          <a
            className="oma-error-state__btn oma-error-state__btn--primary"
            href={loginHref}
            onClick={() => resetSessionInvalidFlag()}
            data-testid="error-state-login"
          >
            {t('session.signInAgain')}
          </a>
          <p className="oma-error-state__detail" style={{ margin: 0 }}>
            {t('session.redirecting')}
          </p>
        </>
      }
    />
  );
}
