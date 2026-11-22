'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import { useLocale, useT } from '../../lib/use-locale';

type Counts = {
  requests: number;
  briefs: Record<string, number>;
  tasks: { open: number; done: number };
  content: {
    planned: number;
    draft: number;
    in_review: number;
    approved: number;
    scheduled: number;
    published: number;
  };
};

type PillarRow = Counts & {
  key: string;
  name_en: string;
  name_ar: string;
  share_target_pct: number | null;
  planned_share_pct: number | null;
  published_share_pct: number | null;
};

type Execution = {
  pillars: PillarRow[];
  catalog: Counts;
  paid: Counts;
  totals: {
    requests: number;
    briefs: number;
    briefs_approved: number;
    tasks_open: number;
    tasks_done: number;
    content_planned: number;
    content_published: number;
  };
};

const pct = (v: number | null) => (v == null ? '—' : `${v}%`);

/** DEC-029 4.3: how far each pillar of the approved plan has moved (brief → task → post). */
export function StrategyExecutionPanel({
  brandId,
  strategyId,
  versionId,
}: {
  brandId: string;
  strategyId: string;
  versionId: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [data, setData] = useState<Execution | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<{ data: Execution }>(
      `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/execution`,
    )
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [brandId, strategyId, versionId]);

  if (error) {
    return (
      <p className="oma-save-status" data-state="error" role="alert">
        {error}
      </p>
    );
  }
  if (!data) return null;
  const briefCount = (c: Counts) => Object.values(c.briefs).reduce((a, b) => a + b, 0);
  const briefDone = (c: Counts) => (c.briefs.APPROVED ?? 0) + (c.briefs.CONVERTED ?? 0);

  return (
    <section
      className="oma-plx-listening-panel oma-plx-brand-section"
      data-testid="strategy-execution-panel"
    >
      <header className="oma-plx-brand-section__head">
        <div>
          <h3 className="oma-plx-brand-section__title">{t('strategy.execution.title')}</h3>
          <p className="oma-muted oma-plx-brand-section__desc">{t('strategy.execution.hint')}</p>
        </div>
      </header>
      <div className="oma-plx-brand-section__body">
        {data.totals.requests === 0 ? (
          <p className="oma-muted" data-testid="strategy-execution-empty">
            {t('strategy.execution.empty')}
          </p>
        ) : (
          <div className="oma-plan-table-wrap">
            <table className="oma-plan-table" data-testid="strategy-execution-table">
              <thead>
                <tr>
                  <th>{t('strategy.plan.pillars')}</th>
                  <th>{t('strategy.execution.share')}</th>
                  <th>{t('strategy.execution.briefs')}</th>
                  <th>{t('strategy.execution.tasks')}</th>
                  <th>{t('strategy.execution.posts')}</th>
                </tr>
              </thead>
              <tbody>
                {data.pillars.map((p) => (
                  <tr key={p.key} data-testid={`strategy-execution-${p.key}`}>
                    <td>{locale === 'ar' ? p.name_ar : p.name_en}</td>
                    <td>
                      {pct(p.share_target_pct)} → {pct(p.planned_share_pct)} /{' '}
                      {pct(p.published_share_pct)}
                    </td>
                    <td>
                      {briefDone(p)}/{briefCount(p)}
                    </td>
                    <td>
                      {p.tasks.done}/{p.tasks.done + p.tasks.open}
                    </td>
                    <td>
                      {p.content.published}/{p.content.planned}
                    </td>
                  </tr>
                ))}
                {data.catalog.requests > 0 ? (
                  <tr>
                    <td>{t('strategy.execution.catalog')}</td>
                    <td>—</td>
                    <td>
                      {briefDone(data.catalog)}/{briefCount(data.catalog)}
                    </td>
                    <td>
                      {data.catalog.tasks.done}/{data.catalog.tasks.done + data.catalog.tasks.open}
                    </td>
                    <td>
                      {data.catalog.content.published}/{data.catalog.content.planned}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
        <p className="oma-muted">{t('strategy.execution.legend')}</p>
        <Link href={`/app/brands/${brandId}/briefs`} className="oma-text-link">
          {t('strategy.execution.openBriefs')}
        </Link>
      </div>
    </section>
  );
}
