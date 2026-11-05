'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@oma/ui/controls';
import {
  addInboxNote,
  getInboxConversation,
  listInboxConversations,
  replyInboxConversation,
  setInboxPriority,
  setInboxStatus,
  type InboxConversationDetail,
  type InboxConversationListItem,
  type InboxMessage,
} from '../../../../lib/inbox-api';
import { useT } from '../../../../lib/use-locale';
import { resolveActiveBrand, useActiveBrandId } from '../../../../lib/active-brand';
import { listScopedBrands } from '../../../../lib/campaign-api';
import { EmptyState } from '../../../../components/ui/empty-state';
import {
  CheckOutlined,
  CommentOutlined,
  DownOutlined,
  HeartOutlined,
  MoreOutlined,
  SmileOutlined,
  StarOutlined,
  UpOutlined,
} from '../../../../components/ui/lucide-icons';
import { InboxPlatformBadge, InboxPlatformIcon } from './inbox-platform-icon';
import {
  channelLine,
  inboxPostThumbnailUrl,
  isCommentType,
  parseInboxPostMeta,
  platformLabel,
  postCaption,
  relativeTime,
  sentimentLabel,
} from './inbox-utils';

export type InboxMode = 'comments' | 'dms';

const PLATFORMS = ['all', 'META_FB', 'META_IG', 'TIKTOK', 'LINKEDIN'] as const;

type StatusTab = 'OPEN' | 'PENDING' | 'CLOSED';

const STATUS_TABS: { value: StatusTab; labelKey: string }[] = [
  { value: 'OPEN', labelKey: 'inbox.filter.open' },
  { value: 'PENDING', labelKey: 'inbox.filter.later' },
  { value: 'CLOSED', labelKey: 'inbox.filter.done' },
];

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

function conversationNeedsReply(detail: InboxConversationDetail | null) {
  if (!detail?.messages.length) return false;
  const last = detail.messages[detail.messages.length - 1]!;
  return last.direction === 'INBOUND';
}

function PersonAvatar({
  name,
  imageUrl,
  size = 'md',
}: {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cls =
    size === 'sm' ? 'oma-plx-inbox-avatar oma-plx-inbox-avatar--sm' : size === 'lg' ? 'oma-plx-inbox-avatar oma-plx-inbox-avatar--lg' : 'oma-plx-inbox-avatar';
  if (imageUrl) {
    return (
      <span className={cls} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" />
      </span>
    );
  }
  return (
    <span className={cls} aria-hidden>
      {(name || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

export function InboxClient({ mode }: { mode: InboxMode }) {
  const t = useT();
  const activeBrandId = useActiveBrandId();
  const [brandReplyName, setBrandReplyName] = useState('OMA');
  const moreRef = useRef<HTMLDivElement>(null);

  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>('all');
  const [statusTab, setStatusTab] = useState<StatusTab>('OPEN');
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [items, setItems] = useState<InboxConversationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboxConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => new Set());
  const [moreOpen, setMoreOpen] = useState(false);
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('oma.inbox.bookmarks');
      if (raw) setBookmarks(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  useEffect(() => {
    void listScopedBrands()
      .then((rows) => {
        const hit = resolveActiveBrand(rows, activeBrandId);
        if (hit?.name) setBrandReplyName(hit.name);
      })
      .catch(() => undefined);
  }, [activeBrandId]);

  const listTitle =
    mode === 'dms' ? t('inbox.directMessages') || 'Direct messages' : t('inbox.commentsTitle') || 'Comments';

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listInboxConversations({
        category: mode,
        platform: platform === 'all' ? undefined : platform,
        status: statusTab,
        limit: 50,
      });
      setItems(res.items);
      setTotal(res.total);
      setSelectedId((prev) => {
        if (prev && res.items.some((it) => it.id === prev)) return prev;
        return res.items[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inbox');
      setItems([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [mode, platform, statusTab]);

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

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const visibleItems = useMemo(() => {
    if (!unansweredOnly || mode !== 'comments') return items;
    return items.filter((it) => it.status !== 'CLOSED' && it.unreadCount > 0);
  }, [items, unansweredOnly, mode]);

  const selectedIndex = useMemo(
    () => visibleItems.findIndex((it) => it.id === selectedId),
    [visibleItems, selectedId],
  );

  const detailMeta = useMemo(
    () => parseInboxPostMeta(detail?.metadataJson),
    [detail?.metadataJson],
  );

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

  const onReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    setDeliveryNote(null);
    try {
      const res = await replyInboxConversation(selectedId, reply.trim());
      setReply('');
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

  const renderListRow = (it: InboxConversationListItem) => {
    const meta = parseInboxPostMeta(it.metadataJson);
    const thumbUrl = inboxPostThumbnailUrl(it.id, meta.postThumbnailUrl);
    const sent = sentimentLabel(it.sentiment);

    return (
      <button
        key={it.id}
        type="button"
        className={`oma-plx-inbox-row${selectedId === it.id ? ' is-active' : ''}${
          it.unreadCount > 0 ? ' is-unread' : ''
        }${it.priority ? ' is-priority' : ''}`}
        onClick={() => setSelectedId(it.id)}
        data-testid={`inbox-row-${it.id}`}
      >
        {mode === 'comments' ? (
          <span className="oma-plx-inbox-row__media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="oma-plx-inbox-row__thumb-img" src={thumbUrl} alt="" />
            <InboxPlatformBadge platform={it.platform} className="oma-plx-inbox-row__plat-badge" />
          </span>
        ) : (
          <span className="oma-plx-inbox-row__media oma-plx-inbox-row__media--person">
            <PersonAvatar name={it.participantName || '?'} imageUrl={it.participantAvatar} />
            <InboxPlatformBadge platform={it.platform} className="oma-plx-inbox-row__plat-badge" />
          </span>
        )}
        <span className="oma-plx-inbox-row__body">
          <span className="oma-plx-inbox-row__top">
            <span className="oma-plx-inbox-row__channel">
              {mode === 'comments' ? (
                <>
                  <InboxPlatformIcon platform={it.platform} size={14} />
                  <span>{channelLine(it, brandReplyName, meta)}</span>
                </>
              ) : (
                <span>{it.participantName || 'Unknown'}</span>
              )}
            </span>
            <span className="oma-plx-inbox-row__time">{relativeTime(it.lastMessageAt)}</span>
          </span>
          <span className="oma-plx-inbox-row__preview">
            {mode === 'comments' ? (
              <>
                <strong>{it.participantName || 'User'}</strong>
                <span>{it.lastMessagePreview || '—'}</span>
              </>
            ) : (
              it.lastMessagePreview || '—'
            )}
          </span>
          {sent && mode === 'comments' ? (
            <span
              className={`oma-plx-inbox-sent-pill oma-plx-inbox-sent-pill--${(it.sentiment ?? 'NEUTRAL').toLowerCase()}`}
            >
              {t(`inbox.sentiment.${(it.sentiment ?? 'neutral').toLowerCase()}`) || sent}
            </span>
          ) : null}
        </span>
        {it.unreadCount > 0 ? (
          <span className="oma-plx-inbox-row__badge">{it.unreadCount}</span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="oma-plx-inbox" data-testid="inbox-page" data-inbox-mode={mode}>
      <section className="oma-plx-inbox-list" aria-label={listTitle}>
        <header className="oma-plx-inbox-list__head">
          <h2 className="oma-plx-inbox-list__title">{listTitle}</h2>
          <label className="oma-plx-inbox-select-wrap oma-plx-inbox-select-wrap--platform">
            <span className="oma-plx-inbox-select__leading" aria-hidden>
              {platform === 'all' ? null : <InboxPlatformIcon platform={platform} size={14} />}
            </span>
            <select
              className="oma-plx-inbox-select oma-plx-inbox-select--with-icon"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as (typeof PLATFORMS)[number])}
              aria-label={t('inbox.channelFilter') || 'Channel'}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p === 'all' ? t('inbox.allChannels') || 'All channels' : platformLabel(p)}
                </option>
              ))}
            </select>
          </label>
        </header>

        <div className="oma-plx-inbox-status-tabs" role="tablist" aria-label="Status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={statusTab === tab.value}
              className={`oma-plx-inbox-status-tabs__btn${statusTab === tab.value ? ' is-active' : ''}`}
              onClick={() => setStatusTab(tab.value)}
            >
              {t(tab.labelKey) || tab.value}
            </button>
          ))}
        </div>

        {mode === 'comments' ? (
          <div className="oma-plx-inbox-list__toolbar">
            <label className="oma-plx-inbox-toggle">
              <input
                type="checkbox"
                checked={unansweredOnly}
                onChange={(e) => setUnansweredOnly(e.target.checked)}
              />
              <span>{t('inbox.unansweredOnly') || 'Unanswered'}</span>
            </label>
            <span className="oma-plx-inbox-list__count">{total}</span>
          </div>
        ) : (
          <div className="oma-plx-inbox-list__toolbar oma-plx-inbox-list__toolbar--solo">
            <span className="oma-plx-inbox-list__count">{total}</span>
          </div>
        )}

        <div className="oma-plx-inbox-list__scroll">
          {loading ? <div className="oma-plx-inbox-empty-inline">Loading…</div> : null}
          {!loading && visibleItems.length === 0 ? (
            <div className="oma-plx-inbox-empty-list">
              <EmptyState
                title={t('inbox.empty.listTitle') || 'No conversations yet'}
                body={
                  t('inbox.empty.listBody') ||
                  'When comments or DMs arrive from connected channels, they show up here.'
                }
              />
            </div>
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

        {!selectedId ? (
          <div className="oma-plx-inbox-thread__empty">
            <EmptyState
              title={t('inbox.empty.threadTitle') || 'Select a conversation'}
              body={
                t('inbox.empty.threadBody') ||
                'Pick a thread from the list to read and reply.'
              }
            />
          </div>
        ) : detailLoading && !detail ? (
          <div className="oma-plx-inbox-empty-inline">Loading thread…</div>
        ) : detail ? (
          <>
            <header className="oma-plx-inbox-thread__head">
              <div className="oma-plx-inbox-thread__identity">
                {mode === 'dms' ? (
                  <PersonAvatar name={detail.participantName || '?'} imageUrl={detail.participantAvatar} />
                ) : (
                  <InboxPlatformIcon platform={detail.platform} size={22} />
                )}
                <div>
                  <h3>{detail.participantName || 'Conversation'}</h3>
                  {mode === 'comments' ? (
                    <p className="oma-plx-inbox-thread__sub">
                      {channelLine(detail, brandReplyName, detailMeta)} ·{' '}
                      {isCommentType(detail.type) ? t('inbox.postComment') || 'Post comment' : detail.type}
                    </p>
                  ) : (
                    <p className="oma-plx-inbox-thread__sub">{channelLine(detail, brandReplyName, detailMeta)}</p>
                  )}
                </div>
              </div>
              <div className="oma-plx-inbox-thread__actions">
                <button
                  type="button"
                  className="oma-plx-inbox-icon-btn"
                  aria-label="Previous"
                  disabled={selectedIndex <= 0}
                  onClick={() => goRelative(-1)}
                >
                  <UpOutlined />
                </button>
                <button
                  type="button"
                  className="oma-plx-inbox-icon-btn"
                  aria-label="Next"
                  disabled={selectedIndex < 0 || selectedIndex >= visibleItems.length - 1}
                  onClick={() => goRelative(1)}
                >
                  <DownOutlined />
                </button>
                <button
                  type="button"
                  className={`oma-plx-inbox-icon-btn${bookmarks.has(detail.id) ? ' is-on' : ''}`}
                  aria-label="Bookmark"
                  aria-pressed={bookmarks.has(detail.id)}
                  onClick={() => toggleBookmark(detail.id)}
                >
                  <StarOutlined />
                </button>
                <div className="oma-plx-inbox-more" ref={moreRef}>
                  <button
                    type="button"
                    className="oma-plx-inbox-icon-btn"
                    aria-expanded={moreOpen}
                    aria-label="More actions"
                    onClick={() => setMoreOpen((v) => !v)}
                  >
                    <MoreOutlined />
                  </button>
                  {moreOpen ? (
                    <div className="oma-plx-inbox-more__menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          void setInboxPriority(detail.id, !detail.priority).then(() => {
                            void loadDetail(detail.id);
                            void loadList();
                            setMoreOpen(false);
                          })
                        }
                      >
                        {detail.priority
                          ? t('inbox.menu.removePriority') || 'Remove priority'
                          : t('inbox.menu.priority') || 'Mark priority'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          void setInboxStatus(detail.id, 'PENDING').then(() => {
                            void loadList();
                            setMoreOpen(false);
                          })
                        }
                      >
                        {t('inbox.menu.later') || 'Move to later'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          void setInboxStatus(detail.id, 'OPEN').then(() => {
                            void loadList();
                            setMoreOpen(false);
                          })
                        }
                      >
                        {t('inbox.menu.reopen') || 'Reopen'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setShowNoteComposer(true);
                          setMoreOpen(false);
                        }}
                      >
                        {t('inbox.menu.note') || 'Internal note'}
                      </button>
                    </div>
                  ) : null}
                </div>
                {detail.status !== 'CLOSED' ? (
                  <Button type="default" size="small" className="oma-plx-inbox-done" onClick={() => void onMarkDone()}>
                    <CheckOutlined /> {t('inbox.markDone') || 'Mark as done'}
                  </Button>
                ) : null}
              </div>
            </header>

            <div className="oma-plx-inbox-thread__body">
              {mode === 'comments' ? (
                <>
                  <article className="oma-plx-inbox-post oma-plx-inbox-post--row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="oma-plx-inbox-post__thumb"
                      src={inboxPostThumbnailUrl(detail.id, detailMeta.postThumbnailUrl)}
                      alt=""
                    />
                    <div className="oma-plx-inbox-post__content">
                      <div className="oma-plx-inbox-post__channel">
                        <InboxPlatformIcon platform={detail.platform} size={16} />
                        <strong>{brandReplyName}</strong>
                        <span>{platformLabel(detail.platform)}</span>
                      </div>
                      <p className="oma-plx-inbox-post__caption">
                        {postCaption(detail, detailMeta) ||
                          t('inbox.postCard.fallback') ||
                          'Engagement on your published post.'}
                      </p>
                    </div>
                  </article>
                  {conversationNeedsReply(detail) ? (
                    <div className="oma-plx-inbox-banner">
                      <CommentOutlined />
                      <span>{t('inbox.needReply') || 'This thread may need a reply.'}</span>
                    </div>
                  ) : null}
                  <div className="oma-plx-inbox-comments">
                    {detail.messages.map((m) => (
                      <article
                        key={m.id}
                        className={`oma-plx-inbox-comment oma-plx-inbox-comment--${m.direction.toLowerCase()}`}
                      >
                        <PersonAvatar name={m.senderName} imageUrl={m.senderAvatar} size="sm" />
                        <div className="oma-plx-inbox-comment__main">
                          <header>
                            <strong>{m.senderName}</strong>
                            {m.direction === 'OUTBOUND' ? (
                              <span className="oma-plx-inbox-comment__you">{t('inbox.you') || 'You'}</span>
                            ) : null}
                            <time dateTime={m.createdAt}>{relativeTime(m.createdAt)}</time>
                          </header>
                          <p>{m.content}</p>
                          {m.direction === 'INBOUND' ? (
                            <div className="oma-plx-inbox-comment__actions">
                              <button type="button" aria-label="Like">
                                <HeartOutlined />
                              </button>
                              <button
                                type="button"
                                aria-label="Reply"
                                onClick={() => setReply(`@${m.senderName.split(' ')[0] ?? 'user'} `)}
                              >
                                <CommentOutlined />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                  {detail.notes.length > 0 ? (
                    <div className="oma-plx-inbox-notes">
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
                          {m.direction === 'INBOUND' ? (
                            <PersonAvatar name={m.senderName} imageUrl={m.senderAvatar} size="sm" />
                          ) : null}
                          <div
                            className={`oma-plx-inbox-bubble oma-plx-inbox-bubble--${m.direction.toLowerCase()}`}
                          >
                            {m.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <footer className="oma-plx-inbox-composer">
              {showNoteComposer ? (
                <div className="oma-plx-inbox-composer__note">
                  <input
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder={t('inbox.notePlaceholder') || 'Internal note…'}
                    className="oma-plx-inbox-composer__input"
                  />
                  <Button type="default" size="small" loading={sending} onClick={() => void onAddNote()}>
                    {t('inbox.saveNote') || 'Save note'}
                  </Button>
                </div>
              ) : null}
              <div className="oma-plx-inbox-composer__main">
                <button type="button" className="oma-plx-inbox-composer__emoji" aria-label="Emoji">
                  <SmileOutlined />
                </button>
                <textarea
                  className="oma-plx-inbox-composer__textarea"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={replyPlaceholder}
                  data-testid="inbox-reply-input"
                  rows={mode === 'dms' ? 3 : 2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void onReply();
                  }}
                />
                <Button
                  type="primary"
                  loading={sending}
                  disabled={!reply.trim()}
                  onClick={() => void onReply()}
                  data-testid="inbox-reply-send"
                  className="oma-plx-inbox-composer__send"
                >
                  {mode === 'comments' ? t('inbox.postReply') || 'Post' : t('inbox.sendReply') || 'Send'}
                </Button>
              </div>
            </footer>
          </>
        ) : null}
      </section>
    </div>
  );
}
