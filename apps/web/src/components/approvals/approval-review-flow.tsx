'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@oma/ui/controls';
import {
  CheckOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
} from '../ui/lucide-icons';
import { PostPreview } from '../content/post-preview';
import { NetworkIcon } from '../content/network-icon';
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

export function ApprovalReviewFlow({
  queue,
  brandNames,
  initialIndex = 0,
  onClose,
}: {
  queue: ContentRowExtra[];
  brandNames: Map<string, string>;
  initialIndex?: number;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [skipped, setSkipped] = useState<Set<string>>(() => readSkipped());
  const activeQueue = useMemo(
    () => queue.filter((item) => !skipped.has(item.id)),
    [queue, skipped],
  );
  const [index, setIndex] = useState(() =>
    Math.min(initialIndex, Math.max(0, activeQueue.length - 1)),
  );
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<
    Awaited<ReturnType<typeof getContentDetail>>['comments']
  >([]);
  const [busy, setBusy] = useState(false);
  const item = activeQueue[index] ?? null;

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
    (next: number) => {
      setComment('');
      setIndex(Math.max(0, Math.min(next, total - 1)));
    },
    [total],
  );

  const skip = useCallback(() => {
    if (!item) return;
    const next = new Set(skipped);
    next.add(item.id);
    setSkipped(next);
    writeSkipped(next);
    if (index >= activeQueue.length - 1) {
      onClose();
      router.push('/app/approvals');
    } else {
      go(index);
    }
  }, [item, skipped, index, activeQueue.length, go, onClose, router]);

  const approve = useCallback(async () => {
    if (!item) return;
    setBusy(true);
    try {
      if (comment.trim()) {
        await addContentComment(item.id, comment.trim(), { internal: true });
      }
      await approveContent(item.id);
      toast.push(t('approvals.approved_toast'), 'success');
      if (index >= activeQueue.length - 1) {
        onClose();
        router.push('/app/approvals');
      } else {
        go(index);
      }
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    } finally {
      setBusy(false);
    }
  }, [item, comment, index, activeQueue.length, go, onClose, router, t, toast]);

  if (!item) {
    return (
      <div className="oma-plx-approvals-review oma-plx-approvals-review--empty" role="dialog">
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
    );
  }

  const brandName = brandNames.get(item.brandId) ?? item.brandId;
  const title = pickCopy(item.title, locale);
  const caption = item.caption ? pickCopy(item.caption, locale) : '';

  return (
    <div className="oma-plx-approvals-review" role="dialog" data-testid="approvals-review-flow">
      <div className="oma-plx-approvals-review__backdrop" aria-hidden />
      <button
        type="button"
        className="oma-plx-approvals-review__nav oma-plx-approvals-review__nav--prev"
        disabled={index <= 0}
        onClick={() => go(index - 1)}
        aria-label={t('approvals.previous')}
      >
        <ArrowLeftOutlined />
      </button>
      <button
        type="button"
        className="oma-plx-approvals-review__nav oma-plx-approvals-review__nav--next"
        disabled={index >= total - 1}
        onClick={() => go(index + 1)}
        aria-label={t('approvals.next')}
      >
        <ArrowRightOutlined />
      </button>

      <div className="oma-plx-approvals-review__sheet">
        <header className="oma-plx-approvals-review__head">
          <div className="oma-plx-approvals-review__progress">
            <span className="oma-ltr">
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
          >
            <CloseOutlined />
          </button>
        </header>

        <div className="oma-plx-approvals-review__brand">
          <span className="oma-plx-approvals-review__brand-ico">
            <NetworkIcon channel={item.channel} size={20} />
          </span>
          <div>
            <strong>{brandName}</strong>
            <span className="oma-plx-approvals-review__meta">{item.status}</span>
          </div>
        </div>

        <div className="oma-plx-approvals-review__preview">
          <PostPreview
            channel={item.channel}
            contentType={item.contentType}
            caption={caption || title}
            title={title}
            media={item.previewAsset}
            brandName={brandName}
            locale={locale}
            size="detail"
          />
        </div>

        {comments.length ? (
          <ul className="oma-plx-approvals-review__comments">
            {comments.slice(0, 4).map((c) => (
              <li key={c.id}>
                <p>{pickCopy(c.body, locale)}</p>
                <time>{new Date(c.at).toLocaleDateString(locale)}</time>
              </li>
            ))}
          </ul>
        ) : null}

        <label className="oma-plx-approvals-review__composer">
          <span className="oma-plx-approvals-review__composer-ico" aria-hidden>
            ·
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('approvals.say_something')}
            rows={2}
          />
        </label>

        <footer className="oma-plx-approvals-review__actions">
          <Button type="default" disabled={busy} onClick={() => skip()}>
            {t('approvals.skip')}
          </Button>
          <Button type="primary" disabled={busy} onClick={() => void approve()}>
            <CheckOutlined />
            {t('approvals.approve_post')}
          </Button>
        </footer>
      </div>
    </div>
  );
}
