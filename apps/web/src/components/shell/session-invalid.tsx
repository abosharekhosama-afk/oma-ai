'use client';

import { useEffect, useState } from 'react';
import { resetSessionInvalidFlag } from '../../lib/api';

/**
 * Listens for oma:session-invalid (from api 401) and shows a professional
 * overlay with re-login CTA + automatic redirect to /login.
 */
export function SessionInvalidOverlay() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('Session invalid');

  useEffect(() => {
    function onInvalid(e: Event) {
      const detail = (e as CustomEvent).detail as { message?: string } | undefined;
      if (detail?.message) setMsg(detail.message);
      setOpen(true);
    }
    window.addEventListener('oma:session-invalid', onInvalid);
    return () => window.removeEventListener('oma:session-invalid', onInvalid);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      window.location.replace('/login?reason=session');
    }, 2800);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  return (
    <div className="oma-session-invalid" role="alertdialog" aria-modal="true" data-testid="session-invalid">
      <div className="oma-session-invalid__card">
        <div className="oma-session-invalid__icon" aria-hidden>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
            <path d="M12 7v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="1" fill="currentColor" />
          </svg>
        </div>
        <h2 className="oma-session-invalid__title">Session expired</h2>
        <p className="oma-session-invalid__body">
          {msg === 'Session invalid'
            ? 'Your session is no longer valid. Sign in again to continue.'
            : msg}
        </p>
        <a
          className="oma-session-invalid__btn"
          href="/login?reason=session"
          onClick={() => resetSessionInvalidFlag()}
        >
          Sign in again
        </a>
        <p className="oma-session-invalid__hint">Redirecting automatically…</p>
      </div>
    </div>
  );
}
