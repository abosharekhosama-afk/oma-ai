'use client';
import { Button, DateField, Input, SelectField, TextArea } from '@oma/ui/controls';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { TrackPill } from '../../../../components/demo/track-pill';
import { EmptyState, ErrorState, DeniedState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
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
  campaignFilterChips,
  campaignNextAction,
  campaignReviewState,
  campaignScheduleReadiness,
  clearCampaignChip,
  filterCampaigns,
  groupCampaignsByStatus,
  strategyHref,
  type CampaignFilters,
  type CampaignRow,
  type ContentRow,
} from '../../../../lib/demo/stage3-campaigns';
import { statusLabel } from '../../../../lib/demo/stage3-content';
import {
  readCampaignLayoutPref,
  writeCampaignLayoutPref,
  type CampaignLayout,
} from '../../../../lib/demo/demo-view-pref';
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
  const [layout, setLayout] = useState<CampaignLayout>('portfolio');
  const [filterSheet, setFilterSheet] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    goal: '',
    brandId: '',
    strategyId: '',
    track: 'ORGANIC',
    owner: '',
    start: '2026-09-20',
    end: '2026-10-31',
    channels: 'Instagram, LinkedIn',
    status: 'DRAFT',
  });

  useEffect(() => {
    setLayout(readCampaignLayoutPref());
  }, []);

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
        const strategy = graph.strategies.find((s) => s.isCurrent) ?? graph.strategies[0];
        return {
          ...f,
          strategyId: strategy?.id ?? '',
          brandId: strategy?.brandId ?? graph.brands[0]?.id ?? '',
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
  const chips = useMemo(
    () =>
      campaignFilterChips(filters, {
        brand: brandName,
        status: (id) => statusLabel(id, locale),
        track: (id) => (id === 'ORGANIC' ? t('demo.organic') : t('demo.paid')),
        strategy: strategyName,
      }),
    [filters, brandName, locale, strategyName, t],
  );
  const strategiesForBrand = useMemo(
    () => (form.brandId ? strategies.filter((s) => s.brandId === form.brandId) : strategies),
    [form.brandId, strategies],
  );

  const contentFor = (id: string) => content.filter((c) => c.campaignId === id);

  function setLayoutPref(next: CampaignLayout) {
    setLayout(next);
    writeCampaignLayoutPref(next);
  }

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
          brandId: form.brandId || strategy?.brandId || '',
          track: form.track,
          owner: form.owner.trim(),
          timeline: { start: form.start, end: form.end },
          channels: form.channels
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
          status: form.status,
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

  const filterFields = (
    <>
      <label className="oma-stage3-search">
        {t('demo.campaigns.search')}
        <Input
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          data-testid="demo-campaign-search"
        />
      </label>
      <label className="oma-filter-desktop">
        {t('demo.campaigns.filter.brand')}
        <SelectField
          value={filters.brandId}
          onChange={(e) => setFilters((f) => ({ ...f, brandId: e.target.value }))}
          data-testid="demo-campaign-filter-brand"
        >
          <option value="all">{t('demo.filter.all')}</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {pickCopy(b.name, locale)}
            </option>
          ))}
        </SelectField>
      </label>
      <label className="oma-filter-desktop">
        {t('demo.filter.status')}
        <SelectField
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
        </SelectField>
      </label>
      <label className="oma-filter-desktop">
        {t('demo.filter.track')}
        <SelectField
          value={filters.track}
          onChange={(e) => setFilters((f) => ({ ...f, track: e.target.value }))}
          data-testid="demo-campaign-filter-track"
        >
          <option value="all">{t('demo.filter.all')}</option>
          <option value="ORGANIC">{t('demo.organic')}</option>
          <option value="PAID">{t('demo.paid')}</option>
        </SelectField>
      </label>
      <label className="oma-filter-desktop">
        {t('demo.campaigns.filter.strategy')}
        <SelectField
          value={filters.strategyId}
          onChange={(e) => setFilters((f) => ({ ...f, strategyId: e.target.value }))}
        >
          <option value="all">{t('demo.filter.all')}</option>
          {strategies.map((s) => (
            <option key={s.id} value={s.id}>
              {pickCopy(s.name, locale)}
            </option>
          ))}
        </SelectField>
      </label>
      <label className="oma-filter-desktop">
        {t('demo.campaigns.filter.owner')}
        <SelectField
          value={filters.owner}
          onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
        >
          <option value="all">{t('demo.filter.all')}</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </SelectField>
      </label>
      <label className="oma-filter-desktop">
        {t('demo.campaigns.filter.from')}
        <DateField
          value={filters.startFrom}
          onChange={(e) => setFilters((f) => ({ ...f, startFrom: e.target.value }))}
        />
      </label>
      <label className="oma-filter-desktop">
        {t('demo.campaigns.filter.to')}
        <DateField
          value={filters.endTo}
          onChange={(e) => setFilters((f) => ({ ...f, endTo: e.target.value }))}
        />
      </label>
    </>
  );

  return (
    <div className="oma-stack" data-testid="demo-campaigns">
      <PageHeader
        title={t('demo.campaigns.title')}
        description={t('demo.campaigns.subtitle')}
        actions={
          <div className="oma-chip-row">
            <div className="oma-view-switch" role="group" aria-label={t('demo.campaigns.layouts')}>
              <Button
                type={layout === 'portfolio' ? 'primary' : 'default'}
                aria-pressed={layout === 'portfolio'}
                data-testid="demo-campaigns-view-portfolio"
                onClick={() => setLayoutPref('portfolio')}
              >
                {t('demo.campaigns.portfolio')}
              </Button>
              <Button
                type={layout === 'list' ? 'primary' : 'default'}
                aria-pressed={layout === 'list'}
                data-testid="demo-campaigns-view-table"
                onClick={() => setLayoutPref('list')}
              >
                {t('demo.campaigns.table')}
              </Button>
            </div>
            <Button
              type="primary"
              data-testid="demo-create-campaign"
              onClick={() => setCreateOpen(true)}
            >
              {t('demo.campaigns.create')}
            </Button>
          </div>
        }
        meta={
          <span className="oma-item-count">
            {filtered.length} / {rows.length}
          </span>
        }
      />
      <DemoDisclosure />

      <div className="oma-stage3-toolbar" data-testid="demo-campaign-filters">
        {filterFields}
        <Button
          type="default"
          onClick={() => setFilterSheet(true)}
          className="oma-filter-sheet-trigger"
        >
          {t('demo.campaigns.openFilters')}
        </Button>
      </div>

      {filterCount > 0 ? (
        <div className="oma-filter-chips" data-testid="demo-campaign-filter-chips">
          {chips.map((chip) => (
            <span key={chip.id} className="oma-filter-chip">
              {chip.label}
              <Button
                type="default"
                aria-label={`${t('demo.campaigns.clearFilters')}: ${chip.label}`}
                onClick={() => setFilters((f) => clearCampaignChip(f, chip.id))}
              >
                ×
              </Button>
            </span>
          ))}
          <Button type="default" onClick={() => setFilters(EMPTY_CAMPAIGN_FILTERS)}>
            {t('demo.campaigns.clearFilters')}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="oma-skeleton-block" aria-busy="true" data-testid="demo-campaigns-loading">
          <div className="oma-skeleton" style={{ height: 28, width: '40%' }} />
          <div className="oma-skeleton" style={{ height: 120, marginTop: 12 }} />
        </div>
      ) : null}
      {unavailable ? (
        <DeniedState title={t('demo.unavailable')} body={t('demo.disclosure')} />
      ) : null}
      {error ? (
        <ErrorState
          title={error}
          action={
            <Button type="default" onClick={() => void load()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : null}
      {!loading && !unavailable && !error && filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? t('demo.empty') : t('demo.campaigns.emptyFiltered')}
          action={
            rows.length === 0 ? (
              <Button type="primary" onClick={() => setCreateOpen(true)}>
                {t('demo.campaigns.create')}
              </Button>
            ) : (
              <Button type="default" onClick={() => setFilters(EMPTY_CAMPAIGN_FILTERS)}>
                {t('demo.campaigns.clearFilters')}
              </Button>
            )
          }
        />
      ) : null}

      {!loading && !unavailable && !error && filtered.length > 0 && layout === 'portfolio' ? (
        <div className="oma-campaign-portfolio" data-testid="demo-campaign-portfolio">
          {filtered.map((c) => {
            const items = contentFor(c.id);
            const review = campaignReviewState(items);
            const ready = campaignScheduleReadiness(items);
            return (
              <Link
                key={c.id}
                href={`/app/campaigns/${c.id}`}
                className="oma-campaign-card"
                data-testid={`demo-campaign-card-${c.id}`}
                onClick={() => setSelectedId(c.id)}
              >
                <span className="oma-campaign-mark" aria-hidden>
                  {pickCopy(c.name, locale).slice(0, 1)}
                </span>
                <div className="oma-campaign-card-body">
                  <strong>{pickCopy(c.name, locale)}</strong>
                  <div className="oma-chip-row">
                    <StatusChip status={c.status} label={statusLabel(c.status, locale)} />
                    <TrackPill
                      track={c.track}
                      organicLabel={t('demo.organic')}
                      paidLabel={t('demo.paid')}
                    />
                  </div>
                  <span className="oma-muted">
                    {brandName(c.brandId)} · {strategyName(c.strategyId)}
                  </span>
                  <span className="oma-muted">
                    {c.owner} · {items.length} · {statusLabel(review, locale)} ·{' '}
                    {t(`demo.campaign.scheduleReady.${ready}`)}
                  </span>
                  <span className="oma-ltr oma-muted">
                    {c.timeline.start} → {c.timeline.end}
                  </span>
                  <span>{campaignNextAction(c, items, locale)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}

      {!loading && !unavailable && !error && layout === 'list'
        ? groups.map((group) => (
            <section key={group.status} className="oma-campaign-group">
              <h2 className="oma-campaign-group-title">
                {statusLabel(group.status, locale)} · {group.rows.length}
              </h2>
              <div className="oma-campaign-table">
                <div className="oma-campaign-table-head">
                  <span>{t('demo.campaigns.col.campaign')}</span>
                  <span>{t('demo.campaigns.col.brand')}</span>
                  <span>{t('demo.campaigns.col.strategy')}</span>
                  <span>{t('demo.campaigns.col.track')}</span>
                  <span>{t('demo.campaigns.col.owner')}</span>
                  <span>{t('demo.campaigns.col.content')}</span>
                  <span>{t('demo.campaigns.col.review')}</span>
                  <span>{t('demo.campaigns.col.next')}</span>
                </div>
                {group.rows.map((c) => {
                  const items = contentFor(c.id);
                  const review = campaignReviewState(items);
                  return (
                    <div
                      key={c.id}
                      className="oma-campaign-table-row"
                      data-selected={selectedId === c.id}
                      data-testid={`demo-campaign-row-${c.id}`}
                      role="link"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedId(c.id);
                        router.push(`/app/campaigns/${c.id}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(c.id);
                          router.push(`/app/campaigns/${c.id}`);
                        }
                      }}
                    >
                      <div className="oma-campaign-name">
                        <Link href={`/app/campaigns/${c.id}`} onClick={(e) => e.stopPropagation()}>
                          {pickCopy(c.name, locale)}
                        </Link>
                        <StatusChip status={c.status} label={statusLabel(c.status, locale)} />
                      </div>
                      <span>{brandName(c.brandId)}</span>
                      <Link
                        href={strategyHref(c.brandId, c.strategyId)}
                        className="oma-text-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {strategyName(c.strategyId)}
                      </Link>
                      <TrackPill
                        track={c.track}
                        organicLabel={t('demo.organic')}
                        paidLabel={t('demo.paid')}
                      />
                      <span>{c.owner}</span>
                      <span>{items.length}</span>
                      <StatusChip
                        status={review === 'CLEAR' ? 'APPROVED' : review}
                        label={statusLabel(review, locale)}
                      />
                      <span>{campaignNextAction(c, items, locale)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="oma-campaign-mobile-list">
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
                        <TrackPill
                          track={c.track}
                          organicLabel={t('demo.organic')}
                          paidLabel={t('demo.paid')}
                        />
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
        open={filterSheet}
        title={t('demo.campaigns.filters')}
        onClose={() => setFilterSheet(false)}
      >
        <div className="oma-composer-fields">{filterFields}</div>
        <div className="oma-dialog-footer">
          <Button type="primary" onClick={() => setFilterSheet(false)}>
            {t('demo.create.confirm')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={createOpen}
        title={t('demo.create.campaignTitle')}
        onClose={() => (!creating ? setCreateOpen(false) : undefined)}
      >
        <div className="oma-composer-fields" data-testid="demo-create-campaign-dialog">
          <div className="oma-composer-group">
            <label>
              {t('demo.create.name')}
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                data-testid="demo-create-campaign-name"
              />
            </label>
            <label>
              {t('demo.create.brand')}
              <SelectField
                value={form.brandId}
                onChange={(e) => {
                  const brandId = e.target.value;
                  const nextStrategy =
                    strategies.find((s) => s.brandId === brandId && s.isCurrent)?.id ??
                    strategies.find((s) => s.brandId === brandId)?.id ??
                    '';
                  setForm((f) => ({ ...f, brandId, strategyId: nextStrategy }));
                }}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {pickCopy(b.name, locale)}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              {t('demo.create.strategy')}
              <SelectField
                value={form.strategyId}
                onChange={(e) => setForm((f) => ({ ...f, strategyId: e.target.value }))}
              >
                {strategiesForBrand.map((s) => (
                  <option key={s.id} value={s.id}>
                    {pickCopy(s.name, locale)}
                  </option>
                ))}
              </SelectField>
            </label>
          </div>
          <div className="oma-composer-group">
            <label>
              {t('demo.create.track')}
              <SelectField
                value={form.track}
                onChange={(e) => setForm((f) => ({ ...f, track: e.target.value }))}
              >
                <option value="ORGANIC">{t('demo.organic')}</option>
                <option value="PAID">{t('demo.paid')}</option>
              </SelectField>
            </label>
            <label>
              {t('demo.create.objective')}
              <TextArea
                rows={2}
                value={form.goal}
                onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
              />
            </label>
            <label>
              {t('demo.create.owner')}
              <Input
                value={form.owner}
                onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
              />
            </label>
          </div>
          <div className="oma-composer-group">
            <label>
              {t('demo.create.start')}
              <DateField
                value={form.start}
                onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
              />
            </label>
            <label>
              {t('demo.create.end')}
              <DateField
                value={form.end}
                onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
              />
            </label>
            <label>
              {t('demo.create.channels')}
              <Input
                value={form.channels}
                onChange={(e) => setForm((f) => ({ ...f, channels: e.target.value }))}
              />
            </label>
            <label>
              {t('demo.create.status')}
              <SelectField
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {['DRAFT', 'ACTIVE', 'UPCOMING'].map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s, locale)}
                  </option>
                ))}
              </SelectField>
            </label>
          </div>
          {createError ? (
            <p role="alert" style={{ color: 'var(--status-danger)', margin: 0 }}>
              {createError}
            </p>
          ) : null}
          <div className="oma-dialog-footer">
            <Button type="default" disabled={creating} onClick={() => setCreateOpen(false)}>
              {t('demo.create.cancel')}
            </Button>
            <Button
              type="primary"
              disabled={creating}
              data-testid="demo-create-campaign-submit"
              onClick={() => void submitCreate()}
            >
              {creating ? t('demo.create.creating') : t('demo.create.confirm')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
