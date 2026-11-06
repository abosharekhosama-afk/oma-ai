'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@oma/ui/controls';
import {
  addInboxNote,
  assignInboxConversation,
  deleteInboxMessage,
  getInboxConnections,
  getInboxConversation,
  getInboxStats,
  hideInboxMessage,
  listInboxConversations,
  replyInboxConversation,
  setInboxPriority,
  setInboxStatus,
  syncInbox,
  type InboxConnections,
  type InboxConversationDetail,
  type InboxConversationListItem,
  type InboxMessage,
  type InboxStats,
} from '../../../../lib/inbox-api';
import { useT } from '../../../../lib/use-locale';
import { resolveActiveBrand, useActiveBrandId } from '../../../../lib/active-brand';
import { listScopedBrands } from '../../../../lib/campaign-api';
import {
  CheckOutlined,
  CommentOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  HeartOutlined,
  LinkOutlined,
  MoreOutlined,
  ReloadOutlined,
  SmileOutlined,
  StarOutlined,
  UpOutlined,
} from '../../../../components/ui/lucide-icons';
import { listWorkspaceMembers, type WorkspaceMember } from '../../../../lib/team-api';
import { InboxListEmptyState, InboxPaneAllDone } from './inbox-empty-art';
import { InboxThreadMenu } from './inbox-thread-menu';
import { InboxPlatformBadge, InboxPlatformIcon } from './inbox-platform-icon';
import { InboxStatusDropdown, type InboxStatusFilter } from './inbox-status-dropdown';
import {
  avatarColorFromName,
  filterByStatusTab,
  formatInboxPostDate,
  inboxPostThumbnailUrl,
  parseInboxPostMeta,
  postCaption,
  relativeTime,
} from './inbox-utils';

export type InboxMode = 'comments' | 'dms';

function groupMessagesByDay(messages: InboxMessage[]) {
  const groups: { label: string; items: InboxMessage[] }[] = [];
  let current = '';
  for (const m of messages) {
    const d = new Date(m.createdAt);
    const label = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    if (label !== current) {
      current = label;
      groups.push({ label, items: [m] });
    } else {
      groups[groups.length - 1]!.items.push(m);
    }
  }
  return groups;
}

function isCommentUnanswered(messages: InboxMessage[], index: number) {
  const m = messages[index];
  if (!m || m.direction !== 'INBOUND') return false;
  for (let j = index + 1; j < messages.length; j += 1) {
    if (messages[j]!.direction === 'OUTBOUND') return false;
  }
  return true;
}

function PersonAvatar({
  name,
  imageUrl,
  size = 'md',
  brand,
}: {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  brand?: boolean;
}) {
  const cls = [
    'oma-plx-inbox-avatar',
    size === 'sm' ? 'oma-plx-inbox-avatar--sm' : size === 'lg' ? 'oma-plx-inbox-avatar--lg' : '',
    brand ? 'oma-plx-inbox-avatar--brand' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const style = brand ? undefined : { background: avatarColorFromName(name || '?') };
  if (imageUrl) {
    return (
      <span className={cls} aria-hidden>
        <img src={imageUrl} alt="" />
      </span>
    );
  }
  return (
    <span className={cls} style={style} aria-hidden>
      {(name || '?').slice(0, 1).toLowerCase()}
    </span>
  );
}

export function InboxClient({ mode }: { mode: InboxMode }) {
  const t = useT();
  const activeBrandId = useActiveBrandId();
  const [brandReplyName, setBrandReplyName] = useState('OMA');
  const [statusTab, setStatusTab] = useState<InboxStatusFilter>('OPEN');
  const [platformFilter, setPlatformFilter] = useState<
    'all' | 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN'
  >('all');
  const [statusCounts, setStatusCounts] = useState<InboxStats | null>(null);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [items, setItems] = useState<InboxConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboxConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [inlineReply, setInlineReply] = useState('');
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => new Set());
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [adBannerDismissed, setAdBannerDismissed] = useState(false);
  const [connections, setConnections] = useState<InboxConnections | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const initialSyncDone = useRef(false);

  const brandSettingsHref = activeBrandId
    ? `/app/brands/${activeBrandId}/settings?tab=accounts`
    : '/app/brands';

  const refreshConnections = useCallback(async () => {
    try {
      const c = await getInboxConnections(activeBrandId || undefined);
      setConnections(c);
    } catch {
      setConnections(null);
    }
  }, [activeBrandId]);

  useEffect(() => {
    const tmr = window.setTimeout(() => setDebouncedQ(searchQuery.trim()), 300);
    return () => window.clearTimeout(tmr);
  }, [searchQuery]);

  useEffect(() => {
    void listWorkspaceMembers()
      .then(setMembers)
      .catch(() => setMembers([]));
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('oma.inbox.bookmarks');
      if (raw) setBookmarks(new Set(JSON.parse(raw) as string[]));
      setAdBannerDismissed(window.localStorage.getItem('oma.inbox.adBanner.dismissed') === '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!commentMenuId) return;
    const onDoc = () => setCommentMenuId(null);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [commentMenuId]);

  useEffect(() => {
    void listScopedBrands()
      .then((rows) => {
        const hit = resolveActiveBrand(rows, activeBrandId);
        if (hit?.name) setBrandReplyName(hit.name);
      })
      .catch(() => undefined);
  }, [activeBrandId]);

  const listTitle =
    mode === 'dms'
      ? t('inbox.directMessages') || 'Direct messages'
      : t('inbox.commentsTitle') || 'Comments';

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, stats] = await Promise.all([
        listInboxConversations({
          category: mode,
          limit: 100,
          brandId: activeBrandId || undefined,
          q: debouncedQ || undefined,
          platform: platformFilter === 'all' ? undefined : platformFilter,
          unanswered: unansweredOnly || undefined,
        }),
        getInboxStats(activeBrandId).catch(() => null),
      ]);
      if (stats) setStatusCounts(stats);
      const filtered = filterByStatusTab(res.items, statusTab);
      setItems(filtered);
      setSelectedId((prev) => {
        if (prev && filtered.some((it) => it.id === prev)) return prev;
        return filtered[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inbox');
      setItems([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [mode, statusTab, activeBrandId, debouncedQ, platformFilter, unansweredOnly]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const d = await getInboxConversation(id);
      setDetail(d);
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, unreadCount: 0, status: d.status } : it)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversation');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const runSync = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setSyncing(true);
      try {
        await syncInbox(activeBrandId || undefined);
        await new Promise((r) => setTimeout(r, 1500));
        await refreshConnections();
        await loadList();
        if (selectedId) await loadDetail(selectedId);
      } catch (e) {
        if (!opts?.silent) {
          setError(e instanceof Error ? e.message : 'Sync failed');
        }
      } finally {
        if (!opts?.silent) setSyncing(false);
      }
    },
    [activeBrandId, refreshConnections, loadList, loadDetail, selectedId],
  );

  useEffect(() => {
    void refreshConnections();
  }, [refreshConnections]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (initialSyncDone.current) return;
    initialSyncDone.current = true;
    void runSync({ silent: true });
  }, [runSync]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const visibleItems = items;

  const selectedIndex = useMemo(
    () => visibleItems.findIndex((it) => it.id === selectedId),
    [visibleItems, selectedId],
  );

  const detailMeta = useMemo(
    () => parseInboxPostMeta(detail?.metadataJson),
    [detail?.metadataJson],
  );

  const statusOptions = useMemo(
    () => [
      {
        value: 'OPEN' as const,
        label: t('inbox.filter.open') || 'Open',
        count: (statusCounts?.open ?? 0) + (statusCounts?.unread ?? 0),
      },
      {
        value: 'PENDING' as const,
        label: t('inbox.filter.later') || 'Later',
        count: statusCounts?.pending ?? 0,
      },
      {
        value: 'CLOSED' as const,
        label: t('inbox.filter.done') || 'Done',
        count: statusCounts?.closed ?? 0,
      },
    ],
    [statusCounts, t],
  );

  const displayedComments = useMemo(() => {
    if (!detail) return [];
    if (!unansweredOnly || mode !== 'comments') return detail.messages;
    return detail.messages.filter((_, idx) => isCommentUnanswered(detail.messages, idx));
  }, [detail, unansweredOnly, mode]);

  const toggleBookmark = (id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      window.localStorage.setItem('oma.inbox.bookmarks', JSON.stringify([...next]));
      return next;
    });
  };

  const goRelative = (delta: number) => {
    if (selectedIndex < 0) return;
    const next = visibleItems[selectedIndex + delta];
    if (next) setSelectedId(next.id);
  };

  const assigneeLabel = useMemo(() => {
    if (!detail?.assignedToUserId) return null;
    const hit = members.find((m) => m.user?.id === detail.assignedToUserId);
    return hit?.user?.name || hit?.user?.email || null;
  }, [detail?.assignedToUserId, members]);

  const onMarkDone = async () => {
    if (!selectedId) return;
    await setInboxStatus(selectedId, 'CLOSED');
    const next =
      visibleItems.find((it, i) => i > selectedIndex && it.status !== 'CLOSED') ??
      visibleItems.find((it) => it.id !== selectedId && it.status !== 'CLOSED');
    await loadList();
    if (next) setSelectedId(next.id);
    else setSelectedId(null);
  };

  const onMoveLater = async () => {
    if (!selectedId) return;
    await setInboxStatus(selectedId, 'PENDING');
    await loadList();
    await loadDetail(selectedId);
  };

  const onReopen = async () => {
    if (!selectedId) return;
    await setInboxStatus(selectedId, 'OPEN');
    await loadList();
    await loadDetail(selectedId);
  };

  const onTogglePriority = async () => {
    if (!selectedId || !detail) return;
    await setInboxPriority(selectedId, !detail.priority);
    await loadDetail(selectedId);
    await loadList();
  };

  const onAssign = async (userId: string | null) => {
    if (!selectedId) return;
    await assignInboxConversation(selectedId, userId);
    await loadDetail(selectedId);
    await loadList();
  };

  const submitReply = async (text: string, clearInline: boolean) => {
    if (!selectedId || !text.trim()) return;
    setSending(true);
    setDeliveryNote(null);
    try {
      const res = await replyInboxConversation(
        selectedId,
        text.trim(),
        replyToMessageId ?? undefined,
      );
      if (clearInline) {
        setInlineReply('');
        setReplyToMessageId(null);
      } else {
        setReply('');
      }
      if (!res.externalDelivered && res.note) setDeliveryNote(res.note);
      else if (res.externalDelivered) setDeliveryNote('Delivered to platform.');
      await loadDetail(selectedId);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reply failed');
    } finally {
      setSending(false);
    }
  };

  const onHideComment = async (messageId: string) => {
    setCommentMenuId(null);
    setSending(true);
    setError(null);
    try {
      await hideInboxMessage(messageId);
      if (selectedId) await loadDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hide failed');
    } finally {
      setSending(false);
    }
  };

  const onDeleteComment = async (messageId: string) => {
    setCommentMenuId(null);
    setSending(true);
    setError(null);
    try {
      await deleteInboxMessage(messageId);
      if (selectedId) {
        await loadDetail(selectedId);
        await loadList();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSending(false);
    }
  };

  const onAddNote = async () => {
    if (!selectedId || !noteDraft.trim()) return;
    setSending(true);
    try {
      await addInboxNote(selectedId, noteDraft.trim());
      setNoteDraft('');
      setShowNoteComposer(false);
      await loadDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Note failed');
    } finally {
      setSending(false);
    }
  };

  const replyPlaceholder =
    mode === 'dms'
      ? (t('inbox.replyAs') || 'Replying as {brand}…').replace('{brand}', brandReplyName)
      : t('inbox.commentOnPost') || 'Comment on this post…';

  const messageGroups = detail ? groupMessagesByDay(detail.messages) : [];
  const listIsEmpty = !loading && visibleItems.length === 0;
  const showPaneAllDone = listIsEmpty || !selectedId;

  const renderListRow = (it: InboxConversationListItem) => {
    const meta = parseInboxPostMeta(it.metadataJson);
    const thumbUrl = inboxPostThumbnailUrl(it.id, meta.postThumbnailUrl);

    return (
      <button
        key={it.id}
        type="button"
        className={`oma-plx-inbox-row${selectedId === it.id ? ' is-active' : ''}${
          it.unreadCount > 0 ? ' is-unread' : ''
        }`}
        onClick={() => setSelectedId(it.id)}
        data-testid={`inbox-row-${it.id}`}
      >
        {mode === 'comments' ? (
          <span className="oma-plx-inbox-row__media">
            <img className="oma-plx-inbox-row__thumb-img" src={thumbUrl} alt="" />
            <InboxPlatformBadge platform={it.platform} className="oma-plx-inbox-row__plat-badge" />
          </span>
        ) : (
          <span className="oma-plx-inbox-row__media oma-plx-inbox-row__media--person">
            <PersonAvatar
              name={it.participantName || '?'}
              imageUrl={it.participantAvatar}
              size="md"
            />
            <InboxPlatformBadge platform={it.platform} className="oma-plx-inbox-row__plat-badge" />
          </span>
        )}
        <span className="oma-plx-inbox-row__body">
          <span className="oma-plx-inbox-row__top">
            <span className="oma-plx-inbox-row__primary">
              {mode === 'comments' ? brandReplyName : it.participantName || 'Unknown'}
            </span>
            <span className="oma-plx-inbox-row__time">{relativeTime(it.lastMessageAt)}</span>
          </span>
          <span className="oma-plx-inbox-row__preview">
            {it.lastMessageDirection === 'INBOUND' && it.status !== 'CLOSED' ? (
              <span
                className="oma-plx-inbox-row__needs-reply"
                title={t('inbox.needReply') || 'Needs reply'}
              >
                •
              </span>
            ) : null}
            {it.lastMessagePreview || '—'}
          </span>
        </span>
        {it.priority ? (
          <span className="oma-plx-inbox-row__priority" aria-label="Priority">
            !
          </span>
        ) : null}
        {mode === 'dms' && it.unreadCount > 0 ? (
          <span className="oma-plx-inbox-row__info-badge" aria-label="Unread">
            {it.unreadCount}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="oma-plx-inbox" data-testid="inbox-page" data-inbox-mode={mode}>
      <section className="oma-plx-inbox-list" aria-label={listTitle}>
        <header className="oma-plx-inbox-list__head">
          <div className="oma-plx-inbox-list__title-row">
            <h2 className="oma-plx-inbox-list__title">{listTitle}</h2>
            <button
              type="button"
              className="oma-plx-inbox-icon-btn oma-plx-inbox-icon-btn--ghost"
              aria-label={t('inbox.syncNow') || 'Sync from channels'}
              disabled={syncing}
              onClick={() => void runSync()}
            >
              <ReloadOutlined className={syncing ? 'oma-plx-inbox-spin' : undefined} />
            </button>
          </div>
          {connections && connections.connectedPages === 0 ? (
            <p className="oma-plx-inbox-list__connect-hint">
              {t('inbox.connectHint') ||
                'Connect Facebook or Instagram in brand settings to pull comments and DMs.'}{' '}
              <Link href={brandSettingsHref}>{t('inbox.connectLink') || 'Connect accounts'}</Link>
            </p>
          ) : connections?.lastSyncAt ? (
            <p className="oma-plx-inbox-list__sync-meta">
              {(t('inbox.lastSync') || 'Last sync {time}').replace(
                '{time}',
                relativeTime(connections.lastSyncAt),
              )}
            </p>
          ) : null}
          <input
            type="search"
            className="oma-plx-inbox-list__search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('inbox.search.placeholder') || 'Search conversations…'}
            aria-label={t('inbox.search.placeholder') || 'Search conversations'}
          />
          <InboxStatusDropdown
            value={statusTab}
            onChange={setStatusTab}
            options={statusOptions}
            ariaLabel={t('inbox.statusFilter') || 'Status'}
          />
          <div className="oma-plx-inbox-channels" data-testid="inbox-channel-filter">
            {(
              [
                ['all', t('inbox.allChannels') || 'All channels'],
                ['META_IG', 'Instagram'],
                ['META_FB', 'Facebook'],
                ['TIKTOK', 'TikTok'],
                ['LINKEDIN', 'LinkedIn'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                data-active={platformFilter === id ? 'true' : 'false'}
                onClick={() => setPlatformFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'comments' ? (
            <label className="oma-plx-inbox-switch">
              <input
                type="checkbox"
                checked={unansweredOnly}
                onChange={(e) => setUnansweredOnly(e.target.checked)}
              />
              <span className="oma-plx-inbox-switch__track" aria-hidden />
              <span>{t('inbox.unansweredOnly') || 'Unanswered'}</span>
            </label>
          ) : null}
        </header>

        <div className="oma-plx-inbox-list__scroll">
          {loading ? <div className="oma-plx-inbox-empty-inline">Loading…</div> : null}
          {listIsEmpty ? (
            <InboxListEmptyState status={statusTab} onGoToOpen={() => setStatusTab('OPEN')} t={t} />
          ) : null}
          {visibleItems.map(renderListRow)}
        </div>
      </section>

      <section className="oma-plx-inbox-thread" aria-label="Conversation">
        {error ? (
          <p className="oma-inbox-error" role="alert">
            {error}
          </p>
        ) : null}
        {deliveryNote ? <p className="oma-inbox-delivery">{deliveryNote}</p> : null}

        {showPaneAllDone && !detailLoading ? (
          <InboxPaneAllDone t={t} />
        ) : detailLoading && !detail ? (
          <div className="oma-plx-inbox-empty-inline">Loading thread…</div>
        ) : detail ? (
          <>
            <header className="oma-plx-inbox-thread__head">
              {mode === 'dms' ? (
                <div className="oma-plx-inbox-thread__identity">
                  <PersonAvatar
                    name={detail.participantName || '?'}
                    imageUrl={detail.participantAvatar}
                  />
                  <h3>{detail.participantName || 'Conversation'}</h3>
                </div>
              ) : (
                <div className="oma-plx-inbox-thread__nav-block">
                  <div className="oma-plx-inbox-thread__nav">
                    <button
                      type="button"
                      className="oma-plx-inbox-icon-btn oma-plx-inbox-icon-btn--ghost"
                      aria-label="Previous"
                      disabled={selectedIndex <= 0}
                      onClick={() => goRelative(-1)}
                    >
                      <UpOutlined />
                    </button>
                    <button
                      type="button"
                      className="oma-plx-inbox-icon-btn oma-plx-inbox-icon-btn--ghost"
                      aria-label="Next"
                      disabled={selectedIndex < 0 || selectedIndex >= visibleItems.length - 1}
                      onClick={() => goRelative(1)}
                    >
                      <DownOutlined />
                    </button>
                  </div>
                  {assigneeLabel ? (
                    <span className="oma-plx-inbox-thread__assignee">
                      {t('inbox.assignedTo') || 'Assigned'}: {assigneeLabel}
                    </span>
                  ) : null}
                </div>
              )}
              <div className="oma-plx-inbox-thread__actions">
                {mode === 'dms' && assigneeLabel ? (
                  <span className="oma-plx-inbox-thread__assignee oma-plx-inbox-thread__assignee--compact">
                    {assigneeLabel}
                  </span>
                ) : null}
                <InboxThreadMenu
                  detail={detail}
                  t={t}
                  members={members}
                  onLater={() => void onMoveLater()}
                  onReopen={() => void onReopen()}
                  onMarkDone={() => void onMarkDone()}
                  onTogglePriority={() => void onTogglePriority()}
                  onAssign={(uid) => void onAssign(uid)}
                  onInternalNote={() => setShowNoteComposer(true)}
                />
                <button
                  type="button"
                  className={`oma-plx-inbox-icon-btn oma-plx-inbox-icon-btn--ghost${bookmarks.has(detail.id) ? ' is-on' : ''}`}
                  aria-label="Bookmark"
                  aria-pressed={bookmarks.has(detail.id)}
                  onClick={() => toggleBookmark(detail.id)}
                >
                  <StarOutlined />
                </button>
                {detail.status !== 'CLOSED' ? (
                  <button
                    type="button"
                    className="oma-plx-inbox-mark-done"
                    onClick={() => void onMarkDone()}
                  >
                    <CheckOutlined />
                    <span>{t('inbox.markDone') || 'Mark as done'}</span>
                  </button>
                ) : null}
              </div>
            </header>

            <div className="oma-plx-inbox-thread__body">
              {mode === 'comments' ? (
                <>
                  {!adBannerDismissed ? (
                    <div className="oma-plx-inbox-ad-banner" role="note">
                      <span className="oma-plx-inbox-ad-banner__icon">Ad</span>
                      <p>
                        {t('inbox.adBanner.body') ||
                          'We support ad comments now! Connect your Meta Ad Account to see comments from your ads & boosted posts.'}
                      </p>
                      <div className="oma-plx-inbox-ad-banner__actions">
                        <button
                          type="button"
                          className="oma-plx-inbox-link-btn"
                          onClick={() => {
                            setAdBannerDismissed(true);
                            window.localStorage.setItem('oma.inbox.adBanner.dismissed', '1');
                          }}
                        >
                          {t('inbox.adBanner.dismiss') || 'Dismiss'}
                        </button>
                        <Link href={brandSettingsHref} className="oma-plx-inbox-ad-banner__connect">
                          + {t('inbox.adBanner.connect') || 'Connect'}
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  <article className="oma-plx-inbox-post oma-plx-inbox-post--row">
                    <img
                      className="oma-plx-inbox-post__thumb"
                      src={inboxPostThumbnailUrl(detail.id, detailMeta.postThumbnailUrl)}
                      alt=""
                    />
                    <div className="oma-plx-inbox-post__content">
                      <div className="oma-plx-inbox-post__channel">
                        <InboxPlatformIcon platform={detail.platform} size={16} />
                        <strong>{brandReplyName}</strong>
                        <time dateTime={detail.lastMessageAt}>
                          {formatInboxPostDate(detail.lastMessageAt)}
                        </time>
                      </div>
                      <p className="oma-plx-inbox-post__caption">
                        {postCaption(detail, detailMeta) ||
                          t('inbox.postCard.fallback') ||
                          'Engagement on your published post.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="oma-plx-inbox-post__external"
                      aria-label="Open post"
                      disabled={!detailMeta.postPermalink}
                      onClick={() => {
                        if (detailMeta.postPermalink)
                          window.open(detailMeta.postPermalink, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <LinkOutlined />
                    </button>
                  </article>

                  <div className="oma-plx-inbox-comments-head">
                    <span>
                      {(t('inbox.commentCount') || '{count} comments').replace(
                        '{count}',
                        String(detail.messages.length),
                      )}
                    </span>
                    <label className="oma-plx-inbox-switch">
                      <input
                        type="checkbox"
                        checked={unansweredOnly}
                        onChange={(e) => setUnansweredOnly(e.target.checked)}
                      />
                      <span className="oma-plx-inbox-switch__track" aria-hidden />
                      <span>{t('inbox.unansweredOnly') || 'Unanswered'}</span>
                    </label>
                  </div>

                  <div className="oma-plx-inbox-comments">
                    {displayedComments.map((m) => {
                      const idx = detail.messages.findIndex((x) => x.id === m.id);
                      const showInline = replyToMessageId === m.id;
                      return (
                        <article key={m.id} className="oma-plx-inbox-comment-card">
                          <div className="oma-plx-inbox-comment-card__head">
                            <PersonAvatar name={m.senderName} imageUrl={m.senderAvatar} size="sm" />
                            <div className="oma-plx-inbox-comment-card__meta">
                              <strong>
                                {m.senderName.split(' ')[0]?.toLowerCase() ?? m.senderName}
                              </strong>
                              <time dateTime={m.createdAt}>{relativeTime(m.createdAt)}</time>
                            </div>
                            {m.direction === 'INBOUND' ? (
                              <div className="oma-plx-inbox-comment-card__tools">
                                <button type="button" aria-label="Like">
                                  <HeartOutlined />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Reply"
                                  onClick={() => {
                                    setReplyToMessageId(m.id);
                                    setInlineReply(`@${m.senderName.split(' ')[0] ?? 'user'} `);
                                  }}
                                >
                                  <CommentOutlined />
                                </button>
                                <div className="oma-plx-inbox-comment-menu">
                                  <button
                                    type="button"
                                    aria-label="More"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCommentMenuId((prev) => (prev === m.id ? null : m.id));
                                    }}
                                  >
                                    <MoreOutlined />
                                  </button>
                                  {commentMenuId === m.id ? (
                                    <div className="oma-plx-inbox-comment-menu__drop" role="menu">
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                          setCommentMenuId(null);
                                          setDeliveryNote(
                                            t('inbox.editNotSupported') ||
                                              'Editing comments on the social network is not supported from here.',
                                          );
                                        }}
                                      >
                                        <EditOutlined /> {t('inbox.comment.edit') || 'Edit'}
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => void onHideComment(m.id)}
                                      >
                                        <EyeInvisibleOutlined /> {t('inbox.comment.hide') || 'Hide'}
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="is-danger"
                                        onClick={() => void onDeleteComment(m.id)}
                                      >
                                        <DeleteOutlined /> {t('inbox.comment.delete') || 'Delete'}
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                          <p className="oma-plx-inbox-comment-card__text">{m.content}</p>
                          {showInline && m.direction === 'INBOUND' ? (
                            <div className="oma-plx-inbox-inline-reply">
                              <PersonAvatar name={brandReplyName} brand size="sm" />
                              <div className="oma-plx-inbox-inline-reply__field">
                                <input
                                  value={inlineReply}
                                  onChange={(e) => setInlineReply(e.target.value)}
                                  placeholder={replyPlaceholder}
                                />
                                <div className="oma-plx-inbox-inline-reply__tools">
                                  <button type="button" aria-label="Attach">
                                    <LinkOutlined />
                                  </button>
                                  <button type="button" aria-label="Emoji">
                                    <SmileOutlined />
                                  </button>
                                  <button type="button" aria-label="AI">
                                    ✦
                                  </button>
                                </div>
                              </div>
                              <Button
                                type="primary"
                                size="small"
                                loading={sending}
                                disabled={!inlineReply.trim()}
                                onClick={() => void submitReply(inlineReply, true)}
                              >
                                {t('inbox.postReply') || 'Post'}
                              </Button>
                            </div>
                          ) : null}
                          {idx === 0 && !showInline && isCommentUnanswered(detail.messages, idx) ? (
                            <div className="oma-plx-inbox-inline-reply oma-plx-inbox-inline-reply--placeholder">
                              <PersonAvatar name={brandReplyName} brand size="sm" />
                              <button
                                type="button"
                                className="oma-plx-inbox-inline-reply__ghost"
                                onClick={() => {
                                  setReplyToMessageId(m.id);
                                  setInlineReply('');
                                }}
                              >
                                {replyPlaceholder}
                              </button>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                  {detail.notes.length > 0 ? (
                    <div className="oma-plx-inbox-notes" data-testid="inbox-internal-notes">
                      {detail.notes.map((n) => (
                        <p key={n.id} className="oma-inbox-note">
                          {n.content}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="oma-plx-inbox-chat">
                  {messageGroups.map((g) => (
                    <div key={g.label} className="oma-plx-inbox-chat__group">
                      <div className="oma-plx-inbox-chat__date">{g.label}</div>
                      {g.items.map((m) => (
                        <div
                          key={m.id}
                          className={`oma-plx-inbox-chat__row oma-plx-inbox-chat__row--${m.direction.toLowerCase()}`}
                        >
                          {m.direction === 'OUTBOUND' ? (
                            <div className="oma-plx-inbox-chat__out-label">{m.senderName}</div>
                          ) : null}
                          <div className="oma-plx-inbox-chat__bubble-wrap">
                            {m.direction === 'INBOUND' ? (
                              <PersonAvatar
                                name={m.senderName}
                                imageUrl={m.senderAvatar}
                                size="sm"
                              />
                            ) : null}
                            <div
                              className={`oma-plx-inbox-bubble oma-plx-inbox-bubble--${m.direction.toLowerCase()}`}
                            >
                              {m.content}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {detail.notes.length > 0 ? (
                    <div className="oma-plx-inbox-notes" data-testid="inbox-internal-notes">
                      {detail.notes.map((n) => (
                        <p key={n.id} className="oma-inbox-note">
                          {n.content}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <footer className={`oma-plx-inbox-composer oma-plx-inbox-composer--${mode}`}>
              {showNoteComposer ? (
                <div className="oma-plx-inbox-composer__note">
                  <input
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder={t('inbox.notePlaceholder') || 'Internal note…'}
                    className="oma-plx-inbox-composer__input"
                  />
                  <Button
                    type="default"
                    size="small"
                    loading={sending}
                    onClick={() => void onAddNote()}
                  >
                    {t('inbox.saveNote') || 'Save note'}
                  </Button>
                </div>
              ) : null}
              <div className="oma-plx-inbox-composer__pill">
                {mode === 'comments' ? (
                  <PersonAvatar name={brandReplyName} brand size="sm" />
                ) : (
                  <InboxPlatformIcon platform={detail.platform} size={18} />
                )}
                <input
                  className="oma-plx-inbox-composer__pill-input"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={replyPlaceholder}
                  data-testid="inbox-reply-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void submitReply(reply, false);
                    }
                  }}
                />
                {reply.trim() ? (
                  <Button
                    type="primary"
                    loading={sending}
                    onClick={() => void submitReply(reply, false)}
                    data-testid="inbox-reply-send"
                    className="oma-plx-inbox-composer__send-inline"
                  >
                    {mode === 'dms'
                      ? t('inbox.sendReply') || 'Send'
                      : t('inbox.postReply') || 'Post'}
                  </Button>
                ) : null}
              </div>
            </footer>
          </>
        ) : null}
      </section>
    </div>
  );
}
