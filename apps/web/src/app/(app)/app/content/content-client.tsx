'use client';

import { useReloadOnBrandChange } from '../../../../lib/active-brand';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ErrorState as ApiErrorState,
  errorKindOf,
  type ErrorKind,
} from '../../../../components/ui/error-state';
import { ContentCalSkeleton, ContentListSkeleton } from '../../../../components/ui/page-skeleton';
import { createPortal } from 'react-dom';
import { resolveContentWorkflow, type ApprovalPolicy, type DemoGraph } from '@oma/demo';
import { ContentFace, faceDisplay } from '../../../../components/content/content-card';
import { PostPreview } from '../../../../components/content/post-preview';
import { FeedPost, type FeedComment } from '../../../../components/content/feed-post';
import { listWorkspaceMembers, type WorkspaceMember } from '../../../../lib/team-api';
import { NetworkIcon } from '../../../../components/content/network-icon';
import {
  CalendarDisplaySettings,
  CalendarPostCard,
  GridTile,
  ModalNav,
  StatusIcons,
  StoriesRow,
  type PostStatus,
} from '../../../../components/content/planable-views';
import {
  CAL_DISPLAY_KEY,
  decideDrop,
  isoWeekNumber,
  isWeekendKey,
  neighbourId,
  parseContentUrl,
  previewStep,
  sanitizeCalendarDisplay,
  shiftDayKey,
  stepCalendar,
  writeContentUrl,
  type CalendarDisplay,
} from '../../../../lib/content-views';
import { Button, DatePicker, Input, OmaSelect, SurfaceButton, TextArea } from '@oma/ui/controls';
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
  SyncOutlined,
  TagOutlined,
  UnorderedListOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';

import { Dialog } from '../../../../components/ui/dialog';
import { EmptyState, DeniedState } from '../../../../components/ui/empty-state';
import { useToast } from '../../../../components/ui/toast';
import { MediaPickerDialog, MediaThumb } from '../../../../components/content/media-picker';
import type { MediaAsset } from '../../../../lib/workdrive-api';
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
import { pickCopy } from '../../../../lib/demo/use-demo-api';
import {
  loadContentWorkspace,
  loadContentWorkspaceRest,
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
  saveContentAsTemplate,
  getContentDetail,
  addContentComment,
  deleteContentComment,
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
import {
  createRequest,
  convertRequestToTask,
  convertTaskToDeliverable,
  opsError,
} from '../../../../lib/ops-api';
import { useLocale, useT } from '../../../../lib/use-locale';
import { useCapabilities } from '../../../../lib/use-capabilities';
import {
  canRequestApproval,
  canApprove,
  canRequestChanges,
  canReject,
  canScheduleItem,
  canMarkPublished,
  approvalProgressLabel,
  scheduleBlockReason,
  scheduleBlockedHint,
  canArchive,
  lifecycleHint,
} from '../../../../lib/content-workflow-ui';
import {
  WORKSPACE_TZ,
  formatCommentTime,
  monthCursorFromKey,
  todayKey,
  wallTimeToIso,
} from '../../../../lib/calendar-today';

type Campaign = DemoGraph['campaigns'][number];
type Brand = DemoGraph['brands'][number];
type Task = DemoGraph['tasks'][number];
type Deliverable = DemoGraph['deliverables'][number];
type RequestRow = DemoGraph['requests'][number];

const TODAY_KEY = todayKey();
const TODAY_CURSOR = monthCursorFromKey(TODAY_KEY);
const DEFAULT_YEAR = TODAY_CURSOR.year;
const DEFAULT_MONTH = TODAY_CURSOR.monthIndex;

/* ── Static demo external calendars (mirrors Planable capture) ── */
const DEMO_EXTERNAL_CALENDARS = [{ id: 'israel-holidays', name: 'Israel Holidays', enabled: true }];

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

function weekdayForKey(key: string, locale: string): string {
  const d = new Date(`${key}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(d);
}

const LABEL_COLORS = [
  '#1677ff',
  '#52c41a',
  '#fa8c16',
  '#eb2f96',
  '#722ed1',
  '#13c2c2',
  '#f5222d',
  '#595959',
];

type BrandTemplateCard = {
  id: string;
  name?: { en?: string; ar?: string };
  name_en?: string;
  title?: { en?: string; ar?: string } | null;
  caption?: { en?: string; ar?: string } | null;
  channel?: string;
  content_type?: string;
  labels?: string[];
  preview_asset_url?: string | null;
};

function templateTitle(tpl: BrandTemplateCard, isAr: boolean): string {
  const localized = isAr ? tpl.name?.ar || tpl.name?.en : tpl.name?.en || tpl.name?.ar;
  return localized || tpl.name_en || tpl.id;
}

function rowLabels(item: { labels?: string[] } | ContentRow): string[] {
  const labels = (item as { labels?: string[] }).labels;
  return Array.isArray(labels) ? labels.filter(Boolean) : [];
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
  /** WorkDrive media picked in compose (stored as preview_asset_id). */
  media: MediaAsset | null;
  owner: string;
  plannedDate: string;
  track: string;
  caption: string;
  brief: string;
  labels: string[];
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
  onOpenLabels,
  onOpenTemplates,
  brandId,
  canConnectStorage,
}: {
  brandId: string | null;
  canConnectStorage: boolean;
  open: boolean;
  creating: boolean;
  error: string | null;
  form: ComposeForm;
  campaigns: Campaign[];
  locale: string;
  onChange: (patch: Partial<ComposeForm>) => void;
  onClose: () => void;
  onSubmit: () => void;
  onOpenLabels?: () => void;
  onOpenTemplates?: () => void;
}) {
  const t = useT();
  const [campaignMenu, setCampaignMenu] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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
          aria-label={t('content.dismiss')}
          disabled={creating}
          onClick={onClose}
        >
          <CloseOutlined />
        </button>

        <div className="oma-compose-pills">
          <div className="oma-compose-pill-wrap">
            <button
              type="button"
              className="oma-compose-pill"
              aria-expanded={campaignMenu}
              data-testid="demo-create-content-campaign"
              onClick={() => setCampaignMenu((v) => !v)}
            >
              <NotificationOutlined />
              {selectedCampaign
                ? pickCopy(selectedCampaign.name, locale)
                : t('demo.campaigns.col.campaign')}
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
                  {t('content.no_campaign')}
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
          <button
            type="button"
            className="oma-compose-pill"
            onClick={() => onOpenLabels?.()}
            data-testid="demo-compose-labels"
          >
            <TagOutlined />
            {t('wsPanel.labels')}
          </button>
          <button
            type="button"
            className="oma-compose-pill"
            onClick={() => onOpenTemplates?.()}
            data-testid="demo-compose-templates"
          >
            <FileTextOutlined />
            {t('wsPanel.templates')}
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
            {form.media ? (
              <div className="oma-compose-media-chip" data-testid="compose-media-selected">
                <MediaThumb asset={form.media} t={t} />
                <button type="button" onClick={() => onChange({ media: null })}>
                  {t('media.remove')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="oma-compose-media"
                aria-label={t('media.add')}
                title={t('media.add')}
                data-testid="compose-media-open"
                onClick={() => setPickerOpen(true)}
              >
                <PictureOutlined />
              </button>
            )}
            <MediaPickerDialog
              open={pickerOpen}
              brandId={brandId}
              kind="posts"
              t={t}
              locale={locale}
              canConnect={canConnectStorage}
              onClose={() => setPickerOpen(false)}
              onPick={(asset) => onChange({ media: asset })}
            />
          </div>
          <div className="oma-compose-main">
            <Input
              className="oma-compose-title"
              placeholder={t('demo.create.title')}
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
            {t('demo.content.filter.type')}
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
            {t('demo.filter.channel')}
            <Input value={form.channel} onChange={(e) => onChange({ channel: e.target.value })} />
          </label>
          <label>
            {t('demo.campaigns.col.owner')}
            <Input value={form.owner} onChange={(e) => onChange({ owner: e.target.value })} />
          </label>
          <label>
            {t('demo.filter.track')}
            <OmaSelect
              value={form.track}
              onChange={(track) => onChange({ track })}
              options={[
                { value: 'ORGANIC', label: t('strategy.nav.organic') },
                { value: 'PAID', label: t('strategy.nav.paid') },
              ]}
            />
          </label>
          <label>
            {t('demo.campaign.goal')}
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
              showTime={{ format: t('content.hhmm') }}
              format="MMM DD, HH:mm"
              value={form.plannedDate ? dayjs(form.plannedDate) : null}
              onChange={(value) =>
                onChange({
                  // Store the wall-clock value; it is converted to an ISO instant in the
                  // workspace timezone on submit (never send the display format to the API).
                  plannedDate: value ? value.format('YYYY-MM-DDTHH:mm') : '',
                })
              }
              suffixIcon={<DownOutlined style={{ fontSize: 10 }} />}
            />
            <span className="oma-compose-tz">({WORKSPACE_TZ.replace('/', ': ')})</span>
          </div>
          <div className="oma-compose-actions">
            <button
              type="button"
              className="oma-compose-view"
              aria-label={t('demo.deliverable.preview')}
            >
              <EyeOutlined />
            </button>
            <button
              type="button"
              className="oma-compose-save"
              disabled={creating}
              data-testid="demo-create-content-submit"
              onClick={onSubmit}
            >
              <span>{creating ? t('demo.content.saving') : t('content.save_draft')}</span>
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
  | 'labels'
  | 'schedule'
  | 'unschedule'
  | 'campaign'
  | 'copylink';

function CardFloatingMenu({
  open,
  pos,
  itemId,
  item,
  policy = 'OPTIONAL',
  locale: _locale,
  variant = 'full',
  campaigns = [],
  canEdit = true,
  onAction,
  onClose,
}: {
  open: boolean;
  pos: { top: number; left: number } | null;
  itemId: string | null;
  item: {
    approvalState?: string;
    scheduleState?: string;
    scheduleBlocked?: boolean;
    clientVisible?: boolean;
    campaignId?: string | null;
  } | null;
  policy?: 'NONE' | 'OPTIONAL' | 'REQUIRED';
  locale: string;
  variant?: 'full' | 'feed';
  canEdit?: boolean;
  campaigns?: Array<{ id: string; name: string }>;
  onAction: (action: CardMenuAction, id: string, arg?: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement | null>(null);
  const [realPos, setRealPos] = useState(pos);
  const [campaignStep, setCampaignStep] = useState(false);
  useEffect(() => {
    setCampaignStep(false);
  }, [itemId, open]);

  useEffect(() => {
    setRealPos(pos);
  }, [pos]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !realPos || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pad = 8;
    let nextLeft = realPos.left;
    let nextTop = realPos.top;
    if (nextLeft + rect.width > window.innerWidth - pad) {
      nextLeft = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (nextTop + rect.height > window.innerHeight - pad) {
      nextTop = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    if (nextLeft !== realPos.left || nextTop !== realPos.top) {
      setRealPos({ left: nextLeft, top: nextTop });
    }
  }, [realPos, open]);

  if (!open || !realPos || !itemId) return null;

  const src = item || {};
  const items: Array<{
    action: CardMenuAction;
    label: string;
    icon: ReactNode;
    danger?: boolean;
    disabled?: boolean;
  }> = [
    {
      action: 'request',
      label: t('demo.content.requestApproval'),
      icon: <SyncOutlined />,
      disabled: !canRequestApproval(src),
    },
    {
      action: 'approve',
      label: t('content.approve_post'),
      icon: <CheckOutlined />,
      disabled: !canApprove(src),
    },
    {
      action: 'changes',
      label: t('strategy.review.requestChanges'),
      icon: <FormOutlined />,
      disabled: !canRequestChanges(src),
    },
    {
      action: 'reject',
      label: t('strategy.review.reject'),
      icon: <CloseOutlined />,
      disabled: !canReject(src),
      danger: true,
    },
    {
      action: 'published',
      label: t('content.mark_as_published'),
      icon: <FlagOutlined />,
      disabled: !canMarkPublished(src, policy),
    },
    {
      action: 'schedule',
      label: t('nav.schedule'),
      icon: <ClockCircleOutlined />,
      disabled: !canScheduleItem(src, policy),
    },
    {
      action: 'unschedule',
      label: t('demo.content.unschedule'),
      icon: <CalendarOutlined />,
      disabled: src.scheduleState !== 'SCHEDULED',
    },
    {
      action: 'hide',
      label:
        src.clientVisible === false ? t('content.show_to_clients') : t('content.hide_from_clients'),
      icon: <EyeInvisibleOutlined />,
    },
    {
      action: 'labels',
      label: t('wsPanel.labels'),
      icon: <TagOutlined />,
    },
    {
      action: 'template',
      label: t('content.save_as_template'),
      icon: <CopyOutlined />,
    },
    {
      action: 'ops',
      label: t('content.convert_to_request'),
      icon: <UnorderedListOutlined />,
    },
    {
      action: 'archive',
      label: t('content.archive_post'),
      icon: <InboxOutlined />,
      disabled: !canArchive(src),
    },
  ];

  const feedItems: typeof items = [
    {
      action: 'labels',
      label: t('views.menu.manage_labels'),
      icon: <TagOutlined />,
      disabled: !canEdit,
    },
    {
      action: 'campaign',
      label: t('views.menu.add_to_campaign'),
      icon: <FlagOutlined />,
      disabled: !canEdit,
    },
    { action: 'copylink', label: t('views.menu.copy_link'), icon: <LinkOutlined /> },
    {
      action: 'archive',
      label: t('content.archive_post'),
      icon: <InboxOutlined />,
      disabled: !canArchive(src),
      danger: true,
    },
  ];
  const shown = variant === 'feed' ? feedItems : items;
  const current = (src as { campaignId?: string | null }).campaignId || '';

  return createPortal(
    <div
      ref={ref}
      className="oma-card-menu--float"
      role="menu"
      data-testid="demo-content-card-menu"
      style={{ position: 'fixed', top: realPos.top, left: realPos.left, zIndex: 9999 }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {campaignStep ? (
        <>
          <button
            type="button"
            role="menuitem"
            className="oma-card-menu__item"
            onClick={() => setCampaignStep(false)}
          >
            <span className="oma-card-menu__item-ico oma-pv-flip">‹</span>
            <span>{t('views.menu.add_to_campaign')}</span>
          </button>
          {campaigns.length === 0 ? (
            <span className="oma-card-menu__item" data-disabled="true">
              {t('views.menu.no_campaigns')}
            </span>
          ) : (
            campaigns.map((c) => (
              <button
                key={c.id}
                type="button"
                role="menuitemradio"
                aria-checked={current === c.id}
                className="oma-card-menu__item"
                onClick={() => onAction('campaign', itemId, c.id)}
              >
                <span className="oma-card-menu__item-ico">{current === c.id ? '✓' : ''}</span>
                <span>{c.name}</span>
              </button>
            ))
          )}
        </>
      ) : null}
      {(campaignStep ? [] : shown).map((it) => (
        <button
          key={it.action}
          type="button"
          role="menuitem"
          className={
            it.danger ? 'oma-card-menu__item oma-card-menu__item--danger' : 'oma-card-menu__item'
          }
          disabled={it.disabled}
          data-disabled={it.disabled ? 'true' : undefined}
          onClick={() => {
            if (it.disabled) return;
            if (it.action === 'campaign') {
              setCampaignStep(true);
              return;
            }
            onAction(it.action, itemId);
          }}
        >
          <span className="oma-card-menu__item-ico">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

function CardActionsButton({
  itemId,
  open,
  label,
  className,
  onOpen,
  onClose,
}: {
  itemId: string;
  open: boolean;
  label: string;
  className?: string;
  onOpen: (itemId: string, anchor: HTMLElement) => void;
  onClose: () => void;
}) {
  return (
    <button
      type="button"
      className={className ? `oma-card-actions-btn ${className}` : 'oma-card-actions-btn'}
      data-testid={`demo-content-actions-${itemId}`}
      data-open={open ? 'true' : 'false'}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (open) onClose();
        else onOpen(itemId, e.currentTarget);
      }}
    >
      <MoreOutlined />
    </button>
  );
}

const FEED_DETAIL_BATCH = 20;

/** Run `fn` over `items` with at most `limit` requests in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

export default function ContentPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const caps = useCapabilities();
  const canManageWorkspace = caps.capabilities.includes('tenant.manage');
  const capsReady = !caps.loading;
  const mayApprove = capsReady && caps.can(['content.approve'], 'any');
  const mayRequestApproval = capsReady && caps.can(['content.request_approval'], 'any');
  const mayComment = capsReady && caps.can(['content.update'], 'any');
  const mayCreate = capsReady && caps.can(['content.create'], 'any');
  const [feedDetails, setFeedDetails] = useState<
    Record<string, { comments: ContentCommentDto[]; events: ApprovalEvent[] }>
  >({});
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  const [rows, setRows] = useState<ContentRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [menuVariant, setMenuVariant] = useState<'full' | 'feed'>('full');
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
  const [errorKind, setErrorKind] = useState<ErrorKind>('generic');
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
  const closingDrawerRef = useRef(false);

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
  const [brandLabels, setBrandLabels] = useState<
    { id: string; name: { en: string; ar: string }; color: string }[]
  >([]);
  const [brandTemplates, setBrandTemplates] = useState<BrandTemplateCard[]>([]);
  const [labelDraft, setLabelDraft] = useState('');
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0]!);
  const [labelQuery, setLabelQuery] = useState('');
  const [labelTarget, setLabelTarget] = useState<'item' | 'compose'>('item');
  const calendarSnapped = useRef(false);
  const [detailPreviewMode, setDetailPreviewMode] = useState<'desktop' | 'mobile' | 'edit'>(
    'desktop',
  );
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
    // No implicit date: "Save draft" must never schedule.
    plannedDate: '',
    brief: '',
    caption: '',
    track: 'ORGANIC',
    media: null as MediaAsset | null,
    labels: [] as string[],
  });

  const isAr = locale.toLowerCase().startsWith('ar');
  // EN Monday matches Planable LIVE_VERIFIED calendar; AR Saturday.
  const [calDisplay, setCalDisplayState] = useState<CalendarDisplay>(() => {
    try {
      return sanitizeCalendarDisplay(
        JSON.parse(window.localStorage.getItem(CAL_DISPLAY_KEY) || 'null'),
        locale,
      );
    } catch {
      return sanitizeCalendarDisplay(null, locale);
    }
  });
  const setCalDisplay = useCallback((next: CalendarDisplay) => {
    setCalDisplayState(next);
    try {
      window.localStorage.setItem(CAL_DISPLAY_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: keep in memory */
    }
  }, []);
  const weekStartsOn: 0 | 1 | 6 = calDisplay.weekStartsOn;
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fast path: primary brand only — paint calendar ASAP
      const ws = await loadContentWorkspace({ full: false });
      setRows(ws.content);
      setPolicy(ws.policy);
      setCampaigns(ws.campaigns as typeof campaigns);
      setBrands(ws.brands as typeof brands);
      setTasks([]);
      setDeliverables([]);
      setRequests([]);
      setError(null);
      setUnavailable(false);
      if (!calendarSnapped.current) {
        calendarSnapped.current = true;
        const dated = ws.content
          .map((row) => dayKey(resolveContentWorkflow(row).plannedAt))
          .filter((key): key is string => Boolean(key));
        const monthPrefix = `${TODAY_CURSOR.year}-${String(TODAY_CURSOR.monthIndex + 1).padStart(2, '0')}`;
        if (dated.length > 0 && !dated.some((key) => key.startsWith(monthPrefix))) {
          const sorted = [...dated].sort();
          const pick =
            dated.find((key) => key === TODAY_KEY) ??
            sorted.find((key) => key >= TODAY_KEY) ??
            sorted[sorted.length - 1]!;
          setCursor(monthCursorFromKey(pick));
          setSelectedDay(pick);
        } else {
          setCursor(TODAY_CURSOR);
          setSelectedDay(TODAY_KEY);
        }
      }
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
      // End loading so UI paints before notes / extra brands
      setLoading(false);

      // Optional notes (do not block first paint)
      const primaryBrand = ws.brands[0]?.id;
      if (primaryBrand) {
        void listDayNotes(primaryBrand)
          .then((notes) => {
            const map: Record<string, { text: string; color: string; locked?: boolean }> = {};
            for (const n of notes) {
              map[n.day_key] = {
                text: locale.toLowerCase().startsWith('ar') ? n.text.ar || n.text.en : n.text.en,
                color: n.color,
                locked: n.locked,
              };
            }
            setDayNotes(map);
          })
          .catch(() => undefined);
      }

      // Background hydrate other brands
      if (ws.remainingBrandIds?.length) {
        void loadContentWorkspaceRest(ws.remainingBrandIds)
          .then((rest) => {
            setCampaigns((prev) => {
              const ids = new Set(prev.map((c) => c.id));
              return [...prev, ...rest.campaigns.filter((c) => !ids.has(c.id))];
            });
            setRows((prev) => {
              const ids = new Set(prev.map((r) => r.id));
              return [...prev, ...rest.content.filter((r) => !ids.has(r.id))];
            });
          })
          .catch(() => undefined);
      }
    } catch (err) {
      setErrorKind(errorKindOf(err));
      setError(contentApiError(err, t('content.failed_to_load_content')));
      setRows([]);
      setLoading(false);
    }
  }, [isAr, locale]);

  useEffect(() => {
    if (!cardMenuId && !viewMenuOpen && !extCalOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          '.oma-card-menu--float, .oma-card-actions-btn, .oma-label-panel, .oma-template-panel',
        )
      )
        return;
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

  /* Keep Planable path view label in shell breadcrumb in sync (icon + text, path style) */
  useEffect(() => {
    const el = document.getElementById('oma-content-view-slot');
    if (!el) return;
    const label = t(`demo.view.${view}`);
    const icons: Record<string, string> = {
      calendar:
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7 3h2v2h6V3h2v2h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2V3Zm12 7H5v9h14v-9Z"/></svg>',
      feed: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z"/></svg>',
      list: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 6h12v2H8V6Zm0 5h12v2H8v-2Zm0 5h12v2H8v-2ZM4 6h2v2H4V6Zm0 5h2v2H4v-2Zm0 5h2v2H4v-2Z"/></svg>',
      grid: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"/></svg>',
    };
    el.innerHTML = `<span class="oma-breadcrumb-view-inner">${icons[view] || icons.calendar}<span class="oma-breadcrumb-view-label">${label}</span><span class="oma-breadcrumb-view-caret" aria-hidden>▾</span></span>`;
    el.setAttribute('data-view', view);
    el.classList.add('oma-breadcrumb-view--interactive');
  }, [view, t]);

  // Refresh when the active brand changes in the header switcher.
  useReloadOnBrandChange(load);

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
      const text = patch.text !== undefined ? patch.text : (current?.text ?? '');
      const color = patch.color ?? current?.color ?? 'yellow';
      const locked = patch.locked ?? false;
      await upsertDayNote(activeBrandId, { dayKey, text, color, locked });
      setDayNotes((prev) => ({
        ...prev,
        [dayKey]: { text, color, locked },
      }));
    } catch (err) {
      toast.push(contentApiError(err, t('content.failed_to_save_note')), 'danger');
    }
  }

  async function toggleHideFromClients(contentId: string) {
    const row = rows.find((r) => r.id === contentId);
    const currentlyVisible = (row as { clientVisible?: boolean })?.clientVisible !== false;
    try {
      const updated = await setClientVisible(contentId, !currentlyVisible);
      setRows((prev) => prev.map((r) => (r.id === contentId ? toContentRow(updated) : r)));
      toast.push(
        !currentlyVisible ? t('content.visible_to_clients') : t('content.hidden_from_clients'),
        'success',
      );
    } catch (err) {
      toast.push(contentApiError(err, t('content.visibility_failed')), 'danger');
    }
  }

  async function saveAsTemplate(contentId: string) {
    if (!activeBrandId) return;
    const row = rows.find((r) => r.id === contentId);
    const name = row ? (isAr ? row.title.ar : row.title.en) : t('content.template');
    try {
      const saved = await saveContentAsTemplate(activeBrandId, {
        name: t('content.template_name').replace('{name}', name),
        fromContentId: contentId,
      });
      const tpl = (saved as { data?: BrandTemplateCard }).data ?? (saved as BrandTemplateCard);
      if (tpl?.id) {
        setBrandTemplates((prev) => [tpl, ...prev.filter((row) => row.id !== tpl.id)]);
      }
      toast.push(t('content.saved_as_template'), 'success');
    } catch (err) {
      toast.push(contentApiError(err, t('errors.http')), 'danger');
    }
  }

  useEffect(() => {
    const urlView = search.get('view');
    if (isContentViewMode(urlView)) {
      setView((current) => (current === urlView ? current : urlView));
    }
    const parsed = parseContentUrl(search.toString());
    setCalSpan(parsed.span);
    if (parsed.approvals)
      setFilters((f) => (f.approval === 'PENDING' ? f : { ...f, approval: 'PENDING' }));
  }, [search]);

  // Home deep links: ?brand=<id> filters the plan, ?date=YYYY-MM-DD opens that calendar day,
  // ?create=1 opens the composer once workspace data is loaded.
  useEffect(() => {
    const brand = search.get('brand');
    if (brand) setFilters((f) => (f.brandId === brand ? f : { ...f, brandId: brand }));
    const date = search.get('date');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      calendarSnapped.current = true;
      setSelectedDay(date);
      setCursor(monthCursorFromKey(date));
    }
  }, [search]);
  const createFromUrl = useRef(false);
  useEffect(() => {
    if (loading || createFromUrl.current || search.get('create') !== '1') return;
    createFromUrl.current = true;
    setCreateOpen(true);
  }, [search, loading]);

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

  // Feed comments/approval trail are only shown in Feed view: fetch them lazily there (was 60
  // detail requests on every open of the calendar, which delayed first paint and saturated the proxy).
  const feedIds = useMemo(
    () => (view === 'feed' ? filtered.slice(0, FEED_DETAIL_BATCH).map((r) => r.id) : []),
    [filtered, view],
  );
  useEffect(() => {
    if (feedIds.length === 0) return;
    let live = true;
    if (members.length === 0) {
      void listWorkspaceMembers()
        .then((m) => live && setMembers(m))
        .catch(() => undefined);
    }
    const missing = feedIds.filter((id) => !feedDetails[id]);
    if (missing.length === 0) return;
    void mapLimit(missing, 4, (id) =>
      getContentDetail(id)
        .then((d) => [id, { comments: d.comments ?? [], events: d.approval_events ?? [] }] as const)
        .catch(() => [id, { comments: [], events: [] }] as const),
    ).then((pairs) => {
      if (live) setFeedDetails((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      live = false;
    };
  }, [feedIds]);
  const savedItems = useMemo(
    () => filtered.filter((item) => !resolveContentWorkflow(item, policy).plannedAt),
    [filtered, policy],
  );
  const feedPosts = useMemo(() => filtered.filter((i) => i.contentType !== 'STORY'), [filtered]);
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
  const linked = selected
    ? linkedIdsForContent(tasks, deliverables, requests, selected.id)
    : { taskId: null, deliverableId: null, requestId: null };
  const review = selected ? reviewPresentation(selected.status, locale) : null;
  const detailMeta = { linked, review };
  void detailMeta;

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
    setDetailSidePanel('feedback');
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

  function renderPostPreview(item: ContentRow, size: 'feed' | 'detail', withReview = true) {
    const caption = item.caption ? pickCopy(item.caption, locale) : '';
    const when = item.scheduledAt || item.plannedAt || null;
    const approval = item.approvalState || 'NOT_REQUESTED';
    return (
      <PostPreview
        channel={item.channel}
        contentType={item.contentType}
        brandName={brandName(item.brandId)}
        caption={caption}
        title={pickCopy(item.title, locale)}
        media={item.previewAsset}
        when={when}
        whenKind={item.scheduledAt ? 'scheduled' : item.plannedAt ? 'planned' : null}
        locale={locale}
        size={size}
        onOpen={size === 'feed' ? () => openItem(item) : undefined}
        review={
          policy === 'NONE' || !withReview
            ? undefined
            : {
                state: approval,
                approved: item.approverApproved,
                required: item.approverRequired,
                canApprove: mayApprove && canApprove(item),
                canRequestChanges: mayApprove && canRequestChanges(item),
                canRequestApproval: mayRequestApproval && canRequestApproval(item),
                commentCount: commentsForContent(tasks, deliverables, item.id).length,
                busy: saving,
                onApprove: () => void runLifecycle('approve', item.id),
                onRequestChanges: () => void runLifecycle('request-changes', item.id),
                onRequestApproval: () => void runLifecycle('request-approval', item.id),
                onComment: () => {
                  if (size === 'feed') openItem(item, 'comments');
                  setDetailSidePanel('feedback');
                },
              }
        }
      />
    );
  }

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const dir = document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
      const step = previewStep(e.key, dir);
      if (step !== 0) {
        e.preventDefault();
        stepModal(step);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function memberName(userId: string | null | undefined): string {
    if (!userId) return t('content.you');
    const m = members.find((x) => x.user?.id === userId);
    return m?.user?.name || m?.user?.email || t('preview.team_member');
  }

  function memberInitials(userId: string | null | undefined): string {
    const name = memberName(userId).trim();
    const parts = name.split(/\s+/).filter(Boolean);
    return (
      (parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : name.slice(0, 2)) || '?'
    ).toUpperCase();
  }

  function memberIsInternal(userId: string): boolean {
    const m = members.find((x) => x.user?.id === userId);
    const kind = String(m?.membership_kind || m?.membership || '').toLowerCase();
    return !/client|external|guest/.test(kind);
  }

  function commentCount(item: ContentRow): number {
    const d = feedDetails[item.id];
    return d ? d.comments.length : commentsForContent(tasks, deliverables, item.id).length;
  }

  function postStatus(item: ContentRow): PostStatus {
    const when = item.scheduledAt || item.plannedAt || null;
    const published =
      String(item.status).startsWith('PUBLISHED') || item.publishSample === 'PUBLISHED_SAMPLE';
    const scheduled = item.scheduleState === 'SCHEDULED';
    return {
      approval: item.approvalState || 'NOT_REQUESTED',
      scheduled,
      published,
      overdue: !published && !!when && String(when).slice(0, 10) < TODAY_KEY,
      hidden: (item as ContentRow & { clientVisible?: boolean }).clientVisible === false,
      comments: commentCount(item),
    };
  }

  function postTime(item: ContentRow): string {
    const when = item.scheduledAt || item.plannedAt;
    if (!when) return '';
    const d = new Date(String(when));
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(isAr ? 'ar' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      numberingSystem: 'latn',
    }).format(d);
  }

  function postDateText(item: ContentRow): string {
    const when = item.scheduledAt || item.plannedAt;
    if (!when) return t('preview.no_date');
    const d = new Date(String(when));
    return new Intl.DateTimeFormat(isAr ? 'ar' : 'en', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  function renderCalendarCard(item: ContentRow) {
    const st = postStatus(item);
    return (
      <CalendarPostCard
        channel={item.channel}
        time={postTime(item)}
        timeTone={
          st.published ? 'published' : st.overdue ? 'overdue' : st.scheduled ? 'scheduled' : 'draft'
        }
        caption={item.caption ? pickCopy(item.caption, locale) : pickCopy(item.title, locale)}
        media={item.previewAsset || null}
        labels={rowLabels(item)}
        campaign={item.campaignId ? campaignName(item.campaignId) : undefined}
        status={st}
        display={calDisplay}
        draft={!st.scheduled && !st.published}
      />
    );
  }

  function renderFeedPost(item: ContentRow) {
    const detail = feedDetails[item.id];
    const approval = item.approvalState || 'NOT_REQUESTED';
    const required = Math.max(1, item.approverRequired ?? 1);
    const approvers = (detail?.events ?? [])
      .filter((e) => /^APPROVE/i.test(e.action))
      .map((e) => memberName(e.actor_user_id));
    const approvedCount = Math.max(item.approverApproved ?? 0, approvers.length);
    const comments: FeedComment[] = detail
      ? detail.comments.map((c) => ({
          id: c.id,
          author: memberName(c.author_user_id),
          body: pickCopy(c.body, locale),
          at: c.at,
          internal: memberIsInternal(c.author_user_id),
        }))
      : commentsForContent(tasks, deliverables, item.id).map((c) => ({
          id: c.id,
          author: c.author,
          body: pickCopy(c.body, locale),
          at: c.at,
          internal: true,
        }));
    return (
      <FeedPost
        key={item.id}
        testId={`demo-content-card-${item.id}`}
        selected={selectedId === item.id}
        onOpen={() => openItem(item)}
        preview={{
          channel: item.channel,
          contentType: item.contentType,
          brandName: brandName(item.brandId),
          caption: item.caption ? pickCopy(item.caption, locale) : '',
          title: pickCopy(item.title, locale),
          media: item.previewAsset,
          when: item.scheduledAt || item.plannedAt || null,
          whenKind: item.scheduledAt ? 'scheduled' : item.plannedAt ? 'planned' : null,
          locale,
          size: 'feed',
          headerActions: (
            <span
              className="oma-pv-feed-actions"
              data-open={cardMenuId === item.id ? 'true' : 'false'}
            >
              <CardActionsButton
                itemId={item.id}
                open={cardMenuId === item.id}
                label={t('content.post_actions')}
                onOpen={placeFeedMenu}
                onClose={closeCardMenu}
              />
            </span>
          ),
        }}
        approval={
          policy === 'NONE'
            ? undefined
            : {
                state: approval,
                approved: approvedCount,
                required,
                steps: Array.from({ length: required }, (_, i) => ({
                  name: approvers[i] ?? null,
                  done: i < approvedCount || approval === 'APPROVED',
                })),
                canApprove: mayApprove && canApprove(item),
                canRequestChanges: mayApprove && canRequestChanges(item),
                canRequestApproval: mayRequestApproval && canRequestApproval(item),
                busy: saving,
                onApprove: () => void runLifecycle('approve', item.id),
                onRequestChanges: () => void runLifecycle('request-changes', item.id),
                onRequestApproval: () => void runLifecycle('request-approval', item.id),
              }
        }
        comments={comments}
        canComment={mayComment}
        onAddComment={async (body) => {
          try {
            const c = await addContentComment(item.id, { en: body, ar: body });
            setFeedDetails((prev) => ({
              ...prev,
              [item.id]: {
                comments: [...(prev[item.id]?.comments ?? []), c],
                events: prev[item.id]?.events ?? [],
              },
            }));
            if (selectedId === item.id) setProdComments((prev) => [...prev, c]);
          } catch (err) {
            toast.push(contentApiError(err, t('errors.http')), 'danger');
            throw err;
          }
        }}
      />
    );
  }

  function modalApproverNames(): string[] {
    return approvalEvents
      .filter((e) => /^APPROVE/i.test(e.action))
      .map((e) => memberName(e.actor_user_id));
  }

  function stepModal(step: number) {
    const ids = (view === 'list' ? sorted : filtered).map((r) => r.id);
    const next = neighbourId(ids, selectedId, step);
    const row = next ? rows.find((r) => r.id === next) : null;
    if (row) openItem(row);
  }

  function requestCloseDrawer() {
    if (dirty) {
      setUnsavedOpen(true);
      return;
    }
    closeDrawer();
  }

  function closeDrawer() {
    closingDrawerRef.current = true;
    setUnsavedOpen(false);
    setSaveState('idle');
    setSaveError(null);
    setSelectedId(null);
    setDraft(emptyDraft());
    setBaseline(emptyDraft());
    setDetailSidePanel('none');
    setDetailMoreOpen(false);
    replaceParams((params) => {
      params.delete('item');
    });
  }

  useEffect(() => {
    const item = search.get('item');
    if (closingDrawerRef.current) {
      if (!item) closingDrawerRef.current = false;
      return;
    }
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
    const target = rows.find((r) => r.id === id);
    if (target) {
      const hint = lifecycleHint(
        command === 'request-approval'
          ? 'request'
          : command === 'request-changes'
            ? 'changes'
            : command === 'mark-published'
              ? 'published'
              : command,
        target,
        isAr,
        policy,
      );
      if (
        hint &&
        (command === 'approve' ||
          command === 'schedule' ||
          command === 'mark-published' ||
          command === 'request-approval')
      ) {
        toast.push(hint, 'danger');
        return;
      }
    }
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

  /**
   * Dropping a post on a day changes its planned date only. A post that is already scheduled
   * inside OMA keeps its schedule and moves to the new day (subject to the approval policy).
   */
  async function rescheduleContentToDay(
    contentId: string,
    dayKey: string,
    fromDay?: string | null,
  ) {
    const row = rows.find((r) => r.id === contentId);
    if (!row) return;
    const decision = decideDrop(row, fromDay ?? null, dayKey, policy);
    if (!decision.ok) {
      if (decision.reason === 'SAME_DAY') return;
      toast.push(
        decision.reason === 'PUBLISHED'
          ? t('views.drop.published')
          : (scheduleBlockedHint('APPROVAL_REQUIRED', isAr) ?? t('content.scheduling_unavailable')),
        'danger',
      );
      return;
    }
    const when = wallTimeToIso(dayKey) ?? `${dayKey}T10:00:00.000Z`;
    const isScheduled = row.scheduleState === 'SCHEDULED';
    if (isScheduled && !canScheduleItem(row, policy)) {
      toast.push(
        scheduleBlockedHint(scheduleBlockReason(row, policy), isAr) ??
          t('content.scheduling_unavailable'),
        'danger',
      );
      return;
    }
    setSaving(true);
    try {
      const updated = isScheduled
        ? await scheduleContent(contentId, { scheduledAt: when })
        : await updateContentProduction(contentId, { plannedAt: when });
      const next = toContentRow(updated);
      setRows((prev) => prev.map((r) => (r.id === contentId ? next : r)));
      toast.push(
        isScheduled
          ? t('content.scheduled_time_moved')
          : t('content.planned_date_updated_not_scheduled'),
        'success',
      );
    } catch (err) {
      toast.push(contentApiError(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
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
      toast.push(t('content.created_request_task_deliverable'), 'success');
      return { requestId: req.id, taskId: task.id, deliverableId: deliv.id };
    } catch (err) {
      toast.push(opsError(err, t('content.ops_conversion_failed')), 'danger');
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
        throw new Error(t('content.select_a_brand'));
      }
      const apiCreated = await createContentProduction({
        brandId,
        title: { en: createForm.title.trim(), ar: createForm.title.trim() },
        caption: createForm.caption.trim()
          ? { en: createForm.caption.trim(), ar: createForm.caption.trim() }
          : undefined,
        campaignId: createForm.campaignId || null,
        contentType: createForm.contentType as ContentRow['contentType'],
        channel: createForm.channel.trim(),
        track: (createForm.track || campaign?.track || 'ORGANIC') as ContentRow['track'],
        // Planned date is a planning hint only; the item stays an unscheduled DRAFT.
        // Scheduling happens solely through the explicit Schedule action.
        plannedAt: wallTimeToIso(createForm.plannedDate),
        labels: createForm.labels,
        preview_asset_id: createForm.media?.id ?? null,
      });
      const createdRow = toContentRow(apiCreated);
      toast.push(t('demo.create.successContent'), 'success');
      setCreateOpen(false);
      if (createForm.plannedDate) {
        const day = createForm.plannedDate.slice(0, 10);
        const [year, month] = day.split('-');
        if (year && month) {
          setCursor({ year: Number(year), monthIndex: Number(month) - 1 });
          setSelectedDay(day);
        }
      }
      setCreateForm((f) => ({ ...f, title: '', brief: '', caption: '', labels: [], media: null }));
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

  function startStory() {
    setCreateForm((f) => ({ ...f, contentType: 'STORY' }));
    setCreateOpen(true);
  }

  function goToDay(key: string) {
    setSelectedDay(key);
    const [y, m] = key.split('-').map(Number);
    if (y && m) setCursor({ year: y, monthIndex: m - 1 });
    replaceParams((params) => writeContentUrl(params, { date: key }));
  }

  function stepCal(delta: number) {
    const anchor =
      calSpan === 'week'
        ? (selectedDay ?? TODAY_KEY)
        : `${cursor.year}-${String(cursor.monthIndex + 1).padStart(2, '0')}-01`;
    const next = stepCalendar(anchor, calSpan, delta);
    if (calSpan === 'week') goToDay(next);
    else {
      const [y, m] = next.split('-').map(Number);
      setCursor({ year: y!, monthIndex: m! - 1 });
      replaceParams((params) => writeContentUrl(params, { date: next }));
    }
  }

  function showApprovalQueue() {
    if (approvalMode) {
      clearSelection();
      return;
    }
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
    toast.push(t('content.approval_request_sent'), 'success');
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
      toast.push(t('content.content_link_copied'), 'success');
    } catch {
      toast.push(t('content.this_browser_could_not_copy'), 'danger');
    }
  }

  /* ── Card menu action handler (used by hover floating menu) ── */
  function handleCardMenuAction(action: CardMenuAction, id: string, arg?: string) {
    setCardMenuId(null);
    setMenuPos(null);
    if (action === 'copylink') {
      const url = new URL(window.location.href);
      url.searchParams.set('item', id);
      void (
        navigator.clipboard?.writeText
          ? navigator.clipboard.writeText(url.toString())
          : Promise.reject(new Error('clipboard'))
      ).then(
        () => toast.push(t('content.content_link_copied'), 'success'),
        () => toast.push(t('content.this_browser_could_not_copy'), 'danger'),
      );
      return;
    }
    if (action === 'campaign' && arg) {
      void updateContentProduction(id, { campaignId: arg })
        .then((api) => {
          const row = toContentRow(api);
          setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
          toast.push(t('views.menu.campaign_updated'), 'success');
        })
        .catch(() => toast.push(t('views.menu.campaign_failed'), 'danger'));
      return;
    }
    if (action === 'request') void runLifecycle('request-approval', id);
    else if (action === 'approve') void runLifecycle('approve', id);
    else if (action === 'published') void runLifecycle('mark-published', id);
    else if (action === 'changes') void runLifecycle('request-changes', id);
    else if (action === 'reject') void runLifecycle('reject', id);
    else if (action === 'hide') void toggleHideFromClients(id);
    else if (action === 'archive') void runLifecycle('archive', id);
    else if (action === 'schedule') void runLifecycle('schedule', id);
    else if (action === 'unschedule') void runLifecycle('unschedule', id);
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
      setLabelTarget('item');
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

  function closeCardMenu() {
    setCardMenuId(null);
    setMenuPos(null);
  }

  function placeFeedMenu(itemId: string, target: HTMLElement) {
    setMenuVariant('feed');
    placeCardMenu(itemId, target, true);
  }

  function placeCardMenu(itemId: string, target: HTMLElement, keepVariant = false) {
    if (!keepVariant) setMenuVariant('full');
    const rect = target.getBoundingClientRect();
    const menuW = 248;
    const menuH = 440;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + menuW + 8 > window.innerWidth) left = Math.max(8, window.innerWidth - menuW - 8);
    if (left < 8) left = 8;
    if (top + menuH + 8 > window.innerHeight) top = Math.max(8, rect.top - menuH - 6);
    setCardMenuId(itemId);
    setMenuPos({ top, left });
  }

  /* ── Card hover with delay (calendar). Click on the actions button opens immediately. ── */
  function scheduleCardMenu(itemId: string, target: HTMLElement) {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      if (!target.matches(':hover')) return;
      placeCardMenu(itemId, target);
    }, 260);
  }

  function cancelCardMenu() {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  function activeLabelNames(): string[] {
    if (labelTarget === 'compose') return createForm.labels;
    const current = rows.find((r) => r.id === selectedId);
    return (current as { labels?: string[] } | undefined)?.labels ?? [];
  }

  function toggleWorkspaceLabel(name: string) {
    const existing = activeLabelNames();
    const next = existing.includes(name) ? existing.filter((x) => x !== name) : [...existing, name];
    if (labelTarget === 'compose') {
      setCreateForm((f) => ({ ...f, labels: next }));
      return;
    }
    if (!selectedId) {
      toast.push(t('content.open_a_post_to_apply'), 'danger');
      return;
    }
    void setContentLabels(selectedId, next)
      .then((updated) => {
        setRows((prev) => prev.map((r) => (r.id === selectedId ? toContentRow(updated) : r)));
        toast.push(t('content.labels_updated'), 'success');
      })
      .catch((err) => toast.push(contentApiError(err, t('errors.http')), 'danger'));
  }

  async function applyTemplate(tpl: BrandTemplateCard) {
    const brandId =
      (labelTarget === 'compose' ? createForm.brandId : selected?.brandId) || brands[0]?.id;
    if (!brandId) return;
    try {
      const fromCompose = labelTarget === 'compose';
      const created = await useContentTemplate(brandId, tpl.id, {
        campaignId: fromCompose ? createForm.campaignId || null : selected?.campaignId || null,
        plannedAt:
          fromCompose && createForm.plannedDate ? wallTimeToIso(createForm.plannedDate) : null,
      });
      const row = toContentRow(created);
      setRows((prev) => [row, ...prev.filter((item) => item.id !== row.id)]);
      const placed = dayKey(row.scheduledAt || row.plannedAt);
      if (placed) {
        const [year, month] = placed.split('-');
        setCursor({ year: Number(year), monthIndex: Number(month) - 1 });
        setSelectedDay(placed);
        setView('calendar');
        writeContentViewPref('calendar');
      }
      setTemplatePickerOpen(false);
      setCreateOpen(false);
      toast.push(t('content.created_from_template'), 'success');
      openItem(row, 'edit');
    } catch (err) {
      toast.push(contentApiError(err, t('errors.http')), 'danger');
    }
  }

  const agendaDays = useMemo(() => {
    const keys = monthCells.filter((c) => c.inMonth).map((c) => c.key);
    return keys
      .map((key) => ({ key, items: byDay.get(key) ?? [] }))
      .filter((d) => d.items.length > 0 || d.key === TODAY_KEY || d.key === selectedDay);
  }, [monthCells, byDay, selectedDay]);

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
          <span className="oma-filter-accordion__ico" aria-hidden>
            <CheckCircleOutlined />
          </span>
          <span>{t('content.approval_status')}</span>
          <span className="oma-filter-accordion__caret">
            {filterSection === 'approval' ? <UpOutlined /> : <DownOutlined />}
          </span>
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
          <span className="oma-filter-accordion__ico" aria-hidden>
            <ClockCircleOutlined />
          </span>
          <span>{t('content.post_status')}</span>
          <span className="oma-filter-accordion__caret">
            {filterSection === 'status' ? <UpOutlined /> : <DownOutlined />}
          </span>
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
                  onChange={() => setFilters((f) => ({ ...f, status: f.status === s ? 'all' : s }))}
                />
                <span>{statusLabel(s, locale)}</span>
                <span className="oma-filter-check__count">
                  {rows.filter((r) => r.status === s).length}
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
          data-open={filterSection === 'campaign' ? 'true' : 'false'}
          data-testid="demo-content-filter-campaign-section"
          onClick={() => toggleFilterSection('campaign')}
        >
          <span className="oma-filter-accordion__ico" aria-hidden>
            <FlagOutlined />
          </span>
          <span>{t('demo.campaigns.col.campaign')}</span>
          <span className="oma-filter-accordion__caret">
            {filterSection === 'campaign' ? <UpOutlined /> : <DownOutlined />}
          </span>
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
              <span>{t('content.no_campaign_all')}</span>
              <span className="oma-filter-check__count">
                {rows.filter((r) => !r.campaignId).length}
              </span>
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
          <span className="oma-filter-accordion__ico" aria-hidden>
            <AppstoreOutlined />
          </span>
          <span>{t('content.post_type')}</span>
          <span className="oma-filter-accordion__caret">
            {filterSection === 'postType' ? <UpOutlined /> : <DownOutlined />}
          </span>
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
                  {ty === 'POST'
                    ? t('analytics.content')
                    : ty === 'STORY'
                      ? t('content.stories')
                      : ty === 'REEL'
                        ? t('content.reels')
                        : ty}
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
          <span className="oma-filter-accordion__ico" aria-hidden>
            <GlobalOutlined />
          </span>
          <span>{t('content.channel_brand')}</span>
          <span className="oma-filter-accordion__caret">
            {filterSection === 'channel' ? <UpOutlined /> : <DownOutlined />}
          </span>
        </button>
        {filterSection === 'channel' ? (
          <div className="oma-filter-accordion__body">
            <p className="oma-content-filter-eyebrow">{t('demo.filter.channel')}</p>
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
            <p className="oma-content-filter-eyebrow">{t('shell.brand')}</p>
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
          <span className="oma-filter-accordion__ico" aria-hidden>
            <MessageOutlined />
          </span>
          <span>{t('content.feedback_activity')}</span>
          <span className="oma-filter-accordion__caret">
            {filterSection === 'review' ? <UpOutlined /> : <DownOutlined />}
          </span>
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
          <span className="oma-filter-accordion__ico" aria-hidden>
            <UserOutlined />
          </span>
          <span>{t('content.author')}</span>
          <span className="oma-filter-accordion__caret">
            {filterSection === 'author' ? <UpOutlined /> : <DownOutlined />}
          </span>
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
          <span className="oma-filter-accordion__ico" aria-hidden>
            <CalendarOutlined />
          </span>
          <span>{t('analytics.period')}</span>
          <span className="oma-filter-accordion__caret">
            {filterSection === 'period' ? <UpOutlined /> : <DownOutlined />}
          </span>
        </button>
        {filterSection === 'period' ? (
          <div className="oma-filter-accordion__body">
            <label className="oma-filter-sidepanel__row">
              <span>{t('content.start_date')}</span>
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
              <span>{t('content.end_date')}</span>
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
          <span className="oma-filter-accordion__ico" aria-hidden>
            <FilterOutlined />
          </span>
          <span>{t('content.search_in_posts')}</span>
          <span className="oma-filter-accordion__caret">
            {filterSection === 'search' ? <UpOutlined /> : <DownOutlined />}
          </span>
        </button>
        {filterSection === 'search' ? (
          <div className="oma-filter-accordion__body">{searchField}</div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="oma-stack oma-content-plan oma-content-plan--tight" data-testid="demo-content">
      <p className="oma-honesty-inline" data-testid="content-calendar-role">
        {t('demo.content.subtitle')}
      </p>
      {/* Portal: Filter / Media / Share / Compose into shell header */}
      {headerSlot &&
        createPortal(
          <>
            <button
              type="button"
              className="oma-top-action"
              data-tooltip={t('content.filter_sort')}
              onClick={() => setFilterSheet(true)}
              data-testid="demo-content-open-filters"
            >
              <FilterOutlined className="oma-top-action__icon" />
              {t('content.filter')}
              {filterCount > 0 ? ` (${filterCount})` : ''}
            </button>
            <button
              type="button"
              className="oma-top-action"
              data-tooltip={t('content.media_library')}
              onClick={() => setMediaLibraryOpen(true)}
              data-testid="demo-content-open-media"
            >
              <PictureOutlined className="oma-top-action__icon" />
              {t('demo.content.media')}
            </button>
            <button
              type="button"
              className="oma-top-action oma-top-action--ghost"
              data-tooltip={t('content.share_view')}
              onClick={() => void shareContentWorkspace()}
              data-testid="demo-content-share"
            >
              <ShareAltOutlined className="oma-top-action__icon" />
              {t('content.share')}
            </button>
            <button
              type="button"
              className="oma-top-action oma-top-action--primary"
              data-tooltip={t('content.compose')}
              data-testid="demo-create-content"
              onClick={() => setCreateOpen(true)}
            >
              <EditOutlined className="oma-top-action__icon" />
              {t('content.compose')}
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
                  {
                    id: 'calendar' as const,
                    icon: <CalendarOutlined />,
                    label: t('demo.view.calendar'),
                  },
                  { id: 'feed' as const, icon: <BarsOutlined />, label: t('demo.view.feed') },
                  {
                    id: 'list' as const,
                    icon: <UnorderedListOutlined />,
                    label: t('demo.view.list'),
                  },
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
              <li role="separator" className="oma-view-menu__sep" />
              <li role="none">
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={filters.approval === 'PENDING'}
                  data-selected={filters.approval === 'PENDING' ? 'true' : 'false'}
                  data-testid="demo-content-view-approvals"
                  className="oma-view-menu__item"
                  onClick={(e) => {
                    e.stopPropagation();
                    const on = filters.approval !== 'PENDING';
                    setFilters((f) => ({ ...f, approval: on ? 'PENDING' : 'all' }));
                    replaceParams((params) => writeContentUrl(params, { approvals: on }));
                    setViewMenuOpen(false);
                  }}
                >
                  <span className="oma-view-menu__item-icon" aria-hidden>
                    <CheckCircleOutlined />
                  </span>
                  <span>{t('views.my_approvals')}</span>
                  <span className="oma-view-menu__check" aria-hidden>
                    {filters.approval === 'PENDING' ? '✓' : ''}
                  </span>
                </button>
              </li>
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

      {/* Layout-matched skeletons instead of the dots loader. */}
      {loading ? (
        view === 'calendar' ? (
          <ContentCalSkeleton />
        ) : (
          <ContentListSkeleton label={t('common.loading')} />
        )
      ) : null}
      {unavailable ? (
        <DeniedState title={t('demo.unavailable')} body={t('demo.disclosure')} />
      ) : null}
      {error ? (
        <ApiErrorState
          compact
          kind={errorKind}
          detail={errorKind === 'generic' ? error : null}
          onRetry={() => void load()}
        />
      ) : null}

      {!loading && !unavailable && !error && filtered.length === 0 && view !== 'calendar' ? (
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
      {!loading && !unavailable && !error && view === 'calendar' ? (
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
                    onClick={() => {
                      setCalSpan('month');
                      replaceParams((params) => writeContentUrl(params, { span: 'month' }));
                    }}
                  >
                    {t('demo.content.calMonth')}
                  </Button>
                  <Button
                    type="text"
                    className="oma-cal-span__btn"
                    data-active={calSpan === 'week' ? 'true' : 'false'}
                    aria-pressed={calSpan === 'week'}
                    data-testid="demo-content-cal-week"
                    onClick={() => {
                      setCalSpan('week');
                      replaceParams((params) => writeContentUrl(params, { span: 'week' }));
                    }}
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
                    onClick={() => stepCal(-1)}
                  >
                    ‹
                  </Button>
                  <Button
                    type="text"
                    className="oma-cal-nav__btn"
                    aria-label={t('demo.content.next')}
                    data-testid="demo-content-cal-next"
                    onClick={() => stepCal(1)}
                  >
                    ›
                  </Button>
                  <strong className="oma-cal-month-label">
                    {monthLabel(cursor.year, cursor.monthIndex, locale)}
                  </strong>
                  {calSpan === 'week' ? (
                    <span className="oma-pv-week-chip oma-ltr" data-testid="content-week-chip">
                      {t('views.week_short').replace(
                        '{n}',
                        String(isoWeekNumber(selectedDay ?? TODAY_KEY)),
                      )}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="oma-pv-today"
                    data-testid="content-cal-today"
                    onClick={() => goToDay(TODAY_KEY)}
                  >
                    {t('views.today')}
                  </button>
                </div>
              </div>
              <div className="oma-cal-toolbar__end">
                <button
                  type="button"
                  className="oma-cal-request-approvals"
                  data-testid="demo-content-request-approvals"
                  data-active={approvalMode ? 'true' : 'false'}
                  data-tooltip={t('content.request_approvals')}
                  onClick={showApprovalQueue}
                >
                  <CheckCircleOutlined />
                  <span>
                    {approvalMode
                      ? t('content.close_requesting_approvals')
                      : t('content.request_approvals')}
                  </span>
                </button>
                <CalendarDisplaySettings value={calDisplay} onChange={setCalDisplay} />
                <span className="oma-cal-ext-wrap">
                  <button
                    type="button"
                    className="oma-cal-ext-indicator"
                    data-tooltip={t('content.external_calendars')}
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
                        <strong>{t('content.holiday_calendars')}</strong>
                        <span className="oma-ext-cal-pop__sync">
                          {t('content.workspace_markers')}
                        </span>
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
                      <p className="oma-ext-cal-pop__add">
                        {t('content.holidays_appear_as_chips_on')}
                      </p>
                    </div>
                  ) : null}
                </span>
                {!savedOpen ? (
                  <button
                    type="button"
                    className="oma-cal-saved-toggle"
                    data-testid="demo-content-saved-toggle"
                    onClick={() => setSavedOpen(true)}
                  >
                    {t('strategy.saved')}
                  </button>
                ) : null}
              </div>
            </div>

            <div
              className="oma-cal-grid"
              role="grid"
              aria-label={t('demo.view.calendar')}
              data-testid="demo-content-cal-grid"
              data-columns={calDisplay.showWeekends ? '7' : '5'}
              data-hide-weekends={calDisplay.showWeekends ? 'false' : 'true'}
              data-post-size={calDisplay.postSize}
              data-span={calSpan}
            >
              <div className="oma-cal-dow-row" data-testid="demo-content-weekdays">
                {dows.map((dow, di) => (
                  <div
                    key={dow}
                    className="oma-cal-dow"
                    role="columnheader"
                    data-weekend={
                      isWeekendKey(shiftDayKey(visibleCells[0]?.key ?? TODAY_KEY, di))
                        ? 'true'
                        : 'false'
                    }
                  >
                    {dow}
                  </div>
                ))}
              </div>
              {Array.from({ length: Math.ceil(visibleCells.length / 7) }, (_, wi) => {
                const week = visibleCells.slice(wi * 7, wi * 7 + 7);
                if (!week.length) return null;
                const weekStart = week[0]!.key;
                return (
                  <div
                    key={`week-${weekStart}`}
                    className="oma-cal-week"
                    style={{ display: 'contents' }}
                  >
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
                          data-weekend={isWeekendKey(cell.key) ? 'true' : 'false'}
                          data-selected={cell.key === selectedDay ? 'true' : 'false'}
                          onClick={() => setSelectedDay(cell.key)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData('text/oma-content-id');
                            const from = e.dataTransfer.getData('text/oma-from-day') || null;
                            if (id) void rescheduleContentToDay(id, cell.key, from);
                          }}
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
                              <span>{t('content.post')}</span>
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
                              <span>{t('content.note')}</span>
                            </button>
                          </div>

                          {/* Private sticky note — appears ABOVE cards */}
                          {calDisplay.showNotes && (note || noteDay === cell.key) ? (
                            <div
                              className="oma-cal-note oma-cal-note--inline"
                              data-color={(note?.color ?? dayNotes[cell.key]?.color) || 'yellow'}
                              data-active={noteDay === cell.key ? 'true' : 'false'}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="oma-cal-note__toolbar">
                                <div className="oma-cal-note__actions">
                                  <button
                                    type="button"
                                    className="oma-cal-note__action"
                                    data-tooltip={t('content.note_color')}
                                    aria-label={t('wsPanel.color')}
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
                                    data-tooltip={t('demo.content.edit')}
                                    aria-label={t('demo.content.edit')}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNoteDay(cell.key);
                                      const ta = (
                                        e.currentTarget.closest(
                                          '.oma-cal-note',
                                        ) as HTMLElement | null
                                      )?.querySelector('textarea');
                                      ta?.focus();
                                    }}
                                  >
                                    <FormOutlined className="oma-cal-note__action-ico" />
                                  </button>
                                  <button
                                    type="button"
                                    className="oma-cal-note__action"
                                    data-tooltip={t('content.only_visible_to_you')}
                                    aria-label={t('content.private')}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <LockOutlined className="oma-cal-note__action-ico" />
                                  </button>
                                  <button
                                    type="button"
                                    className="oma-cal-note__action"
                                    data-tooltip={t('wsPanel.delete')}
                                    aria-label={t('wsPanel.delete')}
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
                                          (dayNotes[cell.key]?.color ?? 'yellow') === c
                                            ? 'true'
                                            : 'false'
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
                              <p className="oma-cal-note__hint">
                                {t('content.private_note_only_you_can')}
                              </p>
                              <textarea
                                className="oma-cal-note__input"
                                placeholder={t('content.type_a_private_note')}
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
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/oma-content-id', item.id);
                                e.dataTransfer.setData('text/oma-from-day', cell.key);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
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
                                  placeCardMenu(item.id, e.currentTarget);
                                }}
                                className="oma-cal-item"
                              >
                                {renderCalendarCard(item)}
                              </SurfaceButton>
                              <CardActionsButton
                                itemId={item.id}
                                open={cardMenuId === item.id}
                                label={t('content.post_actions')}
                                className="oma-card-actions-btn--cal"
                                onOpen={placeCardMenu}
                                onClose={closeCardMenu}
                              />
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
                  <strong className="oma-cal-agenda-day__label">
                    <span>{weekdayForKey(day.key, locale)}</span>
                    <span className="oma-ltr">{day.key}</span>
                  </strong>
                  {day.items.length === 0 ? (
                    <p className="oma-muted" style={{ margin: '8px 0 0' }}>
                      {t('demo.empty')}
                    </p>
                  ) : (
                    <div className="oma-stack" style={{ marginTop: 8, gap: 6 }}>
                      {day.items.map((item) => (
                        <div key={item.id} className="oma-cal-agenda-item">
                          <SurfaceButton
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
                          <CardActionsButton
                            itemId={item.id}
                            open={cardMenuId === item.id}
                            label={t('content.post_actions')}
                            onOpen={placeCardMenu}
                            onClose={closeCardMenu}
                          />
                        </div>
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
                    aria-label={t('brand.evidence.close')}
                    data-tooltip={t('brand.evidence.close')}
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
                    <div
                      key={item.id}
                      className="oma-cal-saved-card"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/oma-content-id', item.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                    >
                      <SurfaceButton
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
                      <CardActionsButton
                        itemId={item.id}
                        open={cardMenuId === item.id}
                        label={t('content.post_actions')}
                        className="oma-card-actions-btn--saved"
                        onOpen={placeCardMenu}
                        onClose={closeCardMenu}
                      />
                    </div>
                  ))}
                </div>
              )}
            </aside>
          ) : null}
        </section>
      ) : null}

      {/* ── FEED VIEW ── */}
      {!loading && !unavailable && !error && filtered.length > 0 && view === 'feed' ? (
        <div className="oma-content-feed oma-content-feed--preview" data-testid="demo-content-feed">
          <div className="oma-pv-feed-stories">
            <StoriesRow
              stories={filtered
                .filter((i) => i.contentType === 'STORY')
                .map((i) => ({
                  id: i.id,
                  media: i.previewAsset || null,
                  title: pickCopy(i.title, locale),
                }))}
              canCreate={mayCreate}
              onNew={startStory}
              onOpen={(id) => {
                const row = rows.find((r) => r.id === id);
                if (row) openItem(row);
              }}
            />
          </div>
          {feedPosts.map((item) => renderFeedPost(item))}
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
              <span>{t('content.select_all').replace('{n}', String(sorted.length))}</span>
            </label>
            <button
              type="button"
              className="oma-plan-list__sort"
              onClick={() => toggleSort('date')}
            >
              {t('content.last_created')} {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          <div className="oma-plan-list__body">
            {sorted.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="oma-plan-list__row"
                  data-testid={`demo-content-card-${item.id}`}
                  data-selected={selected ? 'true' : 'false'}
                  onClick={() => openItem(item)}
                >
                  <label className="oma-plan-list__check" onClick={(e) => e.stopPropagation()}>
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
                        <NetworkIcon channel={item.channel} size={14} />
                      </span>
                      <span className="oma-plan-list__page-name">{brandName(item.brandId)}</span>
                    </div>
                    <div className="oma-plan-list__title" dir="auto">
                      {item.caption ? pickCopy(item.caption, locale) : pickCopy(item.title, locale)}
                    </div>
                  </div>
                  <div className="oma-plan-list__labels">
                    {rowLabels(item).length > 2 ? (
                      <span className="oma-pv-chip">
                        {t('views.labels_count').replace('{n}', String(rowLabels(item).length))}
                      </span>
                    ) : (
                      rowLabels(item).map((lab) => (
                        <span key={lab} className="oma-pv-chip">
                          {lab}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="oma-plan-list__mid">
                    <StatusIcons s={postStatus(item)} t={t} />
                  </div>
                  <div className="oma-plan-list__hover">
                    <button
                      type="button"
                      className="oma-plan-list__ico-btn"
                      data-tooltip={t('demo.deliverable.approve')}
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
                      data-tooltip={t('content.hide_from_clients')}
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
                      data-tooltip={t('demo.tasks.copyLink')}
                      onClick={(e) => {
                        e.stopPropagation();
                        void navigator.clipboard?.writeText(window.location.href);
                        toast.push(t('content.link_copied'), 'success');
                      }}
                    >
                      <LinkOutlined />
                    </button>
                  </div>
                  <CardActionsButton
                    itemId={item.id}
                    open={cardMenuId === item.id}
                    label={t('content.post_actions')}
                    className="oma-card-actions-btn--list"
                    onOpen={placeCardMenu}
                    onClose={closeCardMenu}
                  />
                  <div
                    className="oma-plan-list__when"
                    data-overdue={postStatus(item).overdue ? 'true' : 'false'}
                  >
                    {item.scheduledAt || item.plannedAt ? postDateText(item) : t('preview.no_date')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── GRID VIEW (Planable: stories row + 3-column gapless tiles) ── */}
      {!loading && !unavailable && !error && filtered.length > 0 && view === 'grid' ? (
        <div className="oma-pv-grid-wrap" data-testid="demo-content-grid">
          <StoriesRow
            stories={filtered
              .filter((i) => i.contentType === 'STORY')
              .map((i) => ({
                id: i.id,
                media: i.previewAsset || null,
                title: pickCopy(i.title, locale),
              }))}
            canCreate={mayCreate}
            onNew={startStory}
            onOpen={(id) => {
              const row = rows.find((r) => r.id === id);
              if (row) openItem(row);
            }}
          />
          <div className="oma-pv-grid">
            {filtered
              .filter((i) => i.contentType !== 'STORY')
              .map((item) => (
                <GridTile
                  key={item.id}
                  testId={`demo-content-card-${item.id}`}
                  caption={
                    item.caption ? pickCopy(item.caption, locale) : pickCopy(item.title, locale)
                  }
                  media={item.previewAsset || null}
                  contentType={item.contentType}
                  dateText={postDateText(item)}
                  status={postStatus(item)}
                  onOpen={() => openItem(item)}
                />
              ))}
          </div>
        </div>
      ) : null}

      {/* ── Post detail modal (drawer) ── */}
      <Dialog
        open={Boolean(selected)}
        onClose={requestCloseDrawer}
        title=""
        size="xl"
        className="oma-plan-post-modal"
        hideClose
      >
        {selected ? (
          <div
            className="oma-plan-post"
            data-testid="demo-content-drawer"
            data-detail-tab={detailTab}
            data-review={review?.state ?? ''}
          >
            <ModalNav
              onPrev={
                neighbourId(
                  (view === 'list' ? sorted : filtered).map((r) => r.id),
                  selectedId,
                  -1,
                )
                  ? () => stepModal(-1)
                  : null
              }
              onNext={
                neighbourId(
                  (view === 'list' ? sorted : filtered).map((r) => r.id),
                  selectedId,
                  1,
                )
                  ? () => stepModal(1)
                  : null
              }
            />
            <aside className="oma-plan-post__rail" aria-hidden>
              <span className="oma-plan-post__rail-ico">
                <EditOutlined />
              </span>
            </aside>

            <div className="oma-plan-post__main">
              <header className="oma-plan-post__top">
                <div className="oma-plan-post__top-start">
                  <button
                    type="button"
                    className="oma-plan-post__chip"
                    title={selected.campaignId || undefined}
                  >
                    <FlagOutlined /> {t('demo.campaigns.col.campaign')}
                  </button>
                  <button
                    type="button"
                    className="oma-plan-post__chip"
                    onClick={() => {
                      setLabelTarget('item');
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
                    <TagOutlined /> {t('wsPanel.labels')}
                  </button>
                </div>
                <div className="oma-plan-post__top-end">
                  <span
                    className="oma-plan-post__approve-count"
                    data-tooltip={t('content.not_approved_yet')}
                  >
                    <CheckOutlined />
                    <span>0</span>
                  </span>
                  <button
                    type="button"
                    className="oma-plan-post__tool-btn"
                    onClick={() => void shareContentWorkspace()}
                  >
                    {t('content.share')}
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
                    data-tooltip={t('content.feedback')}
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
                    data-tooltip={t('nav.activity')}
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
                    data-tooltip={t('content.make_visible_to_clients')}
                    onClick={() => {
                      if (selectedId) void toggleHideFromClients(selectedId);
                    }}
                  >
                    <EyeInvisibleOutlined />
                  </button>
                  <button
                    type="button"
                    className="oma-plan-post__icon-btn"
                    data-tooltip={t('wsPanel.delete')}
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
                      <ul
                        className="oma-plan-post__more-menu"
                        role="menu"
                        onClick={() => setDetailMoreOpen(false)}
                      >
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void runLifecycle('request-approval', selectedId)}
                          >
                            <FlagOutlined /> {t('demo.content.requestApproval')}
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void runLifecycle('request-changes', selectedId)}
                          >
                            <EditOutlined /> {t('strategy.review.requestChanges')}
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void runLifecycle('reject', selectedId)}
                          >
                            <CloseOutlined /> {t('strategy.review.reject')}
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void runLifecycle('mark-published', selectedId)}
                          >
                            <CheckOutlined /> {t('content.mark_published')}
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
                            <FileTextOutlined /> {t('content.save_as_template')}
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
                            <DeleteOutlined /> {t('content.archive_post')}
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
                            <FlagOutlined /> {t('content.convert_to_request_task_deliverable')}
                          </button>
                        </li>
                      </ul>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="oma-plan-post__icon-btn oma-plan-post__close"
                    onClick={requestCloseDrawer}
                    aria-label={t('brand.evidence.close')}
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
                      aria-label={t('content.desktop')}
                    >
                      <DesktopOutlined />
                    </button>
                    <button
                      type="button"
                      data-active={detailPreviewMode === 'mobile' ? 'true' : 'false'}
                      onClick={() => setDetailPreviewMode('mobile')}
                      aria-label={t('content.mobile')}
                    >
                      <MobileOutlined />
                    </button>
                    <button
                      type="button"
                      data-active={detailPreviewMode === 'edit' ? 'true' : 'false'}
                      onClick={() => setDetailPreviewMode('edit')}
                      aria-label={t('views.edit_post')}
                      data-tooltip={t('views.edit_post')}
                      data-testid="content-modal-edit"
                    >
                      <EditOutlined />
                    </button>
                  </div>

                  {detailPreviewMode !== 'edit' ? (
                    <div
                      className="oma-pv-modal-stage"
                      data-mode={detailPreviewMode}
                      data-testid="content-detail-preview"
                    >
                      <div className="oma-pv-modal-approval">
                        <span className="oma-pv-modal-approval__label">
                          {modalApproverNames().length > 0
                            ? t('views.approved_by').replace(
                                '{name}',
                                modalApproverNames().join(', '),
                              )
                            : t('content.not_approved_yet')}
                        </span>
                        <button
                          type="button"
                          className="oma-fp__approve-btn"
                          data-state={selected.approvalState || 'NOT_REQUESTED'}
                          disabled={!(mayApprove && canApprove(selected)) || saving}
                          aria-label={t('preview.approve')}
                          data-tooltip={
                            mayApprove && canApprove(selected)
                              ? t('preview.approve')
                              : t(
                                  `preview.approval.${
                                    {
                                      APPROVED: 'approved',
                                      PENDING: 'pending',
                                      PARTIALLY_APPROVED: 'partial',
                                      NOT_REQUESTED: 'not_requested',
                                    }[selected.approvalState || 'NOT_REQUESTED'] ?? 'not_requested'
                                  }`,
                                )
                          }
                          onClick={() => void runLifecycle('approve', selected.id)}
                        >
                          <CheckOutlined />
                        </button>
                        <span className="oma-fp__net">
                          <NetworkIcon channel={selected.channel} size={14} />
                        </span>
                      </div>
                      <div className="oma-pv-modal-post">
                        {renderPostPreview(
                          {
                            ...selected,
                            caption: { en: draft.caption, ar: draft.caption },
                            title: editTitle ? { en: editTitle, ar: editTitle } : selected.title,
                          },
                          'detail',
                          false,
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="oma-plan-post__editor">
                      <div className="oma-plan-post__status-col">
                        <div className="oma-plan-post__status-item">
                          <button
                            type="button"
                            className="oma-plan-post__status-btn"
                            data-tooltip={t('content.not_approved_yet')}
                            onClick={() => setApprovalTipOpen((v) => !v)}
                          >
                            <CheckOutlined />
                          </button>
                          <span className="oma-plan-post__status-label">
                            {t('content.not_approved_yet')}
                          </span>
                          {approvalTipOpen ? (
                            <div className="oma-plan-post__tip-card">
                              <strong>{t('content.no_one_approved_this_post')}</strong>
                              <p>{t('content.pending_approval_from_any_of')}</p>
                              <p className="oma-plan-post__tip-section">{t('nav.team')}</p>
                              <div className="oma-plan-post__tip-user">
                                <span className="oma-plan-post__avatar">O</span>
                                <span>
                                  {selected.assignee || 'Osama'} ({t('content.you')})
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="oma-plan-post__status-item">
                          <button
                            type="button"
                            className="oma-plan-post__status-btn"
                            data-tooltip={t('content.post_is_not_published_yet')}
                            onClick={() => setPublishTipOpen((v) => !v)}
                          >
                            <EditOutlined />
                          </button>
                          {publishTipOpen ? (
                            <div className="oma-plan-post__tip-card oma-plan-post__tip-card--sm">
                              {t('content.post_is_not_published_yet')}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="oma-plan-post__fields">
                        <div className="oma-plan-post__meta-line">
                          <span className="oma-plan-post__page">
                            {selected.channel || 'Osama page'}
                          </span>
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
                          placeholder={t('demo.create.title')}
                          data-testid="demo-content-detail-title"
                        />
                        <textarea
                          className="oma-plan-post__body-input"
                          value={draft.caption}
                          onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
                          placeholder={t('content.type_to_add_headlines_media')}
                          rows={8}
                          data-testid="demo-content-caption"
                        />
                        <div className="oma-plan-post__count">
                          {draft.caption.length} {t('content.characters')} ·{' '}
                          {draft.caption.trim() ? draft.caption.trim().split(/\s+/).length : 0}{' '}
                          {t('content.word')}
                          {draft.caption.trim().split(/\s+/).filter(Boolean).length === 1
                            ? ''
                            : draft.caption.trim()
                              ? 's'
                              : ''}
                        </div>
                        <div className="oma-plan-post__save-row">
                          <span className="oma-plan-post__save-state" data-state={saveState}>
                            {saveState === 'saved'
                              ? t('demo.content.saved')
                              : saveState === 'saving'
                                ? t('demo.content.saving')
                                : saveState === 'error'
                                  ? saveError
                                  : dirty
                                    ? t('content.unsaved_changes')
                                    : null}
                          </span>
                          {dirty ? (
                            <Button
                              type="primary"
                              loading={saving}
                              onClick={() => void saveItem()}
                              data-testid="demo-content-save"
                            >
                              {t('content.save_draft')}
                            </Button>
                          ) : null}
                          <span
                            className="oma-plan-post__approval-meta"
                            data-testid="content-approval-meta"
                          >
                            {approvalProgressLabel(selected, policy, isAr) ? (
                              <span data-testid="content-approval-progress">
                                {approvalProgressLabel(selected, policy, isAr)}
                              </span>
                            ) : null}
                            {scheduleBlockedHint(scheduleBlockReason(selected, policy), isAr) ? (
                              <span data-testid="content-schedule-blocked">
                                {scheduleBlockedHint(scheduleBlockReason(selected, policy), isAr)}
                              </span>
                            ) : null}
                            <span data-testid="content-publishing-not-connected">
                              {t('content.scheduled_inside_oma_only_external')}
                            </span>
                          </span>
                          <DatePicker
                            placeholder={t('demo.content.publish.PLANNED_DATE')}
                            showTime={{ format: t('content.hhmm') }}
                            format="MMM DD, HH:mm"
                            value={draft.scheduledAt ? dayjs(draft.scheduledAt) : null}
                            onChange={(value) => {
                              const next = value ? value.format('YYYY-MM-DDTHH:mm') : '';
                              setDraft((current) => ({ ...current, scheduledAt: next }));
                            }}
                            aria-label={t('demo.content.publish.PLANNED_DATE')}
                          />
                          <Button
                            type="default"
                            disabled={saving || !canScheduleItem(selected, policy)}
                            title={
                              scheduleBlockedHint(scheduleBlockReason(selected, policy), isAr) ??
                              undefined
                            }
                            onClick={() => void runLifecycle('schedule', selectedId)}
                            data-testid="demo-content-schedule"
                          >
                            {t('demo.content.schedule')}
                          </Button>
                          {selected.scheduleState === 'SCHEDULED' ? (
                            <Button
                              type="default"
                              disabled={saving}
                              onClick={() => void runLifecycle('unschedule', selectedId)}
                              data-testid="demo-content-unschedule"
                            >
                              {t('demo.content.unschedule')}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {detailSidePanel !== 'none' ? (
                  <aside className="oma-plan-post__side" data-testid="demo-content-side-panel">
                    <header className="oma-plan-post__side-head">
                      <strong>
                        {detailSidePanel === 'activity' ? t('nav.activity') : t('content.feedback')}
                      </strong>
                      <button
                        type="button"
                        className="oma-plan-post__icon-btn"
                        onClick={() => setDetailSidePanel('none')}
                        aria-label={t('brand.evidence.close')}
                      >
                        <CloseOutlined />
                      </button>
                    </header>

                    {detailSidePanel === 'activity' ? (
                      <div className="oma-plan-post__activity">
                        <div className="oma-plan-post__workflow-chip" style={{ marginBottom: 12 }}>
                          <strong>{t('demo.settings.section.workflow')}</strong>
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
                            {t('content.approvals')}
                          </span>
                        </div>
                        {approvalEvents.length === 0 ? (
                          <p className="oma-muted">{t('content.no_approval_events_yet')}</p>
                        ) : (
                          approvalEvents.map((ev) => (
                            <div key={ev.id} className="oma-plan-post__activity-row">
                              <span className="oma-plan-post__avatar">{ev.action.slice(0, 1)}</span>
                              <div>
                                <p>
                                  <strong>{ev.action}</strong>
                                  {ev.note
                                    ? ` — ${isAr ? ev.note.ar || ev.note.en : ev.note.en || ev.note.ar}`
                                    : ''}
                                </p>
                                <span className="oma-plan-post__activity-meta">
                                  <span className="oma-ltr">
                                    {ev.at.slice(0, 19).replace('T', ' ')}
                                  </span>
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
                            {t('demo.content.comments')}
                          </button>
                          <button
                            type="button"
                            data-active={feedbackTab === 'suggestions' ? 'true' : 'false'}
                            onClick={() => setFeedbackTab('suggestions')}
                          >
                            {t('content.suggestions')}
                          </button>
                        </div>
                        {feedbackTab === 'comments' ? (
                          <div className="oma-plan-post__comments">
                            {prodComments.length === 0 ? (
                              <div className="oma-plan-post__empty">
                                <strong>{t('content.no_comments_yet')}</strong>
                                <p>{t('content.start_the_conversation_by_leaving')}</p>
                              </div>
                            ) : (
                              <div className="oma-comment-thread">
                                {prodComments.map((c) => (
                                  <article key={c.id} className="oma-comment">
                                    <span className="oma-plan-post__avatar">
                                      {memberInitials(c.author_user_id)}
                                    </span>
                                    <div className="oma-comment__body">
                                      <div className="oma-comment-meta">
                                        <strong>{memberName(c.author_user_id)}</strong>
                                        <span className="oma-ltr">
                                          {formatCommentTime(c.at, locale)}
                                        </span>
                                      </div>
                                      <p className="oma-comment-body">
                                        {isAr ? c.body.ar || c.body.en : c.body.en || c.body.ar}
                                      </p>
                                      <button
                                        type="button"
                                        className="oma-comment-delete"
                                        onClick={() => {
                                          if (!selectedId) return;
                                          void deleteContentComment(selectedId, c.id)
                                            .then(() => {
                                              setProdComments((prev) =>
                                                prev.filter((row) => row.id !== c.id),
                                              );
                                            })
                                            .catch((err) => {
                                              toast.push(
                                                contentApiError(err, t('errors.http')),
                                                'danger',
                                              );
                                            });
                                        }}
                                      >
                                        {t('wsPanel.delete')}
                                      </button>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                            <div className="oma-plan-post__comment-box">
                              <div className="oma-plan-post__comment-input-row">
                                <span className="oma-plan-post__avatar">U</span>
                                <textarea
                                  className="oma-plan-post__comment-input"
                                  rows={2}
                                  value={commentDraft}
                                  placeholder={t('content.leave_a_comment')}
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
                                      toast.push(t('demo.tasks.commentAdded'), 'success');
                                    } catch (err) {
                                      toast.push(contentApiError(err, t('errors.http')), 'danger');
                                    }
                                  })();
                                }}
                              >
                                {t('content.send')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="oma-plan-post__empty">
                            <strong>{t('content.no_suggestions_yet')}</strong>
                            <p>{t('content.select_some_text_to_suggest')}</p>
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
            aria-label={t('content.close_filters')}
            onClick={() => setFilterSheet(false)}
          />
          <aside
            className="oma-filter-sidepanel"
            data-testid="demo-content-filter-sheet"
            role="dialog"
            aria-label={t('content.filter_sort')}
          >
            <header className="oma-filter-sidepanel__head">
              <strong>{t('content.filter_sort')}</strong>
              <button
                type="button"
                className="oma-filter-sidepanel__close"
                onClick={() => setFilterSheet(false)}
                aria-label={t('brand.evidence.close')}
              >
                ×
              </button>
            </header>
            <div className="oma-filter-sidepanel__body">
              <p className="oma-content-filter-eyebrow">{t('content.sort_by')}</p>
              <label className="oma-filter-sidepanel__row">
                <span>{t('content.sort_field')}</span>
                <OmaSelect
                  value={sortKey}
                  onChange={(value) => setSortKey(value as ContentSortKey)}
                  options={[
                    { value: 'date', label: t('demo.content.filter.date') },
                    { value: 'updated', label: t('content.last_updated') },
                    { value: 'title', label: t('demo.create.title') },
                    { value: 'channel', label: t('demo.filter.channel') },
                    { value: 'campaign', label: t('demo.campaigns.col.campaign') },
                    { value: 'owner', label: t('content.author') },
                    { value: 'status', label: t('strategy.list.col.status') },
                  ]}
                />
              </label>
              <label className="oma-filter-sidepanel__row">
                <span>{t('content.direction')}</span>
                <OmaSelect
                  value={sortDir}
                  onChange={(value) => setSortDir(value as 'asc' | 'desc')}
                  options={[
                    { value: 'desc', label: t('content.newest_first') },
                    { value: 'asc', label: t('content.oldest_first') },
                  ]}
                />
              </label>
              <div className="oma-content-filter-divider" />
              <p className="oma-content-filter-eyebrow">{t('content.filter_by')}</p>
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

      {/* Media library (WorkDrive) */}
      <MediaPickerDialog
        open={mediaLibraryOpen}
        brandId={createForm.brandId || brands[0]?.id || null}
        kind="posts"
        t={t}
        locale={locale}
        canConnect={canManageWorkspace}
        onClose={() => setMediaLibraryOpen(false)}
        onPick={(asset) => {
          setCreateForm((f) => ({ ...f, media: asset }));
          setCreateOpen(true);
        }}
      />

      {/* Approval selection bar */}
      {selectedIds.length > 0 ? (
        <div className="oma-plan-selbar" data-testid="demo-content-approval-bar">
          <div className="oma-plan-selbar__top">
            <button
              type="button"
              className="oma-plan-selbar__close"
              onClick={clearSelection}
              aria-label={t('brand.evidence.close')}
            >
              <CloseOutlined />
            </button>
            <span className="oma-plan-selbar__badge">{selectedIds.length}</span>
            <span className="oma-plan-selbar__label">
              {selectedIds.length === 1 ? t('content.post_selected') : t('content.posts_selected')}
            </span>
            <button
              type="button"
              className="oma-plan-selbar__link"
              onClick={() => setSelectedIds(sorted.map((r) => r.id))}
            >
              {t('content.select_all')}
            </button>
          </div>
          <div className="oma-plan-selbar__actions">
            <button
              type="button"
              className="oma-plan-selbar__btn"
              disabled={saving}
              onClick={() => void runLifecycle('request-approval', selectedId)}
            >
              <CheckOutlined /> {t('demo.deliverable.approve')}
            </button>
            <button
              type="button"
              className="oma-plan-selbar__btn"
              disabled={saving || selectedIds.length === 0}
              onClick={() => void sendForApproval()}
            >
              <FlagOutlined /> {t('demo.content.requestApproval')}
            </button>
            <button type="button" className="oma-plan-selbar__btn" onClick={() => undefined}>
              <CopyOutlined /> {t('content.copy_to')}
            </button>
            <button type="button" className="oma-plan-selbar__icon" onClick={() => undefined}>
              <InboxOutlined />
            </button>
            <button type="button" className="oma-plan-selbar__icon" onClick={clearSelection}>
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
                aria-label={t('brand.evidence.close')}
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
                  placeholder={t('content.type_a_private_note')}
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
                    data-tooltip={t('content.note_color')}
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
                    data-tooltip={t('content.only_visible_to_you')}
                  >
                    <LockOutlined />
                  </button>
                  <button
                    type="button"
                    className="oma-cal-note__action"
                    data-tooltip={t('wsPanel.delete')}
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
                    {t('demo.tasks.column.DONE')}
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
                        data-active={
                          (dayNotes[noteDay]?.color ?? 'yellow') === c ? 'true' : 'false'
                        }
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
        item={rows.find((r) => r.id === cardMenuId) || null}
        itemId={cardMenuId}
        policy={policy}
        locale={locale}
        variant={menuVariant}
        canEdit={mayComment}
        campaigns={(() => {
          const row = rows.find((r) => r.id === cardMenuId);
          return campaigns
            .filter((c) => !row || !c.brandId || c.brandId === row.brandId)
            .map((c) => ({ id: c.id, name: pickCopy(c.name, locale) }));
        })()}
        onAction={handleCardMenuAction}
        onClose={() => {
          setCardMenuId(null);
          setMenuPos(null);
        }}
      />

      <PlanableComposeCard
        onOpenLabels={() => {
          setLabelTarget('compose');
          const campaign = campaigns.find((c) => c.id === createForm.campaignId);
          const bid = campaign?.brandId || brands[0]?.id;
          if (bid) {
            void listBrandLabels(bid)
              .then((labs) => setBrandLabels(labs as typeof brandLabels))
              .catch(() => setBrandLabels([]));
          }
          setLabelPickerOpen(true);
        }}
        onOpenTemplates={() => {
          const bid = brands[0]?.id;
          if (bid) {
            void listBrandTemplates(bid)
              .then((tpls) => setBrandTemplates(tpls as typeof brandTemplates))
              .catch(() => setBrandTemplates([]));
          } else {
            setBrandTemplates([]);
          }
          setTemplatePickerOpen(true);
        }}
        open={createOpen}
        creating={creating}
        error={createError}
        form={createForm}
        campaigns={campaigns}
        locale={locale}
        brandId={
          createForm.brandId ||
          campaigns.find((c) => c.id === createForm.campaignId)?.brandId ||
          brands[0]?.id ||
          null
        }
        canConnectStorage={canManageWorkspace}
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

      <Dialog
        open={labelPickerOpen}
        title={t('wsPanel.labels')}
        size="lg"
        className="oma-label-dialog"
        zIndex={1200}
        onClose={() => setLabelPickerOpen(false)}
      >
        <div className="oma-label-panel" data-testid="demo-content-labels">
          <p className="oma-label-panel__lead">
            {labelTarget === 'compose'
              ? t('content.choose_labels_for_this_draft')
              : t('content.labels_are_saved_on_the')}
          </p>
          <Input
            value={labelQuery}
            data-testid="demo-content-label-search"
            placeholder={t('content.search_labels')}
            onChange={(e) => setLabelQuery(e.target.value)}
          />
          <div className="oma-label-panel__list">
            {brandLabels.filter((lab) => {
              const q = labelQuery.trim().toLowerCase();
              if (!q) return true;
              return `${lab.name?.en ?? ''} ${lab.name?.ar ?? ''}`.toLowerCase().includes(q);
            }).length === 0 ? (
              <div className="oma-label-panel__empty">
                <TagOutlined />
                <strong>{t('content.no_labels_yet')}</strong>
                <span>{t('content.add_one_with_a_name')}</span>
              </div>
            ) : (
              brandLabels
                .filter((lab) => {
                  const q = labelQuery.trim().toLowerCase();
                  if (!q) return true;
                  return `${lab.name?.en ?? ''} ${lab.name?.ar ?? ''}`.toLowerCase().includes(q);
                })
                .map((lab) => {
                  const name = lab.name?.en || lab.id;
                  const shown = isAr
                    ? lab.name?.ar || lab.name?.en || lab.id
                    : lab.name?.en || lab.name?.ar || lab.id;
                  const on = activeLabelNames().includes(name);
                  return (
                    <button
                      key={lab.id}
                      type="button"
                      className="oma-label-card"
                      data-selected={on ? 'true' : 'false'}
                      onClick={() => toggleWorkspaceLabel(name)}
                    >
                      <span
                        className="oma-label-card__swatch"
                        style={{ background: lab.color || '#1677ff' }}
                      />
                      <span className="oma-label-card__name">{shown}</span>
                      <span className="oma-label-card__check">{on ? '✓' : ''}</span>
                    </button>
                  );
                })
            )}
          </div>
          <div className="oma-label-panel__create">
            <strong>{t('wsPanel.new_label')}</strong>
            <div className="oma-label-panel__create-row">
              <Input
                value={labelDraft}
                data-testid="demo-content-label-name"
                placeholder={t('content.label_name')}
                onChange={(e) => setLabelDraft(e.target.value)}
              />
              <Button
                type="primary"
                data-testid="demo-content-label-add"
                onClick={() => {
                  const brandId =
                    (labelTarget === 'compose' ? createForm.brandId : selected?.brandId) ||
                    brands[0]?.id;
                  if (!brandId || !labelDraft.trim()) return;
                  void createBrandLabel(
                    brandId,
                    { en: labelDraft.trim(), ar: labelDraft.trim() },
                    labelColor,
                  )
                    .then((lab) => {
                      setBrandLabels((prev) => [...prev, lab as (typeof brandLabels)[0]]);
                      setLabelDraft('');
                      toggleWorkspaceLabel(lab.name?.en || labelDraft.trim());
                    })
                    .catch((err) => toast.push(contentApiError(err, t('errors.http')), 'danger'));
                }}
              >
                {t('content.add')}
              </Button>
            </div>
            <div
              className="oma-label-panel__colors"
              role="listbox"
              aria-label={t('content.label_color')}
            >
              {LABEL_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="oma-label-panel__color"
                  style={{ background: color }}
                  data-active={labelColor === color ? 'true' : 'false'}
                  aria-label={color}
                  onClick={() => setLabelColor(color)}
                />
              ))}
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        zIndex={1200}
        open={templatePickerOpen}
        title={t('wsPanel.templates')}
        size="lg"
        className="oma-template-dialog"
        onClose={() => setTemplatePickerOpen(false)}
      >
        <div className="oma-template-panel" data-testid="demo-content-templates">
          <p className="oma-template-panel__lead">{t('content.use_a_template_to_create')}</p>
          {brandTemplates.length === 0 ? (
            <div className="oma-template-panel__empty">
              <FileTextOutlined />
              <strong>{t('content.no_workspace_templates_yet')}</strong>
              <span>{t('content.open_any_post_and_choose')}</span>
            </div>
          ) : (
            <div className="oma-template-panel__grid">
              {brandTemplates.map((tpl) => {
                const title = templateTitle(tpl, isAr);
                const caption = isAr
                  ? tpl.caption?.ar || tpl.caption?.en || tpl.title?.ar || tpl.title?.en
                  : tpl.caption?.en || tpl.caption?.ar || tpl.title?.en || tpl.title?.ar;
                return (
                  <article
                    key={tpl.id}
                    className="oma-template-card"
                    data-testid={`demo-template-${tpl.id}`}
                  >
                    <div className="oma-template-card__media" aria-hidden>
                      {tpl.preview_asset_url ? (
                        <img src={tpl.preview_asset_url} alt="" />
                      ) : (
                        <FileTextOutlined />
                      )}
                    </div>
                    <div className="oma-template-card__body">
                      <strong>{title}</strong>
                      <span className="oma-template-card__meta">
                        {tpl.channel || t('content.no_channel')}
                        {tpl.content_type ? ` · ${tpl.content_type}` : ''}
                      </span>
                      {caption ? <p>{caption}</p> : null}
                      {tpl.labels && tpl.labels.length > 0 ? (
                        <div className="oma-template-card__labels">
                          {tpl.labels.slice(0, 3).map((lab) => (
                            <span key={lab}>{lab}</span>
                          ))}
                        </div>
                      ) : null}
                      <Button type="primary" onClick={() => void applyTemplate(tpl)}>
                        {t('content.use_template')}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
