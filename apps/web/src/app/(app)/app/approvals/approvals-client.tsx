'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CommentOutlined,
  LinkOutlined,
  PlayCircleOutlined,
} from '../../../../components/ui/lucide-icons';
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

function formatCardTime(item: ContentRowExtra): { isScheduled: boolean; label: string } {
  const iso = item.scheduledAt || item.plannedAt;
  const hm = iso && iso.length >= 16 ? iso.slice(11, 16) : '21:40';
  const isScheduled = Boolean(item.scheduledAt) && item.status !== 'DRAFT';
  return { isScheduled, label: isScheduled ? hm : `Draft ${hm}` };
}

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
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<Set<string>>(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSection, setReviewSection] = useState<ApprovalSection>('awaiting');
  const [reviewInitialItemId, setReviewInitialItemId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderSlot(document.getElementById('oma-content-top-actions'));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ws, me] = await Promise.all([
        loadContentWorkspace({ full: true }),
        api<Me>('/api/v1/auth/me').catch(() => ({ user: undefined })),
      ]);
      setUserId(me.user?.id ?? null);
      setUserName(me.user?.name ?? null);
      const nameMap = new Map(ws.brands.map((b) => [b.id, pickCopy(b.name, locale)]));
      setBrands(nameMap);
      const items = ws.content as ContentRowExtra[];
      setRows(items);

      const approvalIds = items
        .filter((i) => {
          const st = i.approvalState || 'NOT_REQUESTED';
          return st !== 'NOT_REQUESTED';
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

  const reviewQueue = useMemo(() => {
    if (reviewSection === 'approved') return buckets.approved;
    if (reviewSection === 'feedback') return buckets.feedback;
    const seen = new Set<string>();
    const combined: ContentRowExtra[] = [];
    for (const row of [...buckets.awaiting, ...buckets.feedback]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        combined.push(row);
      }
    }
    return combined;
  }, [buckets, reviewSection]);

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

  const openReviewForSection = (section: ApprovalSection, itemId?: string) => {
    setReviewSection(section);
    setReviewInitialItemId(itemId ?? null);
    setReviewOpen(true);
  };

  const topBarActions = (
    <div className="oma-plx-approvals__top-actions">
      <ApprovalChannelRail
        channels={channels}
        enabled={channelFilter}
        onToggle={toggleChannel}
        onToggleAll={(on) => setChannelFilter(on ? new Set() : new Set(channels.map((c) => c.id)))}
      />
      <button
        type="button"
        className="oma-plx-approvals__approve-all-btn"
        disabled={!buckets.awaiting.length || approvingAll}
        onClick={() => void approveAll()}
        data-testid="approvals-approve-all"
      >
        {t('approvals.approve_all')}
      </button>
      <button
        type="button"
        className="oma-plx-approvals__review-cta"
        disabled={pendingTotal === 0}
        onClick={() => openReviewForSection('awaiting')}
        data-testid="approvals-review-posts"
      >
        {t('approvals.review_n_posts')
          ? t('approvals.review_n_posts').replace('{n}', String(pendingTotal))
          : `${t('approvals.review_posts')} ${pendingTotal}`}
      </button>
    </div>
  );

  return (
    <div className="oma-plx-approvals" data-testid="demo-my-approvals">
      {headerSlot && headerSlot.isConnected ? (
        createPortal(topBarActions, headerSlot)
      ) : (
        <header className="oma-plx-approvals__subbar">{topBarActions}</header>
      )}

      <div className="oma-plx-approvals__board">
        {loading ? <ContentShimmer embedded /> : null}
        {!loading ? (
          <div className="oma-plx-approvals__columns">
            {SECTIONS.map((section) => {
              const items = buckets[section];
              return (
                <section
                  key={section}
                  className="oma-plx-approvals__column-wrap"
                  data-section={section}
                >
                  <header className="oma-plx-approvals__column-head">
                    <span className="oma-plx-approvals__column-title">
                      {section === 'awaiting' ? (
                        <span
                          className="oma-plx-approvals__sec-ico oma-plx-approvals__sec-ico--awaiting"
                          aria-hidden
                        >
                          ✦
                        </span>
                      ) : section === 'feedback' ? (
                        <CommentOutlined className="oma-plx-approvals__sec-ico oma-plx-approvals__sec-ico--feedback" />
                      ) : (
                        <CheckCircleOutlined className="oma-plx-approvals__sec-ico oma-plx-approvals__sec-ico--approved" />
                      )}
                      <span>{t(`approvals.section.${section}`)}</span>
                    </span>
                    <span
                      className={`oma-plx-approvals__column-count oma-plx-approvals__column-count--${section}`}
                    >
                      {items.length}
                    </span>
                  </header>

                  <div className="oma-plx-approvals__column">
                    {section === 'awaiting' && items.length > 0 ? (
                      <button
                        type="button"
                        className="oma-plx-approvals__column-review-btn"
                        onClick={() => openReviewForSection('awaiting')}
                        data-testid="approvals-column-review-btn"
                      >
                        {t('approvals.review_posts')}
                      </button>
                    ) : null}

                    {items.length === 0 ? (
                      <p className="oma-plx-approvals__empty">{t(`approvals.empty.${section}`)}</p>
                    ) : (
                      <ul className="oma-plx-approvals__cards">
                        {items.map((item) => {
                          const brandName = brands.get(item.brandId) ?? '';
                          const title = pickCopy(item.title, locale);
                          const caption = item.caption ? pickCopy(item.caption, locale) : title;
                          const comments = commentCountFor(item.id, commentsById);
                          const timeMeta = formatCardTime(item);
                          const isVideo =
                            item.contentType === 'REEL' ||
                            Boolean(
                              item.previewAsset && /\.(mp4|mov|webm)$/i.test(item.previewAsset),
                            );
                          const isApprovedCard = item.approvalState === 'APPROVED';

                          return (
                            <li key={item.id}>
                              <article
                                className="oma-plx-approvals-card"
                                data-testid={`approval-card-${item.id}`}
                                role="button"
                                tabIndex={0}
                                onClick={() => openReviewForSection(section, item.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openReviewForSection(section, item.id);
                                  }
                                }}
                              >
                                <header className="oma-plx-approvals-card__head">
                                  <span className="oma-plx-approvals-card__nets">
                                    <NetworkIcon channel={item.channel} size={16} />
                                  </span>
                                  <strong className="oma-plx-approvals-card__brand">
                                    {brandName}
                                  </strong>
                                  <span
                                    className="oma-plx-approvals-card__time"
                                    data-scheduled={timeMeta.isScheduled ? 'true' : 'false'}
                                  >
                                    {timeMeta.isScheduled ? (
                                      <ClockCircleOutlined className="oma-plx-approvals-card__clock" />
                                    ) : null}
                                    <span>{timeMeta.label}</span>
                                  </span>
                                </header>

                                <div className="oma-plx-approvals-card__media">
                                  {item.previewAsset ? (
                                    <>
                                      <MediaSurface
                                        src={item.previewAsset}
                                        contentType={item.contentType}
                                      />
                                      {isVideo ? (
                                        <span
                                          className="oma-plx-approvals-card__media-badge"
                                          aria-hidden
                                        >
                                          <PlayCircleOutlined />
                                        </span>
                                      ) : null}
                                    </>
                                  ) : (
                                    <div
                                      className="oma-plx-approvals-card__media-empty"
                                      aria-hidden
                                    >
                                      {isVideo ? (
                                        <span className="oma-plx-approvals-card__media-badge">
                                          <PlayCircleOutlined />
                                        </span>
                                      ) : (
                                        <span className="oma-plx-approvals-card__media-badge">
                                          <LinkOutlined />
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <p className="oma-plx-approvals-card__caption">{caption}</p>

                                <footer className="oma-plx-approvals-card__foot">
                                  {isApprovedCard ? (
                                    <span className="oma-plx-approvals-card__status oma-plx-approvals-card__status--approved">
                                      <span className="oma-plx-approvals-card__status-dot">
                                        <CheckOutlined />
                                      </span>
                                      <span>{t('approvals.section.approved')}</span>
                                    </span>
                                  ) : (
                                    <span className="oma-plx-approvals-card__status oma-plx-approvals-card__status--pending">
                                      <span className="oma-plx-approvals-card__status-ring" />
                                      <span>{t('approvals.status_pending') || 'Pending'}</span>
                                    </span>
                                  )}
                                  {comments > 0 ? (
                                    <span className="oma-plx-approvals-card__comments">
                                      <CommentOutlined />
                                      <span>{comments}</span>
                                    </span>
                                  ) : null}
                                </footer>
                              </article>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}
      </div>

      {reviewOpen ? (
        <ApprovalReviewFlow
          queue={reviewQueue}
          brandNames={brands}
          initialItemId={reviewInitialItemId}
          userName={userName}
          onClose={() => {
            setReviewOpen(false);
            setReviewInitialItemId(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
