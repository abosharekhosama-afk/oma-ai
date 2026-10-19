'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveContentWorkflow, type ApprovalPolicy, type DemoGraph } from '@oma/demo';
import { ContentFace, StatusMark, faceDisplay } from '../../../../components/content/content-card';
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
import {
  FilterOutlined,
  PictureOutlined,
  EditOutlined,
  ShareAltOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  BarsOutlined,
  CheckCircleOutlined,
  LockOutlined,
  DeleteOutlined,
  DownOutlined,
  CheckOutlined,
  EyeInvisibleOutlined,
  LinkOutlined,
  MoreOutlined,
  CloseOutlined,
  CopyOutlined,
  InboxOutlined,
  FlagOutlined,
  SyncOutlined,
  FormOutlined,
  UserOutlined,          
  ClockCircleOutlined,   
  EyeOutlined,           
  SnippetsOutlined,      
  NotificationOutlined,  
  TagOutlined,           
} from '@ant-design/icons';

import { Dialog } from '../../../../components/ui/dialog';
import { EmptyState, ErrorState, DeniedState } from '../../../../components/ui/empty-state';
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
/* ── Planable-style compose card ─────────────────────────────── */

type ComposeForm = {
  title: string;
  campaignId: string;
  contentType: string;
  channel: string;
  previewAsset: string;
  owner: string;
  plannedDate: string;
  track: string;
  caption: string;
  brief: string;
};

function PlanableComposeCard({
  open,
  creating,
  error,
  form,
  campaigns,
  locale,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  creating: boolean;
  error: string | null;
  form: ComposeForm;
  campaigns: Campaign[];
  locale: string;
  onChange: (patch: Partial<ComposeForm>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [campaignMenu, setCampaignMenu] = useState(false);
  if (!open) return null;
  const selectedCampaign = campaigns.find((c) => c.id === form.campaignId);
  return createPortal(
    <div className="oma-compose-overlay" onClick={creating ? undefined : onClose}>
      <div
        className="oma-compose-card"
        role="dialog"
        aria-modal="true"
        data-testid="demo-create-content-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="oma-compose-close"
          aria-label="Dismiss"
          disabled={creating}
          onClick={onClose}
        >
          <CloseOutlined />
        </button>

        <div className="oma-compose-pills">
          <button type="button" className="oma-compose-pill">
            <SnippetsOutlined />
            Template
          </button>
          <div className="oma-compose-pill-wrap">
            <button
              type="button"
              className="oma-compose-pill"
              aria-expanded={campaignMenu}
              data-testid="demo-create-content-campaign"
              onClick={() => setCampaignMenu((v) => !v)}
            >
              <NotificationOutlined />
              {selectedCampaign ? pickCopy(selectedCampaign.name, locale) : 'Campaign'}
              <DownOutlined style={{ fontSize: 10 }} />
            </button>
            {campaignMenu ? (
              <div className="oma-compose-menu" role="menu">
                <button
                  type="button"
                  className="oma-compose-menu__item"
                  onClick={() => {
                    onChange({ campaignId: '' });
                    setCampaignMenu(false);
                  }}
                >
                  No campaign
                </button>
                {campaigns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="oma-compose-menu__item"
                    onClick={() => {
                      onChange({ campaignId: c.id, track: c.track ?? form.track });
                      setCampaignMenu(false);
                    }}
                  >
                    {pickCopy(c.name, locale)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" className="oma-compose-pill">
            <TagOutlined />
            Labels
          </button>
        </div>

        <div className="oma-compose-body">
          <div className="oma-compose-side">
            <div className="oma-compose-avatar">
              <UserOutlined />
              <span className="oma-compose-avatar-badge">
                <EditOutlined />
              </span>
            </div>
            <button type="button" className="oma-compose-media" aria-label="Media">
              <PictureOutlined />
            </button>
          </div>
          <div className="oma-compose-main">
            <Input
              className="oma-compose-title"
              placeholder="Title"
              value={form.title}
              data-testid="demo-create-content-title"
              onChange={(e) => onChange({ title: e.target.value })}
            />
            <TextArea
              className="oma-compose-text"
              rows={4}
              placeholder={"Type '/' to add headlines, media and more..."}
              value={form.caption}
              onChange={(e) => onChange({ caption: e.target.value })}
            />
          </div>
        </div>

        <div className="oma-compose-extras">
          <label>
            Type
            <OmaSelect
              value={form.contentType}
              onChange={(contentType) => onChange({ contentType })}
              options={['POST', 'REEL', 'CAROUSEL', 'STATIC', 'STORY'].map((ty) => ({
                value: ty,
                label: ty,
              }))}
            />
          </label>
          <label>
            Channel
            <Input
              value={form.channel}
              onChange={(e) => onChange({ channel: e.target.value })}
            />
          </label>
          <label>
            Owner
            <Input
              value={form.owner}
              onChange={(e) => onChange({ owner: e.target.value })}
            />
          </label>
          <label>
            Track
            <OmaSelect
              value={form.track}
              onChange={(track) => onChange({ track })}
              options={[
                { value: 'ORGANIC', label: 'Organic' },
                { value: 'PAID', label: 'Paid' },
              ]}
            />
          </label>
          <label>
            Media
            <OmaSelect
              value={form.previewAsset}
              onChange={(previewAsset) => onChange({ previewAsset })}
              options={Object.entries(P3_MEDIA).map(([id, src]) => ({
                value: src,
                label: id,
              }))}
            />
          </label>
          <label>
            Brief
            <TextArea
              rows={1}
              value={form.brief}
              onChange={(e) => onChange({ brief: e.target.value })}
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="oma-compose-error">
            {error}
          </p>
        ) : null}

        <div className="oma-compose-footer">
          <div className="oma-compose-meta">
            <ClockCircleOutlined />
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="MMM DD, HH:mm"
              value={form.plannedDate ? dayjs(form.plannedDate) : null}
              onChange={(_, dateString) =>
                onChange({
                  plannedDate: Array.isArray(dateString)
                    ? (dateString[0] ?? '')
                    : dateString,
                })
              }
              suffixIcon={<DownOutlined style={{ fontSize: 10 }} />}
            />
            <span className="oma-compose-tz">(Asia: Jerusalem)</span>
          </div>
          <div className="oma-compose-actions">
            <button type="button" className="oma-compose-view" aria-label="Preview">
              <EyeOutlined />
            </button>
            <button
              type="button"
              className="oma-compose-save"
              disabled={creating}
              data-testid="demo-create-content-submit"
              onClick={onSubmit}
            >
              <span>{creating ? 'Saving…' : 'Save draft'}</span>
              <span className="oma-compose-save__caret">
                <DownOutlined style={{ fontSize: 10 }} />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
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
  const [filterSection, setFilterSection] = useState<string | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [dayNotes, setDayNotes] = useState<Record<string, { text: string; color: string }>>({});
  const [noteColorOpen, setNoteColorOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const [noteDay, setNoteDay] = useState<string | null>(null);
  const [approvalMode, setApprovalMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [extCalOpen, setExtCalOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(true);
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
    if (!cardMenuId && !viewMenuOpen && !extCalOpen) return;
    const onDoc = () => {
      setCardMenuId(null);
      setViewMenuOpen(false);
      setExtCalOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [cardMenuId, viewMenuOpen, extCalOpen]);


  useEffect(() => {
    setHeaderSlot(document.getElementById('oma-content-top-actions'));
  }, []);

  /* Path view slot in shell: click opens view switcher card */
  useEffect(() => {
    const el = document.getElementById('oma-content-view-slot');
    if (!el) return;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.style.cursor = 'pointer';
    const open = (e: Event) => {
      e.stopPropagation();
      setViewMenuOpen((v) => !v);
    };
    el.addEventListener('click', open);
    return () => el.removeEventListener('click', open);
  }, []);

  /* Keep Planable path view label in shell breadcrumb in sync */
  useEffect(() => {
    const el = document.getElementById('oma-content-view-slot');
    if (!el) return;
    const label = t(`demo.view.${view}`);
    el.textContent = label;
    el.setAttribute('data-view', view);
  }, [view, t]);

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

  function showApprovalQueue() {
    /* Planable: enter selection mode + bottom bar — do NOT filter the grid */
    setApprovalMode(true);
    setSelectedIds([]);
  }

  function toggleSelectId(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function clearSelection() {
    setSelectedIds([]);
    setApprovalMode(false);
  }

  async function sendForApproval() {
    if (!selectedIds.length) return;
    for (const id of selectedIds) {
      try {
        await demoApi(`/content/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ command: 'request-approval' }),
        });
      } catch {
        /* demo continue */
      }
    }
    setSelectedIds([]);
    setApprovalMode(false);
    toast.push(isAr ? 'تم إرسال طلب الموافقة' : 'Approval request sent', 'success');
    void load();
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

  const toggleFilterSection = (id: string) => {
    setFilterSection((s) => (s === id ? null : id));
  };

  const advancedFilterFields = (
    <div className="oma-filter-accordion-list" data-testid="demo-content-filter-sheet-fields">
      {/* Approval Status */}
      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'approval' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('approval')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden>✓</span>
          <span>{isAr ? 'حالة الموافقة' : 'Approval Status'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'approval' ? '▴' : '▾'}</span>
        </button>
        {filterSection === 'approval' ? (
          <div className="oma-filter-accordion__body">
            {(
              [
                { value: 'all', label: t('demo.filter.all') },
                { value: 'NOT_REQUESTED', label: t('demo.content.approval.notRequested') },
                { value: 'PENDING', label: t('demo.content.approval.pending') },
                { value: 'PARTIALLY_APPROVED', label: t('demo.content.approval.partial') },
                { value: 'APPROVED', label: t('demo.content.approval.approved') },
              ] as const
            ).map((opt) => (
              <label key={opt.value} className="oma-filter-check">
                <input
                  type="checkbox"
                  checked={(filters.approval || 'all') === opt.value}
                  onChange={() => setFilters((f) => ({ ...f, approval: opt.value }))}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>

      {/* Post Status */}
      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'status' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('status')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden>◷</span>
          <span>{isAr ? 'حالة المنشور' : 'Post Status'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'status' ? '▴' : '▾'}</span>
        </button>
        {filterSection === 'status' ? (
          <div className="oma-filter-accordion__body">
            <label className="oma-filter-check">
              <input
                type="checkbox"
                checked={!filters.status || filters.status === 'all'}
                onChange={() => setFilters((f) => ({ ...f, status: 'all' }))}
              />
              <span>{t('demo.filter.all')}</span>
            </label>
            {statuses.map((s) => (
              <label key={s} className="oma-filter-check">
                <input
                  type="checkbox"
                  checked={filters.status === s}
                  onChange={() =>
                    setFilters((f) => ({ ...f, status: f.status === s ? 'all' : s }))
                  }
                />
                <span>{statusLabel(s, locale)}</span>
                <span className="oma-filter-check__count">{rows.filter((r) => r.status === s).length}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>

      {/* Campaign */}
      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'campaign' ? 'true' : 'false'}
          data-testid="demo-content-filter-campaign-section"
          onClick={() => toggleFilterSection('campaign')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden>⚑</span>
          <span>{isAr ? 'الحملة' : 'Campaign'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'campaign' ? '▴' : '▾'}</span>
        </button>
        {filterSection === 'campaign' ? (
          <div className="oma-filter-accordion__body">
            <label className="oma-filter-check">
              <input
                type="checkbox"
                checked={!filters.campaignId || filters.campaignId === 'all'}
                onChange={() => {
                  setFilters((f) => ({ ...f, campaignId: 'all' }));
                  replaceParams((params) => {
                    params.delete('campaign');
                  });
                }}
              />
              <span>{isAr ? 'بدون حملة / الكل' : 'No Campaign / All'}</span>
              <span className="oma-filter-check__count">{rows.filter((r) => !r.campaignId).length}</span>
            </label>
            {campaigns.map((c) => (
              <label key={c.id} className="oma-filter-check">
                <input
                  type="checkbox"
                  checked={filters.campaignId === c.id}
                  onChange={() => {
                    const next = filters.campaignId === c.id ? 'all' : c.id;
                    setFilters((f) => ({ ...f, campaignId: next }));
                    replaceParams((params) => {
                      if (next === 'all') params.delete('campaign');
                      else params.set('campaign', next);
                    });
                  }}
                />
                <span>{pickCopy(c.name, locale)}</span>
                <span className="oma-filter-check__count">
                  {rows.filter((r) => r.campaignId === c.id).length}
                </span>
              </label>
            ))}
          </div>
        ) : null}
      </div>

      {/* Post Type */}
      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'postType' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('postType')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden>▦</span>
          <span>{isAr ? 'نوع المنشور' : 'Post Type'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'postType' ? '▴' : '▾'}</span>
        </button>
        {filterSection === 'postType' ? (
          <div className="oma-filter-accordion__body">
            <label className="oma-filter-check">
              <input
                type="checkbox"
                checked={!filters.contentType || filters.contentType === 'all'}
                onChange={() => setFilters((f) => ({ ...f, contentType: 'all' }))}
              />
              <span>{t('demo.filter.all')}</span>
            </label>
            {types.map((ty) => (
              <label key={ty} className="oma-filter-check">
                <input
                  type="checkbox"
                  checked={filters.contentType === ty}
                  onChange={() =>
                    setFilters((f) => ({
                      ...f,
                      contentType: f.contentType === ty ? 'all' : ty,
                    }))
                  }
                />
                <span>
                  {ty === 'POST' ? 'Posts' : ty === 'STORY' ? 'Stories' : ty === 'REEL' ? 'Reels' : ty}
                </span>
                <span className="oma-filter-check__count">
                  {rows.filter((r) => r.contentType === ty).length}
                </span>
              </label>
            ))}
          </div>
        ) : null}
      </div>

      {/* Channel / Brand */}
      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'channel' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('channel')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden>◎</span>
          <span>{isAr ? 'القناة والعلامة' : 'Channel & Brand'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'channel' ? '▴' : '▾'}</span>
        </button>
        {filterSection === 'channel' ? (
          <div className="oma-filter-accordion__body">
            <p className="oma-content-filter-eyebrow">{isAr ? 'القناة' : 'Channel'}</p>
            <label className="oma-filter-check">
              <input
                type="checkbox"
                checked={!filters.channel || filters.channel === 'all'}
                onChange={() => setFilters((f) => ({ ...f, channel: 'all' }))}
              />
              <span>{t('demo.filter.all')}</span>
            </label>
            {channels.map((ch) => (
              <label key={ch} className="oma-filter-check">
                <input
                  type="checkbox"
                  checked={filters.channel === ch}
                  onChange={() =>
                    setFilters((f) => ({ ...f, channel: f.channel === ch ? 'all' : ch }))
                  }
                />
                <span>{ch}</span>
              </label>
            ))}
            <p className="oma-content-filter-eyebrow">{isAr ? 'العلامة' : 'Brand'}</p>
            <label className="oma-filter-check">
              <input
                type="checkbox"
                checked={!filters.brandId || filters.brandId === 'all'}
                onChange={() => setFilters((f) => ({ ...f, brandId: 'all' }))}
              />
              <span>{t('demo.filter.all')}</span>
            </label>
            {brands.map((b) => (
              <label key={b.id} className="oma-filter-check">
                <input
                  type="checkbox"
                  checked={filters.brandId === b.id}
                  onChange={() =>
                    setFilters((f) => ({
                      ...f,
                      brandId: f.brandId === b.id ? 'all' : b.id,
                    }))
                  }
                />
                <span>{pickCopy(b.name, locale)}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>

      {/* Review */}
      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'review' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('review')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden>💬</span>
          <span>{isAr ? 'المراجعة' : 'Feedback & Activity'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'review' ? '▴' : '▾'}</span>
        </button>
        {filterSection === 'review' ? (
          <div className="oma-filter-accordion__body">
            {(
              [
                { value: 'all', label: t('demo.filter.all') },
                { value: 'needs', label: reviewFilterLabel('needs', locale, t('demo.filter.all')) },
                {
                  value: 'approved',
                  label: reviewFilterLabel('approved', locale, t('demo.filter.all')),
                },
              ] as const
            ).map((opt) => (
              <label key={opt.value} className="oma-filter-check">
                <input
                  type="checkbox"
                  checked={(filters.review || 'all') === opt.value}
                  onChange={() => setFilters((f) => ({ ...f, review: opt.value }))}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>

      {/* Author */}
      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'author' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('author')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden>👤</span>
          <span>{isAr ? 'المؤلف' : 'Author'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'author' ? '▴' : '▾'}</span>
        </button>
        {filterSection === 'author' ? (
          <div className="oma-filter-accordion__body">
            <label className="oma-filter-check">
              <input
                type="checkbox"
                checked={!filters.assignee || filters.assignee === 'all'}
                onChange={() => setFilters((f) => ({ ...f, assignee: 'all' }))}
              />
              <span>{t('demo.filter.all')}</span>
            </label>
            {assignees.map((a) => (
              <label key={a} className="oma-filter-check">
                <input
                  type="checkbox"
                  checked={filters.assignee === a}
                  onChange={() =>
                    setFilters((f) => ({ ...f, assignee: f.assignee === a ? 'all' : a }))
                  }
                />
                <span>{a}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>

      {/* Period */}
      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'period' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('period')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden>📅</span>
          <span>{isAr ? 'الفترة' : 'Period'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'period' ? '▴' : '▾'}</span>
        </button>
        {filterSection === 'period' ? (
          <div className="oma-filter-accordion__body">
            <label className="oma-filter-sidepanel__row">
              <span>{isAr ? 'من' : 'Start date'}</span>
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
            <label className="oma-filter-sidepanel__row">
              <span>{isAr ? 'إلى' : 'End date'}</span>
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
          </div>
        ) : null}
      </div>

      {/* Search */}
      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'search' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('search')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden>🔍</span>
          <span>{isAr ? 'بحث في المنشورات' : 'Search in posts'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'search' ? '▴' : '▾'}</span>
        </button>
        {filterSection === 'search' ? (
          <div className="oma-filter-accordion__body">{searchField}</div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="oma-stack oma-content-plan oma-content-plan--tight" data-testid="demo-content">
                  {/* Portal: Filter / Media / Share / Compose into shell header */}
      {headerSlot &&
        createPortal(
          <>
            <button
              type="button"
              className="oma-top-action"
              data-tooltip={isAr ? 'تصفية وترتيب' : 'Filter & sort'}
              onClick={() => setFilterSheet(true)}
              data-testid="demo-content-open-filters"
            >
              <FilterOutlined className="oma-top-action__icon" />
              {isAr ? 'تصفية' : 'Filter'}
              {filterCount > 0 ? ` (${filterCount})` : ''}
            </button>
            <button
              type="button"
              className="oma-top-action"
              data-tooltip={isAr ? 'مكتبة الوسائط' : 'Media library'}
              onClick={() => setMediaLibraryOpen(true)}
              data-testid="demo-content-open-media"
            >
              <PictureOutlined className="oma-top-action__icon" />
              {isAr ? 'الوسائط' : 'Media'}
            </button>
            <button
              type="button"
              className="oma-top-action oma-top-action--ghost"
              data-tooltip={isAr ? 'مشاركة العرض' : 'Share view'}
              onClick={() => void shareContentWorkspace()}
              data-testid="demo-content-share"
            >
              <ShareAltOutlined className="oma-top-action__icon" />
              {isAr ? 'مشاركة' : 'Share'}
            </button>
            <button
              type="button"
              className="oma-top-action oma-top-action--primary"
              data-tooltip={isAr ? 'إنشاء محتوى' : 'Compose'}
              data-testid="demo-create-content"
              onClick={() => setCreateOpen(true)}
            >
              <EditOutlined className="oma-top-action__icon" />
              {isAr ? 'إنشاء' : 'Compose'}
            </button>
          </>,
          headerSlot,
        )}

      {/* View switcher under path — high z-index above calendar toolbar */}
      {viewMenuOpen && typeof document !== 'undefined'
        ? createPortal(
            <ul
              className="oma-view-menu__list oma-view-menu__list--card oma-view-menu__list--path"
              role="menu"
              data-testid="demo-content-view-menu"
            >
              {(
                [
                  { id: 'calendar' as const, icon: <CalendarOutlined />, label: t('demo.view.calendar') },
                  { id: 'feed' as const, icon: <BarsOutlined />, label: t('demo.view.feed') },
                  { id: 'list' as const, icon: <UnorderedListOutlined />, label: t('demo.view.list') },
                  { id: 'grid' as const, icon: <AppstoreOutlined />, label: t('demo.view.grid') },
                ] as const
              ).map(({ id, icon, label }) => (
                <li key={id} role="none">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={view === id}
                    data-selected={view === id ? 'true' : 'false'}
                    data-testid={`demo-content-view-${id}`}
                    className="oma-view-menu__item"
                    onClick={(e) => {
                      e.stopPropagation();
                      setView(id);
                      writeContentViewPref(id);
                      replaceParams((params) => {
                        params.set('view', id);
                      });
                      setViewMenuOpen(false);
                    }}
                  >
                    <span className="oma-view-menu__item-icon" aria-hidden>
                      {icon}
                    </span>
                    <span>{label}</span>
                    <span className="oma-view-menu__check" aria-hidden>
                      {view === id ? '✓' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}




      {/* Search lives in Filter side panel — no extra toolbar under header */}

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
              <div className="oma-cal-toolbar__start">
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
                    type="text"
                    className="oma-cal-nav__btn"
                    aria-label={t('demo.content.prev')}
                    data-testid="demo-content-cal-prev"
                    onClick={() => shiftMonth(-1)}
                  >
                    ‹
                  </Button>
                  <Button
                    type="text"
                    className="oma-cal-nav__btn"
                    aria-label={t('demo.content.next')}
                    data-testid="demo-content-cal-next"
                    onClick={() => shiftMonth(1)}
                  >
                    ›
                  </Button>
                  <strong className="oma-cal-month-label">
                    {monthLabel(cursor.year, cursor.monthIndex, locale)}
                  </strong>
                </div>
              </div>
              <div className="oma-cal-toolbar__end">
                <button
                  type="button"
                  className="oma-cal-request-approvals"
                  data-testid="demo-content-request-approvals"
                  data-tooltip={isAr ? 'طلب موافقات' : 'Request approvals'}
                  onClick={showApprovalQueue}
                >
                  <CheckCircleOutlined />
                  <span>{approvalMode ? (isAr ? 'جاري الطلب…' : 'Requesting approvals') : isAr ? 'طلب الموافقات' : 'Request approvals'}</span>
                </button>
                <span className="oma-cal-ext-wrap">
                  <button
                    type="button"
                    className="oma-cal-ext-indicator"
                    data-tooltip={isAr ? 'تقويمات خارجية' : 'External calendars'}
                    onClick={() => setExtCalOpen((v) => !v)}
                    data-testid="demo-content-ext-cal"
                  >
                    <span className="oma-cal-ext-dot" aria-hidden />
                    1 calendar
                  </button>
                  {extCalOpen ? (
                    <div className="oma-ext-cal-pop" data-testid="demo-content-ext-cal-pop">
                      <div className="oma-ext-cal-pop__head">
                        <strong>External calendars</strong>
                        <span className="oma-ext-cal-pop__sync">Synced</span>
                      </div>
                      <label className="oma-ext-cal-pop__row">
                        <input type="checkbox" defaultChecked />
                        <span className="oma-cal-ext-dot" aria-hidden />
                        Israel Holidays
                      </label>
                      <button type="button" className="oma-ext-cal-pop__add">
                        + Add external calendar
                      </button>
                    </div>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="oma-cal-saved-toggle"
                  data-testid="demo-content-saved-toggle"
                  onClick={() => setSavedOpen((v) => !v)}
                >
                  Saved
                </button>
              </div>
            </div>


            {/* Planable campaign span bars */}
            <div className="oma-cal-campaign-rails" data-testid="demo-content-campaign-bars">
              {campaigns.slice(0, 3).map((c) => (
                <div key={c.id} className="oma-cal-campaign-bar" title={pickCopy(c.name, locale)}>
                  <span className="oma-cal-campaign-bar__icon" aria-hidden>
                    ▢
                  </span>
                  <span className="oma-cal-campaign-bar__name">{pickCopy(c.name, locale)}</span>
                </div>
              ))}
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
              {Array.from({ length: Math.ceil(visibleCells.length / 7) }, (_, wi) => {
                const week = visibleCells.slice(wi * 7, wi * 7 + 7);
                if (!week.length) return null;
                const weekStart = week[0]!.key;
                const weekEnd = week[week.length - 1]!.key;
                const weekCampaigns = campaigns.filter((c) => {
                  const s = c.timeline?.start;
                  const e = c.timeline?.end;
                  if (!s || !e) return false;
                  return s <= weekEnd && e >= weekStart;
                });
                return (
                  <div key={`week-${weekStart}`} className="oma-cal-week" style={{ display: 'contents' }}>
                    {weekCampaigns.map((c) => {
                      const s = c.timeline.start;
                      const e = c.timeline.end;
                      const first = week.findIndex((cell) => cell.key >= s && cell.key <= e);
                      let last = -1;
                      week.forEach((cell, idx) => {
                        if (cell.key >= s && cell.key <= e) last = idx;
                      });
                      if (first < 0 || last < 0) return null;
                      return (
                        <div
                          key={`camp-${c.id}-${weekStart}`}
                          className="oma-cal-campaign-bar oma-cal-campaign-bar--span"
                          style={{ gridColumn: `${first + 1} / ${last + 2}` }}
                          title={pickCopy(c.name, locale)}
                        >
                          <span className="oma-cal-campaign-bar__icon" aria-hidden>
                            ▢
                          </span>
                          <span className="oma-cal-campaign-bar__name">{pickCopy(c.name, locale)}</span>
                        </div>
                      );
                    })}
                    {week.map((cell) => {
                      const items = byDay.get(cell.key) ?? [];
                      const { visible, extra } = splitCellItems(items);
                      const note = dayNotes[cell.key];
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
                            <div
                              key={item.id}
                              className="oma-cal-item-wrap"
                              onMouseEnter={(e) => {
                                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setCardMenuId(item.id);
                                setMenuPos({ top: r.top, left: r.right + 4 });
                              }}
                              onMouseLeave={() => {
                                window.setTimeout(() => {
                                  setCardMenuId(null);
                                  setMenuPos(null);
                                }, 180);
                              }}
                            >
                        
      {cardMenuId && menuPos
        ? createPortal(
            <div
              className="oma-card-menu oma-card-menu--float"
              role="menu"
              data-testid="demo-content-card-menu"
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                zIndex: 9999,
              }}
              onMouseEnter={() => {
                /* keep open while pointer on menu */
              }}
              onMouseLeave={() => {
                setCardMenuId(null);
                setMenuPos(null);
              }}
            >
              {(
                [
                  { id: 'campaign', label: isAr ? 'إضافة إلى حملة' : 'Add to campaign', icon: <FlagOutlined /> },
                  { id: 'labels', label: isAr ? 'إدارة التصنيفات' : 'Manage labels', icon: <FormOutlined /> },
                  { id: 'repost', label: isAr ? 'إعادة نشر' : 'Repost', icon: <SyncOutlined /> },
                  { id: 'hide', label: isAr ? 'إخفاء عن العملاء' : 'Hide from clients', icon: <EyeInvisibleOutlined /> },
                  { id: 'published', label: isAr ? 'تعليم كمنشور' : 'Mark as published', icon: <CheckOutlined /> },
                  { id: 'link', label: isAr ? 'نسخ رابط المشاركة' : 'Copy public share link', icon: <LinkOutlined /> },
                  { id: 'copy', label: isAr ? 'نسخ إلى…' : 'Copy to…', icon: <CopyOutlined /> },
                  { id: 'archive', label: isAr ? 'أرشفة' : 'Archive post', icon: <InboxOutlined /> },
                ] as const
              ).map((row) => (
                <button
                  key={row.id}
                  type="button"
                  role="menuitem"
                  className="oma-card-menu__item"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (row.id === 'published' && cardMenuId) {
                      setSelectedId(cardMenuId);
                      void runCommand('request-approval');
                    }
                    if (row.id === 'link') {
                      void navigator.clipboard?.writeText(window.location.href);
                      toast.push(isAr ? 'تم نسخ الرابط' : 'Link copied', 'success');
                    }
                    if (row.id === 'hide' || row.id === 'campaign' || row.id === 'labels') {
                      /* demo no-op with feedback */
                      toast.push(row.label, 'success');
                    }
                    setCardMenuId(null);
                    setMenuPos(null);
                  }}
                >
                  <span className="oma-card-menu__item-ico">{row.icon}</span>
                  <span>{row.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}

      {approvalMode ? (
                                <label className="oma-cal-select" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(item.id)}
                                    onChange={() => toggleSelectId(item.id)}
                                  />
                                </label>
                              ) : null}
                              <SurfaceButton
                                data-status={item.status}
                                data-testid={`demo-cal-item-${item.id}`}
                                data-selected={
                                  selectedId === item.id || selectedIds.includes(item.id)
                                    ? 'true'
                                    : 'false'
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (approvalMode) {
                                    toggleSelectId(item.id);
                                    return;
                                  }
                                  openItem(item);
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setCardMenuId(item.id);
                                  setMenuPos({ top: r.top, left: r.right + 4 });
                                }}
                                className="oma-cal-item"
                              >
                                <ContentFace
                                  variant="calendar"
                                  title={pickCopy(item.title, locale)}
                                  caption={item.caption ? pickCopy(item.caption, locale) : ''}
                                  channel={item.channel}
                                  when={
                                    item.scheduledAt
                                      ? item.scheduledAt.slice(11, 16)
                                      : item.plannedAt
                                        ? String(item.plannedAt).slice(11, 16) ||
                                          String(item.plannedAt).slice(0, 5)
                                        : '—'
                                  }
                                  asset={item.previewAsset}
                                  display={faceDisplay(item, policy)}
                                  locale={locale}
                                  selected={selectedId === item.id}
                                />
                              </SurfaceButton>
                            </div>
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
                          {(note || noteDay === cell.key) ? (
                            <div
                              className="oma-cal-note oma-cal-note--inline"
                              data-color={(note?.color ?? dayNotes[cell.key]?.color) || 'yellow'}
                              data-active={noteDay === cell.key ? 'true' : 'false'}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <textarea
                                className="oma-cal-note__input"
                                placeholder={isAr ? 'اكتب ملاحظة خاصة…' : 'Type a private note…'}
                                value={dayNotes[cell.key]?.text ?? ''}
                                rows={3}
                                autoFocus={noteDay === cell.key && !isMobile}
                                onChange={(e) => {
                                  const text = e.target.value;
                                  setDayNotes((prev) => ({
                                    ...prev,
                                    [cell.key]: {
                                      text,
                                      color: prev[cell.key]?.color ?? 'yellow',
                                    },
                                  }));
                                }}
                                onFocus={() => {
                                  setNoteDay(cell.key);
                                  if (isMobile) setNoteColorOpen(false);
                                }}
                              />
                              <div className="oma-cal-note__actions">
                                <button
                                  type="button"
                                  className="oma-cal-note__action"
                                  data-tooltip={isAr ? 'لون الملاحظة' : 'Note color'}
                                  aria-label="Color"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNoteDay(cell.key);
                                    setNoteColorOpen((v) => !v);
                                  }}
                                >
                                  <span
                                    className="oma-cal-note__color-dot"
                                    data-color={dayNotes[cell.key]?.color ?? 'yellow'}
                                  />
                                  <DownOutlined className="oma-cal-note__action-ico" />
                                </button>
                                <button
                                  type="button"
                                  className="oma-cal-note__action"
                                  data-tooltip={isAr ? 'تعديل' : 'Edit'}
                                  aria-label="Edit"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNoteDay(cell.key);
                                    // focus textarea
                                    const ta = (e.currentTarget.closest('.oma-cal-note') as HTMLElement | null)?.querySelector(
                                      'textarea',
                                    );
                                    ta?.focus();
                                  }}
                                >
                                  <FormOutlined className="oma-cal-note__action-ico" />
                                </button>
                                <button
                                  type="button"
                                  className="oma-cal-note__action"
                                  data-tooltip={isAr ? 'مرئي لك فقط' : 'Only visible to you'}
                                  aria-label="Private"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <LockOutlined className="oma-cal-note__action-ico" />
                                </button>
                                <button
                                  type="button"
                                  className="oma-cal-note__action"
                                  data-tooltip={isAr ? 'حذف' : 'Delete'}
                                  aria-label="Delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDayNotes((prev) => {
                                      const next = { ...prev };
                                      delete next[cell.key];
                                      return next;
                                    });
                                    setNoteDay(null);
                                    setNoteColorOpen(false);
                                  }}
                                >
                                  <DeleteOutlined className="oma-cal-note__action-ico" />
                                </button>
                              </div>
                              {noteDay === cell.key && noteColorOpen ? (
                                <div className="oma-cal-note__swatches" role="listbox">
                                  {['yellow', 'mint', 'pink', 'lavender', 'blue'].map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      className="oma-cal-note-swatch"
                                      data-color={c}
                                      data-active={
                                        (dayNotes[cell.key]?.color ?? 'yellow') === c ? 'true' : 'false'
                                      }
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDayNotes((prev) => ({
                                          ...prev,
                                          [cell.key]: {
                                            text: prev[cell.key]?.text ?? '',
                                            color: c,
                                          },
                                        }));
                                        setNoteColorOpen(false);
                                      }}
                                      aria-label={c}
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="oma-cal-cell-actions">
                            <button
                              type="button"
                              className="oma-cal-cell-actions__btn"
                              data-testid={`demo-cal-post-${cell.key}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDay(cell.key);
                                setCreateForm((f) => ({ ...f, plannedDate: cell.key }));
                                setCreateOpen(true);
                              }}
                            >
                              ✎ Post
                            </button>
                            <button
                              type="button"
                              className="oma-cal-cell-actions__btn"
                              data-testid={`demo-cal-note-${cell.key}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDay(cell.key);
                                setDayNotes((prev) =>
                                  prev[cell.key]
                                    ? prev
                                    : { ...prev, [cell.key]: { text: '', color: 'mint' } },
                                );
                                setNoteDay(cell.key);
                              }}
                              title={isAr ? 'مرئي لك فقط' : 'Only visible to you'}
                            >
                              🗒 Note
                            </button>
                          </div>
                        </div>
                      );
                    })}
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

          {savedOpen ? (
          <aside data-testid="demo-content-saved" aria-label={t('demo.content.savedColumn')}>
            <header className="oma-cal-saved-head">
              <strong>{t('demo.content.savedColumn')}</strong>
              <div className="oma-cal-saved-head__meta">
                {savedItems.length > 0 ? (
                  <span className="oma-muted oma-ltr">{savedItems.length}</span>
                ) : null}
                <button
                  type="button"
                  className="oma-cal-saved-close"
                  aria-label="Close"
                  onClick={() => setSavedOpen(false)}
                >
                  ×
                </button>
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
          ) : null}
        </section>
      ) : null}

      {!loading && !unavailable && !error && filtered.length > 0 && view === 'feed' ? (
        <div className="oma-content-feed" data-testid="demo-content-feed">
          {filtered.map((item) => {
            const when = item.scheduledAt
              ? item.scheduledAt.slice(0, 16).replace('T', ', ')
              : item.plannedAt
                ? String(item.plannedAt).slice(0, 16).replace('T', ', ')
                : '—';
            const title = pickCopy(item.title, locale);
            const caption = item.caption ? pickCopy(item.caption, locale) : '';
            return (
              <div
                key={item.id}
                className="oma-feed-card"
                data-testid={`demo-content-card-${item.id}`}
                data-selected={selectedId === item.id ? 'true' : 'false'}
              >
                <div className="oma-feed-card__rail" aria-hidden>
                  <button type="button" className="oma-feed-card__status" tabIndex={-1}>✓</button>
                  <span className="oma-feed-card__channel">{channelMarker(item.channel)}</span>
                </div>
                <SurfaceButton
                  onClick={() => openItem(item)}
                  className="oma-feed-card__body"
                  style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
                >
                  <span className="oma-feed-card__head">
                    <span className="oma-feed-card__date">
                      <span className="oma-ltr">{when}</span>
                      <span aria-hidden> ▾</span>
                    </span>
                    <span className="oma-feed-card__menu" aria-hidden>…</span>
                  </span>
                  <span className="oma-feed-card__title">{title}</span>
                  {caption ? <span className="oma-feed-card__caption">{caption}</span> : null}
                </SurfaceButton>
                <div className="oma-feed-card__comment" onClick={() => openItem(item)}>
                  <span className="oma-feed-card__comment-dot">
                    {commentsForContent(tasks, deliverables, item.id).length}
                  </span>
                  <span>Say something…</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!loading && !unavailable && !error && filtered.length > 0 && view === 'list' ? (
        <div className="oma-plan-list" data-testid="demo-content-list">
          <div className="oma-plan-list__head">
            <label className="oma-plan-list__select-all">
              <input
                type="checkbox"
                checked={selectedIds.length > 0 && selectedIds.length === sorted.length}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(sorted.map((r) => r.id));
                  else setSelectedIds([]);
                }}
              />
              <span>
                {isAr ? `تحديد الكل (${sorted.length})` : `Select all (${sorted.length})`}
              </span>
            </label>
            <button
              type="button"
              className="oma-plan-list__sort"
              onClick={() => toggleSort('date')}
            >
              {isAr ? 'آخر إنشاء' : 'Last created'} {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          <div className="oma-plan-list__body">
            {sorted.map((item) => {
              const when = item.scheduledAt
                ? item.scheduledAt.slice(0, 16).replace('T', ', ')
                : item.plannedAt
                  ? String(item.plannedAt).slice(0, 16).replace('T', ', ')
                  : '—';
              const selected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="oma-plan-list__row"
                  data-testid={`demo-content-card-${item.id}`}
                  data-selected={selected ? 'true' : 'false'}
                  onClick={() => openItem(item)}
                >
                  <label
                    className="oma-plan-list__check"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelectId(item.id)}
                    />
                  </label>
                  <div className="oma-plan-list__thumb" aria-hidden>
                    {item.previewAsset ? (
                      <img src={item.previewAsset} alt="" />
                    ) : (
                      <span className="oma-plan-list__thumb-ph">▣</span>
                    )}
                  </div>
                  <div className="oma-plan-list__main">
                    <div className="oma-plan-list__page">
                      <span className="oma-plan-list__page-ico" aria-hidden>
                        ▣
                      </span>
                      <span className="oma-plan-list__page-name">{item.channel || 'Osama page'}</span>
                    </div>
                    <div className="oma-plan-list__title">{pickCopy(item.title, locale)}</div>
                  </div>
                  <div className="oma-plan-list__mid" aria-hidden>
                    <span className="oma-plan-list__ico" data-tooltip={isAr ? 'منشور متكرر' : 'Post is recurring'}>
                      <SyncOutlined />
                    </span>
                  </div>
                  <div className="oma-plan-list__hover">
                    <button
                      type="button"
                      className="oma-plan-list__ico-btn"
                      data-tooltip={isAr ? 'موافقة' : 'Approve'}
                      onClick={(e) => {
                        e.stopPropagation();
                        void runCommand('request-approval');
                      }}
                    >
                      <CheckOutlined />
                    </button>
                    <button
                      type="button"
                      className="oma-plan-list__ico-btn"
                      data-tooltip={isAr ? 'إخفاء عن العملاء' : 'Hide from clients'}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <EyeInvisibleOutlined />
                    </button>
                    <button
                      type="button"
                      className="oma-plan-list__ico-btn"
                      data-tooltip={isAr ? 'نسخ الرابط' : 'Copy link'}
                      onClick={(e) => {
                        e.stopPropagation();
                        void navigator.clipboard?.writeText(window.location.href);
                        toast.push(isAr ? 'تم نسخ الرابط' : 'Link copied', 'success');
                      }}
                    >
                      <LinkOutlined />
                    </button>
                    <button
                      type="button"
                      className="oma-plan-list__ico-btn"
                      data-tooltip={isAr ? 'المزيد' : 'More'}
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setCardMenuId(item.id);
                        setMenuPos({ top: r.bottom + 4, left: r.right - 220 });
                      }}
                    >
                      <MoreOutlined />
                    </button>
                  </div>
                  <div className="oma-plan-list__when oma-ltr">{when}</div>
                </div>
              );
            })}
          </div>
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

      {filterSheet ? (
        <>
          <button
            type="button"
            className="oma-filter-backdrop"
            aria-label="Close filters"
            onClick={() => setFilterSheet(false)}
          />
          <aside
            className="oma-filter-sidepanel"
            data-testid="demo-content-filter-sheet"
            role="dialog"
            aria-label="Filter & sort"
          >
            <header className="oma-filter-sidepanel__head">
              <strong>{isAr ? 'تصفية وترتيب' : 'Filter & sort'}</strong>
              <button
                type="button"
                className="oma-filter-sidepanel__close"
                onClick={() => setFilterSheet(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="oma-filter-sidepanel__body">
              <p className="oma-content-filter-eyebrow">{isAr ? 'ترتيب حسب' : 'SORT BY'}</p>
              <label className="oma-filter-sidepanel__row">
                <span>{isAr ? 'حقل الترتيب' : 'Sort field'}</span>
                <OmaSelect
                  value={sortKey}
                  onChange={(value) => setSortKey(value as ContentSortKey)}
                  options={[
                    { value: 'date', label: isAr ? 'التاريخ' : 'Date' },
                    { value: 'updated', label: isAr ? 'آخر تحديث' : 'Last updated' },
                    { value: 'title', label: isAr ? 'العنوان' : 'Title' },
                    { value: 'channel', label: isAr ? 'القناة' : 'Channel' },
                    { value: 'campaign', label: isAr ? 'الحملة' : 'Campaign' },
                    { value: 'owner', label: isAr ? 'المسؤول' : 'Author' },
                    { value: 'status', label: isAr ? 'الحالة' : 'Status' },
                  ]}
                />
              </label>
              <label className="oma-filter-sidepanel__row">
                <span>{isAr ? 'الاتجاه' : 'Direction'}</span>
                <OmaSelect
                  value={sortDir}
                  onChange={(value) => setSortDir(value as 'asc' | 'desc')}
                  options={[
                    { value: 'desc', label: isAr ? 'الأحدث أولاً' : 'Newest first' },
                    { value: 'asc', label: isAr ? 'الأقدم أولاً' : 'Oldest first' },
                  ]}
                />
              </label>
              <div className="oma-content-filter-divider" />
              <p className="oma-content-filter-eyebrow">{isAr ? 'تصفية حسب' : 'FILTER BY'}</p>
              {advancedFilterFields}
            </div>
            <footer className="oma-filter-sidepanel__foot">
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
            </footer>
          </aside>
        </>
      ) : null}

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


      {selectedIds.length > 0 ? (
        <div className="oma-plan-selbar" data-testid="demo-content-approval-bar">
          <div className="oma-plan-selbar__top">
            <button
              type="button"
              className="oma-plan-selbar__close"
              onClick={clearSelection}
              aria-label="Close"
            >
              <CloseOutlined />
            </button>
            <span className="oma-plan-selbar__badge">{selectedIds.length}</span>
            <span className="oma-plan-selbar__label">
              {selectedIds.length === 1
                ? isAr
                  ? 'منشور محدد'
                  : 'Post selected'
                : isAr
                  ? 'منشورات محددة'
                  : 'Posts selected'}
            </span>
            <button
              type="button"
              className="oma-plan-selbar__link"
              onClick={() => setSelectedIds(sorted.map((r) => r.id))}
            >
              {isAr ? 'تحديد الكل' : 'Select all'}
            </button>
          </div>
          <div className="oma-plan-selbar__actions">
            <button
              type="button"
              className="oma-plan-selbar__btn"
              disabled={saving}
              onClick={() => void runCommand('request-approval')}
            >
              <CheckOutlined /> {isAr ? 'موافقة' : 'Approve'}
            </button>
            <button
              type="button"
              className="oma-plan-selbar__btn"
              disabled={saving || selectedIds.length === 0}
              onClick={() => void sendForApproval()}
            >
              <FlagOutlined /> {isAr ? 'طلب موافقة' : 'Request approval'}
            </button>
            <button type="button" className="oma-plan-selbar__btn" onClick={() => undefined}>
              <CopyOutlined /> {isAr ? 'نسخ إلى…' : 'Copy to…'}
            </button>
            <button
              type="button"
              className="oma-plan-selbar__icon"
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setCardMenuId(selectedIds[0] ?? null);
                setMenuPos({ top: r.top - 8, left: r.left });
              }}
            >
              <MoreOutlined />
            </button>
            <button type="button" className="oma-plan-selbar__icon" onClick={() => undefined}>
              <InboxOutlined />
            </button>
            <button
              type="button"
              className="oma-plan-selbar__icon"
              onClick={() => {
                clearSelection();
              }}
            >
              <DeleteOutlined />
            </button>
          </div>
        </div>
      ) : null}

      {/* Planable private note editor */}
                  {/* Mobile note editor modal */}
      {noteDay && isMobile
        ? createPortal(
            <div className="oma-cal-note-modal" data-testid="demo-content-note-modal">
              <button
                type="button"
                className="oma-cal-note-modal__backdrop"
                aria-label="Close"
                onClick={() => {
                  setNoteDay(null);
                  setNoteColorOpen(false);
                }}
              />
              <div
                className="oma-cal-note-modal__card"
                data-color={dayNotes[noteDay]?.color ?? 'yellow'}
              >
                <textarea
                  className="oma-cal-note__input"
                  placeholder={isAr ? 'اكتب ملاحظة خاصة…' : 'Type a private note…'}
                  value={dayNotes[noteDay]?.text ?? ''}
                  rows={5}
                  autoFocus
                  onChange={(e) => {
                    const text = e.target.value;
                    setDayNotes((prev) => ({
                      ...prev,
                      [noteDay]: {
                        text,
                        color: prev[noteDay]?.color ?? 'yellow',
                      },
                    }));
                  }}
                />
                <div className="oma-cal-note__actions">
                  <button
                    type="button"
                    className="oma-cal-note__action"
                    data-tooltip={isAr ? 'لون الملاحظة' : 'Note color'}
                    onClick={() => setNoteColorOpen((v) => !v)}
                  >
                    <span
                      className="oma-cal-note__color-dot"
                      data-color={dayNotes[noteDay]?.color ?? 'yellow'}
                    />
                    <DownOutlined />
                  </button>
                  <button type="button" className="oma-cal-note__action" data-tooltip={isAr ? 'مرئي لك فقط' : 'Only visible to you'}>
                    <LockOutlined />
                  </button>
                  <button
                    type="button"
                    className="oma-cal-note__action"
                    data-tooltip={isAr ? 'حذف' : 'Delete'}
                    onClick={() => {
                      setDayNotes((prev) => {
                        const next = { ...prev };
                        delete next[noteDay];
                        return next;
                      });
                      setNoteDay(null);
                    }}
                  >
                    <DeleteOutlined />
                  </button>
                  <button
                    type="button"
                    className="oma-cal-note-modal__done"
                    onClick={() => {
                      setNoteDay(null);
                      setNoteColorOpen(false);
                    }}
                  >
                    {isAr ? 'تم' : 'Done'}
                  </button>
                </div>
                {noteColorOpen ? (
                  <div className="oma-cal-note__swatches oma-cal-note__swatches--below">
                    {['yellow', 'mint', 'pink', 'lavender', 'blue'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="oma-cal-note-swatch"
                        data-color={c}
                        data-active={(dayNotes[noteDay]?.color ?? 'yellow') === c ? 'true' : 'false'}
                        onClick={() => {
                          setDayNotes((prev) => ({
                            ...prev,
                            [noteDay]: { text: prev[noteDay]?.text ?? '', color: c },
                          }));
                          setNoteColorOpen(false);
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}




      <PlanableComposeCard
        open={createOpen}
        creating={creating}
        error={createError}
        form={createForm}
        campaigns={campaigns}
        locale={locale}
        onChange={(patch) => setCreateForm((f) => ({ ...f, ...patch }))}
        onClose={() => setCreateOpen(false)}
        onSubmit={() => void submitCreate()}
      />

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
