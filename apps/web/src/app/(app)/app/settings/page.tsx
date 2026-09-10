'use client';

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

type Integration = DemoGraph['integrations'][number];

export default function SettingsPage() {
  const t = useT();
  const locale = useLocale();
  const [rows, setRows] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await demoApi<Integration[]>('/integrations');
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
    <div className="oma-stack" data-testid="demo-settings">
      <header className="oma-page-header oma-page-header-stack">
        <div>
          <h1>{t('nav.settings')}</h1>
          <p className="oma-muted">{t('demo.settings.subtitle')}</p>
        </div>
      </header>
      <DemoDisclosure />
      <section className="oma-card">
        <h2>{t('demo.settings.workspace')}</h2>
        <p className="oma-muted">{t('demo.settings.stubBody')}</p>
      </section>
      <section className="oma-card" data-testid="demo-integrations">
        <h2>{t('demo.settings.integrations')}</h2>
        <p className="oma-muted">{t('demo.integrationsDeferred')}</p>
        {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
        {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
        {error ? (
          <p role="alert" style={{ color: 'var(--status-danger)' }}>
            {error}
          </p>
        ) : null}
        <ul className="oma-compact-list">
          {rows.map((i) => (
            <li key={i.id} className="oma-compact-row">
              <div>
                <strong>{pickCopy(i.name, locale)}</strong>
                <p className="oma-muted">{i.category}</p>
                <p className="oma-muted">{pickCopy(i.note, locale)}</p>
              </div>
              <StatusChip status={i.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
