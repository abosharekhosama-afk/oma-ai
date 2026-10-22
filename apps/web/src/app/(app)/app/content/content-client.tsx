'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveContentWorkflow, type ApprovalPolicy, type DemoGraph } from '@oma/demo';
import { ContentFace, StatusMark, faceDisplay } from '../../../../components/content/content-card';
import {
  Button,
  DatePicker,
  Input,
  OmaSelect,
  SurfaceButton,
  TextArea,
} from '@oma/ui/controls';
import dayjs from 'dayjs';
import {
  AppstoreOutlined,
  BarsOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  DesktopOutlined,
  DownOutlined,
  UpOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileTextOutlined,
  FilterOutlined,
  FlagOutlined,
  FormOutlined,
  GlobalOutlined,
  HistoryOutlined,
  InboxOutlined,
  LinkOutlined,
  LockOutlined,
  MessageOutlined,
  MobileOutlined,
  MoreOutlined,
  NotificationOutlined,
  PictureOutlined,
  ShareAltOutlined,
  SnippetsOutlined,
  SyncOutlined,
  TagOutlined,
  UnorderedListOutlined,
  UserOutlined,
  TeamOutlined,
  CheckSquareOutlined,
  ApartmentOutlined,
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
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import {
  loadContentWorkspace,
  createContentProduction,
  updateContentProduction,
  requestContentApproval,
  approveContent,
  scheduleContent,
  unscheduleContent,
  archiveContent,
  toContentRow,
  contentApiError,
  listDayNotes,
  upsertDayNote,
  deleteDayNote,
  setClientVisible,
  setContentLabels,
  listContentLabels,
  createContentLabel,
  saveContentAsTemplate,
  listContentTemplates,
  getContentDetail,
  addContentComment,
  requestContentChanges,
  rejectContent,
  markContentPublished,
  listBrandLabels,
  createBrandLabel,
  listBrandTemplates,
  useContentTemplate,
  workflowLabel,
  type ApprovalEvent,
  type ContentCommentDto,
} from '../../../../lib/content-api';
import { createRequest, convertRequestToTask, convertTaskToDeliverable, opsError } from '../../../../lib/ops-api';
import { useLocale, useT } from '../../../../lib/use-locale';

type Campaign = DemoGraph['campaigns'][number];
type Brand = DemoGraph['brands'][number];
type Task = DemoGraph['tasks'][number];
type Deliverable = DemoGraph['deliverables'][number];
type RequestRow = DemoGraph['requests'][number];

/* Planable LIVE_VERIFIED capture window: real "today" for Oct 2026 parity runs. */
const TODAY_KEY = '2026-10-07';
const DEFAULT_YEAR = 2026;
const DEFAULT_MONTH = 9;

/* ── Static demo external calendars (mirrors Planable capture) ── */
const DEMO_EXTERNAL_CALENDARS = [
  { id: 'israel-holidays', name: 'Israel Holidays', enabled: true },
];

/* ── Demo holidays rendered as green chips inside cells (like Planable) ── */
const DEMO_HOLIDAYS: Record<string, string> = {
  '2026-10-26': 'Election Day',
  '2026-11-01': 'Aliyah Day School Observance',
  '2026-12-06': 'Asarah B’Tevet (Tenth of Tevet)',
  '2026-12-24': 'Catholic/Protestant Christmas Eve',
  '2026-12-25': 'Catholic/Protestant Christmas Day',
  '2026-12-26': 'Catholic/Protestant Boxing Day',
  '2026-12-31': "New Year's Eve",
  '2027-01-01': "New Year's Day",
};

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

/* ── Floating card action menu (Planable right-click hover menu) ── */

type CardMenuAction =
  | 'request'
  | 'approve'
  | 'published'
  | 'changes'
  | 'reject'
  | 'hide'
  | 'ops'
  | 'archive'
  | 'template'
  | 'repost'
  | 'labels';

function CardFloatingMenu({
  open,
  pos,
  itemId,
  locale,
  onAction,
  onClose,
}: {
  open: boolean;
  pos: { top: number; left: number } | null;
  itemId: string | null;
  locale: string;
  onAction: (action: CardMenuAction, id: string) => void;
  onClose: () => void;
}) {
  const isAr = locale.toLowerCase().startsWith('ar');
  const ref = useRef<HTMLDivElement | null>(null);
  const [realPos, setRealPos] = useState<{ top: number; left: number } | null>(pos);

  useEffect(() => {
    if (!open || !pos) {
      setRealPos(null);
      return;
    }
    setRealPos(pos);
  }, [open, pos]);

  /* Clamp within viewport */
  useEffect(() => {
    if (!realPos || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nextLeft = realPos.left;
    let nextTop = realPos.top;
    if (nextLeft + rect.width + 8 > vw) nextLeft = vw - rect.width - 8;
    if (nextTop + rect.height + 8 > vh) nextTop = vh - rect.height - 8;
    if (nextLeft < 8) nextLeft = 8;
    if (nextTop < 8) nextTop = 8;
    if (nextLeft !== realPos.left || nextTop !== realPos.top) {
      setRealPos({ left: nextLeft, top: nextTop });
    }
  }, [realPos]);

  if (!open || !realPos || !itemId) return null;

  return createPortal(
    <div
      ref={ref}
      className="oma-card-menu--float"
      role="menu"
      data-testid="demo-content-card-menu"
      style={{ position: 'fixed', top: realPos.top, left: realPos.left, zIndex: 9999 }}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        role="menuitem"
        className="oma-card-menu__item"
        onClick={() => onAction('request', itemId)}
      >
        <span className="oma-card-menu__item-ico"><SyncOutlined /></span>
        <span>{isAr ? 'طلب موافقة' : 'Request approval'}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="oma-card-menu__item"
        onClick={() => onAction('approve', itemId)}
      >
        <span className="oma-card-menu__item-ico"><CheckOutlined /></span>
        <span>{isAr ? 'الموافقة على المنشور' : 'Approve post'}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="oma-card-menu__item"
        onClick={() => onAction('published', itemId)}
      >
        <span className="oma-card-menu__item-ico"><FlagOutlined /></span>
        <span>{isAr ? 'تم كمنشور' : 'Mark as published'}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="oma-card-menu__item"
        onClick={() => onAction('hide', itemId)}
      >
        <span className="oma-card-menu__item-ico"><EyeInvisibleOutlined /></span>
        <span>{isAr ? 'إخفاء عن العملاء' : 'Hide from clients'}</span>
        <span className="oma-card-menu__badge">✕</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="oma-card-menu__item"
        onClick={() => onAction('archive', itemId)}
      >
        <span className="oma-card-menu__item-ico"><InboxOutlined /></span>
        <span>{isAr ? 'أرشفة المنشور' : 'Archive post'}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="oma-card-menu__item oma-card-menu__item--danger"
        onClick={() => onAction('repost', itemId)}
      >
        <span className="oma-card-menu__item-ico"><CloseOutlined /></span>
        <span>{isAr ? 'إعادة نشر' : 'Repost'}</span>
      </button>
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
  const hoverTimerRef = useRef<number | null>(null);
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
  const [detailSidePanel, setDetailSidePanel] = useState<'none' | 'activity' | 'feedback'>('none');
  const [approvalEvents, setApprovalEvents] = useState<ApprovalEvent[]>([]);
  const [prodComments, setProdComments] = useState<ContentCommentDto[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [brandLabels, setBrandLabels] = useState<{ id: string; name: { en: string; ar: string }; color: string }[]>([]);
  const [brandTemplates, setBrandTemplates] = useState<
    { id: string; name?: { en: string; ar: string }; name_en?: string }[]
  >([]);
  const [labelDraft, setLabelDraft] = useState('');
  const [detailPreviewMode, setDetailPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [detailMoreOpen, setDetailMoreOpen] = useState(false);
  const [approvalTipOpen, setApprovalTipOpen] = useState(false);
  const [publishTipOpen, setPublishTipOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [feedbackTab, setFeedbackTab] = useState<'comments' | 'suggestions'>('comments');

  const [overflowDay, setOverflowDay] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    campaignId: '',
    brandId: '',
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
      const ws = await loadContentWorkspace();
      setRows(ws.content);
      try {
        const primaryBrand = ws.brands[0]?.id;
        if (primaryBrand) {
          const notes = await listDayNotes(primaryBrand);
          const map: Record<string, { text: string; color: string; locked?: boolean }> = {};
          for (const n of notes) {
            map[n.day_key] = {
              text: locale.toLowerCase().startsWith('ar') ? n.text.ar || n.text.en : n.text.en,
              color: n.color,
              locked: n.locked,
            };
          }
          setDayNotes(map);
        }
      } catch {
        /* notes optional */
      }

      setPolicy(ws.policy);
      setCampaigns(ws.campaigns as typeof campaigns);
      setBrands(ws.brands as typeof brands);
      setTasks([]);
      setDeliverables([]);
      setRequests([]);
      setError(null);
      setUnavailable(false);
      setCreateForm((f) => ({
        ...f,
        campaignId: f.campaignId || ws.campaigns[0]?.id || '',
        brandId: f.brandId || ws.brands[0]?.id || ws.campaigns[0]?.brandId || '',
        owner: f.owner || 'Owner',
        track: f.track || ws.campaigns[0]?.track || 'ORGANIC',
      }));
      const stored = readContentViewPref();
      const urlView =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('view')
          : null;
      setView(() => {
        if (isContentViewMode(urlView)) return urlView;
        if (hasContentViewPref() && isContentViewMode(stored)) return stored;
        return 'calendar';
      });
    } catch (err) {
      setError(contentApiError(err, isAr ? 'تعذّر تحميل المحتوى' : 'Failed to load content'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    if (!cardMenuId && !viewMenuOpen && !extCalOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.oma-card-menu--float')) return;
      if (target?.closest('.oma-ext-cal-pop')) return;
      if (target?.closest('[data-testid="demo-content-ext-cal"]')) return;
      setCardMenuId(null);
      setMenuPos(null);
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
    if (!selectedId) {
      setApprovalEvents([]);
      setProdComments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const detail = await getContentDetail(selectedId);
        if (cancelled) return;
        setApprovalEvents(detail.approval_events ?? []);
        setProdComments(detail.comments ?? []);
        if (detail.data) {
          setRows((prev) =>
            prev.map((r) => (r.id === detail.data.id ? toContentRow(detail.data) : r)),
          );
        }
      } catch {
        if (!cancelled) {
          setApprovalEvents([]);
          setProdComments([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const activeBrandId = brands[0]?.id || campaigns[0]?.brandId || '';

  async function persistNote(
    dayKey: string,
    patch: { text?: string; color?: string; locked?: boolean; remove?: boolean },
  ) {
    if (!activeBrandId || !dayKey) return;
    try {
      if (patch.remove) {
        await deleteDayNote(activeBrandId, dayKey);
        setDayNotes((prev) => {
          const next = { ...prev };
          delete next[dayKey];
          return next;
        });
        return;
      }
      const current = dayNotes[dayKey];
      const text = patch.text !== undefined ? patch.text : current?.text ?? '';
      const color = patch.color ?? current?.color ?? 'yellow';
      const locked = patch.locked ?? false;
      await upsertDayNote(activeBrandId, { dayKey, text, color, locked });
      setDayNotes((prev) => ({
        ...prev,
        [dayKey]: { text, color, locked },
      }));
    } catch (err) {
      toast.push(
        contentApiError(err, isAr ? 'تعذّر حفظ الملاحظة' : 'Failed to save note'),
        'danger',
      );
    }
  }

  async function toggleHideFromClients(contentId: string) {
    const row = rows.find((r) => r.id === contentId);
    const currentlyVisible = (row as { clientVisible?: boolean })?.clientVisible !== false;
    try {
      const updated = await setClientVisible(contentId, !currentlyVisible);
      setRows((prev) => prev.map((r) => (r.id === contentId ? toContentRow(updated) : r)));
      toast.push(
        isAr
          ? !currentlyVisible
            ? 'ظاهر للعملاء'
            : 'مخفي عن العملاء'
          : !currentlyVisible
            ? 'Visible to clients'
            : 'Hidden from clients',
        'success',
      );
    } catch (err) {
      toast.push(contentApiError(err, 'Visibility update failed'), 'danger');
    }
  }

  async function saveAsTemplate(contentId: string) {
    if (!activeBrandId) return;
    const row = rows.find((r) => r.id === contentId);
    const name = row ? (isAr ? row.title.ar : row.title.en) : 'Template';
    try {
      await saveContentAsTemplate(activeBrandId, {
        name: `${name} template`,
        fromContentId: contentId,
      });
      toast.push(isAr ? 'تم حفظ القالب' : 'Saved as template', 'success');
    } catch (err) {
      toast.push(contentApiError(err, 'Template save failed'), 'danger');
    }
  }

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
  const detailMeta = { linked, review };
  void detailMeta;

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const current =
      typeof window !== 'undefined'
        ? window.location.search.replace(/^\?/, '')
        : search.toString();
    const params = new URLSearchParams(current);
    mutate(params);
    const qs = params.toString();
    const href = qs ? `/app/content?${qs}` : '/app/content';
    router.replace(href, { scroll: false });
  }

  function openItem(item: ContentRow, tab: 'preview' | 'edit' | 'comments' = 'preview') {
    setDetailSidePanel('none');
    setDetailPreviewMode('desktop');
    setDetailMoreOpen(false);
    setApprovalTipOpen(false);
    setPublishTipOpen(false);
    setEditTitle(pickCopy(item.title, locale));
    setCommentDraft('');
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
      const apiRow = await updateContentProduction(selectedId, {
        caption: mergeLocaleCopy(selected.caption, draft.caption, locale),
        channel: draft.channel,
        plannedAt: draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : null,
      });
      const updated = toContentRow(apiRow);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      const next = draftFromItem(updated, locale);
      setDraft(next);
      setBaseline(next);
      setSaveState('saved');
      toast.push(t('demo.content.saved'), 'success');
    } catch (err) {
      const msg = contentApiError(err, t('demo.create.validation'));
      setSaveError(msg);
      setSaveState('error');
      toast.push(msg, 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function runLifecycle(
    command:
      | 'schedule'
      | 'unschedule'
      | 'request-approval'
      | 'approve'
      | 'request-changes'
      | 'reject'
      | 'mark-published'
      | 'archive',
    contentId?: string | null,
  ) {
    const id = contentId || selectedId;
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    try {
      let apiRow;
      if (command === 'request-approval') {
        apiRow = await requestContentApproval(id);
      } else if (command === 'approve') {
        apiRow = await approveContent(id);
      } else if (command === 'request-changes') {
        apiRow = await requestContentChanges(id);
      } else if (command === 'reject') {
        apiRow = await rejectContent(id);
      } else if (command === 'mark-published') {
        apiRow = await markContentPublished(id);
      } else if (command === 'archive') {
        apiRow = await archiveContent(id);
      } else if (command === 'schedule') {
        const row = rows.find((r) => r.id === id) || selected;
        const when =
          draft.scheduledAt || row?.scheduledAt || row?.plannedAt || new Date().toISOString();
        apiRow = await scheduleContent(id, { scheduledAt: when });
      } else {
        apiRow = await unscheduleContent(id);
      }
      const updated = toContentRow(apiRow);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (selectedId === id) {
        const next = draftFromItem(updated, locale);
        setDraft(next);
        setBaseline(next);
      }
      toast.push(t('demo.content.saved'), 'success');
      void load();
    } catch (err) {
      const msg = contentApiError(err, t('demo.unavailable'));
      setSaveError(msg);
      toast.push(msg, 'danger');
    } finally {
      setSaving(false);
    }
  }

  /** @deprecated alias — prefer runLifecycle */
  async function runCommand(command: 'schedule' | 'unschedule' | 'request-approval') {
    return runLifecycle(command);
  }

  async function convertContentToOps(contentId: string) {
    const row = rows.find((r) => r.id === contentId);
    if (!row) return;
    try {
      const req = await createRequest(row.brandId, {
        title: row.title,
        description: row.caption || row.title,
        type: 'CONTENT',
        campaignId: row.campaignId || null,
        contentId: row.id,
        priority: 'MEDIUM',
        channels: row.channel ? [row.channel] : [],
        formats: [row.contentType],
      });
      const task = await convertRequestToTask(req.id);
      const deliv = await convertTaskToDeliverable(task.id);
      toast.push(
        isAr ? 'تم إنشاء طلب → مهمة → تسليم' : 'Created Request → Task → Deliverable',
        'success',
      );
      return { requestId: req.id, taskId: task.id, deliverableId: deliv.id };
    } catch (err) {
      toast.push(opsError(err, isAr ? 'فشل التحويل' : 'Ops conversion failed'), 'danger');
      return null;
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
      const brandId = createForm.brandId || campaign?.brandId || brands[0]?.id || '';
      if (!brandId) {
        throw new Error(isAr ? 'اختر البراند' : 'Select a brand');
      }
      const apiCreated = await createContentProduction({
        brandId,
        title: { en: createForm.title.trim(), ar: createForm.title.trim() },
        caption: createForm.caption.trim()
          ? { en: createForm.caption.trim(), ar: createForm.caption.trim() }
          : undefined,
        campaignId: createForm.campaignId || null,
        contentType: createForm.contentType,
        channel: createForm.channel.trim(),
        track: createForm.track || campaign?.track || 'ORGANIC',
        plannedAt: createForm.plannedDate ? `${createForm.plannedDate}T10:00:00.000Z` : null,
      });
      let createdRow = toContentRow(apiCreated);
      if (createForm.plannedDate) {
        try {
          const scheduled = await scheduleContent(createdRow.id, {
            scheduledAt: `${createForm.plannedDate}T10:00:00.000Z`,
          });
          createdRow = toContentRow(scheduled);
        } catch {
          /* stay unscheduled if policy blocks */
        }
      }
      toast.push(t('demo.create.successContent'), 'success');
      setCreateOpen(false);
      setCreateForm((f) => ({ ...f, title: '', brief: '', caption: '' }));
      openItem(createdRow, 'edit');
      setRows((prev) => (prev.some((r) => r.id === createdRow.id) ? prev : [createdRow, ...prev]));
      void load();
    } catch (err) {
      const msg = contentApiError(err, t('demo.create.validation'));
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
        await requestContentApproval(id);
      } catch {
        /* continue remaining */
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

  /* ── Card menu action handler (used by hover floating menu) ── */
  function handleCardMenuAction(action: CardMenuAction, id: string) {
    setCardMenuId(null);
    setMenuPos(null);
    if (action === 'request') void runLifecycle('request-approval', id);
    else if (action === 'approve') void runLifecycle('approve', id);
    else if (action === 'published') void runLifecycle('mark-published', id);
    else if (action === 'changes') void runLifecycle('request-changes', id);
    else if (action === 'reject') void runLifecycle('reject', id);
    else if (action === 'hide') void toggleHideFromClients(id);
    else if (action === 'archive') void runLifecycle('archive', id);
    else if (action === 'template') void saveAsTemplate(id);
    else if (action === 'ops') {
      void convertContentToOps(id).then((ids) => {
        if (ids?.requestId) window.location.href = `/app/requests/${ids.requestId}`;
      });
    } else if (action === 'repost') {
      void convertContentToOps(id).then((ids) => {
        if (ids?.deliverableId) window.location.href = `/app/deliverables/${ids.deliverableId}`;
      });
    } else if (action === 'labels') {
      setSelectedId(id);
      const brandId = rows.find((r) => r.id === id)?.brandId || brands[0]?.id;
      if (brandId) {
        void listBrandLabels(brandId)
          .then((labs) => setBrandLabels(labs as typeof brandLabels))
          .catch(() => setBrandLabels([]));
      }
      setLabelPickerOpen(true);
    }
  }

  /* ── Card hover with delay ── */
  function scheduleCardMenu(itemId: string, target: HTMLElement) {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      if (!target.matches(':hover')) return;
      const rect = target.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const menuW = 240;
      const menuH = 340;
      let left = rect.right + 8;
      let top = rect.top;
      if (left + menuW + 8 > vw) left = rect.left - menuW - 8;
      if (left < 8) left = 8;
      if (top + menuH + 8 > vh) top = Math.max(8, vh - menuH - 8);
      setCardMenuId(itemId);
      setMenuPos({ top, left });
    }, 260);
  }

  function cancelCardMenu() {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
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
      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'approval' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('approval')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden><CheckCircleOutlined /></span>
          <span>{isAr ? 'حالة الموافقة' : 'Approval Status'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'approval' ? <UpOutlined /> : <DownOutlined />}</span>
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

      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'status' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('status')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden><ClockCircleOutlined /></span>
          <span>{isAr ? 'حالة المنشور' : 'Post Status'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'status' ? <UpOutlined /> : <DownOutlined />}</span>
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

      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'campaign' ? 'true' : 'false'}
          data-testid="demo-content-filter-campaign-section"
          onClick={() => toggleFilterSection('campaign')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden><FlagOutlined /></span>
          <span>{isAr ? 'الحملة' : 'Campaign'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'campaign' ? <UpOutlined /> : <DownOutlined />}</span>
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

      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'postType' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('postType')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden><AppstoreOutlined /></span>
          <span>{isAr ? 'نوع المنشور' : 'Post Type'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'postType' ? <UpOutlined /> : <DownOutlined />}</span>
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

      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'channel' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('channel')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden><GlobalOutlined /></span>
          <span>{isAr ? 'القناة والعلامة' : 'Channel & Brand'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'channel' ? <UpOutlined /> : <DownOutlined />}</span>
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

      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'review' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('review')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden><MessageOutlined /></span>
          <span>{isAr ? 'المراجعة' : 'Feedback & Activity'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'review' ? <UpOutlined /> : <DownOutlined />}</span>
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

      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'author' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('author')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden><UserOutlined /></span>
          <span>{isAr ? 'المؤلف' : 'Author'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'author' ? <UpOutlined /> : <DownOutlined />}</span>
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

      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'period' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('period')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden><CalendarOutlined /></span>
          <span>{isAr ? 'الفترة' : 'Period'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'period' ? <UpOutlined /> : <DownOutlined />}</span>
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

      <div className="oma-filter-accordion">
        <button
          type="button"
          className="oma-filter-accordion__row"
          data-open={filterSection === 'search' ? 'true' : 'false'}
          onClick={() => toggleFilterSection('search')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden><FilterOutlined /></span>
          <span>{isAr ? 'بحث في المنشورات' : 'Search in posts'}</span>
          <span className="oma-filter-accordion__caret">{filterSection === 'search' ? <UpOutlined /> : <DownOutlined />}</span>
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

      {/* View switcher card under path */}
      {viewMenuOpen && typeof document !== 'undefined'
        ? createPortal(
            <ul
              className="oma-view-menu__list oma-view-menu__list--path"
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
                    <span className="oma-view-menu__item-icon" aria-hidden>{icon}</span>
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
        <div className="oma-content-cal-skeleton" aria-busy="true" aria-label={t('common.loading')}>
          <div className="oma-content-cal-skeleton__toolbar">
            <div className="oma-skeleton oma-content-cal-skeleton__chip" />
            <div className="oma-skeleton oma-content-cal-skeleton__chip" />
            <div className="oma-skeleton oma-content-cal-skeleton__label" />
            <div className="oma-content-cal-skeleton__spacer" />
            <div className="oma-skeleton oma-content-cal-skeleton__btn" />
            <div className="oma-skeleton oma-content-cal-skeleton__btn" />
          </div>
          <div className="oma-content-cal-skeleton__dows">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="oma-skeleton oma-content-cal-skeleton__dow" />
            ))}
          </div>
          <div className="oma-content-cal-skeleton__grid">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="oma-content-cal-skeleton__cell">
                <div className="oma-skeleton oma-content-cal-skeleton__daynum" />
                {i % 4 === 1 ? <div className="oma-skeleton oma-content-cal-skeleton__post" /> : null}
                {i % 7 === 3 ? <div className="oma-skeleton oma-content-cal-skeleton__post oma-content-cal-skeleton__post--sm" /> : null}
              </div>
            ))}
          </div>
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

      {/* ── CALENDAR VIEW ── */}
      {!loading && !unavailable && !error && filtered.length > 0 && view === 'calendar' ? (
        <section
          data-testid="demo-content-calendar"
          className="oma-cal-with-saved"
          data-cal-span={calSpan}
          data-saved-open={savedOpen ? 'true' : 'false'}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setExtCalOpen((v) => !v);
                    }}
                    data-testid="demo-content-ext-cal"
                  >
                    <span className="oma-cal-ext-dot" aria-hidden />
                    {DEMO_EXTERNAL_CALENDARS.filter((c) => c.enabled).length} calendar
                  </button>
                  {extCalOpen ? (
                    <div
                      className="oma-ext-cal-pop"
                      data-testid="demo-content-ext-cal-pop"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="oma-ext-cal-pop__head">
                        <strong>External calendars</strong>
                        <span className="oma-ext-cal-pop__sync">Synced 5h ago ↻</span>
                      </div>
                      {DEMO_EXTERNAL_CALENDARS.map((cal) => (
                        <label key={cal.id} className="oma-ext-cal-pop__row">
                          <input type="checkbox" defaultChecked={cal.enabled} />
                          <span className="oma-cal-ext-dot" aria-hidden />
                          <span>{cal.name}</span>
                          <span className="oma-ext-cal-pop__users" aria-hidden>
                            <TeamOutlined />
                          </span>
                        </label>
                      ))}
                      <button type="button" className="oma-ext-cal-pop__add">
                        <span>+</span>
                        <span>Add external calendar</span>
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
                return (
                  <div key={`week-${weekStart}`} className="oma-cal-week" style={{ display: 'contents' }}>
                    {week.map((cell) => {
                      const items = byDay.get(cell.key) ?? [];
                      const { visible, extra } = splitCellItems(items);
                      const note = dayNotes[cell.key];
                      const holiday = DEMO_HOLIDAYS[cell.key];
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

                          {/* Post/Note hover actions at top */}
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
                              <EditOutlined />
                              <span>{isAr ? 'منشور' : 'Post'}</span>
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
                            >
                              <FileTextOutlined />
                              <span>{isAr ? 'ملاحظة' : 'Note'}</span>
                            </button>
                          </div>

                          {/* Private sticky note — appears ABOVE cards */}
                          {note || noteDay === cell.key ? (
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
                                onBlur={(e) => void persistNote(cell.key, { text: e.target.value })}
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
                                    void persistNote(cell.key, { remove: true });
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
                                        void persistNote(cell.key, { color: c });
                                        setNoteColorOpen(false);
                                      }}
                                      aria-label={c}
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {/* Campaign bar + holiday chip */}
                          {holiday ? (
                            <div className="oma-cal-holiday-chip" title={holiday}>
                              {holiday}
                            </div>
                          ) : null}

                          {/* Post cards */}
                          {visible.map((item) => (
                            <div
                              key={item.id}
                              className="oma-cal-item-wrap"
                              data-selected={selectedId === item.id ? 'true' : 'false'}
                              onMouseEnter={(e) => scheduleCardMenu(item.id, e.currentTarget)}
                              onMouseLeave={() => cancelCardMenu()}
                            >
                              {approvalMode ? (
                                <label
                                  className="oma-cal-select"
                                  onClick={(e) => e.stopPropagation()}
                                >
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
                                data-selected={selectedId === item.id ? 'true' : 'false'}
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
                                  setMenuPos({ top: r.top, left: r.right + 8 });
                                }}
                                className="oma-cal-item"
                              >
                                <div className="oma-cal-card">
                                  <div className="oma-cal-card__row">
                                    <span className="oma-cal-card__channel">
                                      <span className="oma-cal-card__icon" aria-hidden>▣</span>
                                      <span className="oma-cal-card__name">
                                        {item.channel || 'Osama page'}
                                      </span>
                                    </span>
                                    <span className="oma-cal-card__meta">
                                      {item.status === 'DRAFT' ? (
                                        <span className="oma-cal-card__draft">Draft</span>
                                      ) : item.status === 'APPROVED' ? (
                                        <span className="oma-cal-card__green-dot" aria-hidden />
                                      ) : null}
                                      <span className="oma-cal-card__time oma-ltr">
                                        {item.scheduledAt
                                          ? item.scheduledAt.slice(11, 16)
                                          : item.plannedAt
                                            ? String(item.plannedAt).slice(11, 16) || '10:00'
                                            : '16:45'}
                                      </span>
                                    </span>
                                  </div>
                                  <div className="oma-cal-card__title">
                                    {pickCopy(item.title, locale)}
                                  </div>
                                </div>
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
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Mobile agenda (hidden on desktop) */}
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
            <aside
              className="oma-cal-saved"
              data-testid="demo-content-saved"
              aria-label={t('demo.content.savedColumn')}
            >
              <header className="oma-cal-saved-head">
                <strong>{t('demo.content.savedColumn')}</strong>
                <div className="oma-cal-saved-head__meta">
                  {savedItems.length > 0 ? (
                    <span className="oma-muted oma-ltr">{savedItems.length}</span>
                  ) : null}
                  <button
                    type="button"
                    className="oma-cal-saved-close"
                    aria-label={isAr ? 'إغلاق' : 'Close'}
                    data-tooltip={isAr ? 'إغلاق' : 'Close'}
                    onClick={() => setSavedOpen(false)}
                  >
                    <CloseOutlined />
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

      {/* ── FEED VIEW ── */}
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

      {/* ── LIST VIEW ── */}
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
                      <span className="oma-plan-list__page-ico" aria-hidden>▣</span>
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
                        void runLifecycle('approve', item.id);
                      }}
                    >
                      <CheckOutlined />
                    </button>
                    <button
                      type="button"
                      className="oma-plan-list__ico-btn"
                      data-tooltip={isAr ? 'إخفاء عن العملاء' : 'Hide from clients'}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleHideFromClients(item.id);
                      }}
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
                        setMenuPos({ top: r.bottom + 4, left: r.right - 240 });
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

      {/* ── GRID VIEW ── */}
      {!loading && !unavailable && !error && filtered.length > 0 && view === 'grid' ? (
        <div className="oma-plan-grid" data-testid="demo-content-grid">
          {filtered.map((item) => {
            const title = pickCopy(item.title, locale);
            const when = item.scheduledAt
              ? item.scheduledAt.slice(0, 16).replace('T', ' at ')
              : '';
            return (
              <button
                key={item.id}
                type="button"
                className="oma-plan-grid__card"
                data-testid={`demo-content-card-${item.id}`}
                data-selected={selectedId === item.id ? 'true' : 'false'}
                onClick={() => openItem(item)}
              >
                <div className="oma-plan-grid__media">
                  {item.previewAsset ? (
                    <img
                      src={item.previewAsset}
                      alt={mediaAlt(title, item.channel, item.contentType)}
                    />
                  ) : (
                    <span className="oma-plan-grid__ph" aria-hidden>▣</span>
                  )}
                  <div className="oma-plan-grid__shade" />
                  <div className="oma-plan-grid__overlay">
                    {when ? <span className="oma-plan-grid__when oma-ltr">{when}</span> : null}
                    <span className="oma-plan-grid__title">{title}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ── Post detail modal (drawer) ── */}
      <Dialog
        open={Boolean(selected)}
        onClose={requestCloseDrawer}
        title=""
        size="xl"
        className="oma-plan-post-modal"
      >
        {selected ? (
          <div
            className="oma-plan-post"
            data-testid="demo-content-drawer"
            data-detail-tab={detailTab}
            data-review={review?.state ?? ''}
          >
            <aside className="oma-plan-post__rail" aria-hidden>
              <span className="oma-plan-post__rail-ico"><EditOutlined /></span>
            </aside>

            <div className="oma-plan-post__main">
              <header className="oma-plan-post__top">
                <div className="oma-plan-post__top-start">
                  <button type="button" className="oma-plan-post__chip" title={selected.campaignId || undefined}>
                    <FlagOutlined /> {isAr ? 'حملة' : 'Campaign'}
                  </button>
                  <button
                    type="button"
                    className="oma-plan-post__chip"
                    onClick={() => {
                      if (!selectedId) return;
                      const brandId = selected.brandId || brands[0]?.id;
                      if (brandId) {
                        void listBrandLabels(brandId)
                          .then((labs) => setBrandLabels(labs as typeof brandLabels))
                          .catch(() => setBrandLabels([]));
                      }
                      setLabelPickerOpen(true);
                    }}
                  >
                    <TagOutlined /> {isAr ? 'تصنيفات' : 'Labels'}
                  </button>
                </div>
                <div className="oma-plan-post__top-end">
                  <span
                    className="oma-plan-post__approve-count"
                    data-tooltip={isAr ? 'لم تتم الموافقة بعد' : 'Not approved yet'}
                  >
                    <CheckOutlined />
                    <span>0</span>
                  </span>
                  <button
                    type="button"
                    className="oma-plan-post__tool-btn"
                    onClick={() => void shareContentWorkspace()}
                  >
                    {isAr ? 'مشاركة' : 'Share'}
                  </button>
                  <span className="oma-plan-post__chip" data-testid="demo-content-workflow">
                    {workflowLabel(
                      {
                        status: selected.status,
                        approvalState: selected.approvalState,
                        scheduleState: selected.scheduleState,
                      },
                      isAr,
                    )}
                  </span>
                  <button
                    type="button"
                    className="oma-plan-post__icon-btn"
                    data-tooltip={isAr ? 'التعليقات' : 'Feedback'}
                    data-active={detailSidePanel === 'feedback' ? 'true' : 'false'}
                    onClick={() =>
                      setDetailSidePanel((p) => (p === 'feedback' ? 'none' : 'feedback'))
                    }
                  >
                    <MessageOutlined />
                  </button>
                  <button
                    type="button"
                    className="oma-plan-post__icon-btn"
                    data-tooltip={isAr ? 'النشاط' : 'Activity'}
                    data-active={detailSidePanel === 'activity' ? 'true' : 'false'}
                    onClick={() =>
                      setDetailSidePanel((p) => (p === 'activity' ? 'none' : 'activity'))
                    }
                  >
                    <HistoryOutlined />
                  </button>
                  <button
                    type="button"
                    className="oma-plan-post__icon-btn"
                    data-tooltip={isAr ? 'إظهار للعملاء' : 'Make visible to clients'}
                    onClick={() => {
                      if (selectedId) void toggleHideFromClients(selectedId);
                    }}
                  >
                    <EyeInvisibleOutlined />
                  </button>
                  <button
                    type="button"
                    className="oma-plan-post__icon-btn"
                    data-tooltip={isAr ? 'حذف' : 'Delete'}
                    onClick={() => {
                      if (selectedId) void runLifecycle('archive', selectedId);
                    }}
                  >
                    <DeleteOutlined />
                  </button>
                  <div className="oma-plan-post__more-wrap">
                    <button
                      type="button"
                      className="oma-plan-post__icon-btn"
                      onClick={() => setDetailMoreOpen((v) => !v)}
                    >
                      <MoreOutlined />
                    </button>
                    {detailMoreOpen ? (
                      <ul className="oma-plan-post__more-menu" role="menu">
                        <li>
                          <button type="button" role="menuitem" onClick={() => void runLifecycle('request-approval', selectedId)}>
                            <FlagOutlined /> {isAr ? 'طلب موافقة' : 'Request approval'}
                          </button>
                        </li>
                        <li>
                          <button type="button" role="menuitem" onClick={() => void runLifecycle('request-changes', selectedId)}>
                            <EditOutlined /> {isAr ? 'طلب تعديلات' : 'Request changes'}
                          </button>
                        </li>
                        <li>
                          <button type="button" role="menuitem" onClick={() => void runLifecycle('reject', selectedId)}>
                            <CloseOutlined /> {isAr ? 'رفض' : 'Reject'}
                          </button>
                        </li>
                        <li>
                          <button type="button" role="menuitem" onClick={() => void runLifecycle('mark-published', selectedId)}>
                            <CheckOutlined /> {isAr ? 'تم كمنشور' : 'Mark published'}
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              if (selectedId) void saveAsTemplate(selectedId);
                              setDetailMoreOpen(false);
                            }}
                          >
                            <FileTextOutlined /> {isAr ? 'حفظ كقالب' : 'Save as template'}
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              if (selectedId) void runLifecycle('archive', selectedId);
                              setDetailMoreOpen(false);
                            }}
                          >
                            <DeleteOutlined /> {isAr ? 'أرشفة' : 'Archive post'}
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              if (selectedId) {
                                void convertContentToOps(selectedId).then((ids) => {
                                  if (ids?.requestId) {
                                    window.location.href = `/app/requests/${ids.requestId}`;
                                  }
                                });
                              }
                              setDetailMoreOpen(false);
                            }}
                          >
                            <FlagOutlined /> {isAr ? 'تحويل لطلب/مهمة/تسليم' : 'Convert to Request → Task → Deliverable'}
                          </button>
                        </li>
                      </ul>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="oma-plan-post__icon-btn oma-plan-post__close"
                    onClick={requestCloseDrawer}
                    aria-label="Close"
                  >
                    <CloseOutlined />
                  </button>
                </div>
              </header>

              <div className="oma-plan-post__body">
                <div className="oma-plan-post__canvas">
                  <div className="oma-plan-post__preview-toggle">
                    <button
                      type="button"
                      data-active={detailPreviewMode === 'desktop' ? 'true' : 'false'}
                      onClick={() => setDetailPreviewMode('desktop')}
                      aria-label="Desktop"
                    >
                      <DesktopOutlined />
                    </button>
                    <button
                      type="button"
                      data-active={detailPreviewMode === 'mobile' ? 'true' : 'false'}
                      onClick={() => setDetailPreviewMode('mobile')}
                      aria-label="Mobile"
                    >
                      <MobileOutlined />
                    </button>
                  </div>

                  {detailPreviewMode === 'mobile' ? (
                    <div className="oma-plan-post__phone">
                      <div className="oma-plan-post__phone-screen">
                        <div className="oma-plan-post__phone-meta">
                          {selected.channel || 'Osama page'} ·{' '}
                          <span className="oma-ltr">
                            {selected.scheduledAt
                              ? selected.scheduledAt.slice(0, 16).replace('T', ', ')
                              : '—'}
                          </span>
                        </div>
                        <strong className="oma-plan-post__phone-title">
                          {editTitle || pickCopy(selected.title, locale)}
                        </strong>
                        <p className="oma-plan-post__phone-body">{draft.caption}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="oma-plan-post__editor">
                      <div className="oma-plan-post__status-col">
                        <div className="oma-plan-post__status-item">
                          <button
                            type="button"
                            className="oma-plan-post__status-btn"
                            data-tooltip={isAr ? 'لم تتم الموافقة بعد' : 'Not approved yet'}
                            onClick={() => setApprovalTipOpen((v) => !v)}
                          >
                            <CheckOutlined />
                          </button>
                          <span className="oma-plan-post__status-label">
                            {isAr ? 'لم تتم الموافقة بعد' : 'Not approved yet'}
                          </span>
                          {approvalTipOpen ? (
                            <div className="oma-plan-post__tip-card">
                              <strong>
                                {isAr ? 'لم يوافق أحد على هذا المنشور بعد' : 'No one approved this post yet'}
                              </strong>
                              <p>
                                {isAr
                                  ? 'بانتظار الموافقة من أي من هؤلاء:'
                                  : 'Pending approval from any of these users:'}
                              </p>
                              <p className="oma-plan-post__tip-section">{isAr ? 'الفريق' : 'Team'}</p>
                              <div className="oma-plan-post__tip-user">
                                <span className="oma-plan-post__avatar">O</span>
                                <span>{selected.assignee || 'Osama'} ({isAr ? 'أنت' : 'You'})</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="oma-plan-post__status-item">
                          <button
                            type="button"
                            className="oma-plan-post__status-btn"
                            data-tooltip={isAr ? 'المنشور غير منشور بعد' : 'Post is not published yet'}
                            onClick={() => setPublishTipOpen((v) => !v)}
                          >
                            <EditOutlined />
                          </button>
                          {publishTipOpen ? (
                            <div className="oma-plan-post__tip-card oma-plan-post__tip-card--sm">
                              {isAr ? 'المنشور غير منشور بعد' : 'Post is not published yet'}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="oma-plan-post__fields">
                        <div className="oma-plan-post__meta-line">
                          <span className="oma-plan-post__page">{selected.channel || 'Osama page'}</span>
                          <span className="oma-plan-post__dot">·</span>
                          <button type="button" className="oma-plan-post__date-btn">
                            <span className="oma-ltr">
                              {selected.scheduledAt
                                ? selected.scheduledAt.slice(0, 16).replace('T', ', ')
                                : draft.scheduledAt
                                  ? draft.scheduledAt.slice(0, 16).replace('T', ', ')
                                  : '—'}
                            </span>
                            <DownOutlined />
                          </button>
                        </div>
                        <input
                          className="oma-plan-post__title-input"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder={isAr ? 'العنوان' : 'Title'}
                          data-testid="demo-content-detail-title"
                        />
                        <textarea
                          className="oma-plan-post__body-input"
                          value={draft.caption}
                          onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
                          placeholder={
                            isAr
                              ? "اكتب '/' لإضافة عناوين ووسائط والمزيد…"
                              : "Type '/' to add headlines, media and more…"
                          }
                          rows={8}
                          data-testid="demo-content-caption"
                        />
                        <div className="oma-plan-post__count">
                          {draft.caption.length} {isAr ? 'حرف' : 'characters'} ·{' '}
                          {draft.caption.trim() ? draft.caption.trim().split(/\s+/).length : 0}{' '}
                          {isAr ? 'كلمة' : 'word'}
                          {draft.caption.trim().split(/\s+/).filter(Boolean).length === 1 ? '' : draft.caption.trim() ? 's' : ''}
                        </div>
                        {(dirty || saveState !== 'idle') ? (
                          <div className="oma-plan-post__save-row">
                            <span className="oma-plan-post__save-state" data-state={saveState}>
                              {saveState === 'saved'
                                ? t('demo.content.saved')
                                : saveState === 'saving'
                                  ? t('demo.content.saving')
                                  : saveState === 'error'
                                    ? saveError
                                    : null}
                            </span>
                            <Button
                              type="primary"
                              loading={saving}
                              onClick={() => void saveItem()}
                              data-testid="demo-content-save"
                            >
                              {isAr ? 'حفظ المسودة' : 'Save draft'}
                            </Button>
                            <Button
                              type="default"
                              disabled={saving}
                              onClick={() => void runLifecycle('schedule', selectedId)}
                            >
                              {t('demo.content.schedule')}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                {detailSidePanel !== 'none' ? (
                  <aside className="oma-plan-post__side" data-testid="demo-content-side-panel">
                    <header className="oma-plan-post__side-head">
                      <strong>
                        {detailSidePanel === 'activity'
                          ? isAr ? 'النشاط' : 'Activity'
                          : isAr ? 'الملاحظات' : 'Feedback'}
                      </strong>
                      <button
                        type="button"
                        className="oma-plan-post__icon-btn"
                        onClick={() => setDetailSidePanel('none')}
                        aria-label="Close"
                      >
                        <CloseOutlined />
                      </button>
                    </header>

                    {detailSidePanel === 'activity' ? (
                      <div className="oma-plan-post__activity">
                        <div className="oma-plan-post__workflow-chip" style={{ marginBottom: 12 }}>
                          <strong>{isAr ? 'حالة المسار' : 'Workflow'}</strong>
                          <span>
                            {workflowLabel(
                              {
                                status: selected.status,
                                approvalState: selected.approvalState,
                                scheduleState: selected.scheduleState,
                              },
                              isAr,
                            )}
                          </span>
                          <span className="oma-muted">
                            {selected.approverApproved}/{selected.approverRequired}{' '}
                            {isAr ? 'موافقات' : 'approvals'}
                          </span>
                        </div>
                        {approvalEvents.length === 0 ? (
                          <p className="oma-muted">
                            {isAr ? 'لا أحداث موافقة بعد.' : 'No approval events yet.'}
                          </p>
                        ) : (
                          approvalEvents.map((ev) => (
                            <div key={ev.id} className="oma-plan-post__activity-row">
                              <span className="oma-plan-post__avatar">
                                {ev.action.slice(0, 1)}
                              </span>
                              <div>
                                <p>
                                  <strong>{ev.action}</strong>
                                  {ev.note
                                    ? ` — ${isAr ? ev.note.ar || ev.note.en : ev.note.en || ev.note.ar}`
                                    : ''}
                                </p>
                                <span className="oma-plan-post__activity-meta">
                                  <span className="oma-ltr">{ev.at.slice(0, 19).replace('T', ' ')}</span>
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="oma-plan-post__feedback">
                        <div className="oma-plan-post__feedback-tabs">
                          <button
                            type="button"
                            data-active={feedbackTab === 'comments' ? 'true' : 'false'}
                            onClick={() => setFeedbackTab('comments')}
                          >
                            {isAr ? 'تعليقات' : 'Comments'}
                          </button>
                          <button
                            type="button"
                            data-active={feedbackTab === 'suggestions' ? 'true' : 'false'}
                            onClick={() => setFeedbackTab('suggestions')}
                          >
                            {isAr ? 'اقتراحات' : 'Suggestions'}
                          </button>
                        </div>
                        {feedbackTab === 'comments' ? (
                          <>
                            <div className="oma-plan-post__comment-box">
                              <div className="oma-plan-post__comment-input-row">
                                <span className="oma-plan-post__avatar">U</span>
                                <textarea
                                  className="oma-plan-post__comment-input"
                                  rows={2}
                                  value={commentDraft}
                                  placeholder={isAr ? 'اكتب تعليقاً…' : 'Leave a comment…'}
                                  onChange={(e) => setCommentDraft(e.target.value)}
                                />
                              </div>
                              <button
                                type="button"
                                className="oma-plan-post__comment-send"
                                disabled={!commentDraft.trim() || !selectedId}
                                onClick={() => {
                                  void (async () => {
                                    if (!selectedId || !commentDraft.trim()) return;
                                    try {
                                      const c = await addContentComment(selectedId, {
                                        en: commentDraft.trim(),
                                        ar: commentDraft.trim(),
                                      });
                                      setProdComments((prev) => [...prev, c]);
                                      setCommentDraft('');
                                      toast.push(isAr ? 'تم إضافة التعليق' : 'Comment added', 'success');
                                    } catch (err) {
                                      toast.push(contentApiError(err, 'Comment failed'), 'danger');
                                    }
                                  })();
                                }}
                              >
                                {isAr ? 'إرسال' : 'Send'}
                              </button>
                            </div>
                            {prodComments.length === 0 ? (
                              <div className="oma-plan-post__empty">
                                <strong>{isAr ? 'لا تعليقات بعد' : 'No comments yet'}</strong>
                                <p>
                                  {isAr
                                    ? 'ابدأ المحادثة بترك أول تعليق.'
                                    : 'Start the conversation by leaving the first comment.'}
                                </p>
                              </div>
                            ) : (
                              <div className="oma-comment-thread">
                                {prodComments.map((c) => (
                                  <article key={c.id} className="oma-comment">
                                    <span className="oma-plan-post__avatar">
                                      {(c.author_user_id || 'U').slice(0, 1)}
                                    </span>
                                    <div>
                                      <div className="oma-comment-meta">
                                        <span className="oma-ltr">{c.at.slice(0, 16).replace('T', ' ')}</span>
                                      </div>
                                      <p className="oma-comment-body">
                                        {isAr ? c.body.ar || c.body.en : c.body.en || c.body.ar}
                                      </p>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="oma-plan-post__empty">
                            <strong>{isAr ? 'لا اقتراحات بعد' : 'No suggestions yet'}</strong>
                            <p>
                              {isAr
                                ? 'حدد نصاً لاقتراح تعديلات.'
                                : 'Select some text to suggest edits.'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </aside>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>

      {/* Overflow day dialog */}
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

      {/* Filter side panel */}
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

      {/* Media library */}
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

      {/* Approval selection bar */}
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
                ? isAr ? 'منشور محدد' : 'Post selected'
                : isAr ? 'منشورات محددة' : 'Posts selected'}
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
              onClick={() => void runLifecycle('request-approval', selectedId)}
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
            <button type="button" className="oma-plan-selbar__icon" onClick={() => undefined}>
              <InboxOutlined />
            </button>
            <button
              type="button"
              className="oma-plan-selbar__icon"
              onClick={clearSelection}
            >
              <DeleteOutlined />
            </button>
          </div>
        </div>
      ) : null}

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
                      [noteDay]: { text, color: prev[noteDay]?.color ?? 'yellow' },
                    }));
                  }}
                  onBlur={(e) => void persistNote(noteDay, { text: e.target.value })}
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
                  <button
                    type="button"
                    className="oma-cal-note__action"
                    data-tooltip={isAr ? 'مرئي لك فقط' : 'Only visible to you'}
                  >
                    <LockOutlined />
                  </button>
                  <button
                    type="button"
                    className="oma-cal-note__action"
                    data-tooltip={isAr ? 'حذف' : 'Delete'}
                    onClick={() => {
                      void persistNote(noteDay, { remove: true });
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
                          void persistNote(noteDay, { color: c });
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

      {/* Floating card hover menu (portal) */}
      <CardFloatingMenu
        open={!!cardMenuId && !!menuPos}
        pos={menuPos}
        itemId={cardMenuId}
        locale={locale}
        onAction={handleCardMenuAction}
        onClose={() => {
          setCardMenuId(null);
          setMenuPos(null);
        }}
      />

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
          <Button type="primary" onClick={closeDrawer}>OK</Button>
        </div>
      </Dialog>

      <Dialog
        open={labelPickerOpen}
        title={isAr ? 'التصنيفات' : 'Labels'}
        onClose={() => setLabelPickerOpen(false)}
      >
        <div className="oma-stack" style={{ gap: 8 }}>
          <div className="oma-chip-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {brandLabels.map((lab) => (
              <button
                key={lab.id}
                type="button"
                className="oma-plan-post__chip"
                style={{ borderColor: lab.color }}
                onClick={() => {
                  if (!selectedId) return;
                  const current = rows.find((r) => r.id === selectedId);
                  const existing = (current as { labels?: string[] })?.labels ?? [];
                  const name = lab.name?.en || lab.id;
                  const next = existing.includes(name)
                    ? existing.filter((x) => x !== name)
                    : [...existing, name];
                  void setContentLabels(selectedId, next)
                    .then((updated) => {
                      setRows((prev) =>
                        prev.map((r) => (r.id === selectedId ? toContentRow(updated) : r)),
                      );
                      toast.push(isAr ? 'تم تحديث التصنيفات' : 'Labels updated', 'success');
                    })
                    .catch((err) => toast.push(contentApiError(err, 'Labels failed'), 'danger'));
                }}
              >
                {lab.name?.en || lab.id}
              </button>
            ))}
          </div>
          <div className="oma-chip-row">
            <input
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder={isAr ? 'تصنيف جديد' : 'New label'}
            />
            <Button
              type="primary"
              onClick={() => {
                const brandId = selected?.brandId || brands[0]?.id;
                if (!brandId || !labelDraft.trim()) return;
                void createBrandLabel(brandId, {
                  en: labelDraft.trim(),
                  ar: labelDraft.trim(),
                })
                  .then((lab) => {
                    setBrandLabels((prev) => [...prev, lab as (typeof brandLabels)[0]]);
                    setLabelDraft('');
                  })
                  .catch((err) => toast.push(contentApiError(err, 'Create label failed'), 'danger'));
              }}
            >
              {isAr ? 'إضافة' : 'Add'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={templatePickerOpen}
        title={isAr ? 'القوالب' : 'Templates'}
        onClose={() => setTemplatePickerOpen(false)}
      >
        <div className="oma-stack" style={{ gap: 8 }}>
          {brandTemplates.length === 0 ? (
            <p className="oma-muted">{isAr ? 'لا قوالب' : 'No templates'}</p>
          ) : (
            brandTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="oma-work-row"
                onClick={() => {
                  const brandId = selected?.brandId || brands[0]?.id;
                  if (!brandId) return;
                  void useContentTemplate(brandId, tpl.id)
                    .then((created) => {
                      const row = toContentRow(created);
                      setRows((prev) => [row, ...prev]);
                      setTemplatePickerOpen(false);
                      toast.push(isAr ? 'تم إنشاء منشور من القالب' : 'Created from template', 'success');
                      openItem(row, 'edit');
                    })
                    .catch((err) => toast.push(contentApiError(err, 'Template failed'), 'danger'));
                }}
              >
                <strong>
                  {(tpl as { name?: { en: string } }).name?.en ||
                    (tpl as { name_en?: string }).name_en ||
                    tpl.id}
                </strong>
              </button>
            ))
          )}
        </div>
      </Dialog>
    </div>
  );
      }
