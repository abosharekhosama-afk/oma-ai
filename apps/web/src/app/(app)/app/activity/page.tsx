'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../../../lib/use-locale';

type Activity = DemoGraph['activity'][number];

export default function ActivityPage() {
  const t = useT();
  const locale = useLocale();
  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await demoApi<Activity[]>('/activity');
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
    <div className="oma-stack" data-testid="demo-activity">
      <header className="oma-page-header oma-page-header-stack">
        <div>
          <h1>{t('nav.activity')}</h1>
          <p className="oma-muted">{t('demo.activity.subtitle')}</p>
        </div>
      </header>
      <DemoDisclosure />
      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          {error}
        </div>
      ) : null}
      <ol className="oma-activity-timeline">
        {rows.map((a) => (
          <li key={a.id} className="oma-card">
            <time dateTime={a.at}>{new Date(a.at).toLocaleString()}</time>
            <p>
              <strong>{a.actor}</strong> — {pickCopy(a.summary, locale)}
            </p>
            <Link href={a.href}>{t('home.action.open')}</Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
