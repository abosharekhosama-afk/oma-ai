'use client';
import { Input, SelectField } from '@oma/ui/controls';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorState, errorKindOf, type ErrorKind } from '../../../../components/ui/error-state';
import { PageHeader } from '../../../../components/ui/page-header';
import { getActiveBrandId, setActiveBrandId, useReloadOnBrandChange } from '../../../../lib/active-brand';
import {
  formatHours,
  formatRate,
  getWorkAnalytics,
  niceMax,
  type AnalyticsPeriod,
  type ApprovalStats,
  type StatusCounts,
  type WorkAnalytics,
} from '../../../../lib/analytics-api';
import { useLocale, useT } from '../../../../lib/use-locale';

const STATUSES: Array<keyof StatusCounts> = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED_SAMPLE'];

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const t = useT();
  const locale = useLocale();
  const [period, setPeriod] = useState<AnalyticsPeriod>('30');
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 29 * 86400_000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [brandId, setBrandId] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [data, setData] = useState<WorkAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorKind | null>(null);
  const reqId = useRef(0);

  const load = useCallback(
    async (override?: { brandId?: string | null }) => {
      const id = ++reqId.current;
      const brand = override && 'brandId' in override ? override.brandId : brandId;
      setLoading(true);
      setError(null);
      try {
        const next = await getWorkAnalytics({ period, from, to, brandId: brand, campaignId });
        if (id !== reqId.current) return;
        setData(next);
      } catch (err) {
        if (id !== reqId.current) return;
        // Stale brand id from another workspace → fall back to all brands.
        if ((err as { status?: number }).status === 404 && brand) {
          setActiveBrandId(null);
          setBrandId(null);
          return;
        }
        setError(errorKindOf(err));
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [period, from, to, brandId, campaignId],
  );

  useEffect(() => {
    setBrandId(getActiveBrandId());
  }, []);
  useEffect(() => {
    if (period === 'custom' && (!from || !to || from > to)) return;
    void load();
  }, [load, period, from, to]);
  useReloadOnBrandChange(() => {
    setCampaignId(null);
    setBrandId(getActiveBrandId());
  });

  const campaigns = useMemo(
    () => (data?.filters.campaigns ?? []).filter((c) => !brandId || c.brand_id === brandId),
    [data, brandId],
  );
  const nf = useMemo(() => new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en'), [locale]);
  const n = (v: number) => nf.format(v);
  const statusLabel = (s: string) => t(`analytics.status.${s}`);

  return (
    <div className="oma-planable-page oma-wa" data-testid="work-analytics">
      <PageHeader title={t('analytics.title')} description={t('analytics.subtitle')} />

      <div className="oma-wa-filters" role="group" aria-label={t('analytics.filters')}>
        <label className="oma-wa-filter">
          <span>{t('analytics.period')}</span>
          <SelectField
            value={period}
            data-testid="analytics-period"
            onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
          >
            <option value="7">{t('analytics.period.7')}</option>
            <option value="30">{t('analytics.period.30')}</option>
            <option value="90">{t('analytics.period.90')}</option>
            <option value="custom">{t('analytics.period.custom')}</option>
          </SelectField>
        </label>
        {period === 'custom' ? (
          <>
            <label className="oma-wa-filter">
              <span>{t('analytics.from')}</span>
              <Input type="date" value={from} max={to} data-testid="analytics-from" onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="oma-wa-filter">
              <span>{t('analytics.to')}</span>
              <Input type="date" value={to} min={from} data-testid="analytics-to" onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        ) : null}
        <label className="oma-wa-filter">
          <span>{t('analytics.brand')}</span>
          <SelectField
            value={brandId ?? ''}
            data-testid="analytics-brand"
            onChange={(e) => {
              const v = e.target.value || null;
              setCampaignId(null);
              setActiveBrandId(v);
              setBrandId(v);
            }}
          >
            <option value="">{t('analytics.allBrands')}</option>
            {(data?.filters.brands ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectField>
        </label>
        <label className="oma-wa-filter">
          <span>{t('analytics.campaign')}</span>
          <SelectField
            value={campaignId ?? ''}
            data-testid="analytics-campaign"
            onChange={(e) => setCampaignId(e.target.value || null)}
          >
            <option value="">{t('analytics.allCampaigns')}</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === 'ar' ? c.name.ar || c.name.en : c.name.en || c.name.ar}
              </option>
            ))}
          </SelectField>
        </label>
      </div>

      <p className="oma-wa-note" data-testid="analytics-social-note" role="note">
        {t('analytics.socialNotConnected')}
      </p>

      {error ? (
        <ErrorState kind={error} compact onRetry={() => void load()} />
      ) : loading && !data ? (
        <AnalyticsSkeleton />
      ) : data ? (
        <div className={`oma-wa-body${loading ? ' is-refreshing' : ''}`} aria-busy={loading}>
          {data.content.total === 0 &&
          data.team.length === 0 &&
          data.approvals.deliverables.submitted === 0 &&
          data.on_time.overdue_tasks === 0 ? (
            <div className="oma-wa-empty" data-testid="analytics-empty">
              <h2>{t('analytics.empty.title')}</h2>
              <p>{t('analytics.empty.body')}</p>
            </div>
          ) : null}

          <section className="oma-wa-kpis" data-testid="analytics-kpis" aria-label={t('analytics.kpis')}>
            <Kpi label={t('analytics.kpi.posts')} value={n(data.content.total)} />
            <Kpi label={t('analytics.kpi.scheduled')} value={n(data.content.series.reduce((a, s) => a + s.scheduled, 0))} />
            <Kpi label={t('analytics.kpi.published')} value={n(data.content.series.reduce((a, s) => a + s.published, 0))} />
            <Kpi label={t('analytics.kpi.avgApproval')} value={formatHours(data.approvals.content.avg_hours_to_approval, locale)} />
            <Kpi label={t('analytics.kpi.onTime')} value={formatRate(data.on_time.task_on_time_rate, locale)} />
            <Kpi
              label={t('analytics.kpi.overdue')}
              value={n(data.on_time.overdue_posts + data.on_time.overdue_tasks)}
              tone={data.on_time.overdue_posts + data.on_time.overdue_tasks > 0 ? 'warn' : undefined}
            />
          </section>

          <section className="oma-wa-card" data-testid="analytics-series">
            <header className="oma-wa-card__head">
              <h2>{t('analytics.overTime')}</h2>
              <span className="oma-wa-legend">
                <i className="oma-wa-dot oma-wa-dot--scheduled" /> {t('analytics.scheduled')}
                <i className="oma-wa-dot oma-wa-dot--published" /> {t('analytics.published')}
              </span>
            </header>
            <ColumnChart data={data} locale={locale} label={t('analytics.overTime')} />
          </section>

          <div className="oma-wa-grid">
            <section className="oma-wa-card" data-testid="analytics-status">
              <header className="oma-wa-card__head">
                <h2>{t('analytics.byStatus')}</h2>
              </header>
              <StatusBar counts={data.content.by_status} label={statusLabel} n={n} />
              <ul className="oma-wa-status-legend">
                {STATUSES.map((s) => (
                  <li key={s}>
                    <i className={`oma-wa-dot oma-wa-dot--${s.toLowerCase()}`} />
                    <span>{statusLabel(s)}</span>
                    <strong>{n(data.content.by_status[s] ?? 0)}</strong>
                  </li>
                ))}
              </ul>
              <BreakdownTable
                title={t('analytics.perBrand')}
                rows={data.content.per_brand.map((r) => ({ id: r.id, name: r.name, total: r.total, by: r.by_status }))}
                n={n}
                statusLabel={statusLabel}
                testId="analytics-per-brand"
              />
              <BreakdownTable
                title={t('analytics.perCampaign')}
                rows={data.content.per_campaign.map((r) => ({
                  id: r.id,
                  name: locale === 'ar' ? r.name.ar || r.name.en : r.name.en || r.name.ar,
                  total: r.total,
                  by: r.by_status,
                }))}
                n={n}
                statusLabel={statusLabel}
                testId="analytics-per-campaign"
              />
            </section>

            <section className="oma-wa-card" data-testid="analytics-approvals">
              <header className="oma-wa-card__head">
                <h2>{t('analytics.approvals')}</h2>
              </header>
              <table className="oma-wa-table">
                <thead>
                  <tr>
                    <th scope="col">{t('analytics.metric')}</th>
                    <th scope="col">{t('analytics.content')}</th>
                    <th scope="col">{t('analytics.deliverables')}</th>
                  </tr>
                </thead>
                <tbody>
                  <ApprovalRow label={t('analytics.submitted')} c={data.approvals.content} d={data.approvals.deliverables} pick={(s) => n(s.submitted)} />
                  <ApprovalRow label={t('analytics.approved')} c={data.approvals.content} d={data.approvals.deliverables} pick={(s) => n(s.approved)} />
                  <ApprovalRow label={t('analytics.avgTimeToApproval')} c={data.approvals.content} d={data.approvals.deliverables} pick={(s) => formatHours(s.avg_hours_to_approval, locale)} />
                  <ApprovalRow label={t('analytics.changesRequested')} c={data.approvals.content} d={data.approvals.deliverables} pick={(s) => n(s.changes_requested)} />
                  <ApprovalRow label={t('analytics.avgRevisionRounds')} c={data.approvals.content} d={data.approvals.deliverables} pick={(s) => (s.avg_revision_rounds === null ? '—' : String(s.avg_revision_rounds))} />
                  <ApprovalRow label={t('analytics.rejectionRate')} c={data.approvals.content} d={data.approvals.deliverables} pick={(s) => formatRate(s.rejection_rate, locale)} />
                </tbody>
              </table>

              <header className="oma-wa-card__head oma-wa-card__head--sub">
                <h2>{t('analytics.onTime')}</h2>
              </header>
              <dl className="oma-wa-dl" data-testid="analytics-ontime">
                <div>
                  <dt>{t('analytics.overduePosts')}</dt>
                  <dd>{n(data.on_time.overdue_posts)}</dd>
                </div>
                <div>
                  <dt>{t('analytics.overdueTasks')}</dt>
                  <dd>{n(data.on_time.overdue_tasks)}</dd>
                </div>
                <div>
                  <dt>{t('analytics.taskOnTimeRate')}</dt>
                  <dd>
                    {formatRate(data.on_time.task_on_time_rate, locale)}
                    <small> ({n(data.on_time.tasks_on_time)}/{n(data.on_time.tasks_completed_with_due)})</small>
                  </dd>
                </div>
                <div>
                  <dt>{t('analytics.postOnTimeRate')}</dt>
                  <dd>
                    {formatRate(data.on_time.post_on_time_rate, locale)}
                    <small> ({n(data.on_time.posts_approved_on_time)}/{n(data.on_time.posts_due)})</small>
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="oma-wa-card" data-testid="analytics-team">
            <header className="oma-wa-card__head">
              <h2>{t('analytics.team')}</h2>
            </header>
            {data.team.length === 0 ? (
              <p className="oma-wa-muted">{t('analytics.teamEmpty')}</p>
            ) : (
              <table className="oma-wa-table">
                <thead>
                  <tr>
                    <th scope="col">{t('analytics.member')}</th>
                    <th scope="col">{t('analytics.tasksCompleted')}</th>
                    <th scope="col">{t('analytics.deliverablesApproved')}</th>
                    <th scope="col">{t('analytics.postsCreated')}</th>
                    <th scope="col">{t('analytics.approvalsGiven')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.team.map((m) => (
                    <tr key={m.user_id}>
                      <th scope="row">{m.name}</th>
                      <td>{n(m.tasks_completed)}</td>
                      <td>{n(m.deliverables_approved)}</td>
                      <td>{n(m.posts_created)}</td>
                      <td>{n(m.approvals_given)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className={`oma-wa-kpi${tone ? ` oma-wa-kpi--${tone}` : ''}`}>
      <span className="oma-wa-kpi__label">{label}</span>
      <strong className="oma-wa-kpi__value">{value}</strong>
    </div>
  );
}

function ApprovalRow({
  label,
  c,
  d,
  pick,
}: {
  label: string;
  c: ApprovalStats;
  d: ApprovalStats;
  pick: (s: ApprovalStats) => string;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{pick(c)}</td>
      <td>{pick(d)}</td>
    </tr>
  );
}

function ColumnChart({ data, locale, label }: { data: WorkAnalytics; locale: string; label: string }) {
  const s = data.content.series;
  const max = niceMax(s.flatMap((p) => [p.scheduled, p.published]));
  const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const every = Math.max(1, Math.ceil(s.length / 8));
  return (
    <div className="oma-wa-chart" role="img" aria-label={label}>
      <div className="oma-wa-chart__axis" aria-hidden="true">
        <span>{max}</span>
        <span>{max / 2}</span>
        <span>0</span>
      </div>
      <div className="oma-wa-chart__plot">
        {s.map((p, i) => (
          <div key={p.bucket} className="oma-wa-chart__col" title={`${fmt.format(new Date(p.bucket))}: ${p.scheduled} / ${p.published}`}>
            <div className="oma-wa-chart__bars">
              <span className="oma-wa-bar oma-wa-bar--scheduled" style={{ height: `${(p.scheduled / max) * 100}%` }} />
              <span className="oma-wa-bar oma-wa-bar--published" style={{ height: `${(p.published / max) * 100}%` }} />
            </div>
            <span className="oma-wa-chart__tick">{i % every === 0 ? fmt.format(new Date(p.bucket)) : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBar({ counts, label, n }: { counts: StatusCounts; label: (s: string) => string; n: (v: number) => string }) {
  const total = STATUSES.reduce((a, s) => a + (counts[s] ?? 0), 0);
  if (!total) return <div className="oma-wa-stack oma-wa-stack--empty" aria-hidden="true" />;
  return (
    <div className="oma-wa-stack" role="img" aria-label={STATUSES.map((s) => `${label(s)} ${n(counts[s] ?? 0)}`).join(', ')}>
      {STATUSES.filter((s) => counts[s]).map((s) => (
        <span key={s} className={`oma-wa-stack__seg oma-wa-dot--${s.toLowerCase()}`} style={{ flexGrow: counts[s] }} />
      ))}
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
  n,
  statusLabel,
  testId,
}: {
  title: string;
  rows: Array<{ id: string; name: string; total: number; by: StatusCounts }>;
  n: (v: number) => string;
  statusLabel: (s: string) => string;
  testId: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="oma-wa-breakdown" data-testid={testId}>
      <h3>{title}</h3>
      <table className="oma-wa-table oma-wa-table--compact">
        <thead>
          <tr>
            <th scope="col">{title}</th>
            {STATUSES.map((s) => (
              <th key={s} scope="col">
                {statusLabel(s)}
              </th>
            ))}
            <th scope="col">Σ</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.name}</th>
              {STATUSES.map((s) => (
                <td key={s}>{n(r.by[s] ?? 0)}</td>
              ))}
              <td>
                <strong>{n(r.total)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="oma-wa-body" data-testid="analytics-skeleton" role="status" aria-label="Loading analytics">
      <div className="oma-wa-kpis">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="oma-wa-kpi">
            <span className="oma-skeleton oma-wa-skel-line oma-wa-skel-line--short" />
            <span className="oma-skeleton oma-wa-skel-value" />
          </div>
        ))}
      </div>
      <div className="oma-wa-card">
        <span className="oma-skeleton oma-wa-skel-line oma-wa-skel-line--short" />
        <span className="oma-skeleton oma-wa-skel-chart" />
      </div>
      <div className="oma-wa-grid">
        <div className="oma-wa-card">
          <span className="oma-skeleton oma-wa-skel-line oma-wa-skel-line--short" />
          <span className="oma-skeleton oma-wa-skel-block" />
        </div>
        <div className="oma-wa-card">
          <span className="oma-skeleton oma-wa-skel-line oma-wa-skel-line--short" />
          <span className="oma-skeleton oma-wa-skel-block" />
        </div>
      </div>
    </div>
  );
}
