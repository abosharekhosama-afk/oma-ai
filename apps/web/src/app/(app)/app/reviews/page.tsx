'use client';
import { TableShimmer } from '../../../../components/ui/shimmer';
import { useReloadOnBrandChange } from '../../../../lib/active-brand';
import { SearchOutlined } from '@ant-design/icons';

import { Button, Input } from '@oma/ui/controls';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
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
import { MediaSurface } from '../../../../components/content/media-surface';

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
  const [searchOpen, setSearchOpen] = useState(false);
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

  // Refresh when the active brand changes in the header switcher.
  useReloadOnBrandChange(load);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <div className="oma-stack oma-reviews-page" data-testid="reviews-production">
      <PageHeader
        title={t('demo.reviews.title')}
        description={t('demo.reviews.subtitle')}
        meta={
          <span className="oma-muted" data-testid="demo-review-workload">
            {t('demo.reviews.workload')}: {workload}
          </span>
        }
      />

      {loading ? <TableShimmer rows={6} avatar={false} /> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
          <div style={{ marginTop: 12 }}>
            <Button type="default" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="oma-reviews-toolbar" aria-label={t('demo.reviews.title')}>
            <div
              className="oma-ws-tabs oma-req-tabs oma-reviews-tabs"
              role="tablist"
              data-testid="demo-review-tabs"
            >
              {TABS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={tab === item}
                  className={`oma-ws-tab oma-req-tab${tab === item ? ' is-active' : ''}`}
                  data-active={tab === item ? 'true' : 'false'}
                  data-testid={`demo-review-tab-${item}`}
                  onClick={() => setTab(item)}
                >
                  <span>{t(`demo.reviews.tab.${item}`)}</span>
                  <span className="oma-reviews-tabs__count" aria-label={`${tabCounts[item]}`}>
                    {tabCounts[item]}
                  </span>
                </button>
              ))}
              <button
                type="button"
                role="tab"
                aria-selected={searchOpen || Boolean(q)}
                className={`oma-ws-tab oma-req-tab oma-reviews-search-tab${searchOpen || q ? ' is-active' : ''}`}
                data-active={searchOpen || q ? 'true' : 'false'}
                data-testid="demo-review-search-toggle"
                onClick={() => {
                  if (searchOpen || q) {
                    setSearchOpen(false);
                    setQ('');
                  } else {
                    setSearchOpen(true);
                  }
                }}
              >
                <SearchOutlined aria-hidden />
                <span>{t('demo.reviews.search')}</span>
              </button>
            </div>
            {searchOpen || q ? (
              <div className="oma-reviews-search-row" data-testid="demo-review-search-bar">
                <SearchOutlined aria-hidden />
                <Input
                  autoFocus={searchOpen}
                  value={q}
                  type="search"
                  maxLength={120}
                  data-testid="demo-review-search"
                  placeholder={t('demo.reviews.search')}
                  aria-label={t('demo.reviews.search')}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q ? (
                  <button
                    type="button"
                    className="oma-reviews-search__clear"
                    aria-label={locale === 'ar' ? 'مسح البحث' : 'Clear search'}
                    onClick={() => setQ('')}
                  >
                    ×
                  </button>
                ) : null}
                <button
                  type="button"
                  className="oma-reviews-search__close"
                  aria-label={locale === 'ar' ? 'إغلاق البحث' : 'Close search'}
                  onClick={() => {
                    setQ('');
                    setSearchOpen(false);
                  }}
                >
                  ×
                </button>
              </div>
            ) : null}
          </section>
          {queue.length === 0 ? (
            <EmptyState title={t('demo.empty')} body={t('demo.reviews.emptyHint')} />
          ) : (
            <div className="oma-review-queue-cards" data-testid="demo-review-queue">
              {queue.map((d) => {
                const ver = currentVersion(d);
                const thumb = ver?.assets[0];
                return (
                  <Link
                    key={d.id}
                    href={`/app/deliverables/${d.id}?review=1`}
                    className="oma-review-queue-card"
                    data-overdue={deliverableIsOverdue(d) ? 'true' : 'false'}
                    data-testid={`demo-review-row-${d.id}`}
                  >
                    {thumb ? (
                      <MediaSurface
                        src={thumb}
                        contentType={d.type === 'LONG_VIDEO' || d.type === 'REEL' ? 'REEL' : undefined}
                        alt=""
                        preload="none"
                      />
                    ) : (
                      <div className="oma-deliv-thumb-fallback" aria-hidden />
                    )}
                    <div className="oma-review-queue-card__content">
                      <div className="oma-review-queue-card__heading">
                        <strong>{pickCopy(d.title, locale)}</strong>
                        <StatusChip status={d.reviewStatus} />
                      </div>
                      <div className="oma-review-queue-card__meta">
                        <span>{d.owner}</span>
                        <span>{ver?.label ?? '—'}</span>
                        <span className="oma-ltr">{d.dueAt || '—'}</span>
                      </div>
                      <div className="oma-review-queue-card__foot">
                        <span className="oma-muted">
                          {unresolvedCount(d)} {t('demo.deliverables.col.comments').toLowerCase()}
                        </span>
                      </div>
                    </div>
                    <span
                      className="oma-review-queue-card__action"
                      data-testid={`demo-review-open-${d.id}`}
                    >
                      {t('demo.reviews.openReview')}
                      <span aria-hidden="true">{locale === 'ar' ? '←' : '→'}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
