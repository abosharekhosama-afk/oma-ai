'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../../lib/use-locale';
import { NetworkIcon } from './network-icon';
import {
  aspectRatioFor,
  CAPTION_LIMIT,
  initials,
  isPlaceholderAsset,
  resolveLayout,
  resolveNetwork,
  splitCaption,
  tokenizeCaption,
  type PreviewContentType,
  type PreviewNetwork,
} from './post-preview-model';
import { MediaSurface } from './media-surface';

export type PreviewApprovalState =
  | 'NOT_REQUESTED'
  | 'PENDING'
  | 'PARTIALLY_APPROVED'
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'REJECTED';

export type PostPreviewReview = {
  state: PreviewApprovalState;
  approved?: number;
  required?: number;
  canApprove: boolean;
  canRequestChanges: boolean;
  canRequestApproval: boolean;
  commentCount: number;
  busy?: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;
  onRequestApproval: () => void;
  onComment: () => void;
};

export type PostPreviewProps = {
  channel: string;
  contentType: PreviewContentType;
  brandName: string;
  avatarUrl?: string | null;
  caption: string;
  title?: string;
  media?: string | null;
  /** Ordered media URLs for carousel (preview + card). Falls back to `media`. */
  mediaItems?: string[] | null;
  when?: string | null;
  whenKind?: 'scheduled' | 'planned' | null;
  locale: string;
  size?: 'feed' | 'detail';
  review?: PostPreviewReview;
  onOpen?: () => void;
  headerActions?: ReactNode;
  hideNetworkLabel?: boolean;
};

type Ctx = PostPreviewProps & {
  network: PreviewNetwork;
  t: (k: string) => string;
  dateText: string;
};

export function formatPreviewDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const d = new Date(iso.length <= 16 ? `${iso}:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

/* ── shared pieces ─────────────────────────────────────────── */

function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  return (
    <span className="oma-pp__avatar" style={{ width: size, height: size }} aria-hidden>
      {url ? <img src={url} alt="" /> : <span>{initials(name)}</span>}
    </span>
  );
}

function Media({ ctx, ratio }: { ctx: Ctx; ratio?: string }) {
  const r = ratio ?? aspectRatioFor(ctx.network, ctx.contentType);
  const items = (ctx.mediaItems?.length
    ? ctx.mediaItems
    : ctx.media
      ? [ctx.media]
      : []
  ).filter((src) => src && !isPlaceholderAsset(src));
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const detail = ctx.size === 'detail';
  const count = items.length;
  const active = count ? items[Math.min(index, count - 1)]! : null;
  const show = Boolean(active);
  const multi = count > 1;

  useEffect(() => {
    setIndex(0);
  }, [items.join('|')]);

  const go = (dir: -1 | 1) => {
    if (!multi) return;
    setIndex((i) => (i + dir + count) % count);
  };

  return (
    <div
      className="oma-pp__media"
      style={{ aspectRatio: r }}
      data-ratio={r}
      data-carousel={multi ? 'true' : 'false'}
      onTouchStart={(e) => {
        touchX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) < 40) return;
        go(dx < 0 ? 1 : -1);
      }}
    >
      {show ? (
        <MediaSurface
          key={active!}
          src={active!}
          contentType={ctx.contentType}
          alt={ctx.title || ''}
          className="oma-pp__media-content"
          autoPlay
          loop={!detail}
          controls={detail}
          preload={detail ? 'auto' : undefined}
        />
      ) : (
        <div className="oma-pp__media-ph">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect
              x="3"
              y="4.5"
              width="18"
              height="15"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="9" cy="10" r="1.6" fill="currentColor" />
            <path
              d="m4.5 18 5-5 3.5 3.5 2.5-2.5 4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
      {(ctx.contentType === 'REEL' || ctx.contentType === 'STORY') && show && !detail ? (
        <span className="oma-pp__play" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      ) : null}
      {multi ? (
        <>
          <button
            type="button"
            className="oma-pp__nav oma-pp__nav--prev"
            aria-label="Previous"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="oma-pp__nav oma-pp__nav--next"
            aria-label="Next"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="oma-pp__counter oma-ltr" aria-hidden>
            {index + 1}/{count}
          </span>
          <span className="oma-pp__dots" aria-hidden>
            {items.map((_, i) => (
              <i key={i} data-on={i === index ? 'true' : 'false'} />
            ))}
          </span>
        </>
      ) : ctx.contentType === 'CAROUSEL' ? (
        <span className="oma-pp__dots" aria-hidden>
          <i data-on="true" />
          <i />
          <i />
        </span>
      ) : null}
    </div>
  );
}

function Caption({ ctx, lead, moreKey }: { ctx: Ctx; lead?: ReactNode; moreKey: string }) {
  const [open, setOpen] = useState(false);
  const { visible, truncated } = splitCaption(ctx.caption, CAPTION_LIMIT[ctx.network]);
  const text = open || !truncated ? ctx.caption.trim() : visible;
  if (!text && !lead) return null;
  return (
    <p className="oma-pp__caption" dir="auto">
      {lead}
      {tokenizeCaption(text).map((seg, i) =>
        seg.tag ? (
          <span key={i} className="oma-pp__tag">
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
      {truncated && !open ? (
        <>
          {'… '}
          <button
            type="button"
            className="oma-pp__more"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
          >
            {ctx.t(moreKey)}
          </button>
        </>
      ) : null}
    </p>
  );
}

function When({ ctx }: { ctx: Ctx }) {
  const label = ctx.dateText
    ? ctx.whenKind === 'planned'
      ? `${ctx.t('preview.planned')} · ${ctx.dateText}`
      : ctx.dateText
    : ctx.t('preview.no_date');
  return <span className="oma-pp__when">{label}</span>;
}

function Header({ ctx, avatar = 32, extra }: { ctx: Ctx; avatar?: number; extra?: ReactNode }) {
  return (
    <div className="oma-pp__head">
      <Avatar name={ctx.brandName} url={ctx.avatarUrl} size={avatar} />
      <div className="oma-pp__who">
        <bdi className="oma-pp__name">{ctx.brandName}</bdi>
        <When ctx={ctx} />
      </div>
      {extra}
      {ctx.headerActions ? (
        <span className="oma-pp__head-actions" onClick={(e) => e.stopPropagation()}>
          {ctx.headerActions}
        </span>
      ) : (
        <span className="oma-pp__kebab" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </span>
      )}
    </div>
  );
}

const ICON: Record<string, string> = {
  like: 'M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5L12 20.3Z',
  comment: 'M4 5h16v11H8l-4 3.5V5Z',
  share: 'M21 3 3 10.5l7 2.5 2.5 7L21 3Zm-11 10 5-5',
  save: 'M6 3h12v18l-6-4.5L6 21V3Z',
  thumb:
    'M7 10v10H4V10h3Zm2 10h8.2a2 2 0 0 0 2-1.6l1.3-6A2 2 0 0 0 18.5 10H14l.8-4a1.8 1.8 0 0 0-3.4-1L9 10v10Z',
  repost: 'M7 7h10l-3-3m3 3-3 3M17 17H7l3 3m-3-3 3-3',
  views: 'M4 20V10m5 10V4m5 16v-7m5 7V8',
  check: 'M5 12.5 9.5 17 19 7',
  flag: 'M5 21V4h11l-1.5 4 1.5 4H5',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Z',
};

function ActIcon({ name }: { name: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <path d={ICON[name]} />
    </svg>
  );
}

function ActionBar({
  ctx,
  items,
  labelled,
}: {
  ctx: Ctx;
  items: Array<[string, string]>;
  labelled?: boolean;
}) {
  return (
    <div className="oma-pp__actions" data-labelled={labelled ? 'true' : 'false'} aria-hidden>
      {items.map(([icon, key]) => (
        <span key={key} className="oma-pp__act" data-icon={icon}>
          <ActIcon name={icon} />
          {labelled ? <span>{ctx.t(key)}</span> : null}
        </span>
      ))}
    </div>
  );
}

/* ── per-network previews ──────────────────────────────────── */

export function InstagramPreview({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <Header ctx={ctx} avatar={32} />
      <Media ctx={ctx} />
      <div className="oma-pp__actions oma-pp__actions--ig" aria-hidden>
        <span className="oma-pp__act">
          <ActIcon name="like" />
        </span>
        <span className="oma-pp__act">
          <ActIcon name="comment" />
        </span>
        <span className="oma-pp__act">
          <ActIcon name="share" />
        </span>
        <span className="oma-pp__act oma-pp__act--end">
          <ActIcon name="save" />
        </span>
      </div>
      <Caption
        ctx={ctx}
        moreKey="preview.more"
        lead={<bdi className="oma-pp__name oma-pp__lead">{ctx.brandName}</bdi>}
      />
    </>
  );
}

export function VerticalPreview({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <Header ctx={ctx} avatar={32} />
      <Media ctx={ctx} ratio="9 / 16" />
      <ActionBar
        ctx={ctx}
        items={[
          ['like', 'preview.like'],
          ['comment', 'preview.comment'],
          ['share', 'preview.share'],
        ]}
      />
      <div className="oma-pp__pad">
        <Caption ctx={ctx} moreKey="preview.more" />
      </div>
    </>
  );
}

export function FacebookPreview({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <Header ctx={ctx} avatar={40} />
      <div className="oma-pp__pad">
        <Caption ctx={ctx} moreKey="preview.see_more" />
      </div>
      <Media ctx={ctx} />
      <ActionBar
        ctx={ctx}
        labelled
        items={[
          ['thumb', 'preview.like'],
          ['comment', 'preview.comment'],
          ['share', 'preview.share'],
        ]}
      />
    </>
  );
}

export function LinkedInPreview({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <Header ctx={ctx} avatar={48} />
      <div className="oma-pp__pad">
        <Caption ctx={ctx} moreKey="preview.see_more" />
      </div>
      <Media ctx={ctx} />
      <ActionBar
        ctx={ctx}
        labelled
        items={[
          ['thumb', 'preview.like'],
          ['comment', 'preview.comment'],
          ['repost', 'preview.repost'],
          ['share', 'preview.send'],
        ]}
      />
    </>
  );
}

export function XPreview({ ctx }: { ctx: Ctx }) {
  return (
    <div className="oma-pp__x">
      <Avatar name={ctx.brandName} url={ctx.avatarUrl} size={40} />
      <div className="oma-pp__x-col">
        <div className="oma-pp__x-head">
          <bdi className="oma-pp__name">{ctx.brandName}</bdi>
          <When ctx={ctx} />
        </div>
        <Caption ctx={ctx} moreKey="preview.see_more" />
        <div className="oma-pp__x-card">
          <Media ctx={ctx} />
        </div>
        <ActionBar
          ctx={ctx}
          items={[
            ['comment', 'preview.reply'],
            ['repost', 'preview.repost'],
            ['like', 'preview.like'],
            ['views', 'preview.views'],
          ]}
        />
      </div>
    </div>
  );
}

export function GenericPreview({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <Header ctx={ctx} />
      <div className="oma-pp__pad">
        {ctx.title ? (
          <strong className="oma-pp__title" dir="auto">
            {ctx.title}
          </strong>
        ) : null}
        <Caption ctx={ctx} moreKey="preview.see_more" />
      </div>
      <Media ctx={ctx} />
    </>
  );
}

/* ── review / approval strip on the post ───────────────────── */

const STATE_KEY: Record<PreviewApprovalState, string> = {
  NOT_REQUESTED: 'preview.approval.not_requested',
  PENDING: 'preview.approval.pending',
  PARTIALLY_APPROVED: 'preview.approval.partial',
  APPROVED: 'preview.approval.approved',
  CHANGES_REQUESTED: 'preview.approval.changes_requested',
  REJECTED: 'preview.approval.rejected',
};

export function ReviewStrip({
  review,
  t,
}: {
  review: PostPreviewReview;
  t: (k: string) => string;
}) {
  const stop = (fn: () => void) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    fn();
  };
  const count =
    review.required &&
    review.required > 0 &&
    (review.state === 'PENDING' || review.state === 'PARTIALLY_APPROVED')
      ? ` ${review.approved ?? 0}/${review.required}`
      : '';
  return (
    <div className="oma-pp__review" data-state={review.state}>
      <span className="oma-pp__state" data-state={review.state}>
        <i aria-hidden />
        {t(STATE_KEY[review.state])}
        {count ? <span className="oma-ltr">{count}</span> : null}
      </span>
      <div className="oma-pp__review-btns">
        {review.state === 'NOT_REQUESTED' ? (
          <button
            type="button"
            className="oma-pp__btn"
            disabled={!review.canRequestApproval || review.busy}
            aria-label={t('preview.request_approval')}
            data-tooltip={t('preview.request_approval')}
            onClick={stop(review.onRequestApproval)}
          >
            <span className="oma-pp__btn-icon" aria-hidden>
              <ActIcon name="flag" />
            </span>
            <span className="oma-pp__btn-label">{t('preview.request_approval')}</span>
          </button>
        ) : null}
        {review.state === 'PENDING' || review.state === 'PARTIALLY_APPROVED' ? (
          <>
            <button
              type="button"
              className="oma-pp__btn"
              disabled={!review.canRequestChanges || review.busy}
              aria-label={t('preview.request_changes')}
              data-tooltip={t('preview.request_changes')}
              onClick={stop(review.onRequestChanges)}
            >
              <span className="oma-pp__btn-icon" aria-hidden>
                <ActIcon name="edit" />
              </span>
              <span className="oma-pp__btn-label">{t('preview.request_changes')}</span>
            </button>
            <button
              type="button"
              className="oma-pp__btn oma-pp__btn--primary"
              disabled={!review.canApprove || review.busy}
              aria-label={t('preview.approve')}
              data-tooltip={t('preview.approve')}
              onClick={stop(review.onApprove)}
            >
              <span className="oma-pp__btn-icon" aria-hidden>
                <ActIcon name="check" />
              </span>
              <span className="oma-pp__btn-label">{t('preview.approve')}</span>
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="oma-pp__btn oma-pp__btn--ghost"
          onClick={stop(review.onComment)}
          aria-label={t('preview.comment')}
          data-tooltip={t('preview.comment')}
        >
          <ActIcon name="comment" />
          <span className="oma-ltr">{review.commentCount}</span>
        </button>
      </div>
    </div>
  );
}

/* ── dispatcher ────────────────────────────────────────────── */

export type PreviewKind =
  | 'instagram'
  | 'instagram-vertical'
  | 'facebook'
  | 'facebook-vertical'
  | 'linkedin'
  | 'x'
  | 'tiktok'
  | 'generic';

export function previewKind(channel: string, type: PreviewContentType): PreviewKind {
  const n = resolveNetwork(channel);
  if (n === 'tiktok') return 'tiktok';
  if (resolveLayout(n, type) === 'vertical') return `${n}-vertical` as PreviewKind;
  return n;
}

export function PostPreview(props: PostPreviewProps) {
  const t = useT();
  const network = resolveNetwork(props.channel);
  const ctx: Ctx = { ...props, network, t, dateText: formatPreviewDate(props.when, props.locale) };
  const kind = previewKind(props.channel, props.contentType);
  let body: ReactNode;
  if (kind === 'tiktok' || kind.endsWith('-vertical')) body = <VerticalPreview ctx={ctx} />;
  else if (kind === 'instagram') body = <InstagramPreview ctx={ctx} />;
  else if (kind === 'facebook') body = <FacebookPreview ctx={ctx} />;
  else if (kind === 'linkedin') body = <LinkedInPreview ctx={ctx} />;
  else if (kind === 'x') body = <XPreview ctx={ctx} />;
  else body = <GenericPreview ctx={ctx} />;
  return (
    <article
      className="oma-pp"
      data-network={network}
      data-kind={kind}
      data-size={props.size ?? 'feed'}
      aria-label={t('preview.label')}
    >
      {props.hideNetworkLabel ? null : (
        <div className="oma-pp__net">
          <NetworkIcon network={network} size={14} />
          <span>{t(`preview.network.${network}`)}</span>
        </div>
      )}
      <div
        className="oma-pp__post"
        onClick={props.onOpen}
        role={props.onOpen ? 'button' : undefined}
        tabIndex={props.onOpen ? 0 : undefined}
        onKeyDown={(e) => {
          if (props.onOpen && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            props.onOpen();
          }
        }}
      >
        {body}
      </div>
      {props.review ? <ReviewStrip review={props.review} t={t} /> : null}
    </article>
  );
}
