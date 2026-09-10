'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

export default function ReviewsPage() {
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

  const inbox = useMemo(
    () =>
      rows.filter(
        (d) => d.reviewStatus === 'AWAITING_REVIEW' || d.reviewStatus === 'CHANGES_REQUESTED',
      ),
    [rows],
  );

  return (
    <div className="oma-stack" data-testid="demo-reviews">
      <header className="oma-page-header oma-page-header-stack">
        <div>
          <h1>{t('demo.reviews.title')}</h1>
          <p className="oma-muted">{t('demo.reviews.subtitle')}</p>
        </div>
      </header>
      <DemoDisclosure />
      <p className="oma-muted">{t('demo.realReviewsNote')}</p>
      <p>
        <Link href="/app/brands" className="oma-text-link">
          {t('nav.intelligence')}
        </Link>
      </p>
      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}
      {!loading && !unavailable && inbox.length === 0 ? (
        <p className="oma-muted">{t('demo.empty')}</p>
      ) : null}
      <ul className="oma-compact-list">
        {inbox.map((d) => (
          <li key={d.id}>
            <Link href={`/app/deliverables/${d.id}`} className="oma-compact-row">
              <div>
                <strong>{pickCopy(d.title, locale)}</strong>
                <div className="oma-chip-row">
                  <span className="oma-badge oma-badge-muted">{d.type}</span>
                  <StatusChip status={d.reviewStatus} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
