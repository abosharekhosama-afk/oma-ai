'use client';

import { Button } from '@oma/ui/controls';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OmaTopLoader } from '../../../../components/ui/oma-top-loader';
import { listActivity, type ActivityItem } from '../../../../lib/activity-api';
import { useToast } from '../../../../components/ui/toast';
import { ActivityFeedItem } from '../../../../components/activity/activity-feed-item';
import { useLocale, useT } from '../../../../lib/use-locale';

type Filter = 'all' | 'members' | 'approvals' | 'content' | 'settings';

export default function ActivityPage() {
  const toast = useToast();
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const locale = useLocale();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    } catch (err) {
      if (!mountedRef.current) return;
      if (!append) {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
        toast.push(tRef.current('activity.loadFailed'), 'danger');
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
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.category === filter);
  }, [items, filter]);

  return (
    <div className="oma-planable-page" data-testid="activity-page-planable">
      <div className="oma-planable-page__header">
        <div>
          <h1 className="oma-planable-page__title">{t('activity.title')}</h1>
          <p className="oma-planable-page__sub">{t('activity.subtitle')}</p>
        </div>
        <Button type="default" onClick={() => void load()} disabled={loading}>
          {t('activity.refresh')}
        </Button>
      </div>

      <div className="oma-ws-tabs">
        {(
          [
            ['all', t('activity.filter.all')],
            ['members', t('activity.filter.members')],
            ['approvals', t('activity.filter.approvals')],
            ['content', t('activity.filter.content')],
            ['settings', t('activity.filter.settings')],
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

      {loading ? <OmaTopLoader /> : null}
      {error ? (
        <div className="plx-empty" role="alert">
          <strong>{error}</strong>
          <div style={{ marginTop: 12 }}>
            <Button type="default" onClick={() => void load()}>
              {t('activity.retry')}
            </Button>
          </div>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="oma-act-feed" data-testid="activity-feed">
          {filtered.length === 0 ? (
            <div className="oma-ws-empty-block">
              <h3>{t('activity.empty')}</h3>
              <p>{t('activity.emptyBody')}</p>
            </div>
          ) : (
            <ul className="oma-act-list">
              {filtered.map((item) => (
                <ActivityFeedItem key={item.id} item={item} locale={locale} t={t} />
              ))}
            </ul>
          )}

          {cursor ? (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Button type="default" disabled={loadingMore} onClick={() => void load(cursor, true)}>
                {loadingMore ? t('activity.loading') : t('activity.loadMore')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
