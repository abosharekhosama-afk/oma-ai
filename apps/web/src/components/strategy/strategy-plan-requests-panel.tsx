'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, CheckboxField } from '@oma/ui/controls';
import { OmaLinkButton } from '../ui/oma-link-button';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import { useT, useLocale } from '../../lib/use-locale';

type PreviewItem = {
  plan_source_key: string;
  track: 'organic' | 'paid';
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  channels: string[];
  formats: string[];
  already_created: boolean;
  brief_ready: boolean;
  brief: {
    objective: { en: string; ar: string };
    audience: { en: string; ar: string };
    keyMessage: { en: string; ar: string };
  };
};

type Props = {
  brandId: string;
  strategyId: string;
  versionId: string;
};

export function StrategyPlanRequestsPanel({ brandId, strategyId, versionId }: Props) {
  const t = useT();
  const locale = useLocale();
  const base = `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}`;
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(
    (pair: { en: string; ar: string }) =>
      locale === 'ar' ? pair.ar || pair.en : pair.en || pair.ar,
    [locale],
  );

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{
        data: { preview: PreviewItem[] };
      }>(`${base}/plan-to-requests/preview`);
      const preview = res.data.preview;
      setItems(preview);
      setSelected(
        new Set(
          preview.filter((item) => !item.already_created).map((item) => item.plan_source_key),
        ),
      );
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  function toggle(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function commitSelected() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{
        data: { created_request_ids: string[]; skipped_plan_source_keys: string[] };
      }>(`${base}/plan-to-requests/commit`, {
        method: 'POST',
        body: JSON.stringify({ plan_source_keys: [...selected] }),
      });
      if (res.data.created_request_ids.length > 0) {
        setMessage(t('strategy.review.requestsCreated'));
      } else if (res.data.skipped_plan_source_keys.length > 0) {
        setMessage(t('strategy.review.requestsAlreadyExist'));
      }
      await loadPreview();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function convertAllTasks() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ data: { created_task_ids: string[] } }>(
        `${base}/plan-to-requests/convert-tasks`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      if (res.data.created_task_ids.length > 0) {
        setMessage(t('strategy.review.tasksCreated'));
      } else {
        setMessage(t('strategy.review.tasksNone'));
      }
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="oma-panel" data-testid="strategy-plan-requests-loading">
        {t('strategy.review.planPreviewLoading')}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="oma-panel" role="status">
        {t('strategy.review.planPreviewEmpty')}
      </div>
    );
  }

  const requestsHref = `/app/requests?brand=${encodeURIComponent(brandId)}&strategy_version=${encodeURIComponent(versionId)}`;

  return (
    <section className="oma-panel" data-testid="strategy-plan-requests-panel">
      <header className="oma-panel__head">
        <h3>{t('strategy.review.planPreviewTitle')}</h3>
        <p className="oma-muted">{t('strategy.review.planPreviewHint')}</p>
      </header>
      <ul className="oma-discovery-list">
        {items.map((item) => (
          <li key={item.plan_source_key} className="oma-discovery-item">
            <label>
              <CheckboxField
                checked={selected.has(item.plan_source_key)}
                disabled={item.already_created || busy}
                onChange={(e) => toggle(item.plan_source_key, e.target.checked)}
              />{' '}
              <strong>{pick(item.title)}</strong>{' '}
              <span className="oma-muted">
                ({item.track}
                {item.already_created ? ` · ${t('strategy.review.planItemExists')}` : ''})
              </span>
            </label>
            <p className="oma-muted">{pick(item.description)}</p>
            {item.channels.length > 0 ? (
              <p className="oma-muted">
                {t('strategy.review.planChannels')}: {item.channels.join(', ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="oma-form-actions">
        <Button
          type="primary"
          disabled={busy || selected.size === 0}
          data-testid="strategy-plan-requests-commit"
          onClick={() => void commitSelected()}
        >
          {t('strategy.review.createRequests')}
        </Button>
        <Button type="default" disabled={busy} onClick={() => void convertAllTasks()}>
          {t('strategy.review.convertTasks')}
        </Button>
        <OmaLinkButton href={requestsHref} type="default">
          {t('strategy.review.openRequests')}
        </OmaLinkButton>
      </div>
      {error ? (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
