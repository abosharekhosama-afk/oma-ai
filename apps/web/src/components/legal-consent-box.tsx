'use client';

import { useEffect, useState } from 'react';
import {
  CURRENT_TERMS_VERSION,
  TERMS_STORAGE_KEY,
  recordTermsAcceptance,
  saveLocalTermsConsent,
} from '../lib/auth-providers-api';
import { api } from '../lib/api';

type Props = {
  acceptLabel: string;
  acceptedBadge: string;
};

export function LegalConsentBox({ acceptLabel, acceptedBadge }: Props) {
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const local = window.localStorage.getItem(TERMS_STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local) as { accepted?: boolean; at?: string };
        if (parsed.accepted) setAcceptedAt(parsed.at ?? new Date().toISOString());
      }
    } catch {
      /* ignore */
    }
    void api<{ user?: { terms_accepted_at?: string | null } }>('/api/v1/auth/me')
      .then((me) => {
        if (me.user?.terms_accepted_at) {
          setAcceptedAt(me.user.terms_accepted_at);
          saveLocalTermsConsent(true);
        }
      })
      .catch(() => {
        /* unauthenticated visitor */
      });
  }, []);

  async function onAccept() {
    setBusy(true);
    try {
      saveLocalTermsConsent(true);
      const res = await recordTermsAcceptance(CURRENT_TERMS_VERSION).catch(() => null);
      setAcceptedAt(res?.data.terms_accepted_at ?? new Date().toISOString());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="oma-legal__consent-card" data-testid="legal-consent-card">
      <label className="oma-legal__consent-check">
        <input
          type="checkbox"
          checked={Boolean(acceptedAt)}
          disabled={busy}
          onChange={(e) => {
            if (e.target.checked) void onAccept();
            else {
              saveLocalTermsConsent(false);
              setAcceptedAt(null);
            }
          }}
          data-testid="legal-consent-checkbox"
        />
        <span>{acceptLabel}</span>
      </label>
      {acceptedAt ? (
        <span className="oma-legal__consent-badge" data-testid="legal-consent-badge">
          ✓ {acceptedBadge} ({acceptedAt.slice(0, 10)})
        </span>
      ) : null}
    </div>
  );
}
