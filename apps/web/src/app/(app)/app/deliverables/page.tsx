'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
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
  const [rows, setRows] = useState<DeliverableRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filters, setFilters] = useState<DeliverableFilters>(EMPTY_DELIVERABLE_FILTERS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const graph = await demoApi<DemoGraph>('/graph');
      setRows(graph.deliverables);
      setCampaigns(graph.campaigns);
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

  const filtered = useMemo(
    () => filterDeliverables(rows, filters, locale),
    [rows, filters, locale],
  );
  const filterCount = activeDeliverableFilterCount(filters);
  const owners = useMemo(() => [...new Set(rows.map((r) => r.owner))], [rows]);
  const reviewers = useMemo(() => [...new Set(rows.map((r) => r.reviewer))], [rows]);

  return (
    <div className="oma-stack" data-testid="demo-deliverables" data-prefs={prefsLoaded ? '1' : '0'}>
      <PageHeader
        title={t('demo.deliverables.title')}
        description={t('demo.deliverables.subtitle')}
        actions={
          <div className="oma-view-toggle" role="group">
            <button
              type="button"
              className="oma-btn oma-btn-secondary"
              aria-pressed={filters.view === 'list'}
              data-testid="demo-deliv-view-list"
              onClick={() => changeView('list')}
            >
              {t('demo.view.list')}
            </button>
            <button
              type="button"
              className="oma-btn oma-btn-secondary"
              aria-pressed={filters.view === 'grid'}
              data-testid="demo-deliv-view-grid"
              onClick={() => changeView('grid')}
            >
              {t('demo.view.grid')}
            </button>
          </div>
        }
      />
      <DemoDisclosure />
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
          <div className="oma-deliv-groups" data-testid="demo-deliv-groups">
            {GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                className="oma-btn oma-btn-secondary"
                aria-pressed={filters.group === g}
                data-testid={`demo-deliv-group-${g}`}
                onClick={() => setFilters((f) => ({ ...f, group: g }))}
              >
                {t(`demo.deliverables.group.${g}`)}
              </button>
            ))}
          </div>

          <div className="oma-stage5-toolbar" data-testid="demo-deliv-filters">
            <label className="oma-stage5-search">
              {t('demo.deliverables.search')}
              <input
                className="oma-input"
                value={filters.q}
                data-testid="demo-deliv-search"
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              />
            </label>
            <label>
              {t('demo.deliverables.filter.review')}
              <select
                className="oma-select"
                value={filters.reviewState}
                data-testid="demo-deliv-filter-review"
                onChange={(e) => setFilters((f) => ({ ...f, reviewState: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {[
                  'DRAFT',
                  'AWAITING_REVIEW',
                  'IN_REVIEW',
                  'CHANGES_REQUESTED',
                  'APPROVED',
                  'REJECTED',
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('demo.deliverables.filter.type')}
              <select
                className="oma-select"
                value={filters.assetType}
                data-testid="demo-deliv-filter-type"
                onChange={(e) => setFilters((f) => ({ ...f, assetType: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {['STATIC', 'CAROUSEL', 'REEL', 'LONG_VIDEO', 'COPY', 'PHOTOGRAPHY'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('demo.deliverables.filter.campaign')}
              <select
                className="oma-select"
                value={filters.campaignId}
                data-testid="demo-deliv-filter-campaign"
                onChange={(e) => setFilters((f) => ({ ...f, campaignId: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {pickCopy(c.name, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('demo.deliverables.filter.owner')}
              <select
                className="oma-select"
                value={filters.owner}
                data-testid="demo-deliv-filter-owner"
                onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {owners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('demo.deliverables.filter.reviewer')}
              <select
                className="oma-select"
                value={filters.reviewer}
                data-testid="demo-deliv-filter-reviewer"
                onChange={(e) => setFilters((f) => ({ ...f, reviewer: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {reviewers.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="oma-muted" data-testid="demo-deliv-result-count">
            {filtered.length} / {rows.length}
          </p>

          {filterCount > 0 ? (
            <div className="oma-filter-chips">
              <button
                type="button"
                className="oma-btn oma-btn-secondary"
                data-testid="demo-deliv-clear-filters"
                onClick={() => setFilters({ ...EMPTY_DELIVERABLE_FILTERS, view: filters.view })}
              >
                {t('demo.requests.clearFilters')}
              </button>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <EmptyState title={t('demo.empty')} body={t('demo.deliverables.emptyHint')} />
          ) : filters.view === 'grid' ? (
            <div className="oma-deliv-grid" data-testid="demo-deliv-grid">
              {filtered.map((d) => {
                const ver = currentVersion(d);
                const thumb = ver?.assets[0];
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
                      <div className="oma-deliv-thumb-fallback" aria-hidden />
                    )}
                    <strong>{pickCopy(d.title, locale)}</strong>
                    <div className="oma-chip-row">
                      <StatusChip status={d.reviewStatus} />
                      <span className="oma-muted">{d.type}</span>
                    </div>
                    <span className="oma-muted">
                      {ver?.label} · {d.owner}
                      {unresolvedCount(d) ? ` · ${unresolvedCount(d)}` : ''}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <>
              <div
                className="oma-deliv-table-wrap oma-deliv-desktop"
                data-testid="demo-deliv-table"
              >
                <table className="oma-deliv-table">
                  <thead>
                    <tr>
                      <th />
                      <th>{t('demo.deliverables.col.title')}</th>
                      <th>{t('demo.deliverables.filter.type')}</th>
                      <th>{t('demo.deliverables.col.version')}</th>
                      <th>{t('demo.deliverables.filter.review')}</th>
                      <th>{t('demo.deliverables.filter.owner')}</th>
                      <th>{t('demo.deliverables.filter.reviewer')}</th>
                      <th>{t('demo.deliverables.col.due')}</th>
                      <th>{t('demo.deliverables.col.comments')}</th>
                      <th>{t('demo.deliverables.col.next')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => {
                      const ver = currentVersion(d);
                      const thumb = ver?.assets[0];
                      const next = deliverableNextAction(d);
                      return (
                        <tr
                          key={d.id}
                          data-overdue={deliverableIsOverdue(d) ? 'true' : 'false'}
                          data-testid={`demo-deliv-row-${d.id}`}
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
        </>
      ) : null}
    </div>
  );
}
