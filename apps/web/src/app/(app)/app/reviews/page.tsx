'use client';
import { ReviewsShimmer } from '../../../../components/ui/screen-shimmer';
import { useReloadOnBrandChange } from '../../../../lib/active-brand';

import { Button } from '@oma/ui/controls';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlxHeaderSearch } from '../../../../components/ui/plx-header-search';
import { EmptyState } from '../../../../components/ui/empty-state';
import { StatusChip } from '../../../../components/ui/status-chip';
import { api } from '../../../../lib/api';
import { pickCopy } from '../../../../lib/demo/use-demo-api';
import {
  currentVersion,
  deliverableIsOverdue,
  filterReviewQueue,
  matchesReviewSearch,
  unresolvedCount,
  type DeliverableRow,
  type ReviewQueueTab,
} from '../../../../lib/demo/stage5-deliverables';
import { loadDeliverablesWorkspace, opsError } from '../../../../lib/ops-api';
import { useLocale, useT } from '../../../../lib/use-locale';
import { MediaSurface, versionMime } from '../../../../components/content/media-surface';

const TABS: ReviewQueueTab[] = ['all', 'assigned', 'waiting', 'changes', 'approved'];

type MeProfile = {
  user?: { name?: string | null; email?: string | null };
};

export default function ReviewsPage() {
  const t = useT();
  const locale = useLocale();
  const [rows, setRows] = useState<DeliverableRow[]>([]);
  const [tab, setTab] = useState<ReviewQueueTab>('waiting');
  const [q, setQ] = useState('');
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewerName, setReviewerName] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ws, me] = await Promise.all([
        loadDeliverablesWorkspace(),
        api<MeProfile>('/api/v1/auth/me').catch(() => ({ user: { name: null, email: '' } })),
      ]);
      setRows(ws.deliverables);
      const label =
        (me.user?.name && me.user.name.trim()) ||
        (me.user?.email ? me.user.email.split('@')[0] : '') ||
        'Team member';
      setReviewerName(label);
      setError(null);
    } catch (err) {
      setError(opsError(err, 'Failed to load review queue'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useReloadOnBrandChange(load);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const sync = () => {
      if (cancelled) return;
      const header = document.getElementById('oma-workspace-top-actions');
      setHeaderSlot(header);
      tries += 1;
      if (!header && tries < 30) {
        window.setTimeout(sync, 50);
      }
    };
    sync();
    return () => {
      cancelled = true;
      setHeaderSlot(null);
    };
  }, []);

  const queue = useMemo(() => {
    const list = filterReviewQueue(rows, tab, reviewerName);
    return list.filter((row) => matchesReviewSearch(row, q));
  }, [rows, tab, q, reviewerName]);

  const tabCounts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((item) => [item, filterReviewQueue(rows, item, reviewerName).length]),
      ) as Record<ReviewQueueTab, number>,
    [rows, reviewerName],
  );
  const workload = useMemo(
    () =>
      rows.filter(
        (r) =>
          reviewerName &&
          (r.reviewer === reviewerName || r.owner === reviewerName) &&
          (r.reviewStatus === 'AWAITING_REVIEW' || r.reviewStatus === 'IN_REVIEW'),
      ).length,
    [rows, reviewerName],
  );

  const searchPlaceholder = t('demo.reviews.search');

  return (
    <div className="oma-plx-listening oma-plx-reviews" data-testid="reviews-production">
      <PlxHeaderSearch
        headerSlot={headerSlot}
        value={q}
        onChange={setQ}
        testId="demo-review-search"
        placeholder={searchPlaceholder}
        ariaLabel={searchPlaceholder}
      />

      <div className="oma-plx-workspace-surface">
        <div className="oma-plx-listening__intro oma-plx-deliv__intro">
          <div>
            <h1 className="oma-plx-listening__title">{t('demo.reviews.title')}</h1>
            <p className="oma-plx-deliv__subtitle">{t('demo.reviews.subtitle')}</p>
          </div>
          {!loading && !error ? (
            <p className="oma-plx-listening__next-check" data-testid="demo-review-workload">
              {t('demo.reviews.workload')}: {workload} · {queue.length}
            </p>
          ) : null}
        </div>

        {loading ? <ReviewsShimmer part="body" /> : null}
        {error ? (
          <div className="oma-inbox-error" role="alert">
            <p style={{ margin: 0 }}>{error}</p>
            <div style={{ marginTop: 12 }}>
              <Button type="default" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          </div>
        ) : null}

        {!loading && !error ? (
          <section className="oma-plx-listening-panel oma-plx-reviews-panel">
            <header className="oma-plx-deliv-panel__head">
              <div
                className="oma-plx-deliv-groups oma-plx-reviews-tabs"
                role="tablist"
                aria-label={t('demo.reviews.title')}
                data-testid="demo-review-tabs"
              >
                {TABS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={tab === item}
                    className={`oma-plx-deliv-groups__btn${tab === item ? ' is-active' : ''}`}
                    data-active={tab === item ? 'true' : 'false'}
                    data-testid={`demo-review-tab-${item}`}
                    onClick={() => setTab(item)}
                  >
                    <span>{t(`demo.reviews.tab.${item}`)}</span>
                    <span className="oma-plx-reviews-tabs__count">{tabCounts[item]}</span>
                  </button>
                ))}
              </div>
            </header>
            <div className="oma-plx-deliv-panel__body">
              {queue.length === 0 ? (
                <EmptyState title={t('demo.empty')} body={t('demo.reviews.emptyHint')} />
              ) : (
                <ul className="oma-plx-review-queue" data-testid="demo-review-queue">
                  {queue.map((d) => {
                    const ver = currentVersion(d);
                    const thumb = ver?.assets[0];
                    const openLabel = t('demo.reviews.openReview');
                    return (
                      <li key={d.id}>
                        <Link
                          href={`/app/deliverables/${d.id}?review=1`}
                          className="oma-plx-review-card"
                          data-overdue={deliverableIsOverdue(d) ? 'true' : 'false'}
                          data-testid={`demo-review-row-${d.id}`}
                        >
                          <div className="oma-plx-review-card__media">
                            {thumb ? (
                              <MediaSurface
                                src={thumb}
                                mime={versionMime(ver)}
                                contentType={
                                  d.type === 'LONG_VIDEO' || d.type === 'REEL' ? 'REEL' : undefined
                                }
                                alt=""
                              />
                            ) : (
                              <div className="oma-plx-review-card__thumb-fallback" aria-hidden />
                            )}
                          </div>
                          <div className="oma-plx-review-card__main">
                            <div className="oma-plx-review-card__name-row">
                              <strong>{pickCopy(d.title, locale)}</strong>
                              <StatusChip status={d.reviewStatus} />
                            </div>
                            <p className="oma-plx-review-card__meta">
                              <span>{d.owner}</span>
                              <span aria-hidden="true">·</span>
                              <span>{ver?.label ?? '—'}</span>
                              <span aria-hidden="true">·</span>
                              <span className="oma-ltr">{d.dueAt || '—'}</span>
                            </p>
                            <p className="oma-plx-review-card__comments">
                              {unresolvedCount(d)} {t('demo.deliverables.col.comments').toLowerCase()}
                            </p>
                          </div>
                          <span
                            className="oma-plx-review-card__cta"
                            data-testid={`demo-review-open-${d.id}`}
                          >
                            {openLabel}
                            <span className="oma-plx-review-card__cta-arrow" aria-hidden="true">
                              {locale === 'ar' ? '←' : '→'}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
