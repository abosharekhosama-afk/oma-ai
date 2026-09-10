'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { StatusChip } from '../../../../components/ui/status-chip';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../../../lib/use-locale';

type ContentItem = DemoGraph['contentItems'][number];
type ViewMode = 'calendar' | 'grid' | 'list';

export default function ContentPage() {
  const t = useT();
  const locale = useLocale();
  const [rows, setRows] = useState<ContentItem[]>([]);
  const [view, setView] = useState<ViewMode>('grid');
  const [channel, setChannel] = useState('all');
  const [track, setTrack] = useState('all');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await demoApi<ContentItem[]>('/content');
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        if (isDemoForbidden(err)) setUnavailable(true);
        else setError(demoErrorMessage(err, t('demo.unavailable')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const channels = useMemo(() => [...new Set(rows.map((r) => r.channel))], [rows]);
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (channel !== 'all' && r.channel !== channel) return false;
        if (track !== 'all' && r.track !== track) return false;
        if (status !== 'all' && r.status !== status) return false;
        return true;
      }),
    [rows, channel, track, status],
  );

  return (
    <div className="oma-stack" data-testid="demo-content">
      <header className="oma-page-header oma-page-header-stack">
        <div>
          <h1>{t('demo.content.title')}</h1>
          <p className="oma-muted">{t('demo.content.subtitle')}</p>
        </div>
        <div className="oma-view-toggle" role="group" aria-label={t('demo.content.title')}>
          {(['calendar', 'grid', 'list'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className="oma-btn oma-btn-secondary"
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              {t(`demo.view.${mode}`)}
            </button>
          ))}
        </div>
      </header>
      <DemoDisclosure message={t('demo.noPublishing')} />
      <div className="oma-filter-bar">
        <label>
          {t('demo.filter.channel')}
          <select
            className="oma-select"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="all">{t('demo.filter.all')}</option>
            {channels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('demo.filter.track')}
          <select className="oma-select" value={track} onChange={(e) => setTrack(e.target.value)}>
            <option value="all">{t('demo.filter.all')}</option>
            <option value="ORGANIC">{t('demo.organic')}</option>
            <option value="PAID">{t('demo.paid')}</option>
          </select>
        </label>
        <label>
          {t('demo.filter.status')}
          <select className="oma-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{t('demo.filter.all')}</option>
            {[...new Set(rows.map((r) => r.status))].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}
      {!loading && !unavailable && filtered.length === 0 ? (
        <p className="oma-muted">{t('demo.empty')}</p>
      ) : null}

      {view === 'grid' ? (
        <div className="oma-content-grid">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={
                item.deliverableId
                  ? `/app/deliverables/${item.deliverableId}`
                  : `/app/campaigns/${item.campaignId}`
              }
              className="oma-content-card"
            >
              <img src={item.previewAsset} alt="" />
              <div className="oma-content-card-body">
                <strong>{pickCopy(item.title, locale)}</strong>
                <div className="oma-chip-row">
                  <StatusChip status={item.status} />
                  <span className="oma-muted">{item.channel}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      {view === 'list' ? (
        <ul className="oma-compact-list">
          {filtered.map((item) => (
            <li key={item.id}>
              <Link
                href={
                  item.deliverableId
                    ? `/app/deliverables/${item.deliverableId}`
                    : `/app/campaigns/${item.campaignId}`
                }
                className="oma-compact-row"
              >
                <strong>{pickCopy(item.title, locale)}</strong>
                <span className="oma-muted">
                  {item.channel} · {item.track}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {view === 'calendar' ? (
        <div className="oma-calendar-grid">
          {filtered
            .slice()
            .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
            .map((item) => (
              <div key={item.id} className="oma-calendar-row">
                <time dateTime={item.scheduledAt ?? undefined}>
                  {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : '—'}
                </time>
                <div>
                  <strong>{pickCopy(item.title, locale)}</strong>
                  <div className="oma-chip-row">
                    <StatusChip status={item.status} />
                    <span className="oma-muted">{item.channel}</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}
