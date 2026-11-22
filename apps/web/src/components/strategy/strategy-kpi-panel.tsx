'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import { useT } from '../../lib/use-locale';

type KpiRow = {
  id: string;
  name: string;
  metric: string | null;
  source: 'measured' | 'manual';
  period: string;
  scope: string;
  target_value: string | null;
  target_number: number | null;
  unit: string | null;
  actual: number | null;
  recorded_at: string | null;
  note: string | null;
  progress_pct: number | null;
  status: string;
};

type Scorecard = { kpis: KpiRow[] };

const METRICS = [
  'posts_published',
  'publish_rate',
  'impressions',
  'reach',
  'engagements',
  'engagement_rate',
  'video_views',
] as const;
const PERIODS = ['WEEK', 'MONTH', 'QUARTER', 'VERSION'] as const;

/** DEC-029 4.5: KPI scorecard — measured from OMA data, or recorded manually (labelled). */
export function StrategyKpiPanel({
  brandId,
  strategyId,
  versionId,
  editable,
}: {
  brandId: string;
  strategyId: string;
  versionId: string;
  editable: boolean;
}) {
  const t = useT();
  const base = `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}`;
  const [data, setData] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', metric: '', target: '', period: 'MONTH' });
  const [manual, setManual] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    void api<{ data: Scorecard }>(`${base}/kpi-scorecard`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getApiError(err).message));
  }, [base]);

  useEffect(() => load(), [load]);

  const addKpi = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api(`${base}/kpis`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          metric: form.metric || null,
          target_number: form.target === '' ? null : Number(form.target),
          target_value: form.target || undefined,
          period: form.period,
        }),
      });
      setForm({ name: '', metric: '', target: '', period: 'MONTH' });
      load();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const record = async (kpiId: string) => {
    const value = manual[kpiId];
    if (value == null || value === '') return;
    setBusy(true);
    setError(null);
    try {
      await api(`${base}/kpi-scorecard/${kpiId}/manual`, {
        method: 'POST',
        body: JSON.stringify({ value: Number(value) }),
      });
      setManual((m) => ({ ...m, [kpiId]: '' }));
      load();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const fmt = (v: number | null, unit: string | null) =>
    v == null ? '—' : unit === 'percent' || unit === '%' ? `${v}%` : v.toLocaleString();

  return (
    <section
      className="oma-plx-listening-panel oma-plx-brand-section"
      data-testid="strategy-kpi-panel"
    >
      <header className="oma-plx-brand-section__head">
        <div>
          <h3 className="oma-plx-brand-section__title">{t('strategy.kpi.title')}</h3>
          <p className="oma-muted oma-plx-brand-section__desc">{t('strategy.kpi.hint')}</p>
        </div>
      </header>
      <div className="oma-plx-brand-section__body">
        {error ? (
          <p className="oma-save-status" data-state="error" role="alert">
            {error}
          </p>
        ) : null}
        {data && data.kpis.length === 0 ? (
          <p className="oma-muted" data-testid="strategy-kpi-empty">
            {t('strategy.kpi.empty')}
          </p>
        ) : null}
        {data && data.kpis.length > 0 ? (
          <div className="oma-plan-table-wrap">
            <table className="oma-plan-table" data-testid="strategy-kpi-table">
              <thead>
                <tr>
                  <th>{t('strategy.kpi.name')}</th>
                  <th>{t('strategy.kpi.source')}</th>
                  <th>{t('strategy.kpi.target')}</th>
                  <th>{t('strategy.kpi.actual')}</th>
                  <th>{t('strategy.kpi.status')}</th>
                </tr>
              </thead>
              <tbody>
                {data.kpis.map((k) => (
                  <tr key={k.id} data-testid={`strategy-kpi-${k.id}`}>
                    <td>
                      {k.name}
                      <div className="oma-muted">{t(`strategy.kpi.period.${k.period}`)}</div>
                    </td>
                    <td>
                      {k.source === 'measured'
                        ? t(`strategy.kpi.metric.${k.metric}`)
                        : t('strategy.kpi.manual')}
                    </td>
                    <td>
                      {k.target_number != null
                        ? fmt(k.target_number, k.unit)
                        : (k.target_value ?? '—')}
                    </td>
                    <td>
                      {fmt(k.actual, k.unit)}
                      {k.source === 'manual' ? (
                        <div className="oma-inline-form">
                          <input
                            type="number"
                            className="oma-input"
                            aria-label={t('strategy.kpi.record')}
                            value={manual[k.id] ?? ''}
                            onChange={(e) => setManual((m) => ({ ...m, [k.id]: e.target.value }))}
                          />
                          <button
                            type="button"
                            className="oma-button oma-button--ghost"
                            disabled={busy || !manual[k.id]}
                            onClick={() => void record(k.id)}
                          >
                            {t('strategy.kpi.record')}
                          </button>
                        </div>
                      ) : null}
                    </td>
                    <td data-state={k.status}>
                      {t(`strategy.kpi.state.${k.status}`)}
                      {k.progress_pct != null ? ` · ${k.progress_pct}%` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {editable ? (
          <div className="oma-inline-form" data-testid="strategy-kpi-add">
            <input
              className="oma-input"
              placeholder={t('strategy.kpi.name')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="oma-input"
              aria-label={t('strategy.kpi.source')}
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
            >
              <option value="">{t('strategy.kpi.manual')}</option>
              {METRICS.map((m) => (
                <option key={m} value={m}>
                  {t(`strategy.kpi.metric.${m}`)}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="oma-input"
              placeholder={t('strategy.kpi.target')}
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />
            <select
              className="oma-input"
              aria-label={t('strategy.kpi.periodLabel')}
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t(`strategy.kpi.period.${p}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="oma-button"
              disabled={busy || !form.name.trim()}
              onClick={() => void addKpi()}
            >
              {t('strategy.kpi.add')}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
