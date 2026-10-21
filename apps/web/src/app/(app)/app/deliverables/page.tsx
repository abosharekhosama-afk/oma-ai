'use client';
import { Button, Input, SelectField } from '@oma/ui/controls';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatusChip } from '../../../../components/ui/status-chip';
import { pickCopy } from '../../../../lib/demo/use-demo-api';
import {
  loadDeliverablesWorkspace,
  opsError,
} from '../../../../lib/ops-api';
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
import { useLocale, useT } from '../../../../lib/use-locale';
import {
  AppstoreOutlined,
  BarsOutlined,
  CloseOutlined,
  FilterOutlined,
  SearchOutlined,
  DownOutlined,
  UpOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';

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
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
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

  function changeView(view: DeliverableFilters['view']) {
    setFilters((f) => ({ ...f, view }));
  }


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
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('data-testid', 'demo-deliv-view-toggle');
    el.style.cursor = 'pointer';
    const open = (e: Event) => {
      e.stopPropagation();
      setViewMenuOpen((v) => !v);
    };
    el.addEventListener('click', open);
    return () => el.removeEventListener('click', open);
  }, []);

  useEffect(() => {
    const el = document.getElementById('oma-content-view-slot');
    if (!el) return;
    el.textContent = filters.view === 'grid' ? t('demo.view.grid') : t('demo.view.list');
    el.setAttribute('data-view', filters.view);
  }, [filters.view, t]);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const onDoc = () => setViewMenuOpen(false);
    const tmr = window.setTimeout(() => document.addEventListener('click', onDoc), 0);
    return () => {
      window.clearTimeout(tmr);
      document.removeEventListener('click', onDoc);
    };
  }, [viewMenuOpen]);

  const filtered = useMemo(
    () => filterDeliverables(rows, filters, locale),
    [rows, filters, locale],
  );
  const filterCount = activeDeliverableFilterCount(filters);
  const owners = useMemo(() => [...new Set(rows.map((r) => r.owner))], [rows]);
  const reviewers = useMemo(() => [...new Set(rows.map((r) => r.reviewer))], [rows]);

  return (
    <div className="oma-deliv-page" data-testid="demo-deliverables" data-prefs={prefsLoaded ? '1' : '0'}>
      <PageHeader title={t('demo.deliverables.title')} description={t('demo.deliverables.subtitle')} />
      <DemoDisclosure />

      {headerSlot && headerSlot.isConnected
        ? createPortal(
            <div className="oma-workspace-header-actions">
              <button
                type="button"
                className="oma-req-filter-btn"
                data-testid="demo-deliv-open-filters"
                data-active={filterSheet ? 'true' : 'false'}
                onClick={() => setFilterSheet((v) => !v)}
              >
                <FilterOutlined />
                <span>{locale.toLowerCase().startsWith('ar') ? 'تصفية' : 'Filter'}</span>
                {filterCount > 0 ? (
                  <span className="oma-req-filter-btn__count">{filterCount}</span>
                ) : null}
              </button>
            </div>,
            headerSlot,
          )
        : null}

      {viewMenuOpen && typeof document !== 'undefined'
        ? createPortal(
            <ul
              className="oma-view-menu__list oma-view-menu__list--card oma-view-menu__list--path"
              role="menu"
              data-testid="demo-deliv-view-menu"
            >
              <li role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={filters.view === 'list'}
                  data-selected={filters.view === 'list' ? 'true' : 'false'}
                  data-testid="demo-deliv-view-list"
                  className="oma-view-menu__item"
                  onClick={(e) => {
                    e.stopPropagation();
                    changeView('list');
                    setViewMenuOpen(false);
                  }}
                >
                  <span className="oma-view-menu__item-icon" aria-hidden>
                    <BarsOutlined />
                  </span>
                  <span>{t('demo.view.list')}</span>
                  <span className="oma-view-menu__check" aria-hidden>
                    {filters.view === 'list' ? '✓' : ''}
                  </span>
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={filters.view === 'grid'}
                  data-selected={filters.view === 'grid' ? 'true' : 'false'}
                  data-testid="demo-deliv-view-grid"
                  className="oma-view-menu__item"
                  onClick={(e) => {
                    e.stopPropagation();
                    changeView('grid');
                    setViewMenuOpen(false);
                  }}
                >
                  <span className="oma-view-menu__item-icon" aria-hidden>
                    <AppstoreOutlined />
                  </span>
                  <span>{t('demo.view.grid')}</span>
                  <span className="oma-view-menu__check" aria-hidden>
                    {filters.view === 'grid' ? '✓' : ''}
                  </span>
                </button>
              </li>
            </ul>,
            document.body,
          )
        : null}

      <p className="oma-honesty-inline" data-testid="demo-storage-honesty">
        {t('demo.deliverable.storageHonesty')}
      </p>

      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? (
        <p className="oma-muted" data-testid="demo-deliverables-denied">
          {t('demo.unavailable')}
        </p>
      ) : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {!loading && !unavailable && !error ? (
        <>
          <div className="oma-req-topbar oma-deliv-topbar">
            <div className="oma-req-tabs" data-testid="demo-deliv-groups" role="tablist">
              {GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  className="oma-req-tab"
                  aria-selected={filters.group === g}
                  data-active={filters.group === g ? 'true' : 'false'}
                  data-testid={`demo-deliv-group-${g}`}
                  onClick={() => setFilters((f) => ({ ...f, group: g }))}
                >
                  {t(`demo.deliverables.group.${g}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="oma-req-workspace oma-deliv-workspace" data-filter-open={filterSheet ? 'true' : 'false'}>
            <div className="oma-req-main">
              <p className="oma-muted" data-testid="demo-deliv-result-count">
                {filtered.length} / {rows.length}
              </p>

              {filtered.length === 0 ? (
                <EmptyState title={t('demo.empty')} body={t('demo.deliverables.emptyHint')} />
              ) : filters.view === 'grid' ? (
                <div className="oma-deliv-grid" data-testid="demo-deliv-grid">
                  {filtered.map((d) => {
                    const ver = currentVersion(d);
                    const thumb = ver?.previewUrl;
                    return (
                      <Link
                        key={d.id}
                        href={`/app/deliverables/${d.id}`}
                        className="oma-deliv-grid-card"
                        data-overdue={deliverableIsOverdue(d) ? 'true' : 'false'}
                        data-testid={`demo-deliv-card-${d.id}`}
                      >
                        {thumb ? (
                          <img src={thumb} alt="" />
                        ) : (
                          <div className="oma-deliv-thumb-fallback" />
                        )}
                        <strong>{pickCopy(d.title, locale)}</strong>
                        <div className="oma-chip-row">
                          <StatusChip status={d.reviewStatus} />
                        </div>
                        <span className="oma-muted">
                          {d.owner} · {d.dueAt}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div className="oma-deliv-table-wrap oma-deliv-desktop" data-testid="demo-deliv-table">
                    <table className="oma-deliv-table">
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
                          const thumb = ver?.previewUrl;
                          const next = deliverableNextAction(d);
                          return (
                            <tr
                              key={d.id}
                              data-overdue={deliverableIsOverdue(d) ? 'true' : 'false'}
                              data-testid={`demo-deliv-row-${d.id}`}
                          className="oma-deliv-row"
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
                                  <img className="oma-deliv-thumb" src={thumb} alt="" />
                                ) : (
                                  <div className="oma-deliv-thumb" />
                                )}
                              </td>
                              <td>
                                <Link href={`/app/deliverables/${d.id}`} className="oma-text-link">
                                  {pickCopy(d.title, locale)}
                                </Link>
                                <div className="oma-muted" style={{ fontSize: 12 }}>
                                  {d.taskId ?? '—'} · {d.campaignId}
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
                  <ul className="oma-deliv-mobile" aria-label={t('demo.deliverables.title')}>
                    {filtered.map((d) => (
                      <li key={d.id}>
                        <Link
                          href={`/app/deliverables/${d.id}`}
                          className="oma-deliv-mobile-card"
                          data-overdue={deliverableIsOverdue(d) ? 'true' : 'false'}
                        >
                          <strong>{pickCopy(d.title, locale)}</strong>
                          <StatusChip status={d.reviewStatus} />
                          <span className="oma-muted">
                            {d.owner} · {d.dueAt}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {filterSheet ? (
              <aside className="oma-req-filter-panel" data-testid="demo-deliv-filters">
                <header className="oma-req-filter-panel__head">
                  <strong>{locale.toLowerCase().startsWith('ar') ? 'تصفية وترتيب' : 'Filter & sort'}</strong>
                  <button
                    type="button"
                    className="oma-req-filter-panel__close"
                    aria-label="Close"
                    onClick={() => setFilterSheet(false)}
                  >
                    <CloseOutlined />
                  </button>
                </header>
                <div className="oma-filter-accordion-list">
                  <div className="oma-filter-accordion">
                    <button
                      type="button"
                      className="oma-filter-accordion__row"
                      data-open={filterSection === 'search' ? 'true' : 'false'}
                      onClick={() => setFilterSection((s) => (s === 'search' ? null : 'search'))}
                    >
                      <span className="oma-filter-accordion__ico">
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
                      <span className="oma-filter-accordion__ico">
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
                      <span className="oma-filter-accordion__ico">
                        <AppstoreOutlined />
                      </span>
                      <span>{t('demo.deliverables.filter.type')}</span>
                      <span className="oma-filter-accordion__caret">
                        {filterSection === 'type' ? <UpOutlined /> : <DownOutlined />}
                      </span>
                    </button>
                    {filterSection === 'type' ? (
                      <div className="oma-filter-accordion__body">
                        {(['all', 'STATIC', 'CAROUSEL', 'REEL', 'LONG_VIDEO', 'COPY', 'PHOTOGRAPHY'] as const).map(
                          (s) => (
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
                          ),
                        )}
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
                      <span className="oma-filter-accordion__ico">
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
                      <span className="oma-filter-accordion__ico">
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
                      <span className="oma-filter-accordion__ico">
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

                {filterCount > 0 ? (
                  <div className="oma-req-filter-panel__foot">
                    <Button
                      type="default"
                      data-testid="demo-deliv-clear-filters"
                      onClick={() => setFilters((f) => ({ ...EMPTY_DELIVERABLE_FILTERS, view: f.view, group: f.group }))}
                    >
                      {t('demo.requests.clearFilters') || 'Clear filters'}
                    </Button>
                  </div>
                ) : null}
              </aside>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
