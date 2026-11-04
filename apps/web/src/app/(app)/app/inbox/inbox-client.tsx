'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input } from '@oma/ui/controls';
import {
  addInboxNote,
  getInboxConversation,
  getInboxStats,
  listInboxConversations,
  replyInboxConversation,
  setInboxPriority,
  setInboxStatus,
  setInboxTags,
  type InboxConversationDetail,
  type InboxConversationListItem,
  type InboxStats,
} from '../../../../lib/inbox-api';
import { useT } from '../../../../lib/use-locale';

const PLATFORMS = ['all', 'META_FB', 'META_IG', 'TIKTOK', 'LINKEDIN'] as const;
const STATUSES = ['all', 'UNREAD', 'OPEN', 'PENDING', 'CLOSED'] as const;
const SENTIMENTS = ['all', 'POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const;

const QUICK_REPLIES = [
  'Thank you for reaching out — we will get back to you shortly.',
  'We are sorry for the inconvenience. Please share your order number.',
  'Thanks for the feedback! We appreciate your support.',
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

function sentimentDot(s: string | null) {
  if (s === 'POSITIVE') return 'oma-inbox-dot oma-inbox-dot--pos';
  if (s === 'NEGATIVE') return 'oma-inbox-dot oma-inbox-dot--neg';
  return 'oma-inbox-dot oma-inbox-dot--neu';
}

export function InboxClient() {
  const t = useT();
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState('all');
  const [sentiment, setSentiment] = useState('all');
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [items, setItems] = useState<InboxConversationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboxConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tab, setTab] = useState<'messages' | 'notes'>('messages');
  const [error, setError] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, st] = await Promise.all([
        listInboxConversations({
          platform: platform === 'all' ? undefined : platform,
          status: status === 'all' ? undefined : status,
          sentiment: sentiment === 'all' ? undefined : sentiment,
          priority: priorityOnly || undefined,
          unassigned: unassignedOnly || undefined,
          q: searchApplied || undefined,
          limit: 50,
        }),
        getInboxStats().catch(() => null),
      ]);
      setItems(res.items);
      setTotal(res.total);
      if (st) setStats(st);
      if (!selectedId && res.items[0]) setSelectedId(res.items[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inbox');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [platform, status, sentiment, priorityOnly, unassignedOnly, searchApplied, selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const d = await getInboxConversation(id);
      setDetail(d);
      setTagInput((d.tags ?? []).join(', '));
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
  }, [platform, status, sentiment, priorityOnly, unassignedOnly, searchApplied]); // eslint-disable-line

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

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

  const onNote = async () => {
    if (!selectedId || !note.trim()) return;
    setSending(true);
    try {
      await addInboxNote(selectedId, note.trim());
      setNote('');
      await loadDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Note failed');
    } finally {
      setSending(false);
    }
  };

  const onSaveTags = async () => {
    if (!selectedId) return;
    const tags = tagInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await setInboxTags(selectedId, tags);
    await loadDetail(selectedId);
    await loadList();
  };

  const unreadTotal = useMemo(
    () => stats?.unread ?? items.reduce((n, it) => n + (it.unreadCount || 0), 0),
    [items, stats],
  );

  return (
    <div className="oma-inbox" data-testid="inbox-page">
      <aside className="oma-inbox-filters" aria-label="Inbox filters">
        <h2 className="oma-inbox-filters__title">{t('nav.inbox') || 'Inbox'}</h2>
        <p className="oma-inbox-filters__meta">
          {total} threads · {unreadTotal} unread
          {stats ? ` · ${stats.priority} priority` : ''}
        </p>

        {stats ? (
          <div className="oma-inbox-stats">
            <button type="button" className="oma-inbox-stat" onClick={() => setStatus('UNREAD')}>
              <strong>{stats.unread}</strong>
              <span>Unread</span>
            </button>
            <button type="button" className="oma-inbox-stat" onClick={() => setPriorityOnly(true)}>
              <strong>{stats.priority}</strong>
              <span>Priority</span>
            </button>
            <button type="button" className="oma-inbox-stat" onClick={() => setUnassignedOnly(true)}>
              <strong>{stats.unassigned}</strong>
              <span>Unassigned</span>
            </button>
            <button type="button" className="oma-inbox-stat" onClick={() => setStatus('PENDING')}>
              <strong>{stats.pending}</strong>
              <span>Pending</span>
            </button>
          </div>
        ) : null}

        <label className="oma-inbox-filters__label">Search</label>
        <div className="oma-inbox-search">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or message…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearchApplied(search.trim());
            }}
          />
          <Button type="default" size="small" onClick={() => setSearchApplied(search.trim())}>
            Go
          </Button>
        </div>

        <label className="oma-inbox-filters__label">Platform</label>
        <div className="oma-inbox-chip-row">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              className={`oma-inbox-chip${platform === p ? ' is-active' : ''}`}
              onClick={() => setPlatform(p)}
            >
              {p === 'all' ? 'All' : platformLabel(p)}
            </button>
          ))}
        </div>

        <label className="oma-inbox-filters__label">Status</label>
        <div className="oma-inbox-chip-row">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`oma-inbox-chip${status === s ? ' is-active' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        <label className="oma-inbox-filters__label">Sentiment</label>
        <div className="oma-inbox-chip-row">
          {SENTIMENTS.map((s) => (
            <button
              key={s}
              type="button"
              className={`oma-inbox-chip${sentiment === s ? ' is-active' : ''}`}
              onClick={() => setSentiment(s)}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        <label className="oma-inbox-filters__label">Desk</label>
        <div className="oma-inbox-chip-row">
          <button
            type="button"
            className={`oma-inbox-chip${priorityOnly ? ' is-active' : ''}`}
            onClick={() => setPriorityOnly((v) => !v)}
          >
            Priority
          </button>
          <button
            type="button"
            className={`oma-inbox-chip${unassignedOnly ? ' is-active' : ''}`}
            onClick={() => setUnassignedOnly((v) => !v)}
          >
            Unassigned
          </button>
          <button
            type="button"
            className="oma-inbox-chip"
            onClick={() => {
              setPlatform('all');
              setStatus('all');
              setSentiment('all');
              setPriorityOnly(false);
              setUnassignedOnly(false);
              setSearch('');
              setSearchApplied('');
            }}
          >
            Reset
          </button>
        </div>
      </aside>

      <section className="oma-inbox-list" aria-label="Conversations">
        {loading ? <div className="oma-inbox-empty">Loading…</div> : null}
        {!loading && items.length === 0 ? (
          <div className="oma-inbox-empty">
            <strong>No conversations</strong>
            <p>Inbound DMs and comments appear when webhooks are connected, or after demo seed.</p>
          </div>
        ) : null}
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className={`oma-inbox-row${selectedId === it.id ? ' is-active' : ''}${
              it.unreadCount > 0 ? ' is-unread' : ''
            }${it.priority ? ' is-priority' : ''}`}
            onClick={() => setSelectedId(it.id)}
            data-testid={`inbox-row-${it.id}`}
          >
            <span className={sentimentDot(it.sentiment)} aria-hidden />
            <span className="oma-inbox-row__body">
              <span className="oma-inbox-row__top">
                <strong>
                  {it.priority ? '⚡ ' : ''}
                  {it.participantName || 'Unknown'}
                </strong>
                <span className="oma-inbox-row__plat">{platformLabel(it.platform)}</span>
              </span>
              <span className="oma-inbox-row__preview">{it.lastMessagePreview || '—'}</span>
              {it.tags && it.tags.length > 0 ? (
                <span className="oma-inbox-row__tags">{it.tags.slice(0, 3).join(' · ')}</span>
              ) : null}
            </span>
            {it.unreadCount > 0 ? <span className="oma-inbox-badge">{it.unreadCount}</span> : null}
          </button>
        ))}
      </section>

      <section className="oma-inbox-thread" aria-label="Conversation">
        {error ? (
          <p className="oma-inbox-error" role="alert">
            {error}
          </p>
        ) : null}
        {deliveryNote ? <p className="oma-inbox-delivery">{deliveryNote}</p> : null}
        {!selectedId ? (
          <div className="oma-inbox-empty">Select a conversation</div>
        ) : detailLoading && !detail ? (
          <div className="oma-inbox-empty">Loading thread…</div>
        ) : detail ? (
          <>
            <header className="oma-inbox-thread__head">
              <div>
                <h3>
                  {detail.priority ? '⚡ ' : ''}
                  {detail.participantName || 'Conversation'}
                </h3>
                <p>
                  {platformLabel(detail.platform)} · {detail.type} · {detail.status}
                  {detail.sentiment ? ` · ${detail.sentiment}` : ''}
                </p>
              </div>
              <div className="oma-inbox-thread__actions">
                <Button
                  type="default"
                  size="small"
                  onClick={() =>
                    void setInboxPriority(detail.id, !detail.priority).then(() => {
                      void loadDetail(detail.id);
                      void loadList();
                    })
                  }
                >
                  {detail.priority ? 'Unmark priority' : 'Priority'}
                </Button>
                <Button type="default" size="small" onClick={() => void setInboxStatus(detail.id, 'PENDING')}>
                  Pending
                </Button>
                <Button type="default" size="small" onClick={() => void setInboxStatus(detail.id, 'CLOSED')}>
                  Close
                </Button>
              </div>
            </header>

            <div className="oma-inbox-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={tab === 'messages' ? 'is-active' : ''}
                onClick={() => setTab('messages')}
              >
                Messages
              </button>
              <button
                type="button"
                role="tab"
                className={tab === 'notes' ? 'is-active' : ''}
                onClick={() => setTab('notes')}
              >
                Internal notes
              </button>
            </div>

            {tab === 'messages' ? (
              <>
                <div className="oma-inbox-messages">
                  {detail.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`oma-inbox-bubble oma-inbox-bubble--${m.direction.toLowerCase()}`}
                    >
                      <div className="oma-inbox-bubble__meta">
                        {m.senderName} · {new Date(m.createdAt).toLocaleString()}
                      </div>
                      <div className="oma-inbox-bubble__text">{m.content}</div>
                    </div>
                  ))}
                </div>
                <div className="oma-inbox-quick">
                  {QUICK_REPLIES.map((q) => (
                    <button key={q} type="button" className="oma-inbox-chip" onClick={() => setReply(q)}>
                      {q.slice(0, 42)}…
                    </button>
                  ))}
                </div>
                <div className="oma-inbox-composer">
                  <Input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply…"
                    data-testid="inbox-reply-input"
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
                  >
                    Reply
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="oma-inbox-messages">
                  {detail.notes.length === 0 ? (
                    <div className="oma-inbox-empty">No internal notes yet</div>
                  ) : (
                    detail.notes.map((n) => (
                      <div key={n.id} className="oma-inbox-note">
                        <div className="oma-inbox-bubble__meta">
                          {n.authorUserId} · {new Date(n.createdAt).toLocaleString()}
                        </div>
                        <div>{n.content}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="oma-inbox-composer">
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add an internal note…"
                  />
                  <Button
                    type="default"
                    loading={sending}
                    disabled={!note.trim()}
                    onClick={() => void onNote()}
                  >
                    Add note
                  </Button>
                </div>
              </>
            )}
          </>
        ) : null}
      </section>

      <aside className="oma-inbox-profile" aria-label="Customer profile">
        {detail ? (
          <div className="oma-inbox-profile__card">
            <div className="oma-inbox-profile__avatar" aria-hidden>
              {(detail.participantName || '?').slice(0, 1).toUpperCase()}
            </div>
            <h4>{detail.participantName || 'Unknown'}</h4>
            <p className="oma-muted">{detail.participantExtId || '—'}</p>
            <dl className="oma-inbox-profile__meta">
              <div>
                <dt>Platform</dt>
                <dd>{platformLabel(detail.platform)}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{detail.type}</dd>
              </div>
              <div>
                <dt>Messages</dt>
                <dd>{detail.messageCount}</dd>
              </div>
              <div>
                <dt>Sentiment</dt>
                <dd>{detail.sentiment || '—'}</dd>
              </div>
              <div>
                <dt>First response</dt>
                <dd>
                  {detail.firstResponseAt
                    ? new Date(detail.firstResponseAt).toLocaleString()
                    : '—'}
                </dd>
              </div>
            </dl>
            <label className="oma-inbox-filters__label">Tags</label>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="vip, refund, collab"
            />
            <Button type="default" size="small" style={{ marginTop: 8 }} onClick={() => void onSaveTags()}>
              Save tags
            </Button>
          </div>
        ) : (
          <div className="oma-inbox-empty">Profile</div>
        )}
      </aside>
    </div>
  );
}
