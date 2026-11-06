'use client';

import Link from 'next/link';
import { Button } from '@oma/ui/controls';
import { StatusMark } from '../../../../components/content/content-card';
import { NetworkIcon } from '../../../../components/content/network-icon';
import { contentBodyText, contentTitleText } from '../../../../lib/content-display-text';
import { contentMediaUrls, type ContentRowExtra } from '../../../../lib/content-api';
import { pickCopy } from '../../../../lib/demo/use-demo-api';
import {
  bucketForScheduleRow,
  displayForScheduleBucket,
  readinessScore,
  type ScheduleRow,
} from '../../../../lib/demo/stage6-schedule';
import { formatScheduleWhen } from '../../../../lib/publish-status';
import type { ScheduleRowExtras } from '../../../../lib/schedule-production';

type Row = ScheduleRow & ScheduleRowExtras;

export function SchedulePostCard({
  post,
  content,
  locale,
  scheduleTz,
  weekdayLabel,
  untitled,
  emptyBody,
  openLabel,
  openPostLabel,
  bucketLabel,
  onOpen,
}: {
  post: Row;
  content?: ContentRowExtra;
  locale: string;
  scheduleTz: string;
  weekdayLabel: string;
  untitled: string;
  emptyBody: string;
  openLabel: string;
  openPostLabel: string;
  bucketLabel: string;
  onOpen: () => void;
}) {
  const title = contentTitleText(
    content?.title ?? post.title,
    content?.caption ?? post.caption,
    locale,
    untitled,
  );
  const caption = contentBodyText(
    content?.title ?? post.title,
    content?.caption ?? post.caption,
    locale,
    emptyBody,
  );
  const previewUrl = content ? (contentMediaUrls(content)[0] ?? null) : null;
  const score = readinessScore(post);
  const bucket = bucketForScheduleRow(post);
  const when = formatScheduleWhen(post.plannedAt, post.timezone || scheduleTz, locale);

  return (
    <article className="oma-plx-sched-post-card" data-testid={`demo-sched-card-${post.id}`}>
      <button type="button" className="oma-plx-sched-post-card__hit" onClick={onOpen}>
        <div className="oma-plx-sched-post-card__media">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" loading="lazy" />
          ) : (
            <span className="oma-plx-sched-post-card__media-fallback" aria-hidden>
              {post.channels[0] ? <NetworkIcon channel={post.channels[0]} size={18} /> : '—'}
            </span>
          )}
        </div>
        <div className="oma-plx-sched-post-card__body">
          <header className="oma-plx-sched-post-card__head">
            <span className="oma-plx-sched-post-card__when oma-ltr">
              {weekdayLabel} · {when}
            </span>
            <span className="oma-plx-sched-post-card__status">
              <StatusMark display={displayForScheduleBucket(bucket)} locale={locale} />
              <span data-testid={`demo-sched-bucket-${post.id}`}>{bucketLabel}</span>
            </span>
          </header>
          <h3 className="oma-plx-sched-post-card__title">{title}</h3>
          {caption ? <p className="oma-plx-sched-post-card__caption">{caption}</p> : null}
          <footer className="oma-plx-sched-post-card__foot">
            <span className="oma-plx-sched-post-card__nets" aria-hidden>
              {post.channels.slice(0, 4).map((c) => (
                <NetworkIcon key={c} channel={c} size={14} />
              ))}
            </span>
            <span className="oma-plx-sched-post-card__meta">
              {score.pct}% · {post.channels.join(', ') || '—'}
            </span>
          </footer>
        </div>
      </button>
      <div className="oma-plx-sched-post-card__actions">
        <Button type="default" onClick={onOpen}>
          {openLabel}
        </Button>
        {post.contentId ? (
          <Link
            href={`/app/content?item=${post.contentId}`}
            className="oma-plx-sched-post-card__link"
          >
            {openPostLabel}
          </Link>
        ) : null}
      </div>
      {post.blockingReason ? (
        <p className="oma-plx-sched-post-card__warn">{pickCopy(post.blockingReason, locale)}</p>
      ) : null}
    </article>
  );
}
