'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

export type InboxMode = 'comments' | 'dms';

const PLATFORMS = ['all', 'META_FB', 'META_IG', 'TIKTOK', 'LINKEDIN'] as const;
type StatusFilter = 'all' | 'UNREAD' | 'OPEN' | 'PENDING' | 'CLOSED';

const STATUS_OPTIONS: { value: StatusFilter; labelKey: string }[] = [
  { value: 'OPEN', labelKey: 'inbox.filter.open' },
  { value: 'all', labelKey: 'inbox.filter.all' },
  { value: 'UNREAD', labelKey: 'inbox.filter.unread' },
  { value: 'PENDING', labelKey: 'inbox.filter.pending' },
  { value: 'CLOSED', labelKey: 'inbox.filter.done' },
];

function platformLabel(p: string) {
  const map: Record<string, string> = {
    META_FB: 'Facebook',
    META_IG: 'Instagram',
    TIKTOK: 'TikTok',
    LINKEDIN: 'LinkedIn',
  };
  return map[p] ?? p;
}

function platformShort(p: string) {
  const map: Record<string, string> = {
    META_FB: 'FB',
    META_IG: 'IG',
    TIKTOK: 'TT',
    LINKEDIN: 'IN',
  };
  return map[p] ?? p.slice(0, 2);
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function isCommentType(type: string) {
  return type === 'POST_COMMENT' || type === 'DARK_COMMENT' || type === 'MENTION';
}

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

export function InboxClient({ mode }: { mode: InboxMode }) {
  const t = useT();
  const activeBrandId = useActiveBrandId();
  const [brandReplyName, setBrandReplyName] = useState('OMA');

  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
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
        status: statusFilter === 'all' ? undefined : statusFilter,
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
  }, [mode, platform, statusFilter]);

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

  return (
    <div className="oma-plx-inbox" data-testid="inbox-page" data-inbox-mode={mode}>
      <section className="oma-plx-inbox-list" aria-label={listTitle}>
        <header className="oma-plx-inbox-list__head">
          <h2 className="oma-plx-inbox-list__title">{listTitle}</h2>
          <div className="oma-plx-inbox-list__filters">
            <label className="oma-plx-inbox-select-wrap">
              <select
                className="oma-plx-inbox-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                aria-label="Status"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.labelKey) || o.value}
                  </option>
                ))}
              </select>
            </label>
            <label className="oma-plx-inbox-select-wrap oma-plx-inbox-select-wrap--platform">
              <select
                className="oma-plx-inbox-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as (typeof PLATFORMS)[number])}
                aria-label="Platform"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p === 'all' ? 'All channels' : platformLabel(p)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

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
        ) : null}

        <div className="oma-plx-inbox-list__scroll">
          {loading ? <div className="oma-inbox-empty">Loading…</div> : null}
          {!loading && visibleItems.length === 0 ? (
            <div className="oma-inbox-empty">
              <strong>No conversations</strong>
              <p>Inbound DMs and comments appear when webhooks are connected, or after demo seed.</p>
            </div>
          ) : null}
          {visibleItems.map((it) => (
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
                <span className="oma-plx-inbox-row__thumb" aria-hidden>
                  <span className="oma-plx-inbox-row__thumb-inner" />
                </span>
              ) : (
                <span className="oma-plx-inbox-row__avatar" aria-hidden>
                  {(it.participantName || '?').slice(0, 1).toUpperCase()}
                  <span className={`oma-plx-inbox-row__plat oma-plx-inbox-row__plat--${it.platform}`}>
                    {platformShort(it.platform)}
                  </span>
                </span>
              )}
              <span className="oma-plx-inbox-row__body">
                <span className="oma-plx-inbox-row__top">
                  <span className="oma-plx-inbox-row__name">
                    {mode === 'comments' ? (
                      <>
                        <span className={`oma-plx-inbox-plat-badge oma-plx-inbox-plat-badge--${it.platform}`}>
                          {platformShort(it.platform)}
                        </span>
                        <span>{brandReplyName}</span>
                      </>
                    ) : (
                      it.participantName || 'Unknown'
                    )}
                  </span>
                  <span className="oma-plx-inbox-row__time">{relativeTime(it.lastMessageAt)}</span>
                </span>
                <span className="oma-plx-inbox-row__preview">
                  {mode === 'comments' && !isCommentType(it.type)
                    ? it.lastMessagePreview
                    : mode === 'comments'
                      ? `${it.participantName}: ${it.lastMessagePreview || '—'}`
                      : it.lastMessagePreview || '—'}
                </span>
              </span>
              {it.unreadCount > 0 ? (
                <span className="oma-plx-inbox-row__badge">{it.unreadCount}</span>
              ) : null}
            </button>
          ))}
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
          <div className="oma-inbox-empty oma-plx-inbox-thread__empty">Select a conversation</div>
        ) : detailLoading && !detail ? (
          <div className="oma-inbox-empty">Loading thread…</div>
        ) : detail ? (
          <>
            <header className="oma-plx-inbox-thread__head">
              <div className="oma-plx-inbox-thread__identity">
                {mode === 'dms' ? (
                  <span className="oma-plx-inbox-thread__avatar" aria-hidden>
                    {(detail.participantName || '?').slice(0, 1).toUpperCase()}
                  </span>
                ) : null}
                <div>
                  <h3>{detail.participantName || 'Conversation'}</h3>
                  {mode === 'comments' ? (
                    <p className="oma-plx-inbox-thread__sub">
                      {platformLabel(detail.platform)} · {detail.subject || 'Post comment'}
                    </p>
                  ) : (
                    <p className="oma-plx-inbox-thread__sub">{platformLabel(detail.platform)}</p>
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
                  ↑
                </button>
                <button
                  type="button"
                  className="oma-plx-inbox-icon-btn"
                  aria-label="Next"
                  disabled={selectedIndex < 0 || selectedIndex >= visibleItems.length - 1}
                  onClick={() => goRelative(1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={`oma-plx-inbox-icon-btn${bookmarks.has(detail.id) ? ' is-on' : ''}`}
                  aria-label="Bookmark"
                  aria-pressed={bookmarks.has(detail.id)}
                  onClick={() => toggleBookmark(detail.id)}
                >
                  ☆
                </button>
                <div className="oma-plx-inbox-more">
                  <button
                    type="button"
                    className="oma-plx-inbox-icon-btn"
                    aria-expanded={moreOpen}
                    aria-label="More actions"
                    onClick={() => setMoreOpen((v) => !v)}
                  >
                    ⋯
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
                        {detail.priority ? 'Remove priority' : 'Mark priority'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void setInboxStatus(detail.id, 'PENDING').then(() => loadList())}
                      >
                        Pending
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void setInboxStatus(detail.id, 'OPEN').then(() => loadList())}
                      >
                        Reopen
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setShowNoteComposer(true);
                          setMoreOpen(false);
                        }}
                      >
                        Internal note
                      </button>
                    </div>
                  ) : null}
                </div>
                {detail.status !== 'CLOSED' ? (
                  <Button type="default" size="small" className="oma-plx-inbox-done" onClick={() => void onMarkDone()}>
                    ✓ {t('inbox.markDone') || 'Mark as done'}
                  </Button>
                ) : null}
              </div>
            </header>

            <div className="oma-plx-inbox-thread__body">
              {mode === 'comments' ? (
                <>
                  <div className="oma-plx-inbox-post">
                    <div className="oma-plx-inbox-post__media" aria-hidden />
                    <div className="oma-plx-inbox-post__meta">
                      <strong>{brandReplyName}</strong>
                      <span>{detail.subject || 'Original post'}</span>
                    </div>
                    <p className="oma-plx-inbox-post__caption">
                      {detail.subject || 'Engagement on your published post.'}
                    </p>
                  </div>
                  {conversationNeedsReply(detail) ? (
                    <div className="oma-plx-inbox-banner">
                      <span>This thread may need a reply.</span>
                    </div>
                  ) : null}
                  <div className="oma-plx-inbox-comments">
                    {detail.messages.map((m) => (
                      <article key={m.id} className="oma-plx-inbox-comment">
                        <span className="oma-plx-inbox-comment__avatar" aria-hidden>
                          {m.senderName.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="oma-plx-inbox-comment__main">
                          <header>
                            <strong>{m.senderName}</strong>
                            <time dateTime={m.createdAt}>{relativeTime(m.createdAt)}</time>
                          </header>
                          <p>{m.content}</p>
                          {m.direction === 'INBOUND' ? (
                            <div className="oma-plx-inbox-comment__actions">
                              <button type="button" aria-label="Like">
                                ♡
                              </button>
                              <button
                                type="button"
                                aria-label="Reply"
                                onClick={() => setReply(`@${m.senderName.split(' ')[0] ?? 'user'} `)}
                              >
                                ↩
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
                            <span className="oma-plx-inbox-chat__avatar" aria-hidden>
                              {m.senderName.slice(0, 1).toUpperCase()}
                            </span>
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
                    placeholder="Internal note…"
                    className="oma-plx-inbox-composer__input"
                  />
                  <Button type="default" size="small" loading={sending} onClick={() => void onAddNote()}>
                    Save note
                  </Button>
                </div>
              ) : null}
              <div className="oma-plx-inbox-composer__main">
                <button type="button" className="oma-plx-inbox-composer__emoji" aria-label="Emoji">
                  ☺
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
                  {mode === 'comments' ? 'Post' : 'Send'}
                </Button>
              </div>
            </footer>
          </>
        ) : null}
      </section>
    </div>
  );
}
