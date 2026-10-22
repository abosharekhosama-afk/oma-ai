'use client';

import { Button } from '@oma/ui/controls';
import { useEffect, useMemo, useRef, useState } from 'react';
import { listActivity, type ActivityItem } from '../../../../lib/activity-api';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
} from '../../../../lib/demo/use-demo-api';
import { ShellIcon } from '../../../../components/shell/shell-icons';
import type { NavIconId } from '../../../../components/shell/nav-config';

type Filter = 'all' | 'members' | 'approvals' | 'content' | 'settings';

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'api' | 'demo'>('api');
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  async function load(next?: string | null, append = false) {
    if (loadingRef.current && !append) return;
    loadingRef.current = true;
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await listActivity({ limit: 30, cursor: next || undefined });
      if (!mountedRef.current) return;
      setItems((prev) => (append ? [...prev, ...res.items] : res.items));
      setCursor(res.next_cursor);
      setSource('api');
    } catch {
      if (append) {
        if (mountedRef.current) setLoadingMore(false);
        loadingRef.current = false;
        return;
      }
      try {
        const demo = await demoApi<
          Array<{
            id: string;
            at?: string;
            createdAt?: string;
            action?: string;
            type?: string;
            summary?: string;
            actor?: string;
          }>
        >('/activity');
        if (!mountedRef.current) return;
        setItems(
          demo.map((d) => ({
            id: d.id,
            at: d.at || d.createdAt || new Date().toISOString(),
            action: d.action || d.type || 'event',
            category:
              (d.type as ActivityItem['category']) ||
              (String(d.action || '').includes('approv') ? 'approvals' : 'other'),
            title: d.summary || d.action || d.type || 'Activity',
            actor: d.actor,
          })),
        );
        setCursor(null);
        setSource('demo');
      } catch (err) {
        if (!mountedRef.current) return;
        if (isDemoForbidden(err)) setError('Unavailable');
        else setError(demoErrorMessage(err, 'Failed to load activity'));
      }
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.category === filter);
  }, [items, filter]);

  function formatWhen(iso: string) {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  const iconFor = (c: ActivityItem['category']): NavIconId => {
    if (c === 'members') return 'team';
    if (c === 'approvals') return 'reviews';
    if (c === 'content') return 'content';
    if (c === 'settings') return 'settings';
    return 'activity';
  };

  return (
    <div className="oma-planable-page" data-testid="activity-page-planable">
      <div className="oma-planable-page__header">
        <div>
          <h1 className="oma-planable-page__title">Activity</h1>
          <p className="oma-planable-page__sub">
            Workspace events: invites, permissions, approvals, and content changes.
            {source === 'demo' ? ' (demo data)' : null}
          </p>
        </div>
        <Button type="default" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="oma-ws-tabs">
        {(
          [
            ['all', 'All'],
            ['members', 'Members'],
            ['approvals', 'Approvals'],
            ['content', 'Content'],
            ['settings', 'Settings'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`oma-ws-tab${filter === id ? ' is-active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="oma-skeleton" role="status" /> : null}
      {error ? (
        <div className="plx-empty" role="alert">
          <strong>{error}</strong>
          <div style={{ marginTop: 12 }}>
            <Button type="default" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="oma-planable-card oma-activity-feed">
          {filtered.length === 0 ? (
            <div className="oma-ws-empty-block">
              <h3>No activity yet</h3>
              <p>Invites, role changes, and content actions will show up here.</p>
            </div>
          ) : (
            <ul className="oma-activity-list">
              {filtered.map((item) => (
                <li key={item.id} className="oma-activity-item">
                  <span className={`oma-activity-icon oma-activity-icon--${item.category}`}>
                    <ShellIcon name={iconFor(item.category)} size={16} />
                  </span>
                  <div className="oma-activity-body">
                    <div className="oma-activity-title-row">
                      <strong>{item.title}</strong>
                      <time dateTime={item.at}>{formatWhen(item.at)}</time>
                    </div>
                    {item.detail ? <p className="oma-activity-detail">{item.detail}</p> : null}
                    {item.actor ? <p className="oma-activity-actor">Actor: {item.actor}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {cursor && source === 'api' ? (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Button
                type="default"
                disabled={loadingMore}
                onClick={() => void load(cursor, true)}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
