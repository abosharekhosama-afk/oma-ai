'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  LinkOutlined,
  SmileOutlined,
  AtSignOutlined,
} from '../ui/lucide-icons';
import { MediaSurface } from '../content/media-surface';
import { NetworkIcon } from '../content/network-icon';
import { initials } from '../content/post-preview-model';
import {
  addContentComment,
  approveContent,
  getContentDetail,
  type ContentRowExtra,
} from '../../lib/content-api';
import { pickCopy } from '../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../lib/use-locale';
import { useToast } from '../ui/toast';

const SKIPPED_KEY = 'oma.approvals.skipped';

function readSkipped(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SKIPPED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSkipped(ids: Set<string>) {
  try {
    sessionStorage.setItem(SKIPPED_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function formatCardDate(iso?: string | null, locale = 'en'): string {
  if (!iso) return 'Draft';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  const monthDay = d.toLocaleDateString(locale, { month: 'long', day: 'numeric' });
  const hm = d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${monthDay}, ${hm}`;
}

export function ApprovalReviewFlow({
  queue,
  brandNames,
  initialItemId,
  initialIndex = 0,
  userName,
  onClose,
}: {
  queue: ContentRowExtra[];
  brandNames: Map<string, string>;
  initialItemId?: string | null;
  initialIndex?: number;
  userName?: string | null;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const [skipped, setSkipped] = useState<Set<string>>(() => readSkipped());

  const activeQueue = useMemo(() => {
    if (initialItemId && skipped.has(initialItemId)) {
      const copy = new Set(skipped);
      copy.delete(initialItemId);
      return queue.filter((item) => !copy.has(item.id));
    }
    return queue.filter((item) => !skipped.has(item.id));
  }, [queue, skipped, initialItemId]);

  const [index, setIndex] = useState(() => {
    if (initialItemId) {
      const found = activeQueue.findIndex((item) => item.id === initialItemId);
      if (found >= 0) return found;
    }
    return Math.min(initialIndex, Math.max(0, activeQueue.length - 1));
  });

  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<
    Awaited<ReturnType<typeof getContentDetail>>['comments']
  >([]);
  const [busy, setBusy] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [transitionState, setTransitionState] = useState<
    'idle' | 'skipping' | 'approving' | 'sliding-next' | 'sliding-prev'
  >('idle');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const item = activeQueue[index] ?? null;
  const nextItem = activeQueue[index + 1] ?? null;

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    void getContentDetail(item.id)
      .then((d) => {
        if (!cancelled) setComments(d.comments);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [item?.id]);

  const total = activeQueue.length;
  const progress = total ? ((index + 1) / total) * 100 : 0;

  const go = useCallback(
    (next: number, dir?: 'next' | 'prev') => {
      if (transitionState !== 'idle') return;
      const clamped = Math.max(0, Math.min(next, total - 1));
      if (clamped === index) return;
      if (dir) {
        setTransitionState(dir === 'next' ? 'sliding-next' : 'sliding-prev');
        timerRef.current = window.setTimeout(() => {
          setComment('');
          setIndex(clamped);
          setTransitionState('idle');
        }, 220);
      } else {
        setComment('');
        setIndex(clamped);
      }
    },
    [index, total, transitionState],
  );

  const skip = useCallback(() => {
    if (!item || transitionState !== 'idle') return;
    setTransitionState('skipping');
    timerRef.current = window.setTimeout(() => {
      const next = new Set(skipped);
      next.add(item.id);
      setSkipped(next);
      writeSkipped(next);
      setComment('');
      setTransitionState('idle');
      if (activeQueue.length <= 1) {
        onClose();
      } else if (index >= activeQueue.length - 1) {
        setIndex(Math.max(0, activeQueue.length - 2));
      }
    }, 460);
  }, [item, transitionState, skipped, activeQueue.length, index, onClose]);

  const postCommentOnly = useCallback(async () => {
    if (!item || !comment.trim() || postingComment) return;
    setPostingComment(true);
    try {
      await addContentComment(item.id, comment.trim(), { internal: false });
      setComment('');
      const d = await getContentDetail(item.id);
      setComments(d.comments);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    } finally {
      setPostingComment(false);
    }
  }, [item, comment, postingComment, t, toast]);

  const approve = useCallback(async () => {
    if (!item || busy || transitionState !== 'idle') return;
    setBusy(true);
    try {
      if (comment.trim()) {
        await addContentComment(item.id, comment.trim(), { internal: false });
      }
      await approveContent(item.id);
      setTransitionState('approving');
      timerRef.current = window.setTimeout(() => {
        toast.push(t('approvals.approved_toast'), 'success');
        setComment('');
        setTransitionState('idle');
        setBusy(false);
        if (index >= activeQueue.length - 1) {
          onClose();
        } else {
          setIndex((i) => Math.min(i + 1, activeQueue.length - 1));
        }
      }, 420);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
      setBusy(false);
      setTransitionState('idle');
    }
  }, [item, busy, transitionState, comment, index, activeQueue.length, onClose, t, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && index < total - 1) go(index + 1, 'next');
      else if (e.key === 'ArrowLeft' && index > 0) go(index - 1, 'prev');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, index, total, go]);

  if (!item) {
    return (
      <div className="oma-plx-approvals-review oma-plx-approvals-review--empty" role="dialog">
        <div className="oma-plx-approvals-review__backdrop" onClick={onClose} aria-hidden />
        <div className="oma-plx-approvals-review__empty-card">
          <button
            type="button"
            className="oma-plx-approvals-review__close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <CloseOutlined />
          </button>
          <p>{t('approvals.review_empty')}</p>
        </div>
      </div>
    );
  }

  const brandName = brandNames.get(item.brandId) ?? item.brandId;
  const title = pickCopy(item.title, locale);
  const caption = item.caption ? pickCopy(item.caption, locale) : title;
  const nextBrandName = nextItem ? (brandNames.get(nextItem.brandId) ?? nextItem.brandId) : '';
  const nextCaption = nextItem
    ? nextItem.caption
      ? pickCopy(nextItem.caption, locale)
      : pickCopy(nextItem.title, locale)
    : '';
  const userInitial = initials(userName || 'You');
  const isApproved = item.approvalState === 'APPROVED';

  return (
    <div className="oma-plx-approvals-review" role="dialog" data-testid="approvals-review-flow">
      <div className="oma-plx-approvals-review__backdrop" onClick={onClose} aria-hidden />

      <button
        type="button"
        className="oma-plx-approvals-review__nav oma-plx-approvals-review__nav--prev"
        disabled={index <= 0 || transitionState !== 'idle'}
        onClick={() => go(index - 1, 'prev')}
        aria-label={t('approvals.previous')}
      >
        <ArrowLeftOutlined />
      </button>
      <button
        type="button"
        className="oma-plx-approvals-review__nav oma-plx-approvals-review__nav--next"
        disabled={index >= total - 1 || transitionState !== 'idle'}
        onClick={() => go(index + 1, 'next')}
        aria-label={t('approvals.next')}
      >
        <ArrowRightOutlined />
      </button>

      <div className="oma-plx-approvals-review__stage">
        {/* Top bar floating above the card: "7 of 12 [progress]" and "[X]" */}
        <header className="oma-plx-approvals-review__topbar">
          <div className="oma-plx-approvals-review__progress">
            <span className="oma-plx-approvals-review__progress-text oma-ltr">
              {index + 1} {t('approvals.of')} {total}
            </span>
            <div className="oma-plx-approvals-review__bar">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
          <button
            type="button"
            className="oma-plx-approvals-review__close"
            onClick={onClose}
            aria-label={t('common.close')}
            data-testid="approvals-review-close"
          >
            <CloseOutlined />
          </button>
        </header>

        {/* Card deck with background next card + foreground active card */}
        <div className="oma-plx-approvals-review__deck">
          {nextItem ? (
            <div
              className="oma-plx-approvals-review__sheet oma-plx-approvals-review__sheet--back"
              aria-hidden
            >
              <div className="oma-plx-approvals-review__card-head">
                <span className="oma-plx-approvals-review__avatar">{initials(nextBrandName)}</span>
                <div className="oma-plx-approvals-review__card-meta">
                  <strong>{nextBrandName}</strong>
                  <span>{formatCardDate(nextItem.scheduledAt ?? nextItem.plannedAt, locale)}</span>
                </div>
                <div className="oma-plx-approvals-review__card-icons">
                  <NetworkIcon channel={nextItem.channel} size={18} />
                </div>
              </div>
              <p className="oma-plx-approvals-review__caption">{nextCaption}</p>
            </div>
          ) : null}

          <div
            className="oma-plx-approvals-review__sheet"
            data-transition={transitionState}
            data-testid="approvals-review-sheet"
          >
            {transitionState === 'skipping' ? (
              <div
                className="oma-plx-approvals-review__overlay oma-plx-approvals-review__overlay--skipped"
                data-testid="approvals-skipped-overlay"
              >
                <span className="oma-plx-approvals-review__overlay-circle">
                  <CloseOutlined />
                </span>
                <strong>{t('approvals.skipped_label') || 'Skipped'}</strong>
              </div>
            ) : null}

            {transitionState === 'approving' ? (
              <div
                className="oma-plx-approvals-review__overlay oma-plx-approvals-review__overlay--approved"
                data-testid="approvals-approved-overlay"
              >
                <span className="oma-plx-approvals-review__overlay-circle">
                  <CheckOutlined />
                </span>
                <strong>{t('approvals.section.approved') || 'Approved'}</strong>
              </div>
            ) : null}

            <div className="oma-plx-approvals-review__scroll">
              <div className="oma-plx-approvals-review__card-head">
                <span className="oma-plx-approvals-review__avatar" aria-hidden>
                  {initials(brandName)}
                </span>
                <div className="oma-plx-approvals-review__card-meta">
                  <strong>{brandName}</strong>
                  <span>{formatCardDate(item.scheduledAt ?? item.plannedAt, locale)}</span>
                </div>
                <div className="oma-plx-approvals-review__card-icons">
                  <Link
                    href={`/app/content?open=${item.id}`}
                    className="oma-plx-approvals-review__expand"
                    title={t('approvals.open_post')}
                    aria-label={t('approvals.open_post')}
                  >
                    ↗
                  </Link>
                  <NetworkIcon channel={item.channel} size={20} />
                </div>
              </div>

              {caption ? <p className="oma-plx-approvals-review__caption">{caption}</p> : null}

              {item.previewAsset ? (
                <div className="oma-plx-approvals-review__media">
                  <MediaSurface src={item.previewAsset} contentType={item.contentType} />
                </div>
              ) : null}

              {comments.length ? (
                <ul className="oma-plx-approvals-review__comments">
                  {comments.map((c) => (
                    <li key={c.id} className="oma-plx-approvals-review__comment">
                      <span className="oma-plx-approvals-review__comment-avatar" aria-hidden>
                        {userInitial}
                      </span>
                      <div className="oma-plx-approvals-review__comment-body">
                        <div className="oma-plx-approvals-review__comment-head">
                          <strong>{userName || 'You'}</strong>
                          <time>
                            {new Date(c.at).toLocaleDateString(locale, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </time>
                        </div>
                        <p>{pickCopy(c.body, locale)}</p>
                      </div>
                      <span className="oma-plx-approvals-review__comment-smile" aria-hidden>
                        <SmileOutlined />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="oma-plx-approvals-review__spacer" />
              )}
            </div>

            {/* Bottom comment input box inside the white sheet */}
            <div className="oma-plx-approvals-review__composer-wrap">
              <div
                className="oma-plx-approvals-review__composer"
                data-focused={comment.trim().length > 0 ? 'true' : 'false'}
              >
                <div className="oma-plx-approvals-review__composer-row">
                  <span className="oma-plx-approvals-review__user-dot" aria-hidden>
                    {userInitial}
                  </span>
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void postCommentOnly();
                      }
                    }}
                    placeholder={t('approvals.say_something')}
                    data-testid="approvals-comment-input"
                  />
                </div>
                <div className="oma-plx-approvals-review__composer-tools">
                  <div className="oma-plx-approvals-review__composer-icons" aria-hidden>
                    <AtSignOutlined />
                    <LinkOutlined />
                  </div>
                  <button
                    type="button"
                    className="oma-plx-approvals-review__post-btn"
                    disabled={!comment.trim() || postingComment}
                    onClick={() => void postCommentOnly()}
                    data-testid="approvals-comment-submit"
                  >
                    {t('approvals.post_comment') || 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom action pills below the white card: [Skip] [✓ Approve post] */}
        <footer className="oma-plx-approvals-review__actions">
          <button
            type="button"
            className="oma-plx-approvals-review__btn oma-plx-approvals-review__btn--skip"
            disabled={busy || transitionState !== 'idle'}
            onClick={() => skip()}
            data-testid="approvals-skip-btn"
          >
            {t('approvals.skip')}
          </button>
          <button
            type="button"
            className="oma-plx-approvals-review__btn oma-plx-approvals-review__btn--approve"
            disabled={busy || isApproved || transitionState !== 'idle'}
            onClick={() => void approve()}
            data-testid="approvals-approve-btn"
          >
            <CheckOutlined />
            <span>
              {isApproved ? t('approvals.section.approved') : t('approvals.approve_post')}
            </span>
          </button>
        </footer>
      </div>
    </div>
  );
}
