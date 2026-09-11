'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { Dialog } from '../../../../components/ui/dialog';
import { Drawer } from '../../../../components/ui/drawer';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatusChip } from '../../../../components/ui/status-chip';
import { useToast } from '../../../../components/ui/toast';
import {
  EMPTY_CONTENT_FILTERS,
  activeContentFilterCount,
  buildMonthCells,
  channelMarker,
  dayKey,
  filterContent,
  groupContentByDay,
  monthLabel,
  statusLabel,
  type ContentFilters,
  type ContentRow,
  type ContentViewMode,
} from '../../../../lib/demo/stage3-content';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../../../lib/use-locale';

type Campaign = DemoGraph['campaigns'][number];

const TODAY_KEY = '2026-09-10';
const DEFAULT_YEAR = 2026;
const DEFAULT_MONTH = 8;
const MAX_CELL_ITEMS = 2;

type DraftFields = {
  caption: string;
  objective: string;
  cta: string;
  status: string;
  assignee: string;
  scheduledAt: string;
};

function emptyDraft(): DraftFields {
  return {
    caption: '',
    objective: '',
    cta: '',
    status: 'DRAFT',
    assignee: '',
    scheduledAt: '',
  };
}

function draftFromItem(item: ContentRow, locale: string): DraftFields {
  return {
    caption: item.caption ? pickCopy(item.caption, locale) : '',
    objective: item.objective ? pickCopy(item.objective, locale) : '',
    cta: item.cta ? pickCopy(item.cta, locale) : '',
    status: item.status,
    assignee: item.assignee,
    scheduledAt: item.scheduledAt ? item.scheduledAt.slice(0, 16) : '',
  };
}

function mergeLocaleCopy(
  existing: { en: string; ar: string } | undefined,
  value: string,
  locale: string,
): { en: string; ar: string } {
  const ar = locale.toLowerCase().startsWith('ar');
  return {
    en: ar ? (existing?.en ?? value) : value,
    ar: ar ? value : (existing?.ar ?? value),
  };
}

function weekdayLabels(locale: string, weekStartsOn: 0 | 6): string[] {
  const fmt = new Intl.DateTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    weekday: 'short',
    timeZone: 'UTC',
  });
  // 2026-01-04 is Sunday UTC
  const sunday = Date.UTC(2026, 0, 4);
  const order = weekStartsOn === 6 ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
  return order.map((dow) => fmt.format(new Date(sunday + dow * 86400000)));
}

function reviewLabel(value: string, locale: string, allLabel: string): string {
  if (value === 'needs') return statusLabel('IN_REVIEW', locale);
  if (value === 'approved') return statusLabel('APPROVED', locale);
  return allLabel;
}

export default function ContentPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();

  const [rows, setRows] = useState<ContentRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filters, setFilters] = useState<ContentFilters>(EMPTY_CONTENT_FILTERS);
  const [view, setView] = useState<ContentViewMode>('calendar');
  const [cursor, setCursor] = useState({ year: DEFAULT_YEAR, monthIndex: DEFAULT_MONTH });
  const [selectedDay, setSelectedDay] = useState<string | null>(TODAY_KEY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftFields>(emptyDraft());
  const [baseline, setBaseline] = useState<DraftFields>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);

  const [overflowDay, setOverflowDay] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    campaignId: '',
    channel: 'Instagram',
    contentType: 'POST',
    owner: '',
    plannedDate: '2026-09-20',
    brief: '',
    track: 'ORGANIC',
  });

  const isAr = locale.toLowerCase().startsWith('ar');
  const weekStartsOn: 0 | 6 = isAr ? 6 : 0;
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const graph = await demoApi<DemoGraph>('/graph');
      setRows(graph.contentItems);
      setCampaigns(graph.campaigns);
      setError(null);
      setUnavailable(false);
      setCreateForm((f) => ({
        ...f,
        campaignId: f.campaignId || graph.campaigns[0]?.id || '',
        owner: f.owner || graph.contentItems[0]?.assignee || 'Maya Nasser',
        track: f.track || graph.campaigns[0]?.track || 'ORGANIC',
      }));
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

  // URL → campaign filter + open item
  useEffect(() => {
    const campaign = search.get('campaign');
    if (campaign) {
      setFilters((f) => (f.campaignId === campaign ? f : { ...f, campaignId: campaign }));
    }
  }, [search]);

  const filtered = useMemo(() => filterContent(rows, filters, locale), [rows, filters, locale]);
  const byDay = useMemo(() => groupContentByDay(filtered), [filtered]);
  const filterCount = activeContentFilterCount(filters);
  const channels = useMemo(() => [...new Set(rows.map((r) => r.channel))].sort(), [rows]);
  const types = useMemo(() => [...new Set(rows.map((r) => r.contentType))].sort(), [rows]);
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))].sort(), [rows]);
  const assignees = useMemo(() => [...new Set(rows.map((r) => r.assignee))].sort(), [rows]);
  const monthCells = useMemo(
    () => buildMonthCells(cursor.year, cursor.monthIndex, weekStartsOn),
    [cursor.year, cursor.monthIndex, weekStartsOn],
  );
  const dows = useMemo(() => weekdayLabels(locale, weekStartsOn), [locale, weekStartsOn]);
  const selected = useMemo(
    () => (selectedId ? (rows.find((r) => r.id === selectedId) ?? null) : null),
    [rows, selectedId],
  );
  const overflowItems = overflowDay ? (byDay.get(overflowDay) ?? []) : [];
  const campaignName = useCallback(
    (id: string) => {
      const c = campaigns.find((x) => x.id === id);
      return c ? pickCopy(c.name, locale) : id;
    },
    [campaigns, locale],
  );

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(search.toString());
    mutate(params);
    const qs = params.toString();
    const href = qs ? `/app/content?${qs}` : '/app/content';
    router.replace(href, { scroll: false });
  }

  function openItem(item: ContentRow) {
    const next = draftFromItem(item, locale);
    setSelectedId(item.id);
    setDraft(next);
    setBaseline(next);
    setSaveState('idle');
    setSaveError(null);
    setOverflowDay(null);
    replaceParams((params) => {
      params.set('item', item.id);
    });
  }

  function requestCloseDrawer() {
    if (dirty) {
      setUnsavedOpen(true);
      return;
    }
    closeDrawer();
  }

  function closeDrawer() {
    setUnsavedOpen(false);
    setSaveState('idle');
    setSaveError(null);
    replaceParams((params) => {
      params.delete('item');
    });
    setSelectedId(null);
    setDraft(emptyDraft());
    setBaseline(emptyDraft());
  }

  // Keep selection in sync with URL without reopening after an intentional close.
  useEffect(() => {
    const item = search.get('item');
    if (!item) {
      if (selectedId !== null) {
        setSelectedId(null);
        setDraft(emptyDraft());
        setBaseline(emptyDraft());
      }
      return;
    }
    if (rows.length === 0) return;
    const row = rows.find((r) => r.id === item);
    if (!row) return;
    if (selectedId === item) return;
    setSelectedId(row.id);
    const next = draftFromItem(row, locale);
    setDraft(next);
    setBaseline(next);
    setSaveState('idle');
    setSaveError(null);
    const day = dayKey(row.scheduledAt);
    if (day) {
      setSelectedDay(day);
      const [y, m] = day.split('-').map(Number);
      if (y && m) setCursor({ year: y, monthIndex: m - 1 });
    }
  }, [search, rows, locale, selectedId]);

  async function saveItem() {
    if (!selectedId || !selected) return;
    setSaving(true);
    setSaveState('saving');
    setSaveError(null);
    try {
      const updated = await demoApi<ContentRow>(`/content/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          caption: mergeLocaleCopy(selected.caption, draft.caption, locale),
          objective: mergeLocaleCopy(selected.objective, draft.objective, locale),
          cta: mergeLocaleCopy(selected.cta, draft.cta, locale),
          status: draft.status,
          assignee: draft.assignee,
          scheduledAt: draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : null,
        }),
      });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      const next = draftFromItem(updated, locale);
      setDraft(next);
      setBaseline(next);
      setSaveState('saved');
      toast.push(t('demo.content.saved'), 'success');
    } catch (err) {
      const msg = demoErrorMessage(err, t('demo.create.validation'));
      setSaveError(msg);
      setSaveState('error');
      toast.push(msg, 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function submitCreate() {
    setCreateError(null);
    if (
      !createForm.title.trim() ||
      !createForm.campaignId ||
      !createForm.channel.trim() ||
      !createForm.owner.trim()
    ) {
      setCreateError(t('demo.create.validation'));
      return;
    }
    setCreating(true);
    try {
      const campaign = campaigns.find((c) => c.id === createForm.campaignId);
      const created = await demoApi<ContentRow>('/content', {
        method: 'POST',
        body: JSON.stringify({
          title: { en: createForm.title.trim(), ar: createForm.title.trim() },
          campaignId: createForm.campaignId,
          brandId: campaign?.brandId ?? '',
          track: createForm.track || campaign?.track || 'ORGANIC',
          channel: createForm.channel.trim(),
          contentType: createForm.contentType,
          owner: createForm.owner.trim(),
          assignee: createForm.owner.trim(),
          scheduledAt: createForm.plannedDate ? `${createForm.plannedDate}T10:00:00+03:00` : null,
          status: 'DRAFT',
          objective: createForm.brief.trim()
            ? { en: createForm.brief.trim(), ar: createForm.brief.trim() }
            : undefined,
        }),
      });
      toast.push(t('demo.create.successContent'), 'success');
      setCreateOpen(false);
      setCreateForm((f) => ({ ...f, title: '', brief: '' }));
      openItem(created);
      setRows((prev) => (prev.some((r) => r.id === created.id) ? prev : [created, ...prev]));
      void load();
    } catch (err) {
      const msg = demoErrorMessage(err, t('demo.create.validation'));
      setCreateError(msg);
      toast.push(msg, 'danger');
    } finally {
      setCreating(false);
    }
  }

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.year, c.monthIndex + delta, 1));
      return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
    });
  }

  function goToday() {
    setCursor({ year: DEFAULT_YEAR, monthIndex: DEFAULT_MONTH });
    setSelectedDay(TODAY_KEY);
  }

  const agendaDays = useMemo(() => {
    const keys = monthCells.filter((c) => c.inMonth).map((c) => c.key);
    return keys
      .map((key) => ({ key, items: byDay.get(key) ?? [] }))
      .filter((d) => d.items.length > 0 || d.key === TODAY_KEY || d.key === selectedDay);
  }, [monthCells, byDay, selectedDay]);

  return (
    <div className="oma-stack" data-testid="demo-content">
      <PageHeader
        title={t('demo.content.title')}
        description={t('demo.content.subtitle')}
        actions={
          <button
            type="button"
            className="oma-btn oma-btn-primary"
            data-testid="demo-create-content"
            onClick={() => setCreateOpen(true)}
          >
            {t('demo.content.create')}
          </button>
        }
        meta={
          <div className="oma-view-switch" role="group" aria-label={t('demo.content.title')}>
            {(['calendar', 'list', 'grid'] as ContentViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                data-testid={`demo-content-view-${mode}`}
                onClick={() => setView(mode)}
              >
                {mode === 'calendar'
                  ? t('demo.view.calendar')
                  : mode === 'list'
                    ? t('demo.view.list')
                    : t('demo.view.grid')}
              </button>
            ))}
          </div>
        }
      />
      <DemoDisclosure message={t('demo.content.noPublishing')} />

      <div className="oma-stage3-toolbar" data-testid="demo-content-filters">
        <label className="oma-stage3-search">
          {t('demo.content.search')}
          <input
            className="oma-input"
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          />
        </label>
        <label>
          {t('demo.content.filter.campaign')}
          <select
            className="oma-select"
            value={filters.campaignId}
            onChange={(e) => {
              const campaignId = e.target.value;
              setFilters((f) => ({ ...f, campaignId }));
              replaceParams((params) => {
                if (campaignId === 'all') params.delete('campaign');
                else params.set('campaign', campaignId);
              });
            }}
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
          {t('demo.filter.channel')}
          <select
            className="oma-select"
            value={filters.channel}
            onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
          >
            <option value="all">{t('demo.filter.all')}</option>
            {channels.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('demo.content.filter.type')}
          <select
            className="oma-select"
            value={filters.contentType}
            onChange={(e) => setFilters((f) => ({ ...f, contentType: e.target.value }))}
          >
            <option value="all">{t('demo.filter.all')}</option>
            {types.map((ty) => (
              <option key={ty} value={ty}>
                {ty}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('demo.filter.status')}
          <select
            className="oma-select"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="all">{t('demo.filter.all')}</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, locale)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('demo.content.filter.review')}
          <select
            className="oma-select"
            value={filters.review}
            onChange={(e) => setFilters((f) => ({ ...f, review: e.target.value }))}
          >
            <option value="all">{t('demo.filter.all')}</option>
            <option value="needs">{reviewLabel('needs', locale, t('demo.filter.all'))}</option>
            <option value="approved">
              {reviewLabel('approved', locale, t('demo.filter.all'))}
            </option>
          </select>
        </label>
        <label>
          {t('demo.content.filter.assignee')}
          <select
            className="oma-select"
            value={filters.assignee}
            onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}
          >
            <option value="all">{t('demo.filter.all')}</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('demo.content.filter.date')}
          <input
            type="date"
            className="oma-input"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          />
        </label>
        <label>
          {t('demo.content.filter.date')}
          <input
            type="date"
            className="oma-input"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          />
        </label>
      </div>

      {filterCount > 0 ? (
        <div className="oma-filter-chips">
          <span className="oma-filter-chip">{filterCount}</span>
          <button
            type="button"
            className="oma-btn oma-btn-secondary"
            onClick={() => {
              setFilters(EMPTY_CONTENT_FILTERS);
              replaceParams((params) => {
                params.delete('campaign');
              });
            }}
          >
            {t('demo.content.clearFilters')}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="oma-skeleton-block" aria-busy="true">
          <div className="oma-skeleton" style={{ height: 28, width: '40%' }} />
          <div className="oma-skeleton" style={{ height: 220, marginTop: 12 }} />
        </div>
      ) : null}
      {unavailable ? (
        <EmptyState title={t('demo.unavailable')} body={t('demo.disclosure')} />
      ) : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
          <button type="button" className="oma-btn oma-btn-secondary" onClick={() => void load()}>
            {t('common.retry')}
          </button>
        </div>
      ) : null}

      {!loading && !unavailable && !error && filtered.length === 0 ? (
        <EmptyState
          title={t('demo.empty')}
          action={
            <button
              type="button"
              className="oma-btn oma-btn-primary"
              onClick={() => setCreateOpen(true)}
            >
              {t('demo.content.create')}
            </button>
          }
        />
      ) : null}

      {!loading && !unavailable && !error && filtered.length > 0 && view === 'calendar' ? (
        <section data-testid="demo-content-calendar">
          <div className="oma-cal-toolbar">
            <strong>{monthLabel(cursor.year, cursor.monthIndex, locale)}</strong>
            <div className="oma-cal-nav">
              <button
                type="button"
                className="oma-btn oma-btn-secondary"
                onClick={() => shiftMonth(-1)}
              >
                {t('demo.content.prev')}
              </button>
              <button type="button" className="oma-btn oma-btn-secondary" onClick={goToday}>
                {t('demo.content.today')}
              </button>
              <button
                type="button"
                className="oma-btn oma-btn-secondary"
                onClick={() => shiftMonth(1)}
              >
                {t('demo.content.next')}
              </button>
            </div>
          </div>

          <div className="oma-cal-grid" role="grid" aria-label={t('demo.view.calendar')}>
            {dows.map((dow) => (
              <div key={dow} className="oma-cal-dow">
                {dow}
              </div>
            ))}
            {monthCells.map((cell) => {
              const items = byDay.get(cell.key) ?? [];
              const visible = items.slice(0, MAX_CELL_ITEMS);
              const extra = items.length - visible.length;
              return (
                <div
                  key={cell.key}
                  className="oma-cal-cell"
                  role="gridcell"
                  data-out={cell.inMonth ? 'false' : 'true'}
                  data-today={cell.key === TODAY_KEY ? 'true' : 'false'}
                  data-selected={cell.key === selectedDay ? 'true' : 'false'}
                  onClick={() => setSelectedDay(cell.key)}
                >
                  <span className="oma-cal-daynum oma-ltr">{cell.date.getUTCDate()}</span>
                  {visible.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="oma-cal-item"
                      data-status={item.status}
                      data-testid={`demo-cal-item-${item.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openItem(item);
                      }}
                    >
                      <span className="oma-cal-marker">{channelMarker(item.channel)}</span>
                      <span>{pickCopy(item.title, locale)}</span>
                    </button>
                  ))}
                  {extra > 0 ? (
                    <button
                      type="button"
                      className="oma-cal-more"
                      data-testid="demo-day-overflow"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDay(cell.key);
                        setOverflowDay(cell.key);
                      }}
                    >
                      +{extra} {t('demo.content.more')}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="oma-cal-agenda" data-testid="demo-content-agenda">
            {agendaDays.map((day) => (
              <div key={day.key} className="oma-cal-agenda-day">
                <strong className="oma-ltr">{day.key}</strong>
                {day.items.length === 0 ? (
                  <p className="oma-muted" style={{ margin: '8px 0 0' }}>
                    {t('demo.empty')}
                  </p>
                ) : (
                  <div className="oma-stack" style={{ marginTop: 8, gap: 6 }}>
                    {day.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="oma-cal-item"
                        data-status={item.status}
                        data-testid={`demo-cal-item-${item.id}`}
                        onClick={() => openItem(item)}
                      >
                        <span className="oma-cal-marker">{channelMarker(item.channel)}</span>
                        <span>
                          {pickCopy(item.title, locale)} · {item.channel}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !unavailable && !error && filtered.length > 0 && view === 'list' ? (
        <div className="oma-content-list-stage3" data-testid="demo-content-list">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="oma-content-list-row"
              data-testid={`demo-content-card-${item.id}`}
              onClick={() => openItem(item)}
            >
              <img className="oma-content-list-thumb" src={item.previewAsset} alt="" />
              <div>
                <strong>{pickCopy(item.title, locale)}</strong>
                <div className="oma-muted">
                  {item.channel} · {campaignName(item.campaignId)}
                </div>
              </div>
              <span className="oma-muted">{item.assignee}</span>
              <span className="oma-ltr oma-muted">
                {item.scheduledAt ? item.scheduledAt.slice(0, 10) : '—'}
              </span>
              <StatusChip status={item.status} label={statusLabel(item.status, locale)} />
              <span
                className={`oma-badge ${item.track === 'ORGANIC' ? 'oma-track-organic' : 'oma-track-paid'}`}
              >
                {item.track === 'ORGANIC' ? t('demo.organic') : t('demo.paid')}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {!loading && !unavailable && !error && filtered.length > 0 && view === 'grid' ? (
        <div className="oma-content-grid-stage3" data-testid="demo-content-grid">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="oma-content-card-stage3"
              data-testid={`demo-content-card-${item.id}`}
              onClick={() => openItem(item)}
            >
              <div className="oma-content-card-media">
                <img src={item.previewAsset} alt="" />
              </div>
              <div className="oma-content-card-body">
                <strong>{pickCopy(item.title, locale)}</strong>
                <div className="oma-chip-row">
                  <StatusChip status={item.status} label={statusLabel(item.status, locale)} />
                  <span className="oma-cal-marker">{channelMarker(item.channel)}</span>
                </div>
                <span className="oma-muted">
                  {campaignName(item.campaignId)} · {item.assignee}
                </span>
                <span className="oma-ltr oma-muted">
                  {item.scheduledAt ? item.scheduledAt.slice(0, 10) : '—'}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      <Drawer
        open={Boolean(selected)}
        onClose={requestCloseDrawer}
        label={t('demo.content.drawerTitle')}
        wide
      >
        {selected ? (
          <div className="oma-stack" data-testid="demo-content-drawer" style={{ padding: 16 }}>
            <div className="oma-breadcrumb">
              <Link href="/app/content">{t('demo.content.title')}</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/app/campaigns/${selected.campaignId}`}>
                {campaignName(selected.campaignId)}
              </Link>
            </div>
            <header className="oma-page-header oma-page-header-stack">
              <div>
                <h2>{pickCopy(selected.title, locale)}</h2>
                <div className="oma-chip-row">
                  <StatusChip
                    status={selected.status}
                    label={statusLabel(selected.status, locale)}
                  />
                  <span className="oma-badge">{selected.channel}</span>
                  <span
                    className={`oma-badge ${selected.track === 'ORGANIC' ? 'oma-track-organic' : 'oma-track-paid'}`}
                  >
                    {selected.track === 'ORGANIC' ? t('demo.organic') : t('demo.paid')}
                  </span>
                </div>
                <p className="oma-muted">
                  {selected.assignee} ·{' '}
                  <span className="oma-ltr">
                    {selected.scheduledAt ? selected.scheduledAt.slice(0, 16) : '—'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                className="oma-btn oma-btn-secondary"
                onClick={requestCloseDrawer}
              >
                {t('demo.create.cancel')}
              </button>
            </header>

            <div className="oma-honesty-banner">{t('demo.content.aiNotConnected')}</div>
            <div className="oma-honesty-banner">{t('demo.content.noPublishing')}</div>

            <div className="oma-composer-preview">
              <img src={selected.previewAsset} alt="" />
            </div>

            <div className="oma-composer-fields">
              <label>
                {t('demo.content.caption')}
                <textarea
                  className="oma-input"
                  rows={3}
                  value={draft.caption}
                  data-testid="demo-content-caption"
                  onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
                />
              </label>
              <label>
                {t('demo.content.objective')}
                <textarea
                  className="oma-input"
                  rows={2}
                  value={draft.objective}
                  onChange={(e) => setDraft((d) => ({ ...d, objective: e.target.value }))}
                />
              </label>
              <label>
                {t('demo.content.cta')}
                <input
                  className="oma-input"
                  value={draft.cta}
                  onChange={(e) => setDraft((d) => ({ ...d, cta: e.target.value }))}
                />
              </label>
              <label>
                {t('demo.filter.status')}
                <select
                  className="oma-select"
                  value={draft.status}
                  onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('demo.content.filter.assignee')}
                <input
                  className="oma-input"
                  value={draft.assignee}
                  onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
                />
              </label>
              <label>
                {t('demo.create.plannedDate')}
                <input
                  type="datetime-local"
                  className="oma-input"
                  value={draft.scheduledAt}
                  onChange={(e) => setDraft((d) => ({ ...d, scheduledAt: e.target.value }))}
                />
              </label>
            </div>

            <div className="oma-chip-row">
              <button
                type="button"
                className="oma-btn oma-btn-primary"
                data-testid="demo-content-save"
                disabled={saving || !dirty}
                onClick={() => void saveItem()}
              >
                {saving ? t('demo.content.saving') : t('demo.content.save')}
              </button>
              <span className="oma-save-state" data-state={saveState}>
                {saveState === 'saved'
                  ? t('demo.content.saved')
                  : saveState === 'error'
                    ? saveError
                    : dirty
                      ? '•'
                      : null}
              </span>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Dialog
        open={Boolean(overflowDay)}
        title={t('demo.content.openDay')}
        onClose={() => setOverflowDay(null)}
      >
        <div className="oma-stack">
          <p className="oma-ltr oma-muted">{overflowDay}</p>
          {overflowItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="oma-cal-item"
              data-status={item.status}
              data-testid={`demo-cal-item-${item.id}`}
              onClick={() => openItem(item)}
            >
              <span className="oma-cal-marker">{channelMarker(item.channel)}</span>
              <span>
                {pickCopy(item.title, locale)} · {statusLabel(item.status, locale)}
              </span>
            </button>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={createOpen}
        title={t('demo.create.contentTitle')}
        onClose={() => (!creating ? setCreateOpen(false) : undefined)}
      >
        <div className="oma-composer-fields" data-testid="demo-create-content-dialog">
          <label>
            {t('demo.create.title')}
            <input
              className="oma-input"
              value={createForm.title}
              data-testid="demo-create-content-title"
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.create.campaign')}
            <select
              className="oma-select"
              value={createForm.campaignId}
              onChange={(e) => {
                const campaignId = e.target.value;
                const campaign = campaigns.find((c) => c.id === campaignId);
                setCreateForm((f) => ({
                  ...f,
                  campaignId,
                  track: campaign?.track ?? f.track,
                }));
              }}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {pickCopy(c.name, locale)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('demo.create.type')}
            <select
              className="oma-select"
              value={createForm.contentType}
              onChange={(e) => setCreateForm((f) => ({ ...f, contentType: e.target.value }))}
            >
              {['POST', 'REEL', 'CAROUSEL', 'STATIC', 'STORY'].map((ty) => (
                <option key={ty} value={ty}>
                  {ty}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('demo.create.channel')}
            <input
              className="oma-input"
              value={createForm.channel}
              onChange={(e) => setCreateForm((f) => ({ ...f, channel: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.create.owner')}
            <input
              className="oma-input"
              value={createForm.owner}
              onChange={(e) => setCreateForm((f) => ({ ...f, owner: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.create.plannedDate')}
            <input
              type="date"
              className="oma-input"
              value={createForm.plannedDate}
              onChange={(e) => setCreateForm((f) => ({ ...f, plannedDate: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.create.track')}
            <select
              className="oma-select"
              value={createForm.track}
              onChange={(e) => setCreateForm((f) => ({ ...f, track: e.target.value }))}
            >
              <option value="ORGANIC">{t('demo.organic')}</option>
              <option value="PAID">{t('demo.paid')}</option>
            </select>
          </label>
          <label>
            {t('demo.create.brief')}
            <textarea
              className="oma-input"
              rows={2}
              value={createForm.brief}
              onChange={(e) => setCreateForm((f) => ({ ...f, brief: e.target.value }))}
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
              data-testid="demo-create-content-submit"
              onClick={() => void submitCreate()}
            >
              {creating ? t('demo.create.creating') : t('demo.create.confirm')}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={unsavedOpen}
        title={t('demo.create.cancel')}
        onClose={() => setUnsavedOpen(false)}
      >
        <p>{t('demo.content.unsaved')}</p>
        <div className="oma-chip-row">
          <button
            type="button"
            className="oma-btn oma-btn-secondary"
            onClick={() => setUnsavedOpen(false)}
          >
            {t('demo.create.cancel')}
          </button>
          <button type="button" className="oma-btn oma-btn-primary" onClick={closeDrawer}>
            OK
          </button>
        </div>
      </Dialog>
    </div>
  );
}
