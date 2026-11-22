'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import { useT } from '../../lib/use-locale';

type Flight = {
  key: string;
  name: string;
  platform: string;
  start_date: string;
  end_date: string;
  budget_amount: number | null;
  currency: string | null;
  campaign_id: string | null;
  actual_spend: number;
  expected_spend: number | null;
  pacing_pct: number | null;
  status: string;
};
type Experiment = {
  id: string;
  name: string;
  primary_metric: string;
  variants: Array<{ key: string; description: string }>;
  status: string;
  result_summary: string | null;
  winner_variant_key: string | null;
};
type Execution = {
  flights: Flight[];
  experiments: Experiment[];
  totals: {
    planned_budget: number | null;
    actual_spend: number | null;
    unassigned_spend: number | null;
  };
};

const NEXT: Record<string, string[]> = {
  PLANNED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['CONCLUDED', 'CANCELLED'],
  CONCLUDED: [],
  CANCELLED: [],
};

/** DEC-029 4.7: paid flights pacing, experiment results and spend import (approved versions). */
export function StrategyPaidExecutionPanel({
  brandId,
  strategyId,
  versionId,
}: {
  brandId: string;
  strategyId: string;
  versionId: string;
}) {
  const t = useT();
  const base = `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}`;
  const [data, setData] = useState<Execution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState('');
  const [csvPlatform, setCsvPlatform] = useState('META');
  const [csvCurrency, setCsvCurrency] = useState('SAR');
  const [drafts, setDrafts] = useState<Record<string, { summary: string; winner: string }>>({});

  const load = useCallback(() => {
    void api<{ data: Execution }>(`${base}/paid-execution`)
      .then((r) => setData(r.data))
      .catch((err) => setError(getApiError(err).message));
  }, [base]);
  useEffect(() => load(), [load]);

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
      load();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const materialize = () =>
    run(async () => {
      const r = await api<{ data: { created_campaign_ids: string[] } }>(
        `${base}/paid-flights/campaigns`,
        { method: 'POST', body: '{}' },
      );
      return `${t('strategy.paidExec.campaignsCreated')}: ${r.data.created_campaign_ids.length}`;
    });

  const move = (e: Experiment, status: string) =>
    run(async () => {
      const d = drafts[e.id];
      await api(`${base}/experiments/${e.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          ...(status === 'CONCLUDED'
            ? { result_summary: d?.summary ?? '', winner_variant_key: d?.winner || null }
            : {}),
        }),
      });
      return null;
    });

  const importCsv = () =>
    run(async () => {
      const r = await api<{
        data: {
          imported: boolean;
          valid_rows: number;
          errors: Array<{ line: number; code: string }>;
        };
      }>(`/api/v1/brands/${brandId}/paid-spend/import`, {
        method: 'POST',
        body: JSON.stringify({ csv, platform: csvPlatform, currency: csvCurrency }),
      });
      if (!r.data.imported) {
        throw new Error(
          `${t('strategy.paidExec.csvErrors')}: ${r.data.errors
            .slice(0, 5)
            .map((e) => `#${e.line} ${e.code}`)
            .join(', ')}`,
        );
      }
      setCsv('');
      return `${t('strategy.paidExec.imported')}: ${r.data.valid_rows}`;
    });

  if (!data) return error ? <p role="alert">{error}</p> : null;
  if (!data.flights.length && !data.experiments.length) return null;
  const money = (v: number | null, c?: string | null) =>
    v == null ? '—' : `${v.toLocaleString()}${c ? ` ${c}` : ''}`;

  return (
    <section
      className="oma-plx-listening-panel oma-plx-brand-section"
      data-testid="strategy-paid-execution"
    >
      <header className="oma-plx-brand-section__head">
        <div>
          <h3 className="oma-plx-brand-section__title">{t('strategy.paidExec.title')}</h3>
          <p className="oma-muted oma-plx-brand-section__desc">{t('strategy.paidExec.hint')}</p>
        </div>
      </header>
      <div className="oma-plx-brand-section__body">
        {error ? (
          <p className="oma-save-status" data-state="error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="oma-save-status" role="status">
            {notice}
          </p>
        ) : null}
        {data.flights.length ? (
          <>
            <div className="oma-plan-table-wrap">
              <table className="oma-plan-table" data-testid="paid-exec-flights">
                <thead>
                  <tr>
                    <th>{t('strategy.plan.flights')}</th>
                    <th>{t('strategy.plan.col.platform')}</th>
                    <th>{t('strategy.paidExec.dates')}</th>
                    <th>{t('strategy.plan.col.budget')}</th>
                    <th>{t('strategy.paidExec.spend')}</th>
                    <th>{t('strategy.paidExec.pacing')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.flights.map((f) => (
                    <tr key={f.key} data-state={f.status}>
                      <td>
                        {f.campaign_id ? (
                          <Link className="oma-text-link" href={`/app/campaigns/${f.campaign_id}`}>
                            {f.name}
                          </Link>
                        ) : (
                          f.name
                        )}
                      </td>
                      <td>{f.platform}</td>
                      <td>
                        {f.start_date} → {f.end_date}
                      </td>
                      <td>{money(f.budget_amount, f.currency)}</td>
                      <td>
                        {money(f.actual_spend, f.currency)}
                        {f.expected_spend != null ? (
                          <div className="oma-muted">
                            {t('strategy.paidExec.expected')}: {money(f.expected_spend)}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {t(`strategy.paidExec.status.${f.status}`)}
                        {f.pacing_pct != null ? ` · ${f.pacing_pct}%` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.flights.some((f) => !f.campaign_id) ? (
              <button
                type="button"
                className="oma-btn oma-btn--secondary"
                disabled={busy}
                onClick={() => void materialize()}
              >
                {t('strategy.paidExec.createCampaigns')}
              </button>
            ) : null}
            {data.totals.unassigned_spend ? (
              <p className="oma-muted">
                {t('strategy.paidExec.unassigned')}: {money(data.totals.unassigned_spend)}
              </p>
            ) : null}
          </>
        ) : null}

        {data.experiments.length ? (
          <ul className="oma-list-plain" data-testid="paid-exec-experiments">
            {data.experiments.map((e) => (
              <li key={e.id} data-state={e.status}>
                <strong>{e.name}</strong> · {e.primary_metric} ·{' '}
                {t(`strategy.paidExec.exp.${e.status}`)}
                {e.winner_variant_key
                  ? ` · ${t('strategy.paidExec.winner')}: ${e.winner_variant_key}`
                  : ''}
                {e.result_summary ? <div className="oma-muted">{e.result_summary}</div> : null}
                {e.status === 'RUNNING' ? (
                  <div className="oma-inline-form">
                    <input
                      className="oma-input"
                      placeholder={t('strategy.paidExec.resultSummary')}
                      value={drafts[e.id]?.summary ?? ''}
                      onChange={(ev) =>
                        setDrafts((d) => ({
                          ...d,
                          [e.id]: { winner: d[e.id]?.winner ?? '', summary: ev.target.value },
                        }))
                      }
                    />
                    <select
                      className="oma-input"
                      aria-label={t('strategy.paidExec.winner')}
                      value={drafts[e.id]?.winner ?? ''}
                      onChange={(ev) =>
                        setDrafts((d) => ({
                          ...d,
                          [e.id]: { summary: d[e.id]?.summary ?? '', winner: ev.target.value },
                        }))
                      }
                    >
                      <option value="">—</option>
                      {e.variants.map((v) => (
                        <option key={v.key} value={v.key}>
                          {v.key}: {v.description}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="oma-chip-row">
                  {NEXT[e.status]!.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="oma-btn oma-btn--ghost"
                      disabled={busy || (s === 'CONCLUDED' && !drafts[e.id]?.summary?.trim())}
                      onClick={() => void move(e, s)}
                    >
                      {t(`strategy.paidExec.move.${s}`)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <details data-testid="paid-exec-import">
          <summary>{t('strategy.paidExec.importTitle')}</summary>
          <p className="oma-muted">{t('strategy.paidExec.importHint')}</p>
          <textarea
            className="oma-input"
            rows={5}
            dir="ltr"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="date,platform,amount,currency,impressions,clicks,conversions,flight"
          />
          <div className="oma-inline-form">
            <input
              className="oma-input"
              aria-label={t('strategy.plan.col.platform')}
              value={csvPlatform}
              onChange={(e) => setCsvPlatform(e.target.value.toUpperCase())}
            />
            <input
              className="oma-input"
              aria-label="currency"
              value={csvCurrency}
              onChange={(e) => setCsvCurrency(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              className="oma-btn oma-btn--primary"
              disabled={busy || !csv.trim()}
              onClick={() => void importCsv()}
            >
              {t('strategy.paidExec.import')}
            </button>
          </div>
        </details>
      </div>
    </section>
  );
}
