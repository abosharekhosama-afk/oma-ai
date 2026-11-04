'use client';
import { TableShimmer } from '../../../../components/ui/shimmer';

import { Button } from '@oma/ui/controls';
import { useEffect, useMemo, useRef, useState } from 'react';
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

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    mountedRef.current = true;
    void loadRef.current();
    const onRefresh = () => void loadRef.current();
    window.addEventListener('oma:activity-refresh', onRefresh);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('oma:activity-refresh', onRefresh);
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.category === filter);
  }, [items, filter]);

  const filters = [
    ['all', t('activity.filter.all')],
    ['members', t('activity.filter.members')],
    ['approvals', t('activity.filter.approvals')],
    ['content', t('activity.filter.content')],
    ['settings', t('activity.filter.settings')],
  ] as const;

  return (
    <div className="oma-bs oma-activity-page" data-testid="activity-page-planable">
      <header className="oma-bs-head">
        <div className="oma-bs-head__text">
          <h1 className="oma-bs-title">{t('activity.title')}</h1>
          <p className="oma-bs-sub">{t('activity.subtitle')}</p>
        </div>
      </header>
      <div className="oma-bs-body">
        <nav className="oma-bs-nav" aria-label={t('activity.title')}>
          {filters.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="oma-bs-nav__item"
              aria-current={filter === id ? 'page' : undefined}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <main className="oma-bs-main">
          {loading ? <TableShimmer rows={8} /> : null}
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
              <div className="oma-act-feed__head">
                <strong>{t('activity.title')}</strong>
                <span>{t('activity.subtitle')}</span>
              </div>
              <div className="oma-act-feed__scroll">
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
              </div>

              {cursor ? (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <Button
                    type="default"
                    disabled={loadingMore}
                    onClick={() => void load(cursor, true)}
                  >
                    {loadingMore ? t('activity.loading') : t('activity.loadMore')}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
