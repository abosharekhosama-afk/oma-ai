'use client';
import { DeliverablesShimmer } from '../../../../components/ui/screen-shimmer';
import { useReloadOnBrandChange } from '../../../../lib/active-brand';
import { Button, Input } from '@oma/ui/controls';

import Link from 'next/link';
import { MediaSurface, versionMime } from '../../../../components/content/media-surface';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlxHeaderFilter } from '../../../../components/ui/plx-header-filter';
import type { DemoGraph } from '@oma/demo';
import { EmptyState } from '../../../../components/ui/empty-state';
import { StatusChip } from '../../../../components/ui/status-chip';
import { pickCopy } from '../../../../lib/demo/use-demo-api';
import { loadDeliverablesWorkspace, opsError } from '../../../../lib/ops-api';
import {
  EMPTY_DELIVERABLE_FILTERS,
  activeDeliverableFilterCount,
  currentVersion,
  deliverableIsOverdue,
  deliverableNextAction,
  filterDeliverables,
  unresolvedCount,
  type DeliverableFilters,
  type DeliverableRow,
} from '../../../../lib/demo/stage5-deliverables';
import { clearBreadcrumbViewSlot } from '../../../../lib/breadcrumb-view-slot';
import { useLocale, useT } from '../../../../lib/use-locale';
import {
  AppstoreOutlined,
  BarsOutlined,
  CloseOutlined,
  FilterOutlined,
  SearchOutlined,
  DownOutlined,
  UpOutlined,
} from '../../../../components/ui/lucide-icons';

type Campaign = DemoGraph['campaigns'][number];

const GROUPS: DeliverableFilters['group'][] = [
  'all',
  'needs_review',
  'changes',
  'in_progress',
  'approved',
  'archived',
];

const VIEW_PREF_KEY = 'oma-demo-deliv-view';

export default function DeliverablesPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [rows, setRows] = useState<DeliverableRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filters, setFilters] = useState<DeliverableFilters>(EMPTY_DELIVERABLE_FILTERS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [filterSection, setFilterSection] = useState<string | null>('search');
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ws = await loadDeliverablesWorkspace();
      setRows(ws.deliverables);
      setCampaigns(ws.campaigns as Campaign[]);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      setError(opsError(err, 'Failed to load deliverables'));
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

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_PREF_KEY);
      if (stored === 'list' || stored === 'grid') {
        setFilters((f) => ({ ...f, view: stored }));
      }
    } catch {
      /* ignore */
    }
    setPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      window.localStorage.setItem(VIEW_PREF_KEY, filters.view);
    } catch {
      /* ignore */
    }
  }, [filters.view, prefsLoaded]);

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

  useEffect(() => {
    const el = document.getElementById('oma-content-view-slot');
    if (!el) return;
    clearBreadcrumbViewSlot(el);
    return () => clearBreadcrumbViewSlot(el);
  }, []);

  function changeView(view: DeliverableFilters['view']) {
    setFilters((f) => ({ ...f, view }));
  }

  const filtered = useMemo(
    () => filterDeliverables(rows, filters, locale),
    [rows, filters, locale],
  );
  const filterCount = activeDeliverableFilterCount(filters);
  const owners = useMemo(() => [...new Set(rows.map((r) => r.owner))], [rows]);
  const reviewers = useMemo(() => [...new Set(rows.map((r) => r.reviewer))], [rows]);

  const filterLabel = locale.toLowerCase().startsWith('ar') ? 'تصفية' : 'Filter';
  const filterPanelTitle = locale.toLowerCase().startsWith('ar') ? 'تصفية وترتيب' : 'Filter & sort';

  return (
    <div
      className="oma-plx-deliverables"
      data-testid="demo-deliverables"
      data-prefs={prefsLoaded ? '1' : '0'}
      data-filter-open={filterSheet ? 'true' : 'false'}
    >
      <PlxHeaderFilter
        headerSlot={headerSlot}
        open={filterSheet}
        onOpenChange={setFilterSheet}
        filterTestId="demo-deliv-open-filters"
        filterLabel={filterLabel}
        filterCount={filterCount}
        panelTitle={filterPanelTitle}
        panelTestId="demo-deliv-filters"
        footer={
          filterCount > 0 ? (
            <Button
              type="default"
              data-testid="demo-deliv-clear-filters"
              onClick={() =>
                setFilters((f) => ({
                  ...EMPTY_DELIVERABLE_FILTERS,
                  view: f.view,
                  group: f.group,
                }))
              }
            >
              {t('demo.requests.clearFilters') || 'Clear filters'}
            </Button>
          ) : null
        }
      >
        <div className="oma-filter-accordion-list oma-plx-deliv-filter-accordion-list">
          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'search' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'search' ? null : 'search'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <SearchOutlined />
              </span>
              <span>{t('demo.deliverables.search')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'search' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'search' ? (
              <div className="oma-filter-accordion__body">
                <Input
                  value={filters.q}
                  data-testid="demo-deliv-search"
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  placeholder={t('demo.deliverables.search')}
                />
              </div>
            ) : null}
          </div>
          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'review' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'review' ? null : 'review'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <FilterOutlined />
              </span>
              <span>{t('demo.deliverables.filter.review')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'review' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'review' ? (
              <div className="oma-filter-accordion__body">
                {(
                  [
                    'all',
                    'DRAFT',
                    'AWAITING_REVIEW',
                    'IN_REVIEW',
                    'CHANGES_REQUESTED',
                    'APPROVED',
                    'REJECTED',
                  ] as const
                ).map((s) => (
                  <label key={s} className="oma-filter-check">
                    <input
                      type="radio"
                      name="deliv-review"
                      data-testid={s === 'all' ? 'demo-deliv-filter-review' : undefined}
                      checked={filters.reviewState === s}
                      onChange={() => setFilters((f) => ({ ...f, reviewState: s }))}
                    />
                    <span>{s === 'all' ? t('demo.filter.all') : s}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'type' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'type' ? null : 'type'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <AppstoreOutlined />
              </span>
              <span>{t('demo.deliverables.filter.type')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'type' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'type' ? (
              <div className="oma-filter-accordion__body">
                {(
                  [
                    'all',
                    'STATIC',
                    'CAROUSEL',
                    'REEL',
                    'LONG_VIDEO',
                    'COPY',
                    'PHOTOGRAPHY',
                  ] as const
                ).map((s) => (
                  <label key={s} className="oma-filter-check">
                    <input
                      type="radio"
                      name="deliv-type"
                      data-testid={s === 'all' ? 'demo-deliv-filter-type' : undefined}
                      checked={filters.assetType === s}
                      onChange={() => setFilters((f) => ({ ...f, assetType: s }))}
                    />
                    <span>{s === 'all' ? t('demo.filter.all') : s}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'campaign' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'campaign' ? null : 'campaign'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <FilterOutlined />
              </span>
              <span>{t('demo.deliverables.filter.campaign')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'campaign' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'campaign' ? (
              <div className="oma-filter-accordion__body">
                <label className="oma-filter-check">
                  <input
                    type="radio"
                    name="deliv-campaign"
                    data-testid="demo-deliv-filter-campaign"
                    checked={filters.campaignId === 'all'}
                    onChange={() => setFilters((f) => ({ ...f, campaignId: 'all' }))}
                  />
                  <span>{t('demo.filter.all')}</span>
                </label>
                {campaigns.map((c) => (
                  <label key={c.id} className="oma-filter-check">
                    <input
                      type="radio"
                      name="deliv-campaign"
                      checked={filters.campaignId === c.id}
                      onChange={() => setFilters((f) => ({ ...f, campaignId: c.id }))}
                    />
                    <span>{pickCopy(c.name, locale)}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'owner' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'owner' ? null : 'owner'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <FilterOutlined />
              </span>
              <span>{t('demo.deliverables.filter.owner')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'owner' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'owner' ? (
              <div className="oma-filter-accordion__body">
                <label className="oma-filter-check">
                  <input
                    type="radio"
                    name="deliv-owner"
                    data-testid="demo-deliv-filter-owner"
                    checked={filters.owner === 'all'}
                    onChange={() => setFilters((f) => ({ ...f, owner: 'all' }))}
                  />
                  <span>{t('demo.filter.all')}</span>
                </label>
                {owners.map((o) => (
                  <label key={o} className="oma-filter-check">
                    <input
                      type="radio"
                      name="deliv-owner"
                      checked={filters.owner === o}
                      onChange={() => setFilters((f) => ({ ...f, owner: o }))}
                    />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'reviewer' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'reviewer' ? null : 'reviewer'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <FilterOutlined />
              </span>
              <span>{t('demo.deliverables.filter.reviewer')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'reviewer' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'reviewer' ? (
              <div className="oma-filter-accordion__body">
                <label className="oma-filter-check">
                  <input
                    type="radio"
                    name="deliv-reviewer"
                    data-testid="demo-deliv-filter-reviewer"
                    checked={filters.reviewer === 'all'}
                    onChange={() => setFilters((f) => ({ ...f, reviewer: 'all' }))}
                  />
                  <span>{t('demo.filter.all')}</span>
                </label>
                {reviewers.map((r) => (
                  <label key={r} className="oma-filter-check">
                    <input
                      type="radio"
                      name="deliv-reviewer"
                      checked={filters.reviewer === r}
                      onChange={() => setFilters((f) => ({ ...f, reviewer: r }))}
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </PlxHeaderFilter>

      <div className="oma-plx-workspace-surface">
        <div className="oma-plx-listening__intro oma-plx-deliv__intro">
          <div>
            <h1 className="oma-plx-listening__title">{t('demo.deliverables.title')}</h1>
            <p className="oma-plx-deliv__subtitle">{t('demo.deliverables.subtitle')}</p>
          </div>
          {!loading && !unavailable && !error ? (
            <p className="oma-plx-listening__next-check" data-testid="demo-deliv-result-count">
              {filtered.length} / {rows.length}
            </p>
          ) : null}
        </div>

        {!loading && !unavailable && !error ? (
          <div className="oma-plx-deliv-view-row">
            <div
              className="oma-plx-listening-segment"
              role="group"
              aria-label={t('demo.view.grid')}
            >
              <button
                type="button"
                className={filters.view === 'grid' ? 'is-active' : ''}
                data-testid="demo-deliv-view-grid"
                aria-pressed={filters.view === 'grid'}
                onClick={() => changeView('grid')}
              >
                <AppstoreOutlined aria-hidden />
                <span>{t('demo.view.grid')}</span>
              </button>
              <button
                type="button"
                className={filters.view === 'list' ? 'is-active' : ''}
                data-testid="demo-deliv-view-list"
                aria-pressed={filters.view === 'list'}
                onClick={() => changeView('list')}
              >
                <BarsOutlined aria-hidden />
                <span>{t('demo.view.list')}</span>
              </button>
            </div>
          </div>
        ) : null}

        {loading ? <DeliverablesShimmer part="body" /> : null}
        {unavailable ? (
          <p className="oma-muted" data-testid="demo-deliverables-denied">
            {t('demo.unavailable')}
          </p>
        ) : null}
        {error ? (
          <p className="oma-inbox-error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !unavailable && !error ? (
          <div className="oma-plx-deliv-workspace">
            <div className="oma-plx-deliv-workspace__main">
              <section className="oma-plx-listening-panel oma-plx-deliv-panel">
                <header className="oma-plx-deliv-panel__head">
                  <div
                    className="oma-plx-deliv-groups"
                    data-testid="demo-deliv-groups"
                    role="tablist"
                    aria-label={t('demo.deliverables.title')}
                  >
                    {GROUPS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        role="tab"
                        className={`oma-plx-deliv-groups__btn${filters.group === g ? ' is-active' : ''}`}
                        aria-selected={filters.group === g}
                        data-active={filters.group === g ? 'true' : 'false'}
                        data-testid={`demo-deliv-group-${g}`}
                        onClick={() => setFilters((f) => ({ ...f, group: g }))}
                      >
                        {t(`demo.deliverables.group.${g}`)}
                      </button>
                    ))}
                  </div>
                </header>

                <div className="oma-plx-deliv-panel__body">
                  {filtered.length === 0 ? (
                    <EmptyState title={t('demo.empty')} body={t('demo.deliverables.emptyHint')} />
                  ) : filters.view === 'grid' ? (
                    <div className="oma-plx-deliv-grid" data-testid="demo-deliv-grid">
                      {filtered.map((d) => {
                        const ver = currentVersion(d);
                        const thumb = ver?.assets?.[0];
                        return (
                          <Link
                            key={d.id}
                            href={`/app/deliverables/${d.id}`}
                            className="oma-plx-deliv-card"
                            data-overdue={deliverableIsOverdue(d) ? 'true' : 'false'}
                            data-testid={`demo-deliv-card-${d.id}`}
                          >
                            <div className="oma-plx-deliv-card__media">
                              {thumb ? (
                                <MediaSurface src={thumb} mime={versionMime(ver)} alt="" />
                              ) : (
                                <div className="oma-plx-deliv-card__media-fallback" aria-hidden />
                              )}
                            </div>
                            <div className="oma-plx-deliv-card__body">
                              <strong className="oma-plx-deliv-card__title">
                                {pickCopy(d.title, locale)}
                              </strong>
                              <div className="oma-plx-deliv-card__chips">
                                <StatusChip status={d.reviewStatus} />
                              </div>
                              <span className="oma-plx-deliv-card__meta">
                                {d.owner} · {d.dueAt}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      <div
                        className="oma-plx-deliv-table-wrap oma-plx-deliv-desktop"
                        data-testid="demo-deliv-table"
                      >
                        <table className="oma-plx-deliv-table">
                          <thead>
                            <tr>
                              <th />
                              <th>{t('demo.deliverables.col.title')}</th>
                              <th>{t('demo.deliverables.col.type')}</th>
                              <th>{t('demo.deliverables.col.version')}</th>
                              <th>{t('demo.deliverables.col.status')}</th>
                              <th>{t('demo.deliverables.col.owner')}</th>
                              <th>{t('demo.deliverables.col.reviewer')}</th>
                              <th>{t('demo.deliverables.col.due')}</th>
                              <th>{t('demo.deliverables.col.comments')}</th>
                              <th>{t('demo.deliverables.col.next')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((d) => {
                              const ver = currentVersion(d);
                              const thumb = ver?.assets?.[0];
                              const next = deliverableNextAction(d);
                              return (
                                <tr
                                  key={d.id}
                                  data-overdue={deliverableIsOverdue(d) ? 'true' : 'false'}
                                  data-testid={`demo-deliv-row-${d.id}`}
                                  className="oma-plx-deliv-row"
                                  role="link"
                                  tabIndex={0}
                                  onClick={() => router.push(`/app/deliverables/${d.id}`)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      router.push(`/app/deliverables/${d.id}`);
                                    }
                                  }}
                                >
                                  <td>
                                    {thumb ? (
                                      <MediaSurface
                                        className="oma-plx-deliv-thumb"
                                        src={thumb}
                                        mime={versionMime(ver)}
                                        alt=""
                                      />
                                    ) : (
                                      <div className="oma-plx-deliv-thumb oma-plx-deliv-thumb--empty" />
                                    )}
                                  </td>
                                  <td>
                                    <Link
                                      href={`/app/deliverables/${d.id}`}
                                      className="oma-plx-deliv-table__title"
                                    >
                                      {pickCopy(d.title, locale)}
                                    </Link>
                                    <div className="oma-plx-deliv-table__sub">
                                      {[
                                        (d as { brandName?: string }).brandName,
                                        (d as { campaignName?: string | null }).campaignName,
                                      ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </div>
                                  </td>
                                  <td>{d.type}</td>
                                  <td>{ver?.label ?? '—'}</td>
                                  <td>
                                    <StatusChip status={d.reviewStatus} />
                                  </td>
                                  <td>{d.owner}</td>
                                  <td>{d.reviewer}</td>
                                  <td>{d.dueAt}</td>
                                  <td>{unresolvedCount(d)}</td>
                                  <td>{pickCopy(next, locale)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <ul
                        className="oma-plx-deliv-mobile"
                        aria-label={t('demo.deliverables.title')}
                      >
                        {filtered.map((d) => (
                          <li key={d.id}>
                            <Link
                              href={`/app/deliverables/${d.id}`}
                              className="oma-plx-deliv-mobile-card"
                              data-overdue={deliverableIsOverdue(d) ? 'true' : 'false'}
                            >
                              <strong>{pickCopy(d.title, locale)}</strong>
                              <StatusChip status={d.reviewStatus} />
                              <span className="oma-plx-deliv-card__meta">
                                {d.owner} · {d.dueAt}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
