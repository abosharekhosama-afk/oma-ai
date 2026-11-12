'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, CheckboxField, DateField, SelectField } from '@oma/ui/controls';
import { OmaLinkButton } from '../ui/oma-link-button';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import { listAllCampaigns } from '../../lib/campaign-api';
import { daysFromToday } from '../../lib/calendar-today';
import { listWorkspaceMembers, type WorkspaceMember } from '../../lib/team-api';
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

type ImpactItem = {
  request_id: string;
  plan_source_key: string;
  source_strategy_version_id: string;
  status: 'aligned' | 'drifted' | 'orphaned';
  changed_fields: string[];
  has_open_task: boolean;
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
  const [impact, setImpact] = useState<ImpactItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncSelected, setSyncSelected] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [dueAt, setDueAt] = useState(daysFromToday(14));
  const [campaignId, setCampaignId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(
    (pair: { en: string; ar: string }) =>
      locale === 'ar' ? pair.ar || pair.en : pair.en || pair.ar,
    [locale],
  );

  const driftedImpact = useMemo(() => impact.filter((row) => row.status === 'drifted'), [impact]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [previewRes, impactRes] = await Promise.all([
        api<{ data: { preview: PreviewItem[] } }>(`${base}/plan-to-requests/preview`),
        api<{ data: { impact: ImpactItem[] } }>(`${base}/plan-to-requests/impact`),
      ]);
      const preview = previewRes.data.preview;
      setItems(preview);
      setImpact(impactRes.data.impact ?? []);
      setSelected(
        new Set(
          preview.filter((item) => !item.already_created).map((item) => item.plan_source_key),
        ),
      );
      setSyncSelected(
        new Set(
          (impactRes.data.impact ?? [])
            .filter((row) => row.status === 'drifted')
            .map((row) => row.request_id),
        ),
      );
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void listWorkspaceMembers()
      .then(setMembers)
      .catch(() => setMembers([]));
    void listAllCampaigns([brandId])
      .then((rows) =>
        setCampaigns(
          rows.map((c) => ({
            id: c.id,
            name: locale === 'ar' ? c.name.ar || c.name.en : c.name.en || c.name.ar,
          })),
        ),
      )
      .catch(() => setCampaigns([]));
  }, [brandId, locale]);

  function toggle(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleSync(id: string, checked: boolean) {
    setSyncSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
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
        body: JSON.stringify({
          plan_source_keys: [...selected],
          defaults: {
            assignee_user_id: assigneeUserId || null,
            due_at: dueAt ? `${dueAt}T12:00:00.000Z` : null,
            campaign_id: campaignId || null,
          },
        }),
      });
      if (res.data.created_request_ids.length > 0) {
        setMessage(t('strategy.review.requestsCreated'));
      } else if (res.data.skipped_plan_source_keys.length > 0) {
        setMessage(t('strategy.review.requestsAlreadyExist'));
      }
      await loadAll();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function syncDrifted() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ data: { updated_request_ids: string[] } }>(
        `${base}/plan-to-requests/sync-requests`,
        {
          method: 'POST',
          body: JSON.stringify({ request_ids: [...syncSelected] }),
        },
      );
      if (res.data.updated_request_ids.length > 0) {
        setMessage(t('strategy.review.syncDone'));
      } else {
        setMessage(t('strategy.review.syncNone'));
      }
      await loadAll();
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

  function impactLabel(status: ImpactItem['status']) {
    if (status === 'drifted') return t('strategy.review.impactDrifted');
    if (status === 'orphaned') return t('strategy.review.impactOrphaned');
    return t('strategy.review.impactAligned');
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
      <div className="oma-form-grid" style={{ marginBottom: '1rem' }}>
        <strong>{t('strategy.review.commitDefaults')}</strong>
        <label>
          {t('strategy.review.assignee')}
          <SelectField
            value={assigneeUserId}
            onChange={(e) => setAssigneeUserId(e.target.value)}
            data-testid="strategy-plan-assignee"
          >
            <option value="">{t('demo.requests.unassigned')}</option>
            {members
              .filter((m) => m.user?.id)
              .map((m) => (
                <option key={m.id} value={m.user!.id}>
                  {m.user?.name || m.user?.email}
                </option>
              ))}
          </SelectField>
        </label>
        <label>
          {t('strategy.review.dueDate')}
          <DateField
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            data-testid="strategy-plan-due"
          />
        </label>
        <label>
          {t('strategy.review.campaign')}
          <SelectField
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            data-testid="strategy-plan-campaign"
          >
            <option value="">{t('strategy.review.noCampaign')}</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        </label>
      </div>
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
      {impact.length > 0 ? (
        <section style={{ marginTop: '1.5rem' }} data-testid="strategy-plan-impact">
          <header className="oma-panel__head">
            <h4>{t('strategy.review.impactTitle')}</h4>
            <p className="oma-muted">{t('strategy.review.impactHint')}</p>
          </header>
          <ul className="oma-discovery-list">
            {impact.map((row) => (
              <li key={row.request_id} className="oma-discovery-item">
                {row.status === 'drifted' ? (
                  <label>
                    <CheckboxField
                      checked={syncSelected.has(row.request_id)}
                      disabled={busy}
                      onChange={(e) => toggleSync(row.request_id, e.target.checked)}
                    />{' '}
                  </label>
                ) : null}
                <span className="oma-muted">{row.plan_source_key}</span> · {impactLabel(row.status)}
                {row.changed_fields.length > 0 ? (
                  <span className="oma-muted"> ({row.changed_fields.join(', ')})</span>
                ) : null}
                {row.has_open_task ? (
                  <span className="oma-muted"> · {t('strategy.review.impactHasTasks')}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {driftedImpact.length > 0 ? (
            <div className="oma-form-actions">
              <Button
                type="default"
                disabled={busy || syncSelected.size === 0}
                data-testid="strategy-plan-sync"
                onClick={() => void syncDrifted()}
              >
                {t('strategy.review.syncSelected')}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
      {error ? (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
