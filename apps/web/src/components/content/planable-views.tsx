'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../../lib/use-locale';
import type { CalendarDisplay, CalendarElement } from '../../lib/content-views';
import { NetworkIcon } from './network-icon';
import { isPlaceholderAsset } from './post-preview-model';
import { MediaSurface } from './media-surface';

/* ── shared status glyphs (approved green · pending grey · scheduled blue clock · overdue red) ── */

export type PostStatus = {
  approval: string;
  scheduled: boolean;
  published: boolean;
  overdue: boolean;
  hidden: boolean;
  comments: number;
};

const svg = (d: string, size = 12) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={d} />
  </svg>
);
const ICON = {
  check: 'm5 12.5 4.2 4.2L19 7',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  send: 'M21 3 3 10.5l7 2.5 2.5 7L21 3Z',
  comment: 'M4 5h16v11H8l-4 3.5V5Z',
  hidden:
    'M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 4.5 9 6-.3.8-1.2 2.2-2.6 3.5M6.6 7.6C4.6 8.9 3.3 10.8 3 12c.5 1.5 4 6 9 6 1.5 0 2.8-.4 4-1',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5',
  video: 'M4 6h12v12H4zM16 10l5-3v10l-5-3',
  carousel: 'M7 5h13v13H7zM4 8v12h12',
};

export function StatusIcons({ s, t }: { s: PostStatus; t: (k: string) => string }) {
  return (
    <span className="oma-pv-status">
      {s.comments > 0 ? (
        <span className="oma-pv-status__i" title={t('preview.comments.title')}>
          {svg(ICON.comment)}
          <span className="oma-ltr">{s.comments}</span>
        </span>
      ) : null}
      {s.approval === 'APPROVED' ? (
        <span className="oma-pv-dot oma-pv-dot--ok" title={t('preview.approval.approved')}>
          {svg(ICON.check, 10)}
        </span>
      ) : null}
      {s.published ? (
        <span className="oma-pv-dot oma-pv-dot--pub" title={t('views.status.published')}>
          {svg(ICON.send, 10)}
        </span>
      ) : s.scheduled ? (
        <span
          className={`oma-pv-dot ${s.overdue ? 'oma-pv-dot--late' : 'oma-pv-dot--sched'}`}
          title={t(s.overdue ? 'views.status.overdue' : 'views.status.scheduled')}
        >
          {svg(ICON.clock, 10)}
        </span>
      ) : null}
      {s.hidden ? (
        <span className="oma-pv-status__i" title={t('views.status.team_only')}>
          {svg(ICON.hidden)}
        </span>
      ) : null}
    </span>
  );
}

export function ApprovalPill({ approval, t }: { approval: string; t: (k: string) => string }) {
  const key =
    approval === 'APPROVED'
      ? 'preview.approval.approved'
      : approval === 'PENDING' || approval === 'PARTIALLY_APPROVED'
        ? 'views.approval.pending_short'
        : null;
  if (!key) return null;
  return (
    <span className="oma-pv-pill" data-state={approval}>
      {svg(approval === 'APPROVED' ? ICON.check : ICON.clock, 10)}
      {t(key)}
    </span>
  );
}

/* ── calendar post card ─────────────────────────────────────── */

export function CalendarPostCard({
  channel,
  channels,
  accountName,
  time,
  timeTone,
  caption,
  media,
  contentType,
  labels,
  campaign,
  status,
  display,
  draft,
  attention,
}: {
  channel: string;
  /** Extra network keys when the post targets multiple pages (Planable multi-icon row). */
  channels?: string[];
  /** Page / brand name shown beside the network icon when there is a single channel. */
  accountName?: string;
  time: string;
  timeTone: 'scheduled' | 'overdue' | 'draft' | 'published';
  caption: string;
  media: string | null;
  contentType?: string;
  labels: string[];
  campaign?: string;
  status: PostStatus;
  display: CalendarDisplay;
  draft: boolean;
  /** Yellow striped top edge (Planable attention/flag strip). */
  attention?: boolean;
}) {
  const t = useT();
  const has = (e: CalendarElement) => display.elements.includes(e);
  const showMedia = display.postSize === 'default' && media && !isPlaceholderAsset(media);
  const isVideo = contentType === 'REEL' || contentType === 'STORY' || contentType === 'VIDEO';
  const nets = (channels?.length ? channels : [channel]).filter(Boolean);
  const overflow = Math.max(0, nets.length - 2);
  const shownNets = nets.slice(0, 2);
  const single = nets.length === 1;
  const pending =
    status.approval === 'PENDING' || status.approval === 'PARTIALLY_APPROVED';
  const approved = status.approval === 'APPROVED';
  return (
    <span
      className="oma-pv-cal-card"
      data-size={display.postSize}
      data-faded={display.fadePublished && status.published ? 'true' : 'false'}
      data-draft={draft ? 'true' : 'false'}
      data-attention={attention || pending ? 'true' : 'false'}
    >
      {(has('labels') && labels.length) || (has('campaigns') && campaign) ? (
        <span className="oma-pv-chips">
          {has('campaigns') && campaign ? (
            <span className="oma-pv-chip oma-pv-chip--campaign">{campaign}</span>
          ) : null}
          {has('labels')
            ? labels.slice(0, campaign && has('campaigns') ? 1 : 2).map((l) => (
                <span key={l} className="oma-pv-chip">
                  {l}
                </span>
              ))
            : null}
          {has('labels') &&
          labels.length > (campaign && has('campaigns') ? 1 : 2) ? (
            <span className="oma-pv-chip oma-pv-chip--more oma-ltr">
              +{labels.length - (campaign && has('campaigns') ? 1 : 2)}
            </span>
          ) : null}
        </span>
      ) : null}
      <span className="oma-pv-cal-card__row">
        <span className="oma-pv-cal-card__account">
          <span className="oma-pv-cal-card__nets" aria-hidden>
            {shownNets.map((n) => (
              <span key={n} className="oma-pv-cal-card__net">
                <NetworkIcon channel={n} size={12} />
              </span>
            ))}
            {overflow > 0 ? <span className="oma-pv-cal-card__net-more oma-ltr">+{overflow}</span> : null}
          </span>
          {single && accountName ? <span className="oma-pv-cal-card__name">{accountName}</span> : null}
        </span>
        <span className="oma-pv-cal-card__spacer" />
        {time || draft ? (
          <span className="oma-pv-cal-card__time oma-ltr" data-tone={timeTone}>
            {time || (draft ? t('views.status.draft') : '')}
            <i
              className="oma-pv-cal-card__dot"
              data-state={approved ? 'ok' : pending ? 'pending' : draft ? 'draft' : 'none'}
              aria-hidden
            />
          </span>
        ) : null}
      </span>
      {showMedia ? (
        <span className="oma-pv-cal-card__media" data-video={isVideo ? 'true' : 'false'}>
          <MediaSurface src={media!} contentType={contentType} alt="" />
          {isVideo ? (
            <span className="oma-pv-cal-card__play" aria-hidden>
              {svg(ICON.video, 12)}
            </span>
          ) : null}
          {contentType && contentType !== 'POST' && contentType !== 'STATIC' ? (
            <span className="oma-pv-cal-card__type" data-type={contentType}>
              {contentType === 'STORY'
                ? 'Story'
                : contentType === 'REEL'
                  ? 'Reels'
                  : contentType === 'CAROUSEL'
                    ? 'Carousel'
                    : contentType === 'VIDEO'
                      ? 'Video'
                      : contentType}
            </span>
          ) : null}
        </span>
      ) : display.postSize === 'default' ? (
        <span className="oma-pv-cal-card__media oma-pv-cal-card__media--empty" aria-hidden />
      ) : null}
      {caption ? (
        <span className="oma-pv-cal-card__text" dir="auto">
          {caption}
        </span>
      ) : null}
      {(has('approvals') && (approved || pending)) ||
      (has('comments') && status.comments > 0) ||
      status.hidden ? (
        <span className="oma-pv-cal-card__foot">
          {has('approvals') ? <ApprovalPill approval={status.approval} t={t} /> : null}
          <span className="oma-pv-cal-card__foot-end">
            {status.hidden ? (
              <span className="oma-pv-status__i" title={t('views.status.team_only')}>
                {svg(ICON.hidden)}
              </span>
            ) : null}
            {has('comments') && status.comments > 0 ? (
              <span className="oma-pv-status__i">
                {svg(ICON.comment)}
                <span className="oma-ltr">{status.comments}</span>
              </span>
            ) : null}
          </span>
        </span>
      ) : null}
    </span>
  );
}

/* ── calendar display settings popover ──────────────────────── */

export function CalendarDisplaySettings({
  value,
  onChange,
}: {
  value: CalendarDisplay;
  onChange: (next: CalendarDisplay) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  useOutside(ref, open, () => setOpen(false));
  const toggleEl = (e: CalendarElement) =>
    onChange({
      ...value,
      elements: value.elements.includes(e)
        ? value.elements.filter((x) => x !== e)
        : [...value.elements, e],
    });
  const check = (
    k: 'showNotes' | 'showCampaigns' | 'showWeekends' | 'fadePublished',
    label: string,
  ) => (
    <label className="oma-pv-ds__check">
      <input
        type="checkbox"
        checked={value[k]}
        onChange={(e) => onChange({ ...value, [k]: e.target.checked })}
      />
      <span>{t(label)}</span>
    </label>
  );
  return (
    <span className="oma-pv-ds" ref={ref}>
      <button
        type="button"
        className="oma-pv-icon-btn"
        aria-label={t('views.display.title')}
        aria-expanded={open}
        data-tooltip={t('views.display.title')}
        data-testid="content-display-settings"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6" />
        </svg>
      </button>
      {open ? (
        <div className="oma-pv-ds__pop" role="dialog" aria-label={t('views.display.title')}>
          <strong className="oma-pv-ds__title">{t('views.display.title')}</strong>
          <span className="oma-pv-ds__label">{t('views.display.post_size')}</span>
          <div className="oma-pv-ds__sizes">
            {(['default', 'compact'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className="oma-pv-ds__size"
                data-active={value.postSize === s ? 'true' : 'false'}
                onClick={() => onChange({ ...value, postSize: s })}
              >
                <span className="oma-pv-ds__size-art" data-size={s} aria-hidden>
                  <i />
                  <i />
                </span>
                {t(`views.display.size_${s}`)}
              </button>
            ))}
          </div>
          <span className="oma-pv-ds__label">{t('views.display.elements')}</span>
          <div className="oma-pv-ds__chips">
            {(['approvals', 'labels', 'campaigns', 'comments'] as const).map((e) => (
              <button
                key={e}
                type="button"
                className="oma-pv-ds__chip"
                aria-pressed={value.elements.includes(e)}
                data-active={value.elements.includes(e) ? 'true' : 'false'}
                onClick={() => toggleEl(e)}
              >
                {t(`views.display.el_${e}`)}
              </button>
            ))}
          </div>
          <div className="oma-pv-ds__checks">
            {check('showNotes', 'views.display.show_notes')}
            {check('showCampaigns', 'views.display.show_campaigns')}
            {check('showWeekends', 'views.display.show_weekends')}
            {check('fadePublished', 'views.display.fade_published')}
          </div>
          <label className="oma-pv-ds__row">
            <span>{t('views.display.start_week')}</span>
            <select
              value={value.weekStartsOn}
              onChange={(e) =>
                onChange({ ...value, weekStartsOn: Number(e.target.value) as 0 | 1 | 6 })
              }
            >
              <option value={1}>{t('views.day.monday')}</option>
              <option value={0}>{t('views.day.sunday')}</option>
              <option value={6}>{t('views.day.saturday')}</option>
            </select>
          </label>
        </div>
      ) : null}
    </span>
  );
}

/* ── grid tile ─────────────────────────────────────────────── */

export function GridTile({
  caption,
  media,
  contentType,
  dateText,
  status,
  onOpen,
  testId,
}: {
  caption: string;
  media: string | null;
  contentType: string;
  dateText: string;
  status: PostStatus;
  onOpen: () => void;
  testId?: string;
}) {
  const t = useT();
  const real = media && !isPlaceholderAsset(media);
  const typeIcon =
    contentType === 'REEL' || contentType === 'STORY'
      ? ICON.video
      : contentType === 'CAROUSEL'
        ? ICON.carousel
        : ICON.image;
  return (
    <button
      type="button"
      className="oma-pv-tile"
      onClick={onOpen}
      data-testid={testId}
      data-faded={status.published ? 'true' : 'false'}
    >
      {real ? (
        <MediaSurface src={media!} contentType={contentType} alt={caption} autoPlay loop />
      ) : (
        <span className="oma-pv-tile__ph" aria-hidden />
      )}
      <span className="oma-pv-tile__top" dir="auto">
        {caption}
      </span>
      <span className="oma-pv-tile__hover">
        <span className="oma-pv-tile__date">{dateText}</span>
        <span className="oma-pv-tile__cap" dir="auto">
          {caption}
        </span>
      </span>
      <span className="oma-pv-tile__type" title={t(`views.type.${contentType.toLowerCase()}`)}>
        {svg(typeIcon, 14)}
      </span>
      <span className="oma-pv-tile__icons">
        <StatusIcons s={status} t={t} />
      </span>
    </button>
  );
}

/* ── stories row (feed + grid) ─────────────────────────────── */

export function StoriesRow({
  stories,
  onNew,
  onOpen,
  canCreate,
}: {
  stories: Array<{ id: string; media: string | null; title: string }>;
  onNew: () => void;
  onOpen: (id: string) => void;
  canCreate: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(true);
  return (
    <section className="oma-pv-stories" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="oma-pv-stories__head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <strong>{t('views.stories')}</strong>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d={open ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
        </svg>
      </button>
      {open ? (
        <div className="oma-pv-stories__row">
          {canCreate ? (
            <button type="button" className="oma-pv-story oma-pv-story--new" onClick={onNew}>
              <span aria-hidden>+</span>
              <span>{t('views.new_story')}</span>
            </button>
          ) : null}
          {stories.map((s) => (
            <button
              key={s.id}
              type="button"
              className="oma-pv-story"
              onClick={() => onOpen(s.id)}
              title={s.title}
            >
              {s.media && !isPlaceholderAsset(s.media) ? (
                <MediaSurface src={s.media} contentType="STORY" alt={s.title} autoPlay loop />
              ) : (
                <span className="oma-pv-tile__ph" aria-hidden />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/* ── modal edge arrows ─────────────────────────────────────── */

export function ModalNav({
  onPrev,
  onNext,
  children,
}: {
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  children?: ReactNode;
}) {
  const t = useT();
  return (
    <>
      <button
        type="button"
        className="oma-pv-modal-arrow"
        data-side="start"
        disabled={!onPrev}
        onClick={() => onPrev?.()}
        aria-label={t('views.prev_post')}
        data-testid="content-modal-prev"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        className="oma-pv-modal-arrow"
        data-side="end"
        disabled={!onNext}
        onClick={() => onNext?.()}
        aria-label={t('views.next_post')}
        data-testid="content-modal-next"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      {children}
    </>
  );
}

function useOutside(ref: React.RefObject<HTMLElement | null>, active: boolean, onOut: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onOut();
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [ref, active, onOut]);
}
