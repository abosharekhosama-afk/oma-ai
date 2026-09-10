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

type Deliverable = DemoGraph['deliverables'][number];

export default function DeliverablesPage() {
  const t = useT();
  const locale = useLocale();
  const [rows, setRows] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await demoApi<Deliverable[]>('/deliverables');
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
    <div className="oma-stack" data-testid="demo-deliverables">
      <header className="oma-page-header oma-page-header-stack">
        <div>
          <h1>{t('demo.deliverables.title')}</h1>
          <p className="oma-muted">{t('demo.deliverables.subtitle')}</p>
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
      <div className="oma-content-grid">
        {rows.map((d) => (
          <Link key={d.id} href={`/app/deliverables/${d.id}`} className="oma-content-card">
            <div className="oma-content-card-body">
              <span className="oma-badge oma-badge-muted">{d.type}</span>
              <strong>{pickCopy(d.title, locale)}</strong>
              <StatusChip status={d.reviewStatus} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
