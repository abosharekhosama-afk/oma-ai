'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader, Panel } from '../../../../components/ui/page-header';
import { StatusChip } from '../../../../components/ui/status-chip';
import { useToast } from '../../../../components/ui/toast';
import { Dialog } from '../../../../components/ui/dialog';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import {
  EMPTY_CAMPAIGN_FILTERS,
  activeFilterCount,
  campaignNextAction,
  campaignProgress,
  campaignReviewState,
  filterCampaigns,
  groupCampaignsByStatus,
  strategyHref,
  type CampaignFilters,
  type CampaignRow,
  type ContentRow,
} from '../../../../lib/demo/stage3-campaigns';
import { statusLabel } from '../../../../lib/demo/stage3-content';
import { useLocale, useT } from '../../../../lib/use-locale';

type Brand = DemoGraph['brands'][number];
type Strategy = DemoGraph['strategies'][number];

export default function CampaignsPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [content, setContent] = useState<ContentRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [filters, setFilters] = useState<CampaignFilters>(EMPTY_CAMPAIGN_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layout, setLayout] = useState<'portfolio' | 'table'>('portfolio');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    goal: '',
    strategyId: '',
    track: 'ORGANIC',
    owner: '',
    start: '2026-09-20',
    end: '2026-10-31',
    channels: 'Instagram, LinkedIn',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const graph = await demoApi<DemoGraph>('/graph');
      setRows(graph.campaigns);
      setContent(graph.contentItems);
      setBrands(graph.brands);
      setStrategies(graph.strategies);
      setError(null);
      setUnavailable(false);
      setForm((f) => {
        if (f.strategyId) return f;
        return {
          ...f,
          strategyId:
            graph.strategies.find((s) => s.isCurrent)?.id ?? graph.strategies[0]?.id ?? '',
          owner: f.owner || graph.campaigns[0]?.owner || 'Layla Haddad',
        };
      });
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

  const brandName = useCallback(
    (brandId: string) => {
      const b = brands.find((x) => x.id === brandId);
      return b ? pickCopy(b.name, locale) : brandId;
    },
    [brands, locale],
  );

  const strategyName = useCallback(
    (strategyId: string) => {
      const s = strategies.find((x) => x.id === strategyId);
      return s ? pickCopy(s.name, locale) : strategyId;
    },
    [strategies, locale],
  );

  const filtered = useMemo(() => filterCampaigns(rows, filters, locale), [rows, filters, locale]);
  const groups = useMemo(() => groupCampaignsByStatus(filtered), [filtered]);
  const owners = useMemo(() => [...new Set(rows.map((r) => r.owner))], [rows]);
  const filterCount = activeFilterCount(filters);

  const contentFor = (id: string) => content.filter((c) => c.campaignId === id);

  async function submitCreate() {
    setCreateError(null);
    if (!form.name.trim() || !form.strategyId || !form.owner.trim() || !form.start || !form.end) {
      setCreateError(t('demo.create.validation'));
      return;
    }
    setCreating(true);
    try {
      const strategy = strategies.find((s) => s.id === form.strategyId);
      const created = await demoApi<CampaignRow>('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: { en: form.name.trim(), ar: form.name.trim() },
          goal: form.goal.trim() ? { en: form.goal.trim(), ar: form.goal.trim() } : undefined,
          strategyId: form.strategyId,
          brandId: strategy?.brandId ?? '',
          track: form.track,
          owner: form.owner.trim(),
          timeline: { start: form.start, end: form.end },
          channels: form.channels
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
          status: 'DRAFT',
        }),
      });
      toast.push(t('demo.create.successCampaign'), 'success');
      setCreateOpen(false);
      setForm((f) => ({ ...f, name: '', goal: '' }));
      await load();
      router.push(`/app/campaigns/${created.id}`);
    } catch (err) {
      setCreateError(demoErrorMessage(err, t('demo.create.validation')));
      toast.push(demoErrorMessage(err, t('demo.create.validation')), 'danger');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="oma-stack" data-testid="demo-campaigns">
      <PageHeader
        title={t('demo.campaigns.title')}
        description={t('demo.campaigns.subtitle')}
        actions={
          <div className="oma-chip-row">
            <div className="oma-view-toggle" role="group" aria-label={t('demo.campaigns.layouts')}>
              <button
                type="button"
                className="oma-btn oma-btn-secondary"
                aria-pressed={layout === 'portfolio'}
                data-testid="demo-campaigns-view-portfolio"
                onClick={() => setLayout('portfolio')}
              >
                {t('demo.campaigns.portfolio')}
              </button>
              <button
                type="button"
                className="oma-btn oma-btn-secondary"
                aria-pressed={layout === 'table'}
                data-testid="demo-campaigns-view-table"
                onClick={() => setLayout('table')}
              >
                {t('demo.campaigns.table')}
              </button>
            </div>
            <button
              type="button"
              className="oma-btn oma-btn-primary"
              data-testid="demo-create-campaign"
              onClick={() => setCreateOpen(true)}
            >
              {t('demo.campaigns.create')}
            </button>
          </div>
        }
        meta={<span className="oma-view-hint">{t('demo.campaigns.viewSession')}</span>}
      />
      <DemoDisclosure />

      <div className="oma-stage3-toolbar" data-testid="demo-campaign-filters">
        <label className="oma-stage3-search">
          {t('demo.campaigns.search')}
          <input
            className="oma-input"
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
            data-testid="demo-campaign-search"
          />
        </label>
        <label>
          {t('demo.filter.status')}
          <select
            className="oma-select"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            data-testid="demo-campaign-filter-status"
          >
            <option value="all">{t('demo.filter.all')}</option>
            {[...new Set(rows.map((r) => r.status))].map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, locale)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('demo.filter.track')}
          <select
            className="oma-select"
            value={filters.track}
            onChange={(e) => setFilters((f) => ({ ...f, track: e.target.value }))}
            data-testid="demo-campaign-filter-track"
          >
            <option value="all">{t('demo.filter.all')}</option>
            <option value="ORGANIC">{t('demo.organic')}</option>
            <option value="PAID">{t('demo.paid')}</option>
          </select>
        </label>
        <label>
          {t('demo.campaigns.filter.strategy')}
          <select
            className="oma-select"
            value={filters.strategyId}
            onChange={(e) => setFilters((f) => ({ ...f, strategyId: e.target.value }))}
          >
            <option value="all">{t('demo.filter.all')}</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {pickCopy(s.name, locale)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('demo.campaigns.filter.owner')}
          <select
            className="oma-select"
            value={filters.owner}
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
          {t('demo.campaigns.filter.from')}
          <input
            type="date"
            className="oma-input"
            value={filters.startFrom}
            onChange={(e) => setFilters((f) => ({ ...f, startFrom: e.target.value }))}
          />
        </label>
        <label>
          {t('demo.campaigns.filter.to')}
          <input
            type="date"
            className="oma-input"
            value={filters.endTo}
            onChange={(e) => setFilters((f) => ({ ...f, endTo: e.target.value }))}
          />
        </label>
      </div>

      {filterCount > 0 ? (
        <div className="oma-filter-chips">
          <span className="oma-filter-chip">{filterCount}</span>
          <button
            type="button"
            className="oma-btn oma-btn-secondary"
            onClick={() => setFilters(EMPTY_CAMPAIGN_FILTERS)}
          >
            {t('demo.campaigns.clearFilters')}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="oma-skeleton-block" aria-busy="true" data-testid="demo-campaigns-loading">
          <div className="oma-skeleton" style={{ height: 28, width: '40%' }} />
          <div className="oma-skeleton" style={{ height: 180, marginTop: 12 }} />
        </div>
      ) : null}
      {unavailable ? (
        <EmptyState title={t('demo.unavailable')} body={t('demo.disclosure')} />
      ) : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}
      {!loading && !unavailable && !error && filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? t('demo.empty') : t('demo.campaigns.emptyFiltered')}
          action={
            <button
              type="button"
              className="oma-btn oma-btn-primary"
              onClick={() => setCreateOpen(true)}
            >
              {t('demo.campaigns.create')}
            </button>
          }
        />
      ) : null}

      {!loading && !unavailable && !error && filtered.length > 0 && layout === 'portfolio' ? (
        <div className="oma-campaign-portfolio" data-testid="demo-campaign-portfolio">
          {filtered.map((c) => {
            const items = contentFor(c.id);
            const review = campaignReviewState(items);
            const progress = campaignProgress(c);
            return (
              <Link
                key={c.id}
                href={`/app/campaigns/${c.id}`}
                className="oma-campaign-card"
                data-testid={`demo-campaign-card-${c.id}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="oma-campaign-card-media" aria-hidden>
                  <span>
                    {c.track === 'ORGANIC' ? t('demo.organic') : t('demo.paid')} ·{' '}
                    {statusLabel(c.status, locale)}
                  </span>
                </div>
                <div className="oma-campaign-card-body">
                  <strong>{pickCopy(c.name, locale)}</strong>
                  <div className="oma-chip-row">
                    <StatusChip status={c.status} label={statusLabel(c.status, locale)} />
                    <span className="oma-muted">{brandName(c.brandId)}</span>
                  </div>
                  <div className="oma-campaign-progress" aria-hidden>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <span className="oma-muted">
                    {c.owner} · {items.length} ·{' '}
                    {statusLabel(review === 'CLEAR' ? 'APPROVED' : review, locale)}
                  </span>
                  <span className="oma-muted">{campaignNextAction(c, items, locale)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}

      {!loading && !unavailable && !error && layout === 'table'
        ? groups.map((group) => (
            <section key={group.status} className="oma-campaign-group">
              <h2 className="oma-campaign-group-title">
                {statusLabel(group.status, locale)} · {group.rows.length}
              </h2>
              <div className="oma-campaign-table-wrap">
                <table className="oma-campaign-table">
                  <thead>
                    <tr>
                      <th>{t('demo.campaigns.col.campaign')}</th>
                      <th>{t('demo.campaigns.col.brand')}</th>
                      <th>{t('demo.campaigns.col.strategy')}</th>
                      <th>{t('demo.campaigns.col.track')}</th>
                      <th>{t('demo.campaigns.col.progress')}</th>
                      <th>{t('demo.campaigns.col.owner')}</th>
                      <th>{t('demo.campaigns.col.content')}</th>
                      <th>{t('demo.campaigns.col.review')}</th>
                      <th>{t('demo.campaigns.col.dates')}</th>
                      <th>{t('demo.campaigns.col.next')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((c) => {
                      const items = contentFor(c.id);
                      const review = campaignReviewState(items);
                      const progress = campaignProgress(c);
                      return (
                        <tr
                          key={c.id}
                          data-selected={selectedId === c.id}
                          data-testid={`demo-campaign-row-${c.id}`}
                          onClick={() => {
                            setSelectedId(c.id);
                            router.push(`/app/campaigns/${c.id}`);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setSelectedId(c.id);
                              router.push(`/app/campaigns/${c.id}`);
                            }
                          }}
                          tabIndex={0}
                        >
                          <td>
                            <div className="oma-campaign-name">
                              <Link
                                href={`/app/campaigns/${c.id}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {pickCopy(c.name, locale)}
                              </Link>
                              <StatusChip status={c.status} label={statusLabel(c.status, locale)} />
                            </div>
                          </td>
                          <td>{brandName(c.brandId)}</td>
                          <td>
                            <Link
                              href={strategyHref(c.brandId, c.strategyId)}
                              className="oma-text-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {strategyName(c.strategyId)}
                            </Link>
                          </td>
                          <td>
                            <span
                              className={`oma-badge ${c.track === 'ORGANIC' ? 'oma-track-organic' : 'oma-track-paid'}`}
                            >
                              {c.track === 'ORGANIC' ? t('demo.organic') : t('demo.paid')}
                            </span>
                          </td>
                          <td>
                            <div className="oma-progress-inline">
                              <div className="oma-progress-track" aria-hidden="true">
                                <div
                                  className="oma-progress-fill"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="oma-muted">{progress}%</span>
                            </div>
                          </td>
                          <td>{c.owner}</td>
                          <td>{items.length}</td>
                          <td>
                            <StatusChip
                              status={review === 'CLEAR' ? 'APPROVED' : review}
                              label={statusLabel(review, locale)}
                            />
                          </td>
                          <td className="oma-ltr">
                            {c.timeline.start} → {c.timeline.end}
                          </td>
                          <td>{campaignNextAction(c, items, locale)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="oma-campaign-mobile-list" aria-hidden="true">
                {group.rows.map((c) => {
                  const items = contentFor(c.id);
                  return (
                    <Link
                      key={c.id}
                      href={`/app/campaigns/${c.id}`}
                      className="oma-campaign-mobile-card"
                    >
                      <strong>{pickCopy(c.name, locale)}</strong>
                      <div className="oma-chip-row">
                        <span
                          className={`oma-badge ${c.track === 'ORGANIC' ? 'oma-track-organic' : 'oma-track-paid'}`}
                        >
                          {c.track === 'ORGANIC' ? t('demo.organic') : t('demo.paid')}
                        </span>
                        <StatusChip status={c.status} label={statusLabel(c.status, locale)} />
                      </div>
                      <span className="oma-muted">
                        {c.owner} · {items.length} · {campaignNextAction(c, items, locale)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        : null}

      <Dialog
        open={createOpen}
        title={t('demo.create.campaignTitle')}
        onClose={() => (!creating ? setCreateOpen(false) : undefined)}
      >
        <div className="oma-composer-fields" data-testid="demo-create-campaign-dialog">
          <label>
            {t('demo.create.name')}
            <input
              className="oma-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              data-testid="demo-create-campaign-name"
            />
          </label>
          <label>
            {t('demo.create.goal')}
            <textarea
              className="oma-input"
              rows={2}
              value={form.goal}
              onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.create.strategy')}
            <select
              className="oma-select"
              value={form.strategyId}
              onChange={(e) => setForm((f) => ({ ...f, strategyId: e.target.value }))}
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {pickCopy(s.name, locale)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('demo.create.track')}
            <select
              className="oma-select"
              value={form.track}
              onChange={(e) => setForm((f) => ({ ...f, track: e.target.value }))}
            >
              <option value="ORGANIC">{t('demo.organic')}</option>
              <option value="PAID">{t('demo.paid')}</option>
            </select>
          </label>
          <label>
            {t('demo.create.owner')}
            <input
              className="oma-input"
              value={form.owner}
              onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.create.start')}
            <input
              type="date"
              className="oma-input"
              value={form.start}
              onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.create.end')}
            <input
              type="date"
              className="oma-input"
              value={form.end}
              onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.create.channels')}
            <input
              className="oma-input"
              value={form.channels}
              onChange={(e) => setForm((f) => ({ ...f, channels: e.target.value }))}
            />
          </label>
          {createError ? (
            <p role="alert" style={{ color: 'var(--status-danger)', margin: 0 }}>
              {createError}
            </p>
          ) : null}
          <div className="oma-chip-row">
            <button
              type="button"
              className="oma-btn oma-btn-secondary"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              {t('demo.create.cancel')}
            </button>
            <button
              type="button"
              className="oma-btn oma-btn-primary"
              disabled={creating}
              data-testid="demo-create-campaign-submit"
              onClick={() => void submitCreate()}
            >
              {creating ? t('demo.create.creating') : t('demo.create.confirm')}
            </button>
          </div>
        </div>
      </Dialog>

      {!loading && !unavailable ? (
        <Panel title={t('demo.campaigns.viewSession')} description={t('demo.disclosure')}>
          <p className="oma-muted" style={{ margin: 0 }}>
            {filtered.length} / {rows.length}
          </p>
        </Panel>
      ) : null}
    </div>
  );
}
