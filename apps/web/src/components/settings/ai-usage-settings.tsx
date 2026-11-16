'use client';

import { Button } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { getApiError } from '../../lib/brand-api';
import {
  aiUsageApi,
  aiUsageRates,
  formatUsd,
  type AiRunListItem,
  type AiUsageSummary,
} from '../../lib/ai-usage-api';

type Tr = (key: string) => string;

/** Admin AI usage: monthly per-use-case runs, failures, repairs and real cost (DEC-027 3.8). */
export function AiUsageSettings({
  t,
  locale,
  canView,
}: {
  t: Tr;
  locale: string;
  canView: boolean;
}) {
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const [runs, setRuns] = useState<AiRunListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!canView) return;
    aiUsageApi
      .usage()
      .then((r) => setUsage(r.data))
      .catch((e) => setError(getApiError(e).message));
    aiUsageApi
      .runs({ limit: 20 })
      .then((r) => {
        setRuns(r.data.items);
        setCursor(r.data.next_cursor);
      })
      .catch((e) => setError(getApiError(e).message));
  }, [canView]);
  useEffect(load, [load]);

  const loadMore = () => {
    if (!cursor) return;
    setBusy(true);
    aiUsageApi
      .runs({ limit: 20, cursor })
      .then((r) => {
        setRuns((prev) => [...prev, ...r.data.items]);
        setCursor(r.data.next_cursor);
      })
      .catch((e) => setError(getApiError(e).message))
      .finally(() => setBusy(false));
  };

  return (
    <div className="oma-ws-section" data-testid="settings-ai-usage">
      <h2 className="oma-ws-section-title">{t('demo.settings.section.ai')}</h2>
      <p className="oma-ws-empty-desc">{t('settings.ai.body')}</p>
      {!canView ? (
        <p className="oma-ws-empty-desc" data-testid="settings-ai-usage-denied">
          {t('settings.ai.adminOnly')}
        </p>
      ) : null}
      {error ? (
        <p className="oma-plx-error" role="alert">
          {error}
        </p>
      ) : null}
      {canView && usage ? (
        <>
          <p className="oma-muted" data-testid="settings-ai-usage-month">
            {t('settings.ai.month')}: {usage.month} · {t('settings.ai.cost')}:{' '}
            {formatUsd(usage.totals.cost_usd, locale)}
          </p>
          {usage.by_use_case.length ? (
            <table className="oma-table" data-testid="settings-ai-usage-table">
              <thead>
                <tr>
                  <th>{t('settings.ai.useCase')}</th>
                  <th>{t('settings.ai.runs')}</th>
                  <th>{t('settings.ai.failed')}</th>
                  <th>{t('settings.ai.repaired')}</th>
                  <th>{t('settings.ai.rejected')}</th>
                  <th>{t('settings.ai.cost')}</th>
                </tr>
              </thead>
              <tbody>
                {usage.by_use_case.map((b) => {
                  const rates = aiUsageRates(b);
                  return (
                    <tr key={b.use_case}>
                      <td>{b.use_case}</td>
                      <td>{b.runs}</td>
                      <td>
                        {b.failed} ({rates.failurePct}%)
                      </td>
                      <td>
                        {b.repaired} ({rates.repairPct}%)
                      </td>
                      <td>{b.human_rejected}</td>
                      <td>{formatUsd(b.cost_usd, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="oma-ws-empty-desc">{t('settings.ai.empty')}</p>
          )}
        </>
      ) : null}
      {canView && runs.length ? (
        <>
          <h3 className="oma-ws-label">{t('settings.ai.recent')}</h3>
          <table className="oma-table" data-testid="settings-ai-runs-table">
            <thead>
              <tr>
                <th>{t('settings.ai.when')}</th>
                <th>{t('settings.ai.useCase')}</th>
                <th>{t('settings.ai.status')}</th>
                <th>{t('settings.ai.attempts')}</th>
                <th>{t('settings.ai.cost')}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} data-status={run.status}>
                  <td>{new Date(run.created_at).toLocaleString(locale)}</td>
                  <td>
                    {run.use_case}
                    {run.legacy ? ` · ${t('settings.ai.legacy')}` : ''}
                  </td>
                  <td>
                    {run.status}
                    {run.review ? ` · ${run.review}` : ''}
                    {run.failure_stage ? ` · ${run.failure_stage}` : ''}
                  </td>
                  <td>{run.attempt_count}</td>
                  <td>{formatUsd(run.cost_usd, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {cursor ? (
            <div className="oma-ws-action-row">
              <Button disabled={busy} onClick={loadMore} data-testid="settings-ai-runs-more">
                {t('settings.ai.more')}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
