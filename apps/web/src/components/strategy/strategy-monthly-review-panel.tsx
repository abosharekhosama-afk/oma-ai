'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import { useT } from '../../lib/use-locale';

type Finding = {
  code: string;
  severity: 'info' | 'warn' | 'critical';
  subject: string;
  facts: Record<string, number | string | null>;
};

type Review = {
  id: string;
  month: string;
  status: 'PROPOSED' | 'DRAFT_ONLY' | 'NO_CHANGES';
  draft_version_id: string | null;
  ai_run_id: string | null;
  ai_error: string | null;
  findings: Finding[];
};

type Preview = { month: string; findings: Finding[]; actionable: number; review: Review | null };

function lastMonth(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * DEC-029 4.10: monthly review. Findings are measured; "Create revision" makes a new DRAFT
 * with an AI proposal that a human applies (plan/ai/accept) and then approves as usual.
 */
export function StrategyMonthlyReviewPanel({
  brandId,
  strategyId,
  versionId,
  onDraftCreated,
}: {
  brandId: string;
  strategyId: string;
  versionId: string;
  onDraftCreated?: () => void;
}) {
  const t = useT();
  const sbase = `/api/v1/brands/${brandId}/strategies/${strategyId}`;
  const base = `${sbase}/versions/${versionId}`;
  const [month, setMonth] = useState(lastMonth);
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);

  const load = useCallback(() => {
    setError(null);
    void api<{ data: Preview }>(`${base}/monthly-review?month=${encodeURIComponent(month)}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(getApiError(err).message));
  }, [base, month]);

  useEffect(() => load(), [load]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`${base}/monthly-review`, { method: 'POST', body: JSON.stringify({ month }) });
      load();
      onDraftCreated?.();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async (review: Review) => {
    if (!review.draft_version_id || !review.ai_run_id) return;
    setBusy(true);
    setError(null);
    try {
      await api(`${sbase}/versions/${review.draft_version_id}/plan/ai/accept`, {
        method: 'POST',
        body: JSON.stringify({ run_id: review.ai_run_id }),
      });
      setApplied(true);
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const facts = (f: Finding) =>
    Object.entries(f.facts)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${t(`strategy.monthlyReview.fact.${k}`)}: ${v}`)
      .join(' · ');

  const review = data?.review ?? null;
  const draftHref = review?.draft_version_id
    ? `/app/brands/${brandId}/strategies/${strategyId}`
    : null;

  return (
    <section
      className="oma-plx-listening-panel oma-plx-brand-section"
      data-testid="strategy-monthly-review-panel"
    >
      <header className="oma-plx-brand-section__head">
        <div>
          <h3 className="oma-plx-brand-section__title">{t('strategy.monthlyReview.title')}</h3>
          <p className="oma-muted oma-plx-brand-section__desc">
            {t('strategy.monthlyReview.hint')}
          </p>
        </div>
        <input
          type="month"
          className="oma-input"
          aria-label={t('strategy.monthlyReview.month')}
          value={month}
          max={new Date().toISOString().slice(0, 7)}
          onChange={(e) => setMonth(e.target.value)}
        />
      </header>
      <div className="oma-plx-brand-section__body">
        {error ? (
          <p className="oma-save-status" data-state="error" role="alert">
            {error}
          </p>
        ) : null}
        {data ? (
          <ul className="oma-plain-list" data-testid="strategy-monthly-review-findings">
            {data.findings.map((f, i) => (
              <li key={`${f.code}-${i}`} data-severity={f.severity}>
                <strong>{t(`strategy.monthlyReview.code.${f.code}`)}</strong> — {f.subject}
                {facts(f) ? <div className="oma-muted">{facts(f)}</div> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {data && !review ? (
          data.actionable > 0 ? (
            <button
              type="button"
              className="oma-button"
              disabled={busy}
              onClick={() => void run()}
              data-testid="strategy-monthly-review-run"
            >
              {t('strategy.monthlyReview.run')}
            </button>
          ) : (
            <button
              type="button"
              className="oma-button oma-button--ghost"
              disabled={busy}
              onClick={() => void run()}
            >
              {t('strategy.monthlyReview.recordNoChanges')}
            </button>
          )
        ) : null}
        {review ? (
          <div className="oma-card" data-testid="strategy-monthly-review-result">
            <p>{t(`strategy.monthlyReview.status.${review.status}`)}</p>
            {review.ai_error ? (
              <p className="oma-muted">
                {t('strategy.monthlyReview.aiUnavailable')} ({review.ai_error})
              </p>
            ) : null}
            {review.status === 'PROPOSED' && !applied ? (
              <button
                type="button"
                className="oma-button"
                disabled={busy}
                onClick={() => void apply(review)}
              >
                {t('strategy.monthlyReview.apply')}
              </button>
            ) : null}
            {applied ? <p>{t('strategy.monthlyReview.applied')}</p> : null}
            {draftHref ? (
              <Link className="oma-text-link" href={draftHref}>
                {t('strategy.monthlyReview.openDraft')}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
