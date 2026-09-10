'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../../../lib/use-locale';

type Member = DemoGraph['members'][number];

export default function TeamPage() {
  const t = useT();
  const locale = useLocale();
  const [rows, setRows] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await demoApi<Member[]>('/team');
        if (!cancelled) setRows(data);
      } catch (err) {
        if (cancelled) return;
        if (isDemoForbidden(err)) setUnavailable(true);
        else setError(demoErrorMessage(err, t('demo.unavailable')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div className="oma-stack" data-testid="demo-team">
      <header className="oma-page-header oma-page-header-stack">
        <div>
          <h1>{t('nav.team')}</h1>
          <p className="oma-muted">{t('demo.team.subtitle')}</p>
        </div>
        <Link href="/app/company/members" className="oma-btn oma-btn-secondary">
          {t('demo.teamInviteLink')}
        </Link>
      </header>
      <DemoDisclosure />
      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          {error}
        </div>
      ) : null}
      <ul className="oma-compact-list">
        {rows.map((m) => (
          <li key={m.id} className="oma-card">
            <strong>{pickCopy(m.name, locale)}</strong>
            <p className="oma-muted">{m.role}</p>
            <p>
              Workload {(m.workload * 100).toFixed(0)}% · {m.assignments} assignments ·{' '}
              {m.reviewQueue} in review
            </p>
            {m.restricted ? <span className="oma-badge">{t('demo.teamRestricted')}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
