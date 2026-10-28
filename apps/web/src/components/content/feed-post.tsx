'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/use-locale';
import { NetworkIcon } from './network-icon';
import { PostPreview, type PostPreviewProps, type PreviewApprovalState } from './post-preview';
import { initials, resolveNetwork } from './post-preview-model';

export type FeedComment = {
  id: string;
  author: string;
  body: string;
  at: string;
  internal?: boolean;
};

export type FeedApprovalStep = { name: string | null; done: boolean };

export type FeedApproval = {
  state: PreviewApprovalState;
  approved: number;
  required: number;
  steps: FeedApprovalStep[];
  canApprove: boolean;
  canRequestChanges: boolean;
  canRequestApproval: boolean;
  busy?: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;
  onRequestApproval: () => void;
};

export type FeedPostProps = {
  preview: Omit<PostPreviewProps, 'review' | 'onOpen' | 'hideNetworkLabel'>;
  approval?: FeedApproval;
  comments: FeedComment[];
  canComment: boolean;
  onAddComment?: (body: string) => Promise<void>;
  onOpen: () => void;
  selected?: boolean;
  testId?: string;
};

export function relativeTime(iso: string, locale: string, now = Date.now()): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const diff = Math.round((d - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    numeric: 'auto',
    style: 'narrow',
  });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(diff, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return new Intl.DateTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/** "2/4" counter shown on the floating approval button (only for multi-approver flows). */
export function approvalCounter(a: Pick<FeedApproval, 'approved' | 'required' | 'state'>): string {
  if (a.required > 1 && a.state !== 'NOT_REQUESTED')
    return `${Math.min(a.approved, a.required)}/${a.required}`;
  return '';
}

const STATE_KEY: Record<PreviewApprovalState, string> = {
  NOT_REQUESTED: 'preview.approval.not_requested',
  PENDING: 'preview.approval.pending',
  PARTIALLY_APPROVED: 'preview.approval.partial',
  APPROVED: 'preview.approval.approved',
  CHANGES_REQUESTED: 'preview.approval.changes_requested',
  REJECTED: 'preview.approval.rejected',
};

/**
 * Approval control with a real step list and lifecycle actions. `float` is the round button
 * used beside feed posts; `chip` is the compact "✓ approved/required" pill used in the
 * preview card header.
 */
export function ApprovalButton({
  a,
  variant = 'float',
  testId,
}: {
  a: FeedApproval;
  variant?: 'float' | 'chip';
  testId?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const counter = approvalCounter(a);
  const actionable = a.state === 'PENDING' || a.state === 'PARTIALLY_APPROVED';
  const chip = variant === 'chip';
  const chipCount = `${Math.min(a.approved, a.required)}/${a.required}`;
  return (
    <div className="oma-fp__approval" ref={ref} data-variant={variant} data-testid={testId}>
      <button
        type="button"
        className={chip ? 'oma-fp__approve-chip' : 'oma-fp__approve-btn'}
        data-state={a.state}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t(STATE_KEY[a.state])}
        title={t(STATE_KEY[a.state])}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="m5 12.5 4.2 4.2L19 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {chip ? <span className="oma-ltr">{chipCount}</span> : null}
      </button>
      {!chip && counter ? <span className="oma-fp__counter oma-ltr">{counter}</span> : null}
      {open ? (
        <div className="oma-fp__pop" role="dialog" aria-label={t('preview.approval.title')}>
          <div className="oma-fp__pop-head">
            <strong>{t('preview.approval.title')}</strong>
            <span className="oma-fp__pop-state" data-state={a.state}>
              {t(STATE_KEY[a.state])}
            </span>
          </div>
          <ol className="oma-fp__steps">
            {a.steps.map((s, i) => (
              <li key={i} className="oma-fp__step" data-done={s.done ? 'true' : 'false'}>
                <span className="oma-fp__step-dot" aria-hidden>
                  {s.done ? '✓' : ''}
                </span>
                <span className="oma-fp__step-avatar" aria-hidden>
                  {s.name ? initials(s.name) : '·'}
                </span>
                <span className="oma-fp__step-text">
                  <span>{t('preview.approval.step').replace('{n}', String(i + 1))}</span>
                  <bdi className="oma-fp__step-name">
                    {s.name ||
                      (s.done ? t('preview.approval.approved') : t('preview.approval.waiting'))}
                  </bdi>
                </span>
              </li>
            ))}
          </ol>
          <div className="oma-fp__pop-actions">
            {a.state === 'NOT_REQUESTED' ? (
              <button
                type="button"
                className="oma-pp__btn oma-pp__btn--primary"
                disabled={!a.canRequestApproval || a.busy}
                onClick={() => {
                  setOpen(false);
                  a.onRequestApproval();
                }}
              >
                {t('preview.request_approval')}
              </button>
            ) : null}
            {actionable ? (
              <>
                <button
                  type="button"
                  className="oma-pp__btn"
                  disabled={!a.canRequestChanges || a.busy}
                  onClick={() => {
                    setOpen(false);
                    a.onRequestChanges();
                  }}
                >
                  {t('preview.request_changes')}
                </button>
                <button
                  type="button"
                  className="oma-pp__btn oma-pp__btn--primary"
                  disabled={!a.canApprove || a.busy}
                  onClick={() => {
                    setOpen(false);
                    a.onApprove();
                  }}
                >
                  {t('preview.approve')}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CommentsPanel({
  comments,
  canComment,
  onAdd,
  locale,
}: {
  comments: FeedComment[];
  canComment: boolean;
  onAdd?: (body: string) => Promise<void>;
  locale: string;
}) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const submit = async () => {
    const body = draft.trim();
    if (!body || !onAdd) return;
    setSending(true);
    try {
      await onAdd(body);
      setDraft('');
    } catch {
      // keep the draft so the comment is not lost; the caller already showed the error
    } finally {
      setSending(false);
    }
  };
  return (
    <aside className="oma-fp__comments" aria-label={t('preview.comments.title')}>
      {canComment && onAdd ? (
        <form
          className="oma-fp__composer"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            className="oma-fp__input"
            dir="auto"
            value={draft}
            placeholder={t('content.say_something')}
            aria-label={t('content.say_something')}
            onChange={(e) => setDraft(e.target.value)}
          />
          {draft.trim() ? (
            <button type="submit" className="oma-pp__btn oma-pp__btn--primary" disabled={sending}>
              {t('preview.comments.send')}
            </button>
          ) : null}
        </form>
      ) : null}
      {comments.length === 0 ? (
        <p className="oma-fp__empty">{t('preview.comments.empty')}</p>
      ) : (
        <ul className="oma-fp__thread">
          {comments.map((c) => (
            <li
              key={c.id}
              className="oma-fp__comment"
              data-internal={c.internal ? 'true' : 'false'}
            >
              <div className="oma-fp__c-meta">
                <span className="oma-fp__c-avatar" aria-hidden>
                  {initials(c.author)}
                </span>
                <bdi className="oma-fp__c-name">{c.author}</bdi>
                <span className="oma-fp__c-time">{relativeTime(c.at, locale)}</span>
                {c.internal ? (
                  <span className="oma-fp__c-tag">{t('preview.comments.internal')}</span>
                ) : null}
              </div>
              <p className="oma-fp__c-body" dir="auto">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

/** One row of the Planable-style Feed: approval rail · network post · comments thread. */
export function FeedPost(props: FeedPostProps) {
  const t = useT();
  const network = resolveNetwork(props.preview.channel);
  return (
    <section
      className="oma-fp"
      data-selected={props.selected ? 'true' : 'false'}
      data-testid={props.testId}
    >
      <div className="oma-fp__rail">
        {props.approval ? <ApprovalButton a={props.approval} /> : null}
        <span className="oma-fp__net" title={t(`preview.network.${network}`)}>
          <NetworkIcon network={network} size={14} />
        </span>
      </div>
      <div className="oma-fp__post">
        <PostPreview
          {...props.preview}
          hideNetworkLabel
          headerActions={
            <>
              <button
                type="button"
                className="oma-fp__icon-btn"
                aria-label={t('preview.open_post')}
                title={t('preview.open_post')}
                onClick={props.onOpen}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {props.preview.headerActions}
            </>
          }
        />
      </div>
      <CommentsPanel
        comments={props.comments}
        canComment={props.canComment}
        onAdd={props.onAddComment}
        locale={props.preview.locale}
      />
    </section>
  );
}
