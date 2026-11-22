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
  default_selected?: boolean;
  pillar_key?: string | null;
  brief: {
    objective: { en: string; ar: string };
    audience: { en: string; ar: string };
    keyMessage: { en: string; ar: string };
  };
};

type CalendarSummary = {
  available: boolean;
  posts_per_week: number;
  default_weeks: number;
  max_weeks?: number;
  slots_in_default?: number;
  by_pillar?: Record<string, number>;
} | null;

type ImpactItem = {
  request_id: string;
  plan_source_key: string;
  source_strategy_version_id: string;
  status: 'aligned' | 'drifted' | 'orphaned';
  changed_fields: string[];
  has_open_task: boolean;
};

const PAGE_SIZE = 12;

export type PlanGroup = 'pillar' | 'product' | 'service' | 'paid';

export function planGroupOf(item: { plan_source_key: string; track: string }): PlanGroup {
  if (item.track === 'paid') return 'paid';
  if (item.plan_source_key.includes(':catalog:service:')) return 'service';
  if (item.plan_source_key.includes(':catalog:')) return 'product';
  return 'pillar';
}

/** Compact counts for the execution tab (by type, channel and status). */
export function planSummary(
  items: Array<{
    plan_source_key: string;
    track: string;
    channels: string[];
    already_created: boolean;
    default_selected?: boolean;
  }>,
) {
  const groups = new Map<PlanGroup, number>();
  const channels = new Map<string, number>();
  let created = 0;
  let pendingDefault = 0;
  for (const item of items) {
    const g = planGroupOf(item);
    groups.set(g, (groups.get(g) ?? 0) + 1);
    for (const c of item.channels) channels.set(c, (channels.get(c) ?? 0) + 1);
    if (item.already_created) created += 1;
    else if (item.default_selected !== false) pendingDefault += 1;
  }
  const order: PlanGroup[] = ['pillar', 'product', 'service', 'paid'];
  return {
    total: items.length,
    created,
    pendingDefault,
    groups: order.filter((g) => groups.has(g)).map((g) => ({ group: g, count: groups.get(g)! })),
    channels: [...channels.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([channel, count]) => ({ channel, count })),
  };
}

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
  const [catalogRequestCount, setCatalogRequestCount] = useState(0);
  const [calendar, setCalendar] = useState<CalendarSummary>(null);
  const [page, setPage] = useState(0);
  const [startDate, setStartDate] = useState(daysFromToday(1));
  const [weeks, setWeeks] = useState('4');
  const [showAllCatalog, setShowAllCatalog] = useState(false);

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
        api<{
          data: {
            preview: PreviewItem[];
            catalog_request_count?: number;
            catalog_offerings_count?: number;
            calendar?: CalendarSummary;
          };
        }>(`${base}/plan-to-requests/preview`),
        api<{ data: { impact: ImpactItem[] } }>(`${base}/plan-to-requests/impact`),
      ]);
      const preview = previewRes.data.preview;
      setItems(preview);
      setCatalogRequestCount(previewRes.data.catalog_request_count ?? 0);
      setCalendar(previewRes.data.calendar ?? null);
      setImpact(impactRes.data.impact ?? []);
      setSelected(
        new Set(
          preview
            .filter((item) => !item.already_created && item.default_selected !== false)
            .map((item) => item.plan_source_key),
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

  async function commitSelected(toCalendar: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const calendarOn = Boolean(calendar?.available && toCalendar);
      const res = await api<{
        data: {
          created_request_ids: string[];
          created_content_ids?: string[];
          created_brief_ids?: string[];
          skipped_plan_source_keys: string[];
        };
      }>(`${base}/plan-to-requests/commit`, {
        method: 'POST',
        body: JSON.stringify({
          plan_source_keys: [...selected].filter(
            (key) => !items.find((i) => i.plan_source_key === key)?.already_created,
          ),
          defaults: {
            assignee_user_id: assigneeUserId || null,
            // With a calendar each item is due two days before its first slot.
            ...(calendarOn ? {} : { due_at: dueAt ? `${dueAt}T12:00:00.000Z` : null }),
            campaign_id: campaignId || null,
          },
          calendar: calendarOn ? { start_date: startDate, weeks: Number(weeks) || 4 } : null,
        }),
      });
      if (res.data.created_request_ids.length > 0) {
        setMessage(
          (res.data.created_brief_ids?.length ?? 0) > 0
            ? t('strategy.review.requestsAndBriefsCreated')
            : (res.data.created_content_ids?.length ?? 0) > 0
              ? t('strategy.review.requestsAndCalendarCreated')
              : t('strategy.review.requestsCreated'),
        );
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
      <div
        className="oma-plx-listening-panel oma-plx-brand-section"
        data-testid="strategy-plan-requests-loading"
      >
        {t('strategy.review.planPreviewLoading')}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="oma-plx-listening-panel oma-plx-brand-section" role="status">
        {t('strategy.review.planPreviewEmpty')}
      </div>
    );
  }

  const isCatalog = (item: PreviewItem) => item.plan_source_key.includes(':catalog:');
  const visibleItems = showAllCatalog
    ? items
    : items.filter(
        (item) =>
          !isCatalog(item) ||
          item.default_selected !== false ||
          item.already_created ||
          selected.has(item.plan_source_key),
      );
  const hiddenCatalog = items.filter(
    (item) => isCatalog(item) && item.default_selected === false && !item.already_created,
  ).length;
  const selectedCatalog = items.filter(
    (item) => isCatalog(item) && selected.has(item.plan_source_key),
  ).length;

  const requestsHref = `/app/requests?brand=${encodeURIComponent(brandId)}&strategy_version=${encodeURIComponent(versionId)}`;
  const calendarHref = `/app/content?brand=${encodeURIComponent(brandId)}`;
  const briefsHref = `/app/brands/${encodeURIComponent(brandId)}/briefs`;
  const summary = planSummary(items);
  const pendingSelected = [...selected].filter(
    (key) => !items.find((i) => i.plan_source_key === key)?.already_created,
  ).length;
  const allSent = summary.total > 0 && summary.pendingDefault === 0 && summary.created > 0;
  const calendarReady = Boolean(calendar?.available);
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = visibleItems.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const groupLabel = (g: PlanGroup) => t(`strategy.execution.group.${g}`);

  return (
    <section
      className="oma-plx-listening-panel oma-plx-brand-section oma-plan-exec"
      data-testid="strategy-plan-requests-panel"
    >
      <header className="oma-plx-brand-section__head">
        <div>
          <h3 className="oma-plx-brand-section__title">{t('strategy.review.planPreviewTitle')}</h3>
          <p className="oma-muted oma-plx-brand-section__desc">
            {t('strategy.execution.summaryHint')}
          </p>
        </div>
      </header>
      <div className="oma-plx-brand-section__body">
        <div className="oma-plan-exec__stats" data-testid="strategy-plan-summary">
          <div className="oma-plan-exec__stat">
            <span className="oma-plan-exec__stat-value">{summary.total}</span>
            <span className="oma-plan-exec__stat-label">{t('strategy.execution.stat.items')}</span>
          </div>
          <div className="oma-plan-exec__stat">
            <span className="oma-plan-exec__stat-value">{summary.created}</span>
            <span className="oma-plan-exec__stat-label">{t('strategy.execution.stat.sent')}</span>
          </div>
          <div className="oma-plan-exec__stat">
            <span className="oma-plan-exec__stat-value">{pendingSelected}</span>
            <span className="oma-plan-exec__stat-label">
              {t('strategy.execution.stat.selected')}
            </span>
          </div>
          {calendar?.available ? (
            <div className="oma-plan-exec__stat">
              <span className="oma-plan-exec__stat-value">{calendar.posts_per_week}</span>
              <span className="oma-plan-exec__stat-label">
                {t('strategy.execution.stat.perWeek')}
              </span>
            </div>
          ) : null}
        </div>
        <div className="oma-plan-exec__breakdown">
          <div data-testid="strategy-plan-summary-groups">
            <strong>{t('strategy.execution.byType')}</strong>
            <ul className="oma-plan-exec__chips">
              {summary.groups.map((g) => (
                <li key={g.group} className="oma-plan-exec__chip">
                  {groupLabel(g.group)} <b>{g.count}</b>
                </li>
              ))}
            </ul>
          </div>
          {summary.channels.length > 0 ? (
            <div data-testid="strategy-plan-summary-channels">
              <strong>{t('strategy.execution.byChannel')}</strong>
              <ul className="oma-plan-exec__chips">
                {summary.channels.slice(0, 8).map((c) => (
                  <li key={c.channel} className="oma-plan-exec__chip">
                    {c.channel} <b>{c.count}</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div data-testid="strategy-plan-summary-status">
            <strong>{t('strategy.execution.byStatus')}</strong>
            <ul className="oma-plan-exec__chips">
              <li className="oma-plan-exec__chip oma-plan-exec__chip--done">
                {t('strategy.execution.status.sent')} <b>{summary.created}</b>
              </li>
              <li className="oma-plan-exec__chip">
                {t('strategy.execution.status.pending')} <b>{summary.total - summary.created}</b>
              </li>
            </ul>
          </div>
        </div>

        <div className="oma-plan-exec__actions" data-testid="strategy-plan-primary-actions">
          {allSent ? (
            <p className="oma-plan-exec__done" role="status" data-testid="strategy-plan-sent">
              {t('strategy.execution.allSent')}
            </p>
          ) : null}
          <Button
            type="primary"
            disabled={busy || pendingSelected === 0 || !calendarReady}
            data-testid="strategy-plan-send-calendar"
            onClick={() => void commitSelected(true)}
            title={calendarReady ? undefined : t('strategy.review.calendar.missingCadence')}
          >
            {busy
              ? t('strategy.execution.working')
              : allSent
                ? t('strategy.execution.sentToCalendar')
                : t('strategy.execution.sendToCalendar').replace('{n}', String(pendingSelected))}
          </Button>
          <Button
            type="default"
            disabled={busy || pendingSelected === 0}
            data-testid="strategy-plan-requests-commit"
            onClick={() => void commitSelected(false)}
          >
            {t('strategy.execution.createBriefs').replace('{n}', String(pendingSelected))}
          </Button>
          <div className="oma-plan-exec__links">
            <OmaLinkButton href={calendarHref} type="link">
              {t('strategy.execution.openCalendar')}
            </OmaLinkButton>
            <OmaLinkButton href={briefsHref} type="link">
              {t('strategy.execution.openBriefs')}
            </OmaLinkButton>
            <OmaLinkButton href={requestsHref} type="link">
              {t('strategy.review.openRequests')}
            </OmaLinkButton>
            <Button type="link" disabled={busy} onClick={() => void convertAllTasks()}>
              {t('strategy.review.convertTasks')}
            </Button>
          </div>
        </div>
        {!calendarReady && calendar ? (
          <p className="oma-muted" data-testid="strategy-plan-calendar-missing">
            {t('strategy.review.calendar.missingCadence')}
          </p>
        ) : null}

        <details className="oma-plan-exec__details" data-testid="strategy-plan-options">
          <summary>{t('strategy.execution.options')}</summary>
          <div className="oma-form-grid">
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
            {calendarReady ? (
              <>
                <label>
                  {t('strategy.review.calendar.start')}
                  <DateField
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    data-testid="strategy-plan-calendar-start"
                  />
                </label>
                <label>
                  {t('strategy.review.calendar.weeks')}
                  <SelectField
                    value={weeks}
                    onChange={(e) => setWeeks(e.target.value)}
                    data-testid="strategy-plan-calendar-weeks"
                  >
                    {[1, 2, 4, 6, 8, 12].map((w) => (
                      <option key={w} value={String(w)}>
                        {w}
                      </option>
                    ))}
                  </SelectField>
                </label>
                <p
                  className="oma-muted oma-field-span"
                  data-testid="strategy-plan-calendar-summary"
                >
                  {t('strategy.review.calendar.summary')
                    .replace('{perWeek}', String(calendar!.posts_per_week))
                    .replace('{total}', String(calendar!.posts_per_week * (Number(weeks) || 4)))}
                </p>
              </>
            ) : null}
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
        </details>

        <details className="oma-plan-exec__details" data-testid="strategy-plan-items">
          <summary>
            {t('strategy.execution.items').replace('{n}', String(visibleItems.length))}
          </summary>
          {hiddenCatalog > 0 ? (
            <p className="oma-muted" data-testid="strategy-plan-catalog-picker">
              {t('strategy.review.catalogPicker')
                .replace('{selected}', String(selectedCatalog))
                .replace('{total}', String(catalogRequestCount))}{' '}
              <Button
                type="link"
                onClick={() => {
                  setShowAllCatalog((v) => !v);
                  setPage(0);
                }}
              >
                {showAllCatalog
                  ? t('strategy.review.catalogShowLess')
                  : t('strategy.review.catalogShowAll')}
              </Button>
            </p>
          ) : null}
          <ul className="oma-plan-exec__list">
            {pageItems.map((item) => (
              <li key={item.plan_source_key} className="oma-plan-exec__row">
                <label className="oma-plan-exec__row-main">
                  <CheckboxField
                    checked={item.already_created || selected.has(item.plan_source_key)}
                    disabled={item.already_created || busy}
                    onChange={(e) => toggle(item.plan_source_key, e.target.checked)}
                  />
                  <span className="oma-plan-exec__row-title">{pick(item.title)}</span>
                </label>
                <span className="oma-plan-exec__row-meta">
                  <span className="oma-plan-exec__chip">{groupLabel(planGroupOf(item))}</span>
                  {item.channels.length > 0 ? (
                    <span className="oma-muted">{item.channels.slice(0, 3).join('، ')}</span>
                  ) : null}
                  {item.already_created ? (
                    <span className="oma-plan-exec__chip oma-plan-exec__chip--done">
                      {t('strategy.execution.status.sent')}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {pageCount > 1 ? (
            <nav className="oma-plan-exec__pager" aria-label={t('strategy.execution.pager')}>
              <Button
                type="default"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                {t('strategy.execution.prev')}
              </Button>
              <span className="oma-muted" data-testid="strategy-plan-page">
                {t('strategy.execution.pageOf')
                  .replace('{page}', String(currentPage + 1))
                  .replace('{pages}', String(pageCount))}
              </span>
              <Button
                type="default"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                {t('strategy.execution.next')}
              </Button>
            </nav>
          ) : null}
        </details>
        {impact.length > 0 ? (
          <section style={{ marginTop: '1.5rem' }} data-testid="strategy-plan-impact">
            <header className="oma-panel__head">
              <h4>{t('strategy.review.impactTitle')}</h4>
              <p className="oma-muted">{t('strategy.review.impactHint')}</p>
            </header>
            <ul className="oma-plx-brand-data-grid">
              {impact.map((row) => (
                <li
                  key={row.request_id}
                  className="oma-plx-listening-card oma-plx-brand-catalog-card"
                >
                  {row.status === 'drifted' ? (
                    <label>
                      <CheckboxField
                        checked={syncSelected.has(row.request_id)}
                        disabled={busy}
                        onChange={(e) => toggleSync(row.request_id, e.target.checked)}
                      />{' '}
                    </label>
                  ) : null}
                  <span className="oma-muted">{row.plan_source_key}</span> ·{' '}
                  {impactLabel(row.status)}
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
      </div>
    </section>
  );
}
