'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { CommentOutlined } from '../../../../components/ui/lucide-icons';
import {
  ApprovalChannelRail,
  type ApprovalChannelRow,
} from '../../../../components/approvals/approval-channel-rail';
import { ApprovalReviewFlow } from '../../../../components/approvals/approval-review-flow';
import { MediaSurface } from '../../../../components/content/media-surface';
import { NetworkIcon } from '../../../../components/content/network-icon';
import { ContentShimmer } from '../../../../components/ui/screen-shimmer';
import { useToast } from '../../../../components/ui/toast';
import { api } from '../../../../lib/api';
import {
  approveContent,
  getContentDetail,
  loadContentWorkspace,
  type ContentCommentDto,
  type ContentRowExtra,
} from '../../../../lib/content-api';
import {
  approvalQueueTotal,
  bucketContentApprovals,
  commentCountFor,
  type ApprovalSection,
} from '../../../../lib/content-approvals-queue';
import { t as translate } from '@oma/i18n';
import { pickCopy } from '../../../../lib/demo/use-demo-api';
import { mapLimit } from '../../../../lib/map-limit';
import { useLocale, useT } from '../../../../lib/use-locale';

type Me = { user?: { id?: string; name?: string | null } };

const SECTIONS: ApprovalSection[] = ['awaiting', 'feedback', 'approved'];

export function ApprovalsClient() {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [rows, setRows] = useState<ContentRowExtra[]>([]);
  const [brands, setBrands] = useState<Map<string, string>>(new Map());
  const [commentsById, setCommentsById] = useState<Map<string, ContentCommentDto[]>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<Set<string>>(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSection, setReviewSection] = useState<ApprovalSection>('awaiting');
  const [approvingAll, setApprovingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ws, me] = await Promise.all([
        loadContentWorkspace({ full: true }),
        api<Me>('/api/v1/auth/me').catch(() => ({ user: undefined })),
      ]);
      setUserId(me.user?.id ?? null);
      const nameMap = new Map(ws.brands.map((b) => [b.id, pickCopy(b.name, locale)]));
      setBrands(nameMap);
      const items = ws.content as ContentRowExtra[];
      setRows(items);

      const approvalIds = items
        .filter((i) => {
          const st = i.approvalState || 'NOT_REQUESTED';
          return st !== 'NOT_REQUESTED' && st !== 'APPROVED';
        })
        .slice(0, 60)
        .map((i) => i.id);

      const detailPairs = await mapLimit(approvalIds, 4, async (id) => {
        try {
          const d = await getContentDetail(id);
          return [id, d.comments] as [string, ContentCommentDto[]];
        } catch {
          return [id, [] as ContentCommentDto[]] as [string, ContentCommentDto[]];
        }
      });
      setCommentsById(new Map(detailPairs));
    } catch (err) {
      toastRef.current.push(
        err instanceof Error ? err.message : translate(locale, 'errors.http'),
        'danger',
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const channels = useMemo((): ApprovalChannelRow[] => {
    const seen = new Set<string>();
    const out: ApprovalChannelRow[] = [];
    for (const item of rows) {
      const id = `${item.brandId}:${item.channel}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        brandId: item.brandId,
        brandName: brands.get(item.brandId) ?? item.brandId,
        channel: item.channel,
      });
    }
    return out.sort((a, b) => a.brandName.localeCompare(b.brandName));
  }, [rows, brands]);

  const filteredRows = useMemo(() => {
    if (channelFilter.size === 0) return rows;
    return rows.filter((r) => channelFilter.has(`${r.brandId}:${r.channel}`));
  }, [rows, channelFilter]);

  const buckets = useMemo(
    () =>
      bucketContentApprovals(filteredRows, {
        userId,
        commentsByContentId: commentsById,
      }),
    [filteredRows, userId, commentsById],
  );

  const reviewQueue = buckets[reviewSection];
  const pendingTotal = approvalQueueTotal(buckets);

  const toggleChannel = (id: string) => {
    setChannelFilter((prev) => {
      const base = prev.size === 0 ? new Set(channels.map((c) => c.id)) : new Set(prev);
      if (base.has(id)) base.delete(id);
      else base.add(id);
      if (base.size === channels.length) return new Set();
      return base;
    });
  };

  const approveAll = async () => {
    if (!buckets.awaiting.length) return;
    setApprovingAll(true);
    try {
      await mapLimit(buckets.awaiting, 3, (item) => approveContent(item.id));
      toast.push(t('approvals.approve_all_done'), 'success');
      await load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    } finally {
      setApprovingAll(false);
    }
  };

  return (
    <div className="oma-plx-approvals" data-testid="demo-my-approvals">
      <header className="oma-plx-approvals__head">
        <div>
          <h1 className="oma-plx-listening__title">{t('views.my_approvals')}</h1>
          <p className="oma-plx-deliv__subtitle">{t('approvals.subtitle')}</p>
        </div>
        <div className="oma-plx-approvals__head-actions">
          <button
            type="button"
            className="oma-plx-approvals__link-btn"
            disabled={!buckets.awaiting.length || approvingAll}
            onClick={() => void approveAll()}
            data-testid="approvals-approve-all"
          >
            {t('approvals.approve_all')}
          </button>
          <Button
            type="primary"
            disabled={pendingTotal === 0}
            onClick={() => {
              setReviewSection('awaiting');
              setReviewOpen(true);
            }}
            data-testid="approvals-review-posts"
          >
            {`${t('approvals.review_posts')} ${pendingTotal}`}
          </Button>
        </div>
      </header>

      <div className="oma-plx-approvals__body">
        <ApprovalChannelRail
          channels={channels}
          enabled={channelFilter}
          onToggle={toggleChannel}
          onToggleAll={(on) =>
            setChannelFilter(on ? new Set() : new Set(channels.map((c) => c.id)))
          }
        />

        <div className="oma-plx-approvals__board">
          {loading ? <ContentShimmer embedded /> : null}
          {!loading ? (
            <div className="oma-plx-approvals__columns">
              {SECTIONS.map((section) => (
                <section key={section} className="oma-plx-approvals__column" data-section={section}>
                  <header className="oma-plx-approvals__column-head">
                    <span>{t(`approvals.section.${section}`)}</span>
                    <span className="oma-plx-approvals__column-count">
                      {buckets[section].length}
                    </span>
                  </header>
                  {buckets[section].length === 0 ? (
                    <p className="oma-plx-approvals__empty">{t(`approvals.empty.${section}`)}</p>
                  ) : (
                    <ul className="oma-plx-approvals__cards">
                      {buckets[section].map((item) => {
                        const brandName = brands.get(item.brandId) ?? '';
                        const title = pickCopy(item.title, locale);
                        const caption = item.caption ? pickCopy(item.caption, locale) : title;
                        const comments = commentCountFor(item.id, commentsById);
                        return (
                          <li key={item.id}>
                            <article
                              className="oma-plx-approvals-card"
                              data-testid={`approval-card-${item.id}`}
                            >
                              <header className="oma-plx-approvals-card__head">
                                <NetworkIcon channel={item.channel} size={18} />
                                <strong>{brandName}</strong>
                                <span className="oma-plx-approvals-card__time">
                                  {item.scheduledAt?.slice(11, 16) ?? '—'}
                                </span>
                              </header>
                              <div className="oma-plx-approvals-card__media">
                                {item.previewAsset ? (
                                  <MediaSurface
                                    src={item.previewAsset}
                                    contentType={item.contentType}
                                  />
                                ) : (
                                  <span className="oma-plx-approvals-card__placeholder">
                                    {title}
                                  </span>
                                )}
                              </div>
                              <p className="oma-plx-approvals-card__caption">{caption}</p>
                              <footer className="oma-plx-approvals-card__foot">
                                <span data-state={item.approvalState}>
                                  {t('content.approvals')}
                                </span>
                                {comments ? (
                                  <span className="oma-plx-approvals-card__comments">
                                    <CommentOutlined />
                                    {comments}
                                  </span>
                                ) : null}
                              </footer>
                              <Link
                                href={`/app/content?open=${item.id}`}
                                className="oma-plx-approvals-card__open"
                              >
                                {t('approvals.open_post')}
                              </Link>
                            </article>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {reviewOpen ? (
        <ApprovalReviewFlow
          queue={reviewQueue}
          brandNames={brands}
          onClose={() => {
            setReviewOpen(false);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
