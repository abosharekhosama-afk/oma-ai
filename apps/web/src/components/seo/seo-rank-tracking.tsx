'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import { useT } from '../../lib/use-locale';

type RankRow = {
  keyword: string;
  pillar_key: string | null;
  latest_position: number | null;
  change: number | null;
  status: string;
  series: Array<{ week: string; position: number | null }>;
};
type Tracking = {
  strategy_version_id: string | null;
  weeks: string[];
  source: string | null;
  gsc: { status: string; last_sync_at: string | null; last_error: string | null; mode: string };
  keywords: RankRow[];
};
type Gap = {
  kind: string;
  keyword: string;
  position: number | null;
  impressions: number | null;
  page_url: string | null;
};

/** DEC-029 4.6: weekly rank tracking for plan keywords + SEO gaps → draft brief. */
export function SeoRankTracking({ brandId }: { brandId: string }) {
  const t = useT();
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [briefId, setBriefId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void api<{ data: Tracking }>(`/api/v1/brands/${brandId}/seo/rank-tracking?weeks=8`)
      .then((r) => setTracking(r.data))
      .catch((err) => setError(getApiError(err).message));
    void api<{ data: { gaps: Gap[] } }>(`/api/v1/brands/${brandId}/seo/gaps`)
      .then((r) => setGaps(r.data.gaps))
      .catch((err) => setError(getApiError(err).message));
  }, [brandId]);
  useEffect(() => load(), [load]);

  const toBrief = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ data: { brief_id: string } }>(
        `/api/v1/brands/${brandId}/seo/gaps/brief`,
        { method: 'POST', body: JSON.stringify({ keywords: picked }) },
      );
      setBriefId(res.data.brief_id);
      setPicked([]);
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const recent = tracking?.weeks.slice(-4) ?? [];
  return (
    <>
      <section className="oma-plx-brand-section" data-testid="seo-rank-tracking">
        <h3 className="oma-plx-brand-section__title">{t('brand.seo.rankTracking')}</h3>
        <p className="oma-muted">
          {t('brand.seo.rankTrackingHint')}
          {tracking?.gsc.last_sync_at
            ? ` · ${t('brand.seo.lastSync')}: ${new Date(tracking.gsc.last_sync_at).toLocaleDateString()}`
            : ''}
          {tracking?.source ? ` · ${tracking.source}` : ''}
        </p>
        {tracking?.gsc.status === 'NEEDS_RECONNECT' ? (
          <p className="oma-callout oma-callout--warning" role="alert">
            {t('brand.seo.reconnect')}
          </p>
        ) : null}
        {error ? (
          <p className="oma-callout oma-callout--warning" role="alert">
            {error}
          </p>
        ) : null}
        {tracking && !tracking.strategy_version_id ? (
          <p className="oma-muted">{t('brand.seo.noPlanKeywords')}</p>
        ) : tracking && tracking.keywords.length ? (
          <table className="oma-table oma-table--compact">
            <thead>
              <tr>
                <th>{t('brand.seo.keyword')}</th>
                {recent.map((w) => (
                  <th key={w}>{w.slice(5)}</th>
                ))}
                <th>{t('brand.seo.change')}</th>
              </tr>
            </thead>
            <tbody>
              {tracking.keywords.map((k) => (
                <tr key={k.keyword} data-state={k.status}>
                  <td dir="auto">{k.keyword}</td>
                  {k.series.slice(-4).map((p) => (
                    <td key={p.week}>{p.position ?? '—'}</td>
                  ))}
                  <td>
                    {k.change == null
                      ? '—'
                      : k.change > 0
                        ? `▲ ${k.change}`
                        : k.change < 0
                          ? `▼ ${-k.change}`
                          : '='}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tracking ? (
          <p className="oma-muted">{t('brand.seo.noPlanKeywords')}</p>
        ) : null}
      </section>

      <section className="oma-plx-brand-section" data-testid="seo-gaps">
        <h3 className="oma-plx-brand-section__title">{t('brand.seo.gaps')}</h3>
        <p className="oma-muted">{t('brand.seo.gapsHint')}</p>
        {gaps && gaps.length === 0 ? <p className="oma-muted">{t('brand.seo.noGaps')}</p> : null}
        {gaps && gaps.length > 0 ? (
          <ul className="oma-list-plain">
            {gaps.map((g) => (
              <li key={g.keyword}>
                <label>
                  <input
                    type="checkbox"
                    checked={picked.includes(g.keyword)}
                    onChange={(e) =>
                      setPicked((p) =>
                        e.target.checked
                          ? [...p, g.keyword].slice(0, 30)
                          : p.filter((x) => x !== g.keyword),
                      )
                    }
                  />{' '}
                  <span dir="auto">{g.keyword}</span> — {t(`brand.seo.gap.${g.kind}`)}
                  {g.position != null ? ` (#${Math.round(g.position)})` : ''}
                  {g.impressions ? ` · ${g.impressions} ${t('brand.seo.impressions')}` : ''}
                </label>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="oma-chip-row">
          <button
            type="button"
            className="oma-btn oma-btn--primary"
            disabled={busy || picked.length === 0}
            onClick={() => void toBrief()}
            data-testid="seo-gaps-brief"
          >
            {t('brand.seo.gapsToBrief')}
          </button>
          {briefId ? (
            <Link className="oma-text-link" href={`/app/brands/${brandId}/briefs/${briefId}`}>
              {t('brand.seo.openBrief')}
            </Link>
          ) : null}
        </div>
      </section>
    </>
  );
}
