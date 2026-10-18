'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveContentWorkflow, type ApprovalPolicy, type DemoGraph } from '@oma/demo';
import { ContentFace, StatusMark, faceDisplay } from '../../../../components/content/content-card';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { TrackPill } from '../../../../components/demo/track-pill';
import {
  Button,
  DatePicker,
  Input,
  OmaSelect,
  SurfaceButton,
  Tabs,
  TextArea,
} from '@oma/ui/controls';
import dayjs from 'dayjs';
import { Dialog } from '../../../../components/ui/dialog';
import { EmptyState, ErrorState, DeniedState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
import { useToast } from '../../../../components/ui/toast';
import { mediaAlt, P3_MEDIA } from '../../../../lib/demo/demo-media';
import {
  hasContentViewPref,
  isContentViewMode,
  readContentViewPref,
  writeContentViewPref,
} from '../../../../lib/demo/demo-view-pref';
import {
  EMPTY_CONTENT_FILTERS,
  activeContentFilterCount,
  buildMonthCells,
  channelMarker,
  clearContentChip,
  commentsForContent,
  contentFilterChips,
  dayKey,
  filterContent,
  groupContentByDay,
  linkedIdsForContent,
  monthLabel,
  reviewPresentation,
  sortContent,
  splitCellItems,
  statusLabel,
  type ContentFilters,
  type ContentRow,
  type ContentSortKey,
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
type Brand = DemoGraph['brands'][number];
type Task = DemoGraph['tasks'][number];
type Deliverable = DemoGraph['deliverables'][number];
type RequestRow = DemoGraph['requests'][number];

/* Planable LIVE_VERIFIED capture window: real “today” for Oct 2026 parity runs. */
const TODAY_KEY = '2026-10-07';
const DEFAULT_YEAR = 2026;
const DEFAULT_MONTH = 9;

type DraftFields = {
  caption: string;
  objective: string;
  cta: string;
  status: string;
  assignee: string;
  scheduledAt: string;
  channel: string;
};

function emptyDraft(): DraftFields {
  return {
    caption: '',
    objective: '',
    cta: '',
    status: 'DRAFT',
    assignee: '',
    scheduledAt: '',
    channel: '',
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
    channel: item.channel,
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

function weekdayLabels(locale: string, weekStartsOn: 0 | 1 | 6): string[] {
  const fmt = new Intl.DateTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    weekday: 'short',
    timeZone: 'UTC',
  });
  const sunday = Date.UTC(2026, 0, 4);
  const order =
    weekStartsOn === 6
      ? [6, 0, 1, 2, 3, 4, 5]
      : weekStartsOn === 1
        ? [1, 2, 3, 4, 5, 6, 0]
        : [0, 1, 2, 3, 4, 5, 6];
  return order.map((dow) => fmt.format(new Date(sunday + dow * 86400000)));
}

function reviewFilterLabel(value: string, locale: string, allLabel: string): string {
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
  const [brands, setBrands] = useState<Brand[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [filters, setFilters] = useState<ContentFilters>(EMPTY_CONTENT_FILTERS);
  const [view, setView] = useState<ContentViewMode>('calendar');
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [sortKey, setSortKey] = useState<ContentSortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [cursor, setCursor] = useState({ year: DEFAULT_YEAR, monthIndex: DEFAULT_MONTH });
  const [calSpan, setCalSpan] = useState<'month' | 'week'>('month');
  const [selectedDay, setSelectedDay] = useState<string | null>(TODAY_KEY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [policy, setPolicy] = useState<ApprovalPolicy>('OPTIONAL');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftFields>(emptyDraft());
  const [baseline, setBaseline] = useState<DraftFields>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<'preview' | 'edit' | 'comments'>('preview');

  const [overflowDay, setOverflowDay] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
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
    caption: '',
    track: 'ORGANIC',
    previewAsset: P3_MEDIA.product as string,
  });

  const isAr = locale.toLowerCase().startsWith('ar');
  // EN Monday matches Planable LIVE_VERIFIED calendar; AR Saturday.
  const weekStartsOn: 0 | 1 | 6 = isAr ? 6 : 1;
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const graph = await demoApi<DemoGraph>('/graph');
      setRows(graph.contentItems);
      setPolicy(graph.demoPreferences.approvalPolicy ?? 'OPTIONAL');
      setCampaigns(graph.campaigns);
      setBrands(graph.brands);
      setTasks(graph.tasks);
      setDeliverables(graph.deliverables);
      setRequests(graph.requests);
      setError(null);
      setUnavailable(false);
      setCreateForm((f) => ({
        ...f,
        campaignId: f.campaignId || graph.campaigns[0]?.id || '',
        owner: f.owner || graph.contentItems[0]?.assignee || 'Maya Nasser',
        track: f.track || graph.campaigns[0]?.track || 'ORGANIC',
      }));
      const stored = readContentViewPref();
      const pref = graph.demoPreferences.defaultContentView;
      const urlView =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('view')
          : null;
      setView(() => {
        if (isContentViewMode(urlView)) return urlView;
        if (hasContentViewPref() && isContentViewMode(stored)) return stored;
        if (pref === 'list' || pref === 'calendar') return pref;
        return 'calendar';
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

  useEffect(() => {
    const urlView = search.get('view');
    if (isContentViewMode(urlView)) {
      setView((current) => (current === urlView ? current : urlView));
    }
  }, [search]);

  useEffect(() => {
    const campaign = search.get('campaign');
    if (campaign) {
      setFilters((f) => (f.campaignId === campaign ? f : { ...f, campaignId: campaign }));
    }
  }, [search]);

  const campaignName = useCallback(
    (id: string) => {
      const c = campaigns.find((x) => x.id === id);
      return c ? pickCopy(c.name, locale) : id;
    },
    [campaigns, locale],
  );
  const brandName = useCallback(
    (id: string) => {
      const b = brands.find((x) => x.id === id);
      return b ? pickCopy(b.name, locale) : id;
    },
    [brands, locale],
  );

  const filtered = useMemo(() => filterContent(rows, filters, locale), [rows, filters, locale]);
  const savedItems = useMemo(
    () => filtered.filter((item) => !resolveContentWorkflow(item, policy).plannedAt),
    [filtered, policy],
  );
  const sorted = useMemo(
    () => sortContent(filtered, sortKey, sortDir, locale, campaignName),
    [filtered, sortKey, sortDir, locale, campaignName],
  );
  const byDay = useMemo(() => groupContentByDay(filtered), [filtered]);
  const filterCount = activeContentFilterCount(filters);
  const chips = useMemo(
    () =>
      contentFilterChips(filters, {
        campaign: campaignName,
        brand: brandName,
        status: (id) => statusLabel(id, locale),
        review: (id) => reviewFilterLabel(id, locale, t('demo.filter.all')),
      }),
    [filters, campaignName, brandName, locale, t],
  );
  const channels = useMemo(() => [...new Set(rows.map((r) => r.channel))].sort(), [rows]);
  const types = useMemo(() => [...new Set(rows.map((r) => r.contentType))].sort(), [rows]);
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))].sort(), [rows]);
  const assignees = useMemo(() => [...new Set(rows.map((r) => r.assignee))].sort(), [rows]);
  const monthCells = useMemo(
    () => buildMonthCells(cursor.year, cursor.monthIndex, weekStartsOn),
    [cursor.year, cursor.monthIndex, weekStartsOn],
  );
  const visibleCells = useMemo(() => {
    if (calSpan === 'month') return monthCells;
    const anchor = selectedDay ?? TODAY_KEY;
    const idx = monthCells.findIndex((c) => c.key === anchor);
    const start = idx >= 0 ? idx - (idx % 7) : 0;
    return monthCells.slice(start, start + 7);
  }, [calSpan, monthCells, selectedDay]);
  const dows = useMemo(() => weekdayLabels(locale, weekStartsOn), [locale, weekStartsOn]);
  const selected = useMemo(
    () => (selectedId ? (rows.find((r) => r.id === selectedId) ?? null) : null),
    [rows, selectedId],
  );
  const overflowItems = overflowDay ? (byDay.get(overflowDay) ?? []) : [];
  const comments = selected ? commentsForContent(tasks, deliverables, selected.id) : [];
  const linked = selected
    ? linkedIdsForContent(tasks, deliverables, requests, selected.id)
    : { taskId: null, deliverableId: null, requestId: null };
  const review = selected ? reviewPresentation(selected.status, locale) : null;

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const current =
      typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : search.toString();
    const params = new URLSearchParams(current);
    mutate(params);
    const qs = params.toString();
    const href = qs ? `/app/content?${qs}` : '/app/content';
    router.replace(href, { scroll: false });
  }

  function changeView(mode: ContentViewMode) {
    setView(mode);
    writeContentViewPref(mode);
    replaceParams((params) => {
      params.set('view', mode);
    });
  }

  function openItem(item: ContentRow, tab: 'preview' | 'edit' | 'comments' = 'preview') {
    const next = draftFromItem(item, locale);
    setSelectedId(item.id);
    setDraft(next);
    setBaseline(next);
    setSaveState('idle');
    setSaveError(null);
    setOverflowDay(null);
    setDetailTab(tab);
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
          assignee: draft.assignee,
          channel: draft.channel,
          command: 'save-draft',
          plannedAt: draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : null,
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

  async function changePolicy(next: ApprovalPolicy) {
    setPolicy(next);
    await demoApi('/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ approvalPolicy: next }),
    });
  }

  async function runCommand(command: 'schedule' | 'unschedule' | 'request-approval') {
    if (!selectedId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await demoApi<ContentRow>(`/content/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ command }),
      });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      const next = draftFromItem(updated, locale);
      setDraft(next);
      setBaseline(next);
      toast.push(t('demo.content.saved'), 'success');
    } catch (err) {
      const msg = demoErrorMessage(err, t('demo.content.scheduleBlocked'));
      setSaveError(msg);
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
          previewAsset: createForm.previewAsset,
          caption: createForm.caption.trim()
            ? { en: createForm.caption.trim(), ar: createForm.caption.trim() }
            : undefined,
          objective: createForm.brief.trim()
            ? { en: createForm.brief.trim(), ar: createForm.brief.trim() }
            : undefined,
        }),
      });
      toast.push(t('demo.create.successContent'), 'success');
      setCreateOpen(false);
      setCreateForm((f) => ({ ...f, title: '', brief: '', caption: '' }));
      openItem(created, 'edit');
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

  function showApprovalQueue() {
    setFilters((current) => ({ ...current, review: 'needs' }));
  }

  function toggleSort(key: ContentSortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  async function shareContentWorkspace() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else throw new Error('Clipboard unavailable');
      toast.push(isAr ? 'تم نسخ رابط مساحة المحتوى' : 'Content link copied', 'success');
    } catch {
      toast.push(
        isAr ? 'تعذّر نسخ الرابط من هذا المتصفح' : 'This browser could not copy the link',
        'danger',
      );
    }
  }

  const agendaDays = useMemo(() => {
    const keys = monthCells.filter((c) => c.inMonth).map((c) => c.key);
    return keys
      .map((key) => ({ key, items: byDay.get(key) ?? [] }))
      .filter((d) => d.items.length > 0 || d.key === TODAY_KEY || d.key === selectedDay);
  }, [monthCells, byDay, selectedDay]);

  const dateStripDays = useMemo(
    () => monthCells.filter((c) => c.inMonth).map((c) => c.key),
    [monthCells],
  );

  const searchField = (
    <label className="oma-stage3-search">
      {t('demo.content.search')}
      <Input
        value={filters.query}
        onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
        data-testid="demo-content-search"
      />
    </label>
  );

  const advancedFilterFields = (
    <>
      <label>
        {t('demo.content.filter.campaign')}
        <OmaSelect
          value={filters.campaignId}
          testId="demo-content-filter-campaign"
          onChange={(campaignId) => {
            setFilters((f) => ({ ...f, campaignId }));
            replaceParams((params) => {
              if (campaignId === 'all') params.delete('campaign');
              else params.set('campaign', campaignId);
            });
          }}
          options={[
            { value: 'all', label: t('demo.filter.all') },
            ...campaigns.map((c) => ({ value: c.id, label: pickCopy(c.name, locale) })),
          ]}
        />
      </label>
      <label>
        {t('demo.content.filter.brand')}
        <OmaSelect
          value={filters.brandId}
          testId="demo-content-filter-brand"
          onChange={(brandId) => setFilters((f) => ({ ...f, brandId }))}
          options={[
            { value: 'all', label: t('demo.filter.all') },
            ...brands.map((b) => ({ value: b.id, label: pickCopy(b.name, locale) })),
          ]}
        />
      </label>
      <label>
        {t('demo.filter.channel')}
        <OmaSelect
          value={filters.channel}
          testId="demo-content-filter-channel"
          onChange={(channel) => setFilters((f) => ({ ...f, channel }))}
          options={[
            { value: 'all', label: t('demo.filter.all') },
            ...channels.map((ch) => ({ value: ch, label: ch })),
          ]}
        />
      </label>
      <label>
        {t('demo.content.filter.type')}
        <OmaSelect
          value={filters.contentType}
          onChange={(contentType) => setFilters((f) => ({ ...f, contentType }))}
          options={[
            { value: 'all', label: t('demo.filter.all') },
            ...types.map((ty) => ({ value: ty, label: ty })),
          ]}
        />
      </label>
      <label>
        {t('demo.filter.status')}
        <OmaSelect
          value={filters.status}
          testId="demo-content-filter-status"
          onChange={(status) => setFilters((f) => ({ ...f, status }))}
          options={[
            { value: 'all', label: t('demo.filter.all') },
            ...statuses.map((s) => ({ value: s, label: statusLabel(s, locale) })),
          ]}
        />
      </label>
      <label>
        {t('demo.content.filter.review')}
        <OmaSelect
          value={filters.review}
          onChange={(review) => setFilters((f) => ({ ...f, review }))}
          options={[
            { value: 'all', label: t('demo.filter.all') },
            { value: 'needs', label: reviewFilterLabel('needs', locale, t('demo.filter.all')) },
            {
              value: 'approved',
              label: reviewFilterLabel('approved', locale, t('demo.filter.all')),
            },
          ]}
        />
      </label>
      <label>
        {t('demo.content.filter.approval')}
        <OmaSelect
          value={filters.approval}
          testId="demo-content-filter-approval"
          onChange={(approval) => setFilters((f) => ({ ...f, approval }))}
          options={[
            { value: 'all', label: t('demo.filter.all') },
            { value: 'NOT_REQUESTED', label: t('demo.content.approval.notRequested') },
            { value: 'PENDING', label: t('demo.content.approval.pending') },
            { value: 'PARTIALLY_APPROVED', label: t('demo.content.approval.partial') },
            { value: 'APPROVED', label: t('demo.content.approval.approved') },
          ]}
        />
      </label>
      <label>
        {t('demo.content.filter.owner')}
        <OmaSelect
          value={filters.assignee}
          onChange={(assignee) => setFilters((f) => ({ ...f, assignee }))}
          options={[
            { value: 'all', label: t('demo.filter.all') },
            ...assignees.map((a) => ({ value: a, label: a })),
          ]}
        />
      </label>
      <label>
        {t('demo.content.filter.date')}
        <DatePicker
          value={filters.dateFrom ? dayjs(filters.dateFrom) : null}
          onChange={(_, dateString) =>
            setFilters((f) => ({
              ...f,
              dateFrom: Array.isArray(dateString) ? (dateString[0] ?? '') : dateString,
            }))
          }
          allowClear
        />
      </label>
      <label>
        {t('demo.content.filter.date')}
        <DatePicker
          value={filters.dateTo ? dayjs(filters.dateTo) : null}
          onChange={(_, dateString) =>
            setFilters((f) => ({
              ...f,
              dateTo: Array.isArray(dateString) ? (dateString[0] ?? '') : dateString,
            }))
          }
          allowClear
        />
      </label>
    </>
  );

  return (
    <div className="oma-stack oma-content-plan" data-testid="demo-content">
      {/*
        Planable LIVE_VERIFIED Content chrome: breadcrumb-level title (shell),
        compact view/filter/compose row — not a marketing page header stack.
      */}
      <PageHeader
        title={t('demo.content.title')}
        actions={
          <div className="oma-content-plan__actions">
            <Button
              type="default"
              onClick={() => setFilterSheet(true)}
              className="oma-filter-sheet-trigger"
              data-testid="demo-content-open-filters"
            >
              {t('demo.content.openFilters')}
              {filterCount > 0 ? ` (${filterCount})` : ''}
            </Button>
            <Button
              type="default"
              onClick={() => setMediaLibraryOpen(true)}
              className="oma-content-media-trigger"
              data-testid="demo-content-open-media"
            >
              {t('demo.content.media')}
            </Button>
            <Button
              type="default"
              onClick={() => void shareContentWorkspace()}
              data-testid="demo-content-share"
            >
              {isAr ? 'مشاركة' : 'Share'}
            </Button>
            <Button
              type="primary"
              data-testid="demo-create-content"
              onClick={() => setCreateOpen(true)}
            >
              {t('demo.content.create')}
            </Button>
          </div>
        }
        meta={
          <>
            {/* Planable LIVE_VERIFIED: view switcher is a dropdown, not always-visible tabs. */}
            <div className="oma-view-menu" data-testid="demo-content-view-menu">
              <Button
                type="default"
                className="oma-view-menu__trigger"
                data-testid="demo-content-view-trigger"
                aria-haspopup="menu"
                aria-expanded={viewMenuOpen}
                aria-label={t('demo.content.title')}
                onClick={() => setViewMenuOpen((open) => !open)}
              >
                <span data-testid={`demo-content-view-current-${view}`}>
                  {t(`demo.view.${view}`)}
                </span>
                <span className="oma-view-menu__caret" aria-hidden>
                  ▾
                </span>
              </Button>
              {viewMenuOpen ? (
                <ul className="oma-view-menu__list" role="menu">
                  {(['calendar', 'feed', 'grid', 'list'] as ContentViewMode[]).map((mode) => (
                    <li key={mode} role="none">
                      <Button
                        type="text"
                        role="menuitemradio"
                        aria-checked={view === mode}
                        data-testid={`demo-content-view-${mode}`}
                        data-selected={view === mode ? 'true' : 'false'}
                        className="oma-view-menu__item"
                        onClick={() => {
                          changeView(mode);
                          setViewMenuOpen(false);
                        }}
                      >
                        <span className="oma-view-menu__check" aria-hidden>
                          {view === mode ? '✓' : ''}
                        </span>
                        {t(`demo.view.${mode}`)}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <label className="oma-content-policy">
              {t('demo.content.policy')}
              <OmaSelect
                value={policy}
                testId="demo-content-approval-policy"
                onChange={(next) => void changePolicy(next as ApprovalPolicy)}
                options={[
                  { value: 'NONE', label: 'NONE' },
                  { value: 'OPTIONAL', label: 'OPTIONAL' },
                  { value: 'REQUIRED', label: 'REQUIRED' },
                ]}
              />
            </label>
            <span className="oma-item-count">
              {filtered.length} / {rows.length}
            </span>
          </>
        }
      />
      <DemoDisclosure message={t('demo.content.noPublishing')} />

      <div className="oma-stage3-toolbar" data-testid="demo-content-filters">
        {searchField}
      </div>

      {filterCount > 0 ? (
        <div className="oma-filter-chips" data-testid="demo-content-filter-chips">
          {chips.map((chip) => (
            <span key={chip.id} className="oma-filter-chip">
              {chip.label}
              <Button
                type="default"
                aria-label={`${t('demo.content.clearFilters')}: ${chip.label}`}
                onClick={() => {
                  const next = clearContentChip(filters, chip.id);
                  setFilters(next);
                  if (chip.id === 'campaignId') {
                    replaceParams((params) => params.delete('campaign'));
                  }
                }}
              >
                ×
              </Button>
            </span>
          ))}
          <Button
            type="default"
            onClick={() => {
              setFilters(EMPTY_CONTENT_FILTERS);
              replaceParams((params) => {
                params.delete('campaign');
              });
            }}
          >
            {t('demo.content.clearFilters')}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="oma-skeleton-block" aria-busy="true">
          <div className="oma-skeleton" style={{ height: 28, width: '40%' }} />
          <div className="oma-skeleton" style={{ height: 220, marginTop: 12 }} />
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
          title={t('demo.empty')}
          action={
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              {t('demo.content.create')}
            </Button>
          }
        />
      ) : null}

      {!loading && !unavailable && !error && filtered.length > 0 && view === 'calendar' ? (
        <section
          data-testid="demo-content-calendar"
          className="oma-cal-with-saved"
          data-cal-span={calSpan}
        >
          <div className="oma-cal-main">
            <div className="oma-cal-toolbar">
              <div className="oma-cal-span" role="group" aria-label={t('demo.view.calendar')}>
                <Button
                  type="text"
                  className="oma-cal-span__btn"
                  data-active={calSpan === 'month' ? 'true' : 'false'}
                  aria-pressed={calSpan === 'month'}
                  data-testid="demo-content-cal-month"
                  onClick={() => setCalSpan('month')}
                >
                  {t('demo.content.calMonth')}
                </Button>
                <Button
                  type="text"
                  className="oma-cal-span__btn"
                  data-active={calSpan === 'week' ? 'true' : 'false'}
                  aria-pressed={calSpan === 'week'}
                  data-testid="demo-content-cal-week"
                  onClick={() => setCalSpan('week')}
                >
                  {t('demo.content.calWeek')}
                </Button>
              </div>
              <div className="oma-cal-nav">
                <Button
                  type="default"
                  className="oma-cal-nav__btn"
                  aria-label={t('demo.content.prev')}
                  data-testid="demo-content-cal-prev"
                  onClick={() => shiftMonth(-1)}
                >
                  ‹
                </Button>
                <strong className="oma-cal-month-label">
                  {monthLabel(cursor.year, cursor.monthIndex, locale)}
                </strong>
                <Button
                  type="default"
                  className="oma-cal-nav__btn"
                  aria-label={t('demo.content.next')}
                  data-testid="demo-content-cal-next"
                  onClick={() => shiftMonth(1)}
                >
                  ›
                </Button>
                <Button
                  type="default"
                  className="oma-cal-nav__today"
                  data-testid="demo-content-cal-today"
                  onClick={goToday}
                >
                  {t('demo.content.today')}
                </Button>
                {selectedDay ? (
                  <Button
                    type="default"
                    onClick={() => {
                      setCreateForm((f) => ({ ...f, plannedDate: selectedDay }));
                      setCreateOpen(true);
                    }}
                  >
                    {t('demo.content.createOnDate')}
                  </Button>
                ) : null}
                <Button
                  type="default"
                  className="oma-cal-request-approvals"
                  data-testid="demo-content-request-approvals"
                  onClick={showApprovalQueue}
                >
                  {isAr ? 'طلب الموافقات' : 'Request approvals'}
                </Button>
              </div>
            </div>

            <div
              className="oma-cal-date-strip"
              data-testid="demo-content-date-strip"
              aria-label={t('demo.view.calendar')}
            >
              {dateStripDays.map((key) => (
                <Button
                  key={key}
                  type="default"
                  data-selected={key === selectedDay ? 'true' : 'false'}
                  onClick={() => setSelectedDay(key)}
                >
                  {key.slice(8)}
                </Button>
              ))}
            </div>

            <div
              className="oma-cal-grid"
              role="grid"
              aria-label={t('demo.view.calendar')}
              data-testid="demo-content-cal-grid"
              data-columns="7"
            >
              {dows.map((dow) => (
                <div key={dow} className="oma-cal-dow" role="columnheader">
                  {dow}
                </div>
              ))}
              {visibleCells.map((cell) => {
                const items = byDay.get(cell.key) ?? [];
                const { visible, extra } = splitCellItems(items);
                return (
                  <div
                    key={cell.key}
                    className="oma-cal-cell"
                    role="gridcell"
                    aria-selected={cell.key === selectedDay}
                    data-out={cell.inMonth ? 'false' : 'true'}
                    data-today={cell.key === TODAY_KEY ? 'true' : 'false'}
                    data-selected={cell.key === selectedDay ? 'true' : 'false'}
                    onClick={() => setSelectedDay(cell.key)}
                  >
                    <span className="oma-cal-daynum oma-ltr">{cell.date.getUTCDate()}</span>
                    {visible.map((item) => (
                      <SurfaceButton
                        key={item.id}
                        data-status={item.status}
                        data-testid={`demo-cal-item-${item.id}`}
                        data-selected={selectedId === item.id ? 'true' : 'false'}
                        onClick={(e) => {
                          e.stopPropagation();
                          openItem(item);
                        }}
                        className="oma-cal-item"
                      >
                        <ContentFace
                          variant="calendar"
                          title={pickCopy(item.title, locale)}
                          caption={item.caption ? pickCopy(item.caption, locale) : ''}
                          channel={item.channel}
                          when={item.scheduledAt ? item.scheduledAt.slice(11, 16) : '—'}
                          asset={item.previewAsset}
                          display={faceDisplay(item, policy)}
                          locale={locale}
                          selected={selectedId === item.id}
                        />
                      </SurfaceButton>
                    ))}
                    {extra > 0 ? (
                      <Button
                        type="default"
                        data-testid="demo-day-overflow"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay(cell.key);
                          setOverflowDay(cell.key);
                        }}
                        className="oma-cal-more"
                      >
                        +{extra}
                      </Button>
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
                        <SurfaceButton
                          key={item.id}
                          data-status={item.status}
                          data-testid={`demo-cal-item-${item.id}`}
                          onClick={() => openItem(item)}
                          className="oma-cal-item"
                        >
                          <img className="oma-cal-thumb" src={item.previewAsset} alt="" />
                          <span>
                            {pickCopy(item.title, locale)} · {item.channel} ·{' '}
                            {statusLabel(item.status, locale)}
                          </span>
                        </SurfaceButton>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <aside data-testid="demo-content-saved" aria-label={t('demo.content.savedColumn')}>
            <header className="oma-cal-saved-head">
              <strong>{t('demo.content.savedColumn')}</strong>
              <div className="oma-cal-saved-head__meta">
                {savedItems.length > 0 ? (
                  <span className="oma-muted oma-ltr">{savedItems.length}</span>
                ) : null}
                <span className="oma-cal-saved-close" aria-hidden>
                  ×
                </span>
              </div>
            </header>
            {savedItems.length === 0 ? (
              <div className="oma-cal-saved-empty" data-testid="demo-content-saved-empty">
                <div className="oma-cal-saved-empty__art" aria-hidden />
                <strong>{t('demo.content.savedEmpty')}</strong>
                <p className="oma-muted">{t('demo.content.savedEmptyHint')}</p>
                <Button type="default" onClick={() => setCreateOpen(true)}>
                  {t('demo.content.create')}
                </Button>
              </div>
            ) : (
              <div className="oma-cal-saved-list">
                {savedItems.map((item) => (
                  <SurfaceButton
                    key={item.id}
                    data-testid={`demo-saved-item-${item.id}`}
                    data-selected={selectedId === item.id ? 'true' : 'false'}
                    onClick={() => openItem(item)}
                    className="oma-cal-item"
                  >
                    <ContentFace
                      variant="saved"
                      title={pickCopy(item.title, locale)}
                      caption={item.caption ? pickCopy(item.caption, locale) : ''}
                      channel={item.channel}
                      when="—"
                      asset={item.previewAsset}
                      display={faceDisplay(item, policy)}
                      locale={locale}
                      selected={selectedId === item.id}
                    />
                  </SurfaceButton>
                ))}
              </div>
            )}
          </aside>
        </section>
      ) : null}

      {!loading && !unavailable && !error && filtered.length > 0 && view === 'feed' ? (
        <div className="oma-content-feed" data-testid="demo-content-feed">
          {filtered.map((item) => (
            <SurfaceButton
              key={item.id}
              data-testid={`demo-content-card-${item.id}`}
              data-selected={selectedId === item.id ? 'true' : 'false'}
              onClick={() => openItem(item)}
              className="oma-content-feed-item"
            >
              <div
                className="oma-content-feed-media"
                data-ratio={item.contentType === 'REEL' ? 'video' : 'post'}
              >
                <img
                  src={item.previewAsset}
                  alt={mediaAlt(pickCopy(item.title, locale), item.channel, item.contentType)}
                />
              </div>
              <div className="oma-chip-row">
                <span className="oma-cal-marker">{channelMarker(item.channel)}</span>
                <span>{item.channel}</span>
                <TrackPill
                  track={item.track}
                  organicLabel={t('demo.organic')}
                  paidLabel={t('demo.paid')}
                />
              </div>
              <strong>{pickCopy(item.title, locale)}</strong>
              <p className="oma-muted" style={{ margin: 0 }}>
                {item.caption ? pickCopy(item.caption, locale) : t('demo.content.unsupported')}
              </p>
              <span className="oma-muted">{campaignName(item.campaignId)}</span>
              <div className="oma-chip-row">
                <StatusMark display={faceDisplay(item, policy)} locale={locale} />
                <span className="oma-muted">{item.assignee}</span>
                <span className="oma-ltr oma-muted">
                  {item.scheduledAt ? item.scheduledAt.slice(0, 16) : '—'}
                </span>
                <span className="oma-muted">
                  {commentsForContent(tasks, deliverables, item.id).length}
                </span>
              </div>
            </SurfaceButton>
          ))}
        </div>
      ) : null}

      {!loading && !unavailable && !error && filtered.length > 0 && view === 'list' ? (
        <div className="oma-content-list-stage3" data-testid="demo-content-list">
          <div className="oma-content-list-head">
            <span />
            <Button type="default" onClick={() => toggleSort('title')}>
              {t('demo.create.title')}
            </Button>
            <Button type="default" onClick={() => toggleSort('channel')}>
              {t('demo.filter.channel')}
            </Button>
            <Button type="default" onClick={() => toggleSort('campaign')}>
              {t('demo.create.campaign')}
            </Button>
            <Button type="default" onClick={() => toggleSort('owner')}>
              {t('demo.create.owner')}
            </Button>
            <Button type="default" onClick={() => toggleSort('status')}>
              {t('demo.filter.status')}
            </Button>
            <Button type="default" onClick={() => toggleSort('review')}>
              {t('demo.content.filter.review')}
            </Button>
            <Button type="default" onClick={() => toggleSort('date')}>
              {t('demo.create.plannedDate')}
            </Button>
            <span />
          </div>
          {sorted.map((item) => (
            <SurfaceButton
              key={item.id}
              data-testid={`demo-content-card-${item.id}`}
              data-selected={selectedId === item.id ? 'true' : 'false'}
              onClick={() => openItem(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openItem(item);
                }
              }}
              className="oma-content-list-row"
            >
              <img
                className="oma-content-list-thumb"
                src={item.previewAsset}
                alt={mediaAlt(pickCopy(item.title, locale), item.channel, item.contentType)}
              />
              <div>
                <strong>{pickCopy(item.title, locale)}</strong>
              </div>
              <span className="oma-muted">{item.channel}</span>
              <span className="oma-muted">{campaignName(item.campaignId)}</span>
              <span className="oma-muted">{item.assignee}</span>
              <StatusMark display={faceDisplay(item, policy)} locale={locale} />
              <span className="oma-muted">{statusLabel(item.status, locale)}</span>
              <span className="oma-ltr oma-muted">
                {item.scheduledAt ? item.scheduledAt.slice(0, 10) : '—'}
              </span>
              <TrackPill
                track={item.track}
                organicLabel={t('demo.organic')}
                paidLabel={t('demo.paid')}
              />
            </SurfaceButton>
          ))}
        </div>
      ) : null}

      {!loading && !unavailable && !error && filtered.length > 0 && view === 'grid' ? (
        <div className="oma-content-grid-stage3" data-testid="demo-content-grid">
          {filtered.map((item) => (
            <SurfaceButton
              key={item.id}
              data-testid={`demo-content-card-${item.id}`}
              data-selected={selectedId === item.id ? 'true' : 'false'}
              onClick={() => openItem(item)}
              className="oma-content-card-stage3"
            >
              <div className="oma-content-card-media">
                <img
                  src={item.previewAsset}
                  alt={mediaAlt(pickCopy(item.title, locale), item.channel, item.contentType)}
                />
              </div>
              <div className="oma-content-card-body">
                <strong>{pickCopy(item.title, locale)}</strong>
                <div className="oma-chip-row">
                  <span className="oma-cal-marker">{channelMarker(item.channel)}</span>
                  <StatusMark display={faceDisplay(item, policy)} locale={locale} />
                </div>
                <span className="oma-muted">{campaignName(item.campaignId)}</span>
                <span className="oma-ltr oma-muted">
                  {item.scheduledAt ? item.scheduledAt.slice(0, 10) : '—'}
                </span>
              </div>
            </SurfaceButton>
          ))}
        </div>
      ) : null}

      <Dialog
        open={Boolean(selected)}
        onClose={requestCloseDrawer}
        title={t('demo.content.drawerTitle')}
        size="xl"
        className="oma-content-detail-modal"
      >
        {selected ? (
          <div className="oma-stack oma-content-detail" data-testid="demo-content-drawer">
            <div className="oma-breadcrumb">
              <Link href="/app/content">{t('demo.content.title')}</Link>
              <span aria-hidden="true">/</span>
              <Link
                href={`/app/campaigns/${selected.campaignId}`}
                data-testid="demo-content-campaign-link"
              >
                {campaignName(selected.campaignId)}
              </Link>
            </div>
            <header className="oma-page-header oma-page-header-stack oma-content-detail__header">
              <div>
                <h2>{pickCopy(selected.title, locale)}</h2>
                <div className="oma-chip-row">
                  <StatusMark display={faceDisplay(selected, policy)} locale={locale} />
                  <span className="oma-badge">{selected.channel}</span>
                  <TrackPill
                    track={selected.track}
                    organicLabel={t('demo.organic')}
                    paidLabel={t('demo.paid')}
                  />
                  {review ? (
                    <span data-testid="demo-content-review-state">{review.label}</span>
                  ) : null}
                </div>
                <p className="oma-muted">
                  {selected.assignee} ·{' '}
                  <span className="oma-ltr">
                    {selected.scheduledAt ? selected.scheduledAt.slice(0, 16) : '—'}
                  </span>
                </p>
                <span className="oma-save-state" data-state={saveState}>
                  {saveState === 'saved'
                    ? t('demo.content.saved')
                    : saveState === 'saving'
                      ? t('demo.content.saving')
                      : saveState === 'error'
                        ? saveError
                        : dirty
                          ? '•'
                          : null}
                </span>
              </div>
              <Button onClick={requestCloseDrawer}>{t('demo.create.cancel')}</Button>
            </header>

            <div className="oma-honesty-banner">{t('demo.content.aiNotConnected')}</div>
            <div className="oma-honesty-banner">{t('demo.content.noPublishing')}</div>

            <Tabs
              activeKey={detailTab}
              onChange={(key) => setDetailTab(key as typeof detailTab)}
              items={[
                { key: 'preview', label: t('demo.content.media') },
                { key: 'edit', label: t('demo.content.edit') },
                { key: 'comments', label: t('demo.content.comments') },
              ]}
            />

            {detailTab !== 'comments' ? (
              <div className="oma-content-composer" data-testid="demo-content-composer">
                <div className="oma-content-composer-preview">
                  <img
                    src={selected.previewAsset}
                    alt={mediaAlt(
                      pickCopy(selected.title, locale),
                      selected.channel,
                      selected.contentType,
                    )}
                    data-testid="demo-content-composer-preview"
                  />
                </div>
                {detailTab === 'edit' ? (
                  <div className="oma-composer-fields">
                    <label>
                      {t('demo.content.channelAccount')}
                      <Input
                        value={draft.channel}
                        onChange={(e) => setDraft((d) => ({ ...d, channel: e.target.value }))}
                      />
                    </label>
                    <label>
                      {t('demo.content.caption')}
                      <TextArea
                        rows={3}
                        value={draft.caption}
                        data-testid="demo-content-caption"
                        onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
                      />
                    </label>
                    <label>
                      {t('demo.content.objective')}
                      <TextArea
                        rows={2}
                        value={draft.objective}
                        onChange={(e) => setDraft((d) => ({ ...d, objective: e.target.value }))}
                      />
                    </label>
                    <label>
                      {t('demo.content.cta')}
                      <Input
                        value={draft.cta}
                        onChange={(e) => setDraft((d) => ({ ...d, cta: e.target.value }))}
                      />
                    </label>
                    <p className="oma-composer-section">{t('demo.content.section.approval')}</p>
                    <p data-testid="demo-content-policy-explainer">
                      {policy === 'NONE'
                        ? t('demo.content.policy.none')
                        : policy === 'OPTIONAL'
                          ? t('demo.content.policy.optional')
                          : t('demo.content.policy.required')}
                    </p>
                    <p data-testid="demo-content-approver-progress">
                      {t('demo.content.approverProgress')
                        .replace(
                          '{approved}',
                          String(resolveContentWorkflow(selected, policy).approverApproved),
                        )
                        .replace(
                          '{required}',
                          String(resolveContentWorkflow(selected, policy).approverRequired),
                        )}
                    </p>
                    <p data-testid="demo-content-next-action">
                      {policy === 'NONE'
                        ? t('demo.content.next.none')
                        : policy === 'OPTIONAL'
                          ? t('demo.content.next.optional')
                          : resolveContentWorkflow(selected, policy).scheduleBlocked
                            ? t('demo.content.next.approve')
                            : t('demo.content.next.schedule')}
                    </p>
                    {resolveContentWorkflow(selected, policy).scheduleBlocked ? (
                      <p data-testid="demo-content-schedule-reason">
                        {t('demo.content.scheduleBlocked')}
                      </p>
                    ) : null}
                    <p data-testid="demo-content-publish-state">
                      {t(
                        `demo.content.publish.${resolveContentWorkflow(selected, policy).publishDisplay}`,
                      )}
                      {' · '}
                      {t('demo.content.noPublishing')}
                    </p>
                    <label>
                      {t('demo.content.filter.owner')}
                      <Input
                        value={draft.assignee}
                        onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
                      />
                    </label>
                    <p className="oma-composer-section">{t('demo.content.section.planning')}</p>
                    <label>
                      {t('demo.create.plannedDate')}
                      <DatePicker
                        showTime={{ format: 'HH:mm' }}
                        format="YYYY-MM-DDTHH:mm"
                        value={draft.scheduledAt ? dayjs(draft.scheduledAt) : null}
                        onChange={(_, dateString) =>
                          setDraft((d) => ({
                            ...d,
                            scheduledAt: Array.isArray(dateString)
                              ? (dateString[0] ?? '')
                              : dateString,
                          }))
                        }
                      />
                    </label>
                    <div className="oma-chip-row">
                      <Button
                        type="primary"
                        data-testid="demo-content-save"
                        disabled={!dirty}
                        loading={saving}
                        onClick={() => void saveItem()}
                      >
                        {t('demo.content.save')}
                      </Button>
                      <Button
                        data-testid="demo-content-schedule"
                        title={
                          resolveContentWorkflow(selected, policy).scheduleBlocked
                            ? t('demo.content.scheduleBlocked')
                            : undefined
                        }
                        disabled={
                          saving || resolveContentWorkflow(selected, policy).scheduleBlocked
                        }
                        onClick={() => void runCommand('schedule')}
                      >
                        {t('demo.content.schedule')}
                      </Button>
                      <Button
                        data-testid="demo-content-unschedule"
                        disabled={saving}
                        onClick={() => void runCommand('unschedule')}
                      >
                        {t('demo.content.unschedule')}
                      </Button>
                      {policy !== 'NONE' ? (
                        <Button
                          data-testid="demo-content-request-approval"
                          disabled={saving}
                          onClick={() => void runCommand('request-approval')}
                        >
                          {t('demo.content.requestApproval')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="oma-status-rows">
                    <div>
                      <span className="oma-status-label">{t('demo.create.campaign')}</span>
                      <Link href={`/app/campaigns/${selected.campaignId}`}>
                        {campaignName(selected.campaignId)}
                      </Link>
                    </div>
                    <div>
                      <span className="oma-status-label">{t('demo.create.type')}</span>
                      <span>{selected.contentType}</span>
                    </div>
                    <div>
                      <span className="oma-status-label">{t('demo.content.caption')}</span>
                      <span>{selected.caption ? pickCopy(selected.caption, locale) : '—'}</span>
                    </div>
                    <div>
                      <span className="oma-status-label">{t('demo.content.linked')}</span>
                      <span className="oma-chip-row">
                        {linked.taskId ? (
                          <Link href="/app/tasks">{t('demo.campaign.tasks')}</Link>
                        ) : null}
                        {linked.requestId ? (
                          <Link href="/app/requests">{t('demo.requests.title')}</Link>
                        ) : null}
                        {linked.deliverableId ? (
                          <Link href={`/app/deliverables/${linked.deliverableId}`}>
                            {t('demo.campaign.deliverables')}
                          </Link>
                        ) : null}
                      </span>
                    </div>
                    <div>
                      <Button type="default" onClick={() => setDetailTab('edit')}>
                        {t('demo.content.edit')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div data-testid="demo-content-comments">
                {review?.disabledReason ? (
                  <p className="oma-honesty-banner">{review.disabledReason}</p>
                ) : null}
                {review ? (
                  <div className="oma-status-rows">
                    <div>
                      <span className="oma-status-label">{t('demo.content.reviewState')}</span>
                      <span>{review.label}</span>
                    </div>
                    <div>
                      <span className="oma-status-label">{t('demo.content.reviewer')}</span>
                      <span>{comments[0]?.author ?? selected.assignee}</span>
                    </div>
                    <div>
                      <span className="oma-status-label">{t('demo.content.approvalStep')}</span>
                      <span>
                        {review.state === 'approved'
                          ? statusLabel('APPROVED', locale)
                          : review.state === 'review'
                            ? t('demo.content.changesRequested')
                            : review.label}
                      </span>
                    </div>
                  </div>
                ) : null}
                {comments.length === 0 ? (
                  <p className="oma-muted">{t('demo.content.noComments')}</p>
                ) : (
                  <div className="oma-comment-thread">
                    {comments.map((c) => (
                      <article key={c.id} className="oma-comment">
                        <span className="oma-comment-avatar" aria-hidden>
                          {c.author.slice(0, 1)}
                        </span>
                        <div>
                          <div className="oma-comment-meta">
                            {c.author} · <span className="oma-ltr">{c.at}</span>
                            {c.resolved ? ` · ${t('demo.content.resolved')}` : ''}
                          </div>
                          <p className="oma-comment-body">{pickCopy(c.body, locale)}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(overflowDay)}
        title={t('demo.content.openDay')}
        onClose={() => setOverflowDay(null)}
      >
        <div className="oma-stack">
          <p className="oma-ltr oma-muted">{overflowDay}</p>
          {overflowItems.map((item) => (
            <SurfaceButton
              key={item.id}
              data-status={item.status}
              data-testid={`demo-cal-item-${item.id}`}
              onClick={() => openItem(item)}
              className="oma-cal-item"
            >
              <img className="oma-cal-thumb" src={item.previewAsset} alt="" />
              <span>
                {pickCopy(item.title, locale)} · {statusLabel(item.status, locale)}
              </span>
            </SurfaceButton>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={filterSheet}
        title={t('demo.content.filters')}
        onClose={() => setFilterSheet(false)}
        footer={
          <div className="oma-dialog-footer oma-filter-sheet-footer">
            <Button
              type="default"
              onClick={() => setFilters(EMPTY_CONTENT_FILTERS)}
              data-testid="demo-content-filter-clear"
            >
              {t('demo.content.clearFilters')}
            </Button>
            <Button
              type="primary"
              onClick={() => setFilterSheet(false)}
              data-testid="demo-content-filter-apply"
            >
              {t('demo.filters.apply')}
            </Button>
          </div>
        }
      >
        <div className="oma-composer-fields" data-testid="demo-content-filter-sheet">
          {searchField}
          {advancedFilterFields}
        </div>
      </Dialog>

      <Dialog
        open={mediaLibraryOpen}
        title={isAr ? 'مكتبة الوسائط' : 'Media library'}
        onClose={() => setMediaLibraryOpen(false)}
        size="lg"
        className="oma-content-media-modal"
      >
        <div className="oma-media-library-grid" data-testid="demo-content-media-library">
          {Object.entries(P3_MEDIA).map(([name, src]) => (
            <button
              key={name}
              type="button"
              className="oma-media-library-item"
              onClick={() => {
                setCreateForm((f) => ({ ...f, previewAsset: src }));
                setMediaLibraryOpen(false);
                setCreateOpen(true);
              }}
            >
              <img src={src} alt={name} />
              <span>{name.replaceAll('_', ' ')}</span>
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
            <Input
              value={createForm.title}
              data-testid="demo-create-content-title"
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.create.campaign')}
            <OmaSelect
              value={createForm.campaignId}
              onChange={(campaignId) => {
                const campaign = campaigns.find((c) => c.id === campaignId);
                setCreateForm((f) => ({
                  ...f,
                  campaignId,
                  track: campaign?.track ?? f.track,
                }));
              }}
              options={campaigns.map((c) => ({ value: c.id, label: pickCopy(c.name, locale) }))}
            />
          </label>
          <label>
            {t('demo.create.type')}
            <OmaSelect
              value={createForm.contentType}
              onChange={(contentType) => setCreateForm((f) => ({ ...f, contentType }))}
              options={['POST', 'REEL', 'CAROUSEL', 'STATIC', 'STORY'].map((ty) => ({
                value: ty,
                label: ty,
              }))}
            />
          </label>
          <label>
            {t('demo.content.channelAccount')}
            <Input
              value={createForm.channel}
              onChange={(e) => setCreateForm((f) => ({ ...f, channel: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.content.media')}
            <OmaSelect
              value={createForm.previewAsset}
              onChange={(previewAsset) => setCreateForm((f) => ({ ...f, previewAsset }))}
              options={Object.entries(P3_MEDIA).map(([id, src]) => ({ value: src, label: id }))}
            />
          </label>
          <label>
            {t('demo.create.owner')}
            <Input
              value={createForm.owner}
              onChange={(e) => setCreateForm((f) => ({ ...f, owner: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.create.plannedDate')}
            <DatePicker
              value={createForm.plannedDate ? dayjs(createForm.plannedDate) : null}
              onChange={(_, dateString) =>
                setCreateForm((f) => ({
                  ...f,
                  plannedDate: Array.isArray(dateString) ? (dateString[0] ?? '') : dateString,
                }))
              }
            />
          </label>
          <label>
            {t('demo.create.track')}
            <OmaSelect
              value={createForm.track}
              onChange={(track) => setCreateForm((f) => ({ ...f, track }))}
              options={[
                { value: 'ORGANIC', label: t('demo.organic') },
                { value: 'PAID', label: t('demo.paid') },
              ]}
            />
          </label>
          <label>
            {t('demo.content.caption')}
            <TextArea
              rows={2}
              value={createForm.caption}
              onChange={(e) => setCreateForm((f) => ({ ...f, caption: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.create.brief')}
            <TextArea
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
          <div className="oma-dialog-footer">
            <Button type="default" disabled={creating} onClick={() => setCreateOpen(false)}>
              {t('demo.create.cancel')}
            </Button>
            <Button
              type="primary"
              loading={creating}
              data-testid="demo-create-content-submit"
              onClick={() => void submitCreate()}
            >
              {t('demo.create.confirm')}
            </Button>
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
          <Button type="default" onClick={() => setUnsavedOpen(false)}>
            {t('demo.create.cancel')}
          </Button>
          <Button type="primary" onClick={closeDrawer}>
            OK
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
