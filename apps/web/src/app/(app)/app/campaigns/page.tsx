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
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import {
  listBrandsProduction,
  listAllCampaigns,
  createCampaignProduction,
  updateCampaignProduction,
  archiveCampaignProduction,
  toCampaignRow,
  apiErrorMessage,
  isForbidden as isApiForbidden,
} from '../../../../lib/campaign-api';
import {
  EMPTY_CAMPAIGN_FILTERS,
  activeFilterCount,
  campaignFilterChips,
  campaignNextAction,
  campaignReviewState,
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
type CampaignTab = 'all' | 'active' | 'planning' | 'completed';

export default function CampaignsPage() {
  const t = useT();
  const locale = useLocale();
  const isAr = locale.toLowerCase().startsWith('ar');
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
  const [campaignTab, setCampaignTab] = useState<CampaignTab>('all');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
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
    links: [] as string[],
  });

  useEffect(() => {
    setLayout(readCampaignLayoutPref());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnavailable(false);
    try {
      const brandRows = await listBrandsProduction();
      const brandIds = brandRows.map((b) => b.id);
      const campaigns = brandIds.length ? await listAllCampaigns(brandIds) : [];
      setBrands(
        brandRows.map((b) => ({
          id: b.id,
          name: { en: b.name, ar: b.name },
          state: b.status === 'ARCHIVED' ? ('draft' as const) : ('healthy' as const),
          profileStatus: b.status,
          strategyId: null,
        })) as Brand[],
      );
      setRows(campaigns.map((c) => toCampaignRow(c)));
      setContent([]);
      setStrategies([]);
      setForm((f) => ({
        ...f,
        brandId: f.brandId || brandIds[0] || '',
        owner: f.owner || 'Owner',
      }));
    } catch (err) {
      if (isApiForbidden(err)) {
        setUnavailable(true);
        setError(
          isAr
            ? 'لا توجد صلاحية لعرض الحملات (campaign.read). أعد تشغيل seed أو امنح الصلاحية.'
            : 'Missing campaign.read capability. Re-run seed or grant the capability.',
        );
      } else {
        setError(apiErrorMessage(err, isAr ? 'تعذّر تحميل الحملات' : 'Failed to load campaigns'));
      }
      setRows([]);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, [isAr]);

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

  const filtered = useMemo(() => {
    const matchesFilters = filterCampaigns(rows, filters, locale);
    if (campaignTab === 'active') {
      return matchesFilters.filter((campaign) =>
        ['ACTIVE', 'NEEDS_ATTENTION', 'IN_REVIEW'].includes(campaign.status),
      );
    }
    if (campaignTab === 'planning') {
      return matchesFilters.filter((campaign) => ['DRAFT', 'UPCOMING'].includes(campaign.status));
    }
    if (campaignTab === 'completed') {
      return matchesFilters.filter((campaign) =>
        ['COMPLETED', 'ARCHIVED'].includes(campaign.status),
      );
    }
    return matchesFilters;
  }, [rows, filters, locale, campaignTab]);
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
    if (!form.name.trim() || !form.brandId || !form.start || !form.end) {
      setCreateError(t('demo.create.validation'));
      return;
    }
    setCreating(true);
    try {
      const strategy = strategies.find((s) => s.id === form.strategyId);
      const payload = {
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
        links: form.links,
      };
      if (!payload.brandId) {
        setCreateError(isAr ? 'اختر البراند' : 'Select a brand');
        setCreating(false);
        return;
      }
      let saved: CampaignRow;
      if (editingId) {
        const updated = await updateCampaignProduction(editingId, {
          name: payload.name,
          description: payload.goal,
          track: payload.track,
          timelineStart: payload.timeline.start,
          timelineEnd: payload.timeline.end,
          links: payload.links,
          status: payload.status,
        });
        saved = toCampaignRow(updated);
      } else {
        const created = await createCampaignProduction({
          brandId: payload.brandId,
          name: payload.name,
          description: payload.goal,
          objective: payload.goal,
          channels: payload.channels,
          track: payload.track,
          timelineStart: payload.timeline.start,
          timelineEnd: payload.timeline.end,
          links: payload.links,
          status: payload.status,
        });
        saved = toCampaignRow(created);
      }
      toast.push(
        editingId
          ? isAr
            ? 'تم تحديث الحملة'
            : 'Campaign updated'
          : t('demo.create.successCampaign'),
        'success',
      );
      setCreateOpen(false);
      setEditingId(null);
      setForm((f) => ({ ...f, name: '', goal: '' }));
      await load();
      if (!editingId) router.push(`/app/campaigns/${saved.id}`);
    } catch (err) {
      const msg = apiErrorMessage(err, t('demo.create.validation'));
      setCreateError(msg);
      toast.push(msg, 'danger');
    } finally {
      setCreating(false);
    }
  }

  function openEdit(campaign: CampaignRow) {
    setEditingId(campaign.id);
    setMenuId(null);
    setForm({
      name: pickCopy(campaign.name, locale),
      goal: pickCopy(campaign.objective, locale),
      brandId: campaign.brandId,
      strategyId: campaign.strategyId,
      track: campaign.track,
      owner: campaign.owner,
      start: campaign.timeline.start,
      end: campaign.timeline.end,
      channels: campaign.channels.join(', '),
      status: campaign.status,
      links: campaign.links ?? [],
    });
    setCreateError(null);
    setCreateOpen(true);
  }

  async function duplicateCampaign(campaign: CampaignRow) {
    setMenuId(null);
    const copy = locale.toLowerCase().startsWith('ar') ? 'نسخة' : 'copy';
    try {
      if (!campaign.brandId) {
        toast.push(isAr ? 'الحملة بلا براند' : 'Campaign has no brand', 'danger');
        return;
      }
      const created = await createCampaignProduction({
        brandId: campaign.brandId,
        name: {
          en: `${campaign.name.en} (${copy})`,
          ar: `${campaign.name.ar} (${copy})`,
        },
        description: campaign.objective,
        track: campaign.track,
        timelineStart: campaign.timeline.start,
        timelineEnd: campaign.timeline.end,
        links: campaign.links ?? [],
      });
      const duplicated = toCampaignRow(created);
      toast.push(isAr ? 'تم نسخ الحملة' : 'Campaign duplicated', 'success');
      await load();
      router.push(`/app/campaigns/${duplicated.id}`);
    } catch (err) {
      toast.push(apiErrorMessage(err, t('demo.create.validation')), 'danger');
    }
  }

  async function copyCampaignLink(campaign: CampaignRow) {
    setMenuId(null);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/app/campaigns/${campaign.id}`);
      toast.push(isAr ? 'تم نسخ رابط الحملة' : 'Campaign link copied', 'success');
    } catch {
      toast.push(isAr ? 'تعذّر نسخ الرابط' : 'Could not copy the campaign link', 'danger');
    }
  }

  async function archiveCampaign() {
    if (!archiveTarget) return;
    try {
      await archiveCampaignProduction(archiveTarget);
      setArchiveTarget(null);
      setMenuId(null);
      await load();
      toast.push(isAr ? 'تمت أرشفة الحملة' : 'Campaign archived', 'success');
    } catch (err) {
      toast.push(apiErrorMessage(err, t('demo.create.validation')), 'danger');
    }
  }

  const searchField = (
    <label className="oma-stage3-search">
      {t('demo.campaigns.search')}
      <Input
        value={filters.query}
        onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
        data-testid="demo-campaign-search"
      />
    </label>
  );

  const advancedFilterFields = (
    <>
      <label>
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
      <label>
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
      <label>
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
      <label>
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
      <label>
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
      <label>
        {t('demo.campaigns.filter.from')}
        <DateField
          value={filters.startFrom}
          onChange={(e) => setFilters((f) => ({ ...f, startFrom: e.target.value }))}
        />
      </label>
      <label>
        {t('demo.campaigns.filter.to')}
        <DateField
          value={filters.endTo}
          onChange={(e) => setFilters((f) => ({ ...f, endTo: e.target.value }))}
        />
      </label>
    </>
  );

  return (
    <div className="oma-stack oma-campaigns-page" data-testid="demo-campaigns">
      <PageHeader
        title={t('demo.campaigns.title')}
        description={t('demo.campaigns.subtitle')}
        actions={
          <div className="oma-campaign-header-actions">
            <Button
              type="text"
              className="oma-campaign-filter-trigger"
              data-testid="demo-campaign-open-filters"
              onClick={() => setFilterSheet(true)}
            >
              {isAr ? 'تصفية' : 'Filter'}
              {filterCount > 0 ? ` (${filterCount})` : ''}
            </Button>
            <div
              className="oma-campaign-layout-switch"
              role="group"
              aria-label={t('demo.campaigns.layouts')}
            >
              <Button
                type="text"
                aria-pressed={layout === 'portfolio'}
                data-testid="demo-campaigns-view-portfolio"
                onClick={() => setLayoutPref('portfolio')}
                aria-label={isAr ? 'عرض البطاقات' : 'Card view'}
              >
                ▦
              </Button>
              <Button
                type="text"
                aria-pressed={layout === 'list'}
                data-testid="demo-campaigns-view-table"
                onClick={() => setLayoutPref('list')}
                aria-label={isAr ? 'عرض القائمة' : 'List view'}
              >
                ☷
              </Button>
            </div>
            <Button
              type="primary"
              data-testid="demo-create-campaign"
              onClick={() => {
                setEditingId(null);
                setCreateError(null);
                setCreateOpen(true);
              }}
            >
              {isAr ? 'حملة جديدة' : 'New campaign'}
            </Button>
          </div>
        }
        meta={
          <div
            className="oma-campaign-status-tabs"
            role="tablist"
            aria-label={t('demo.campaigns.title')}
          >
            {(
              [
                ['all', isAr ? 'الكل' : 'All'],
                ['active', isAr ? 'نشطة' : 'Active'],
                ['planning', isAr ? 'قيد التخطيط' : 'Planning'],
                ['completed', isAr ? 'مكتملة' : 'Completed'],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="text"
                role="tab"
                aria-selected={campaignTab === key}
                data-active={campaignTab === key ? 'true' : 'false'}
                data-testid={`demo-campaign-tab-${key}`}
                onClick={() => setCampaignTab(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        }
      />
      <DemoDisclosure />

      <div className="oma-stage3-toolbar" data-testid="demo-campaign-filters">
        {searchField}
        <Button
          type="default"
          onClick={() => setFilterSheet(true)}
          className="oma-filter-sheet-trigger"
          data-testid="demo-campaign-open-filters"
        >
          {t('demo.campaigns.openFilters')}
          {filterCount > 0 ? ` (${filterCount})` : ''}
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
            return (
              <article
                key={c.id}
                className="oma-campaign-card"
                data-testid={`demo-campaign-card-${c.id}`}
              >
                <Link
                  href={`/app/campaigns/${c.id}`}
                  className="oma-campaign-card-main"
                  data-selected={selectedId === c.id ? 'true' : 'false'}
                  onClick={() => setSelectedId(c.id)}
                >
                  <span className="oma-campaign-mark" aria-hidden>
                    ▣
                  </span>
                  <div className="oma-campaign-card-body">
                    <strong>{pickCopy(c.name, locale)}</strong>
                    <span className="oma-campaign-card-dates oma-ltr">
                      {c.timeline.start} – {c.timeline.end}
                    </span>
                    <span className="oma-campaign-card-status">
                      <span className="oma-campaign-status-dot" data-status={c.status} />
                      {statusLabel(c.status, locale)}
                    </span>
                  </div>
                </Link>
                <div className="oma-campaign-card-actions">
                  <Button
                    type="text"
                    aria-label={
                      favoriteIds.includes(c.id)
                        ? isAr
                          ? 'إزالة من المفضلة'
                          : 'Remove from favorites'
                        : isAr
                          ? 'إضافة إلى المفضلة'
                          : 'Add to favorites'
                    }
                    aria-pressed={favoriteIds.includes(c.id)}
                    onClick={() =>
                      setFavoriteIds((ids) =>
                        ids.includes(c.id) ? ids.filter((id) => id !== c.id) : [...ids, c.id],
                      )
                    }
                  >
                    {favoriteIds.includes(c.id) ? '★' : '☆'}
                  </Button>
                  <div className="oma-campaign-menu-wrap">
                    <Button
                      type="text"
                      aria-label={isAr ? 'إجراءات الحملة' : 'Campaign actions'}
                      aria-haspopup="menu"
                      aria-expanded={menuId === c.id}
                      onClick={() => setMenuId((id) => (id === c.id ? null : c.id))}
                    >
                      ⋯
                    </Button>
                    {menuId === c.id ? (
                      <div className="oma-campaign-menu" role="menu">
                        <button role="menuitem" onClick={() => openEdit(c)}>
                          {isAr ? 'تعديل' : 'Edit'}
                        </button>
                        <button role="menuitem" onClick={() => void duplicateCampaign(c)}>
                          {isAr ? 'نسخ' : 'Duplicate'}
                        </button>
                        <button role="menuitem" onClick={() => void copyCampaignLink(c)}>
                          {isAr ? 'نسخ الرابط' : 'Copy link'}
                        </button>
                        <button
                          role="menuitem"
                          className="is-danger"
                          onClick={() => {
                            setMenuId(null);
                            setArchiveTarget(c.id);
                          }}
                        >
                          {isAr ? 'أرشفة الحملة' : 'Archive campaign'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
          <button
            type="button"
            className="oma-campaign-create-card"
            data-testid="demo-campaign-create-card"
            onClick={() => {
              setEditingId(null);
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            <span aria-hidden="true">+</span>
            {isAr ? 'إنشاء حملة' : 'Create campaign'}
          </button>
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
        footer={
          <div className="oma-dialog-footer oma-filter-sheet-footer">
            <Button
              type="default"
              onClick={() => setFilters(EMPTY_CAMPAIGN_FILTERS)}
              data-testid="demo-campaign-filter-clear"
            >
              {t('demo.campaigns.clearFilters')}
            </Button>
            <Button
              type="primary"
              onClick={() => setFilterSheet(false)}
              data-testid="demo-campaign-filter-apply"
            >
              {t('demo.filters.apply')}
            </Button>
          </div>
        }
      >
        <div className="oma-composer-fields" data-testid="demo-campaign-filter-sheet">
          {searchField}
          {advancedFilterFields}
        </div>
      </Dialog>

      <Dialog
        open={createOpen}
        title={
          editingId
            ? isAr
              ? 'تعديل الحملة'
              : 'Edit campaign'
            : isAr
              ? 'إنشاء حملة جديدة'
              : 'Create new campaign'
        }
        onClose={() => {
          if (!creating) {
            setCreateOpen(false);
            setEditingId(null);
          }
        }}
        size="lg"
        className="oma-campaign-compose-modal"
      >
        <div className="oma-campaign-compose" data-testid="demo-create-campaign-dialog">
          <label className="oma-campaign-compose-title">
            <span className="oma-sr-only">{t('demo.create.name')}</span>
            <Input
              value={form.name}
              placeholder={isAr ? 'اسم الحملة' : 'Campaign name'}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              data-testid="demo-create-campaign-name"
            />
          </label>
          <div className="oma-campaign-properties">
            <label>
              <span>{isAr ? 'الحالة' : 'Status'}</span>
              <SelectField
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {['DRAFT', 'UPCOMING', 'ACTIVE', 'COMPLETED'].map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s, locale)}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              <span>{isAr ? 'تاريخ البداية' : 'Start date'}</span>
              <DateField
                value={form.start}
                onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
              />
            </label>
            <label>
              <span>{isAr ? 'تاريخ الانتهاء' : 'End date'}</span>
              <DateField
                value={form.end}
                onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
              />
            </label>
          </div>
          <section className="oma-campaign-links">
            <div className="oma-campaign-compose-label">{isAr ? 'الروابط' : 'Links'}</div>
            {form.links.length ? (
              <ul>
                {form.links.map((link) => (
                  <li key={link}>
                    <a href={link} target="_blank" rel="noreferrer">
                      {link}
                    </a>
                    <Button
                      type="text"
                      aria-label={isAr ? 'إزالة الرابط' : 'Remove link'}
                      onClick={() =>
                        setForm((f) => ({ ...f, links: f.links.filter((item) => item !== link) }))
                      }
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Button
              type="text"
              className="oma-campaign-add-link"
              onClick={() => {
                setLinkDraft('');
                setLinkError(null);
                setLinkEditorOpen(true);
              }}
            >
              + {isAr ? 'إضافة رابط' : 'Add link'}
            </Button>
          </section>
          <label className="oma-campaign-description">
            <span>{isAr ? 'الوصف' : 'Description'}</span>
            <TextArea
              rows={4}
              value={form.goal}
              placeholder={
                isAr
                  ? 'أضف وصفًا للحملة أو اكتب / للأوامر...'
                  : 'Add a description, a campaign brief, or type / for commands...'
              }
              onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
            />
          </label>
          <details className="oma-campaign-extra-fields">
            <summary>{isAr ? 'تفاصيل التخطيط' : 'Planning details'}</summary>
            <div className="oma-campaign-extra-grid">
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
                {t('demo.create.owner')}
                <Input
                  value={form.owner}
                  onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                />
              </label>
              <label>
                {t('demo.create.channels')}
                <Input
                  value={form.channels}
                  onChange={(e) => setForm((f) => ({ ...f, channels: e.target.value }))}
                />
              </label>
            </div>
          </details>
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
              {creating
                ? t('demo.create.creating')
                : editingId
                  ? isAr
                    ? 'حفظ التغييرات'
                    : 'Save changes'
                  : isAr
                    ? 'إنشاء الحملة'
                    : 'Create campaign'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={linkEditorOpen}
        title={isAr ? 'إضافة رابط إلى الحملة' : 'Add link to this campaign'}
        onClose={() => setLinkEditorOpen(false)}
      >
        <div className="oma-campaign-link-editor">
          <label>
            URL
            <Input
              type="url"
              value={linkDraft}
              placeholder="https://"
              onChange={(e) => setLinkDraft(e.target.value)}
              autoFocus
            />
          </label>
          {linkError ? <p role="alert">{linkError}</p> : null}
          <div className="oma-dialog-footer">
            <Button type="default" onClick={() => setLinkEditorOpen(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="primary"
              onClick={() => {
                try {
                  const parsed = new URL(linkDraft.trim());
                  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
                  setForm((f) => ({
                    ...f,
                    links: f.links.includes(parsed.toString())
                      ? f.links
                      : [...f.links, parsed.toString()],
                  }));
                  setLinkEditorOpen(false);
                } catch {
                  setLinkError(
                    isAr
                      ? 'أدخل رابطًا صالحًا يبدأ بـ http أو https.'
                      : 'Enter a valid http or https URL.',
                  );
                }
              }}
            >
              {isAr ? 'إضافة الرابط' : 'Add link'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(archiveTarget)}
        title={isAr ? 'أرشفة الحملة' : 'Archive campaign'}
        onClose={() => setArchiveTarget(null)}
      >
        <p>
          {isAr
            ? 'ستُنقل الحملة إلى المكتملة/المؤرشفة. تبقى عناصر المحتوى والمهام مرتبطة بها.'
            : 'This moves the campaign to archived. Its posts and tasks remain linked.'}
        </p>
        <div className="oma-dialog-footer">
          <Button type="default" onClick={() => setArchiveTarget(null)}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button type="primary" onClick={() => void archiveCampaign()}>
            {isAr ? 'أرشفة الحملة' : 'Archive campaign'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
