'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { StatusChip } from '../../../../components/ui/status-chip';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../../../lib/use-locale';

type RequestRow = DemoGraph['requests'][number];

export default function RequestsPage() {
  const t = useT();
  const locale = useLocale();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await demoApi<RequestRow[]>('/requests');
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
    <div className="oma-stack" data-testid="demo-requests">
      <header className="oma-page-header oma-page-header-stack">
        <div>
          <h1>{t('demo.requests.title')}</h1>
          <p className="oma-muted">{t('demo.requests.subtitle')}</p>
        </div>
      </header>
      <DemoDisclosure />
      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}
      {!loading && !unavailable && rows.length === 0 ? (
        <p className="oma-muted">{t('demo.empty')}</p>
      ) : null}
      <ul className="oma-compact-list">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/app/requests/${r.id}`} className="oma-compact-row">
              <div>
                <strong>{pickCopy(r.title, locale)}</strong>
                <div className="oma-chip-row">
                  <StatusChip status={r.status} />
                  <StatusChip
                    status={r.priority}
                    tone={r.priority === 'URGENT' || r.priority === 'HIGH' ? 'warning' : 'neutral'}
                  />
                </div>
              </div>
              <span className="oma-muted">{r.dueAt}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
