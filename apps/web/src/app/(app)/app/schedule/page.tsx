'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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

type Scheduled = DemoGraph['scheduledPosts'][number];

export default function SchedulePage() {
  const t = useT();
  const locale = useLocale();
  const [rows, setRows] = useState<Scheduled[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await demoApi<Scheduled[]>('/schedule');
        if (!cancelled) setRows(data);
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

  return (
    <div className="oma-stack" data-testid="demo-schedule">
      <header className="oma-page-header oma-page-header-stack">
        <div>
          <h1>{t('demo.schedule.title')}</h1>
          <p className="oma-muted">{t('demo.schedule.subtitle')}</p>
        </div>
      </header>
      <DemoDisclosure message={t('demo.noPublishing')} />
      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}
      {!loading && !unavailable && rows.length === 0 ? (
        <p className="oma-muted">{t('demo.empty')}</p>
      ) : null}
      <div className="oma-calendar-grid">
        {rows.map((post) => (
          <article key={post.id} className="oma-calendar-row">
            <time dateTime={post.plannedAt}>{new Date(post.plannedAt).toLocaleString()}</time>
            <div className="oma-stack">
              <div className="oma-chip-row">
                <StatusChip status={post.state} />
                <span className="oma-muted">{post.channels.join(' · ')}</span>
              </div>
              <p>{pickCopy(post.caption, locale)}</p>
              <p className="oma-muted">
                {post.timezone} ·{' '}
                <Link href="/app/content" className="oma-text-link">
                  {post.contentId}
                </Link>
              </p>
              <h3>{t('demo.schedule.readiness')}</h3>
              <ul>
                {post.readiness.map((check, i) => (
                  <li key={i}>
                    {check.ok ? '✓' : '✗'} {pickCopy(check.check, locale)}
                  </li>
                ))}
              </ul>
              {!post.externalPublishingConnected ? (
                <p className="oma-muted" role="status">
                  {t('demo.noPublishing')}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
