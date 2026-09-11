'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatusChip } from '../../../../components/ui/status-chip';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import {
  currentVersion,
  deliverableIsOverdue,
  filterReviewQueue,
  unresolvedCount,
  type DeliverableRow,
  type ReviewQueueTab,
} from '../../../../lib/demo/stage5-deliverables';
import { useLocale, useT } from '../../../../lib/use-locale';

const TABS: ReviewQueueTab[] = ['assigned', 'waiting', 'changes', 'approved', 'all'];

export default function ReviewsPage() {
  const t = useT();
  const locale = useLocale();
  const [rows, setRows] = useState<DeliverableRow[]>([]);
  const [tab, setTab] = useState<ReviewQueueTab>('waiting');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await demoApi<DeliverableRow[]>('/deliverables');
      setRows(data);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (isDemoForbidden(err)) setUnavailable(true);
      else setError(demoErrorMessage(err, 'Demo unavailable'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const queue = useMemo(() => {
    let list = filterReviewQueue(rows, tab);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((r) =>
        [r.title.en, r.title.ar, r.owner, r.reviewer, r.type]
          .join(' ')
          .toLowerCase()
          .includes(query),
      );
    }
    return list;
  }, [rows, tab, q]);

  const workload = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.reviewer === 'Layla Haddad' &&
          (r.reviewStatus === 'AWAITING_REVIEW' || r.reviewStatus === 'IN_REVIEW'),
      ).length,
    [rows],
  );

  return (
    <div className="oma-stack" data-testid="demo-reviews">
      <PageHeader
        title={t('demo.reviews.title')}
        description={t('demo.reviews.subtitle')}
        meta={
          <span className="oma-muted" data-testid="demo-review-workload">
            {t('demo.reviews.workload')}: {workload}
          </span>
        }
      />
      <DemoDisclosure />
      <p className="oma-muted">{t('demo.realReviewsNote')}</p>

      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {!loading && !unavailable && !error ? (
        <>
          <div className="oma-review-tabs" role="tablist" data-testid="demo-review-tabs">
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                className="oma-btn oma-btn-secondary"
                aria-pressed={tab === item}
                data-testid={`demo-review-tab-${item}`}
                onClick={() => setTab(item)}
              >
                {t(`demo.reviews.tab.${item}`)}
              </button>
            ))}
          </div>
          <div className="oma-stage5-toolbar">
            <label className="oma-stage5-search">
              {t('demo.reviews.search')}
              <input
                className="oma-input"
                value={q}
                data-testid="demo-review-search"
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
          </div>

          {queue.length === 0 ? (
            <EmptyState title={t('demo.empty')} body={t('demo.reviews.emptyHint')} />
          ) : (
            <div className="oma-deliv-table-wrap" data-testid="demo-review-queue">
              <table className="oma-deliv-table">
                <thead>
                  <tr>
                    <th />
                    <th>{t('demo.deliverables.col.title')}</th>
                    <th>{t('demo.deliverables.col.version')}</th>
                    <th>{t('demo.deliverables.filter.campaign')}</th>
                    <th>{t('demo.reviews.submitter')}</th>
                    <th>{t('demo.deliverables.col.due')}</th>
                    <th>{t('demo.deliverables.col.comments')}</th>
                    <th>{t('demo.deliverables.filter.review')}</th>
                    <th>{t('demo.reviews.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((d) => {
                    const ver = currentVersion(d);
                    const thumb = ver?.assets[0];
                    return (
                      <tr
                        key={d.id}
                        data-overdue={deliverableIsOverdue(d) ? 'true' : 'false'}
                        data-testid={`demo-review-row-${d.id}`}
                      >
                        <td>
                          {thumb ? (
                            <img className="oma-deliv-thumb" src={thumb} alt="" />
                          ) : (
                            <div className="oma-deliv-thumb" />
                          )}
                        </td>
                        <td>
                          <Link
                            href={`/app/deliverables/${d.id}?review=1`}
                            className="oma-text-link"
                          >
                            {pickCopy(d.title, locale)}
                          </Link>
                        </td>
                        <td>{ver?.label ?? '—'}</td>
                        <td>{d.campaignId}</td>
                        <td>{d.owner}</td>
                        <td>{d.dueAt}</td>
                        <td>{unresolvedCount(d)}</td>
                        <td>
                          <StatusChip status={d.reviewStatus} />
                        </td>
                        <td>
                          <Link
                            href={`/app/deliverables/${d.id}?review=1`}
                            className="oma-btn oma-btn-secondary"
                            data-testid={`demo-review-open-${d.id}`}
                          >
                            {t('demo.reviews.openReview')}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
