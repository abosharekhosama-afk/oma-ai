'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { DemoDeliverableType, DemoGraph, DemoReviewStatus } from '@oma/demo';
import { DemoDisclosure } from '../../../../../components/demo/demo-disclosure';
import { StatusChip } from '../../../../../components/ui/status-chip';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../../../../lib/use-locale';

type Deliverable = DemoGraph['deliverables'][number];

const MEDIA_TYPES: DemoDeliverableType[] = [
  'REEL',
  'LONG_VIDEO',
  'PHOTOGRAPHY',
  'STATIC',
  'CAROUSEL',
];

export default function DeliverableDetailPage() {
  const t = useT();
  const locale = useLocale();
  const params = useParams<{ deliverableId: string }>();
  const deliverableId = params.deliverableId;
  const [row, setRow] = useState<Deliverable | null>(null);
  const [reviewStatus, setReviewStatus] = useState<DemoReviewStatus | null>(null);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!deliverableId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await demoApi<Deliverable>(`/deliverables/${deliverableId}`);
        if (cancelled) return;
        setRow(data);
        setReviewStatus(data.reviewStatus);
        const v0 = data.versions[0]?.id ?? '';
        const v1 = data.versions[1]?.id ?? v0;
        setCompareA(v0);
        setCompareB(v1);
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
  }, [deliverableId, t]);

  const showMediaCanvas = row ? MEDIA_TYPES.includes(row.type) : false;
  const versionA = useMemo(
    () => row?.versions.find((v) => v.id === compareA) ?? null,
    [row, compareA],
  );
  const versionB = useMemo(
    () => row?.versions.find((v) => v.id === compareB) ?? null,
    [row, compareB],
  );
  const current = useMemo(
    () => row?.versions.find((v) => v.id === row.currentVersionId) ?? row?.versions.at(-1) ?? null,
    [row],
  );

  return (
    <div className="oma-stack" data-testid="demo-deliverable-detail">
      <header className="oma-page-header">
        <div>
          <Link href="/app/deliverables" className="oma-text-link">
            ← {t('demo.deliverables.title')}
          </Link>
          <h1>{row ? pickCopy(row.title, locale) : t('demo.deliverables.title')}</h1>
        </div>
      </header>
      <DemoDisclosure message={t('demo.reviewHonesty')} />
      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {row ? (
        <>
          <div className="oma-chip-row">
            <span className="oma-badge oma-badge-muted">{row.type}</span>
            <StatusChip status={reviewStatus ?? row.reviewStatus} />
          </div>
          <p>
            <Link href={`/app/campaigns/${row.campaignId}`} className="oma-text-link">
              {row.campaignId}
            </Link>
            {row.taskId ? (
              <>
                {' · '}
                <Link href="/app/tasks" className="oma-text-link">
                  {row.taskId}
                </Link>
              </>
            ) : null}
          </p>

          {showMediaCanvas && current ? (
            <section className="oma-media-review-canvas" aria-label="Media review">
              <p className="oma-muted">{current.label}</p>
              {current.assets.map((src) => (
                <img key={src} src={src} alt="" />
              ))}
            </section>
          ) : null}

          <section className="oma-card">
            <h2>{t('demo.deliverable.versions')}</h2>
            <ul className="oma-compact-list">
              {row.versions.map((v) => (
                <li key={v.id}>
                  <div className="oma-compact-row">
                    <div>
                      <strong>{v.label}</strong>
                      <p className="oma-muted">{pickCopy(v.notes, locale)}</p>
                    </div>
                    <span className="oma-muted">{new Date(v.createdAt).toLocaleString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {row.versions.some((v) => v.assets.length > 0) && row.versions.length >= 2 ? (
            <section className="oma-card">
              <h2>{t('demo.deliverable.compare')}</h2>
              <div className="oma-filter-row">
                <label>
                  A
                  <select
                    className="oma-select"
                    value={compareA}
                    onChange={(e) => setCompareA(e.target.value)}
                  >
                    {row.versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  B
                  <select
                    className="oma-select"
                    value={compareB}
                    onChange={(e) => setCompareB(e.target.value)}
                  >
                    {row.versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="oma-compare-grid">
                <div>
                  <h3>{versionA?.label}</h3>
                  {versionA?.assets.map((src) => (
                    <img key={src} src={src} alt="" style={{ width: '100%', borderRadius: 8 }} />
                  ))}
                </div>
                <div>
                  <h3>{versionB?.label}</h3>
                  {versionB?.assets.map((src) => (
                    <img key={src} src={src} alt="" style={{ width: '100%', borderRadius: 8 }} />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <section className="oma-card">
            <h2>{t('demo.deliverable.changeRequests')}</h2>
            {row.changeRequests.length === 0 ? (
              <p className="oma-muted">{t('demo.empty')}</p>
            ) : (
              <ul className="oma-stack">
                {row.changeRequests.map((cr) => (
                  <li key={cr.id}>
                    <strong>{cr.author}</strong>
                    <p>{pickCopy(cr.body, locale)}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="oma-approval-actions">
              <button type="button" className="oma-btn" onClick={() => setReviewStatus('APPROVED')}>
                {t('demo.deliverable.approve')}
              </button>
              <button
                type="button"
                className="oma-btn oma-btn-secondary"
                onClick={() => setReviewStatus('CHANGES_REQUESTED')}
              >
                {t('demo.deliverable.requestChanges')}
              </button>
              <button
                type="button"
                className="oma-btn oma-btn-secondary"
                onClick={() => setReviewStatus('REJECTED')}
              >
                {t('demo.deliverable.reject')}
              </button>
            </div>
            <p className="oma-muted">{t('demo.reviewHonesty')}</p>
          </section>
        </>
      ) : null}
    </div>
  );
}
