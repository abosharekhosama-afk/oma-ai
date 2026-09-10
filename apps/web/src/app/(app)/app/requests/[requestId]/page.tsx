'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../../components/demo/demo-disclosure';
import { StatusChip } from '../../../../../components/ui/status-chip';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../../../../lib/use-locale';

type RequestDetail = DemoGraph['requests'][number] & {
  brief: DemoGraph['briefs'][number] | null;
};

export default function RequestDetailPage() {
  const t = useT();
  const locale = useLocale();
  const params = useParams<{ requestId: string }>();
  const requestId = params.requestId;
  const [row, setRow] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await demoApi<RequestDetail>(`/requests/${requestId}`);
        if (!cancelled) setRow(data);
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
  }, [requestId, t]);

  return (
    <div className="oma-stack" data-testid="demo-request-detail">
      <header className="oma-page-header">
        <div>
          <Link href="/app/requests" className="oma-text-link">
            ← {t('demo.requests.title')}
          </Link>
          <h1>{row ? pickCopy(row.title, locale) : t('demo.requests.title')}</h1>
        </div>
      </header>
      <DemoDisclosure />
      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}
      {row ? (
        <>
          <div className="oma-chip-row">
            <StatusChip status={row.status} />
            <StatusChip status={row.priority} />
          </div>
          <section className="oma-card">
            <p>
              <strong>{row.requester}</strong>
            </p>
            <p className="oma-muted">Due {row.dueAt}</p>
            {row.campaignId ? (
              <Link href={`/app/campaigns/${row.campaignId}`} className="oma-text-link">
                {row.campaignId}
              </Link>
            ) : null}
          </section>
          {row.brief ? (
            <section className="oma-card">
              <h2>{t('demo.request.brief')}</h2>
              <p>
                <strong>{t('demo.campaign.objective')}:</strong>{' '}
                {pickCopy(row.brief.objective, locale)}
              </p>
              <p>
                <strong>{t('demo.campaign.audience')}:</strong>{' '}
                {pickCopy(row.brief.audience, locale)}
              </p>
              <p>
                <strong>{t('demo.campaign.channels')}:</strong> {row.brief.channels.join(' · ')}
              </p>
              <p>
                <strong>Formats:</strong> {row.brief.formats.join(' · ')}
              </p>
              <ul>
                {row.brief.references.map((ref) => (
                  <li key={ref}>{ref}</li>
                ))}
              </ul>
              <h3>{t('demo.request.attachments')}</h3>
              <div className="oma-chip-row">
                {row.brief.attachmentAssets.map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    width={96}
                    height={120}
                    style={{ borderRadius: 8 }}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
