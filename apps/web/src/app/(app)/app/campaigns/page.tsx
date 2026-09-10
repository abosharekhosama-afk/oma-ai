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

type Campaign = DemoGraph['campaigns'][number];

export default function CampaignsPage() {
  const t = useT();
  const locale = useLocale();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await demoApi<Campaign[]>('/campaigns');
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

  return (
    <div className="oma-stack" data-testid="demo-campaigns">
      <header className="oma-page-header oma-page-header-stack">
        <div>
          <h1>{t('demo.campaigns.title')}</h1>
          <p className="oma-muted">{t('demo.campaigns.subtitle')}</p>
        </div>
      </header>
      <DemoDisclosure />
      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? (
        <p className="oma-muted" role="status">
          {t('demo.unavailable')}
        </p>
      ) : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}
      {!loading && !unavailable && !error && rows.length === 0 ? (
        <p className="oma-muted">{t('demo.empty')}</p>
      ) : null}
      <ul className="oma-compact-list">
        {rows.map((c) => (
          <li key={c.id}>
            <Link href={`/app/campaigns/${c.id}`} className="oma-compact-row">
              <div>
                <strong>{pickCopy(c.name, locale)}</strong>
                <div className="oma-chip-row">
                  <span
                    className={`oma-badge ${c.track === 'ORGANIC' ? 'oma-track-organic' : 'oma-track-paid'}`}
                  >
                    {c.track === 'ORGANIC' ? t('demo.organic') : t('demo.paid')}
                  </span>
                  <StatusChip status={c.status} />
                </div>
              </div>
              <span className="oma-muted">
                {c.timeline.start} → {c.timeline.end}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
