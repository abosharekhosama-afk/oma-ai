'use client';
import { DetailShimmer } from '../../../../../components/ui/shimmer';
import { OmaLinkButton } from '../../../../../components/ui/oma-link-button';
import { MediaSurface } from '../../../../../components/content/media-surface';
import { Button } from '@oma/ui/controls';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { TrackPill } from '../../../../../components/demo/track-pill';
import { EmptyState, ErrorState, DeniedState } from '../../../../../components/ui/empty-state';
import { PageHeader } from '../../../../../components/ui/page-header';
import { StatusChip } from '../../../../../components/ui/status-chip';
import { Dialog } from '../../../../../components/ui/dialog';
import { pickCopy } from '../../../../../lib/demo/use-demo-api';
import {
  getCampaignProduction,
  toCampaignRow,
  listBrandsProduction,
  updateCampaignProduction,
  archiveCampaignProduction,
  apiErrorMessage,
} from '../../../../../lib/campaign-api';
import { listContentForBrand, toContentRow } from '../../../../../lib/content-api';
import {
  listDeliverables,
  listTasks,
  toDeliverableRow,
  toTaskRow,
} from '../../../../../lib/ops-api';
import { todayKey } from '../../../../../lib/calendar-today';
import { Input, TextArea, SelectField, DateField } from '@oma/ui/controls';
import { useToast } from '../../../../../components/ui/toast';
import {
  campaignNextAction,
  campaignReviewState,
  campaignScheduleReadiness,
  strategyHref,
} from '../../../../../lib/demo/stage3-campaigns';
import { mediaAlt } from '../../../../../lib/demo/demo-media';
import { statusLabel } from '../../../../../lib/demo/stage3-content';
import { useLocale, useT } from '../../../../../lib/use-locale';

type Campaign = DemoGraph['campaigns'][number];
type ContentItem = DemoGraph['contentItems'][number];
type Strategy = DemoGraph['strategies'][number];
type Brand = DemoGraph['brands'][number];
type Task = DemoGraph['tasks'][number];
type Deliverable = DemoGraph['deliverables'][number];
type Activity = DemoGraph['activity'][number];

type Tab = 'overview' | 'content' | 'tasks' | 'deliverables' | 'activity';

export default function CampaignDetailPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ campaignId: string }>();
  const campaignId = params.campaignId;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unavailable = false;
  const [editOpen, setEditOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    objective: '',
    audience: '',
    channels: '',
    start: '',
    end: '',
    track: 'ORGANIC' as 'ORGANIC' | 'PAID',
    status: 'DRAFT' as string,
  });

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    (async () => {
      try {
        const apiCamp = await getCampaignProduction(campaignId);
        const row = toCampaignRow(apiCamp);
        const brands = await listBrandsProduction();
        const b = brands.find((x) => x.id === apiCamp.brand_id);
        const brandRow = b
          ? ({
              id: b.id,
              name: { en: b.name, ar: b.name },
              state: 'healthy',
              profileStatus: b.status,
              strategyId: null,
            } as Brand)
          : null;
        if (cancelled) return;
        setCampaign(row);
        setBrand(brandRow);
        setStrategy(null);
        // Linked content from production Content API
        try {
          const items = await listContentForBrand(apiCamp.brand_id, { campaignId });
          if (!cancelled) setContent(items.map((c) => toContentRow(c)) as ContentItem[]);
        } catch {
          if (!cancelled) setContent([]);
        }
        try {
          const [taskRows, delRows] = await Promise.all([
            listTasks(apiCamp.brand_id).catch(() => []),
            listDeliverables(apiCamp.brand_id).catch(() => []),
          ]);
          if (!cancelled) {
            setTasks(
              taskRows
                .filter((t) => t.campaign_id === campaignId)
                .map((t) => toTaskRow(t)) as Task[],
            );
            setDeliverables(
              delRows
                .filter((d) => d.campaign_id === campaignId)
                .map((d) => toDeliverableRow(d)) as Deliverable[],
            );
          }
        } catch {
          if (!cancelled) {
            setTasks([]);
            setDeliverables([]);
          }
        }
        setActivity([]);
        setError(null);
        setEditForm({
          name: pickCopy(row.name, locale),
          objective: pickCopy(row.objective, locale),
          audience: pickCopy(row.audience, locale),
          channels: row.channels.join(', '),
          start: row.timeline.start,
          end: row.timeline.end,
          track: row.track,
          status: row.status,
        });
      } catch (err) {
        if (cancelled) return;
        setError(
          apiErrorMessage(
            err,
            locale.toLowerCase().startsWith('ar')
              ? 'تعذّر تحميل الحملة'
              : 'Failed to load campaign',
          ),
        );
        setCampaign(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const needsAttention = useMemo(
    () =>
      content.filter(
        (c) =>
          c.status === 'IN_REVIEW' ||
          (c.scheduledAt &&
            c.scheduledAt.slice(0, 10) < todayKey() &&
            c.status !== 'PUBLISHED_DEMO'),
      ),
    [content],
  );

  const pipeline = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of content) {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
    }
    return counts;
  }, [content]);

  const team = useMemo(
    () => [...new Set(content.map((c) => c.assignee).concat(campaign?.owner ?? ''))],
    [content, campaign],
  );
  const review = campaignReviewState(content);
  const ready = campaignScheduleReadiness(content);

  return (
    <div className="oma-stack" data-testid="demo-campaign-detail">
      <div className="oma-breadcrumb" aria-label="Breadcrumb">
        <Link href="/app">{t('nav.home')}</Link>
        <span aria-hidden="true">/</span>
        <Link href="/app/campaigns">{t('demo.campaigns.back')}</Link>
        <span aria-hidden="true">/</span>
        <span>{campaign ? pickCopy(campaign.name, locale) : '…'}</span>
      </div>

      <div className="oma-campaign-workspace-head">
        <PageHeader
          title={campaign ? pickCopy(campaign.name, locale) : t('demo.campaigns.title')}
          description={campaign ? pickCopy(campaign.objective, locale) : undefined}
          meta={
            campaign ? (
              <>
                {brand ? <span className="oma-muted">{pickCopy(brand.name, locale)}</span> : null}
                {campaign.strategyId ? (
                  <Link
                    href={strategyHref(campaign.brandId, campaign.strategyId)}
                    className="oma-text-link"
                    data-testid="demo-campaign-strategy-link"
                  >
                    {strategy ? pickCopy(strategy.name, locale) : t('demo.campaign.openStrategy')}
                  </Link>
                ) : null}
                <TrackPill
                  track={campaign.track}
                  organicLabel={t('demo.organic')}
                  paidLabel={t('demo.paid')}
                />
                <StatusChip status={campaign.status} label={statusLabel(campaign.status, locale)} />
                <span className="oma-muted">{campaign.owner}</span>
                <span className="oma-muted oma-ltr">
                  {campaign.timeline.start} → {campaign.timeline.end}
                </span>
              </>
            ) : null
          }
          actions={
            <>
              <OmaLinkButton href={`/app/content?campaign=${campaignId}`} type="primary">
                {t('demo.content.title')}
              </OmaLinkButton>
              <Button type="default" onClick={() => setEditOpen(true)}>
                {t('demo.campaign.edit')}
              </Button>
              <Button
                type="default"
                aria-haspopup="menu"
                aria-label={t('demo.create.cancel')}
                onClick={() => setConfirmClose(true)}
              >
                ⋯
              </Button>
            </>
          }
        />
      </div>

      {loading ? <DetailShimmer /> : null}
      {unavailable ? <DeniedState title={t('demo.unavailable')} /> : null}
      {error ? <ErrorState title={error} /> : null}

      {campaign ? (
        <>
          {campaign.track === 'PAID' ? (
            <div className="oma-honesty-banner" data-testid="demo-paid-planning-only">
              {t('demo.planningOnly')} — {t('demo.campaign.externalNotConnected')}
            </div>
          ) : null}

          <div
            className="oma-ws-tabs oma-workspace-tabs"
            role="tablist"
            aria-label="Campaign workspace"
          >
            {(
              [
                ['overview', t('demo.campaign.overview')],
                ['content', t('demo.campaign.content')],
                ['tasks', t('demo.campaign.tasks')],
                ['deliverables', t('demo.campaign.deliverables')],
                ['activity', t('demo.campaign.activity')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                data-testid={`demo-campaign-tab-${id}`}
                onClick={() => setTab(id)}
                className={`oma-ws-tab oma-workspace-tab${tab === id ? ' is-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'overview' ? (
            <div className="oma-campaign-overview">
              <div className="oma-campaign-kpis">
                <article className="oma-campaign-kpi">
                  <span>{t('demo.campaign.content')}</span>
                  <strong>{content.length}</strong>
                </article>
                <article className="oma-campaign-kpi">
                  <span>{t('demo.campaign.tasks')}</span>
                  <strong>{tasks.length}</strong>
                </article>
                <article className="oma-campaign-kpi">
                  <span>{t('demo.campaign.deliverables')}</span>
                  <strong>{deliverables.length}</strong>
                </article>
                <article className="oma-campaign-kpi">
                  <span>{t('demo.campaign.scheduleReady')}</span>
                  <strong>{t(`demo.campaign.scheduleReady.${ready}`)}</strong>
                </article>
                <article className="oma-campaign-kpi">
                  <span>{t('demo.campaigns.col.review')}</span>
                  <strong>{statusLabel(review, locale)}</strong>
                </article>
              </div>
              <div className="oma-campaign-overview__grid">
                <section className="oma-campaign-panel">
                  <h2>{t('demo.campaign.goal')}</h2>
                  <p className="oma-campaign-copy">{pickCopy(campaign.objective, locale)}</p>
                  <dl className="oma-campaign-facts">
                    <dt>{t('demo.campaign.audience')}</dt>
                    <dd>{pickCopy(campaign.audience, locale)}</dd>
                    <dt>{t('demo.campaign.channels')}</dt>
                    <dd>{campaign.channels.join(' · ') || '—'}</dd>
                  </dl>
                  <Link
                    href={strategyHref(campaign.brandId, campaign.strategyId)}
                    className="oma-text-link"
                  >
                    {t('demo.campaign.openStrategy')}
                  </Link>
                  <p className="oma-ltr oma-muted" data-testid="demo-strategy-id">
                    {campaign.strategyId}
                  </p>
                </section>
                <section className="oma-campaign-panel">
                  <h2>{t('demo.campaign.milestones')}</h2>
                  <dl className="oma-campaign-facts">
                    <dt>{t('demo.filter.status')}</dt>
                    <dd>
                      <StatusChip
                        status={campaign.status}
                        label={statusLabel(campaign.status, locale)}
                      />
                    </dd>
                    <dt>{t('demo.campaign.timeline')}</dt>
                    <dd className="oma-ltr">
                      {campaign.timeline.start} → {campaign.timeline.end}
                    </dd>
                    <dt>{t('demo.campaign.budget')}</dt>
                    <dd>
                      {campaign.budget.amount > 0
                        ? `${campaign.budget.currency} ${campaign.budget.amount.toLocaleString()}`
                        : t('demo.planningOnly')}
                    </dd>
                    <dt>{t('demo.campaigns.col.owner')}</dt>
                    <dd>{campaign.owner || '—'}</dd>
                    <dt>{t('demo.campaigns.col.next')}</dt>
                    <dd>{campaignNextAction(campaign, content, locale)}</dd>
                  </dl>
                  {team.filter(Boolean).length > 0 ? (
                    <div className="oma-campaign-team" aria-label={t('demo.campaign.team')}>
                      {team.filter(Boolean).map((name) => (
                        <span key={name}>{name}</span>
                      ))}
                    </div>
                  ) : null}
                </section>
              </div>
              {campaign.kpis.length > 0 ? (
                <div className="oma-campaign-metrics" aria-label={t('demo.campaign.kpis')}>
                  {campaign.kpis.map((kpi, i) => (
                    <article key={i} className="oma-campaign-metric">
                      <span>{pickCopy(kpi.name, locale)}</span>
                      <strong>
                        {kpi.target} · {Math.round(kpi.progress * 100)}%
                      </strong>
                      <span className="oma-campaign-meter" aria-hidden="true">
                        <i style={{ width: `${Math.round(Math.min(1, kpi.progress) * 100)}%` }} />
                      </span>
                    </article>
                  ))}
                </div>
              ) : null}
              {Object.keys(pipeline).length > 0 ? (
                <section className="oma-campaign-panel">
                  <h2>{t('demo.campaign.pipeline')}</h2>
                  <div className="oma-campaign-team">
                    {Object.entries(pipeline).map(([status, count]) => (
                      <span key={status}>
                        {statusLabel(status, locale)} · {count}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}
              {needsAttention.length > 0 ? (
                <section className="oma-campaign-panel">
                  <h2>{t('demo.campaign.needsAttention')}</h2>
                  <div className="oma-req-table-wrap oma-campaign-table">
                    <table className="oma-req-table oma-task-table">
                      <thead>
                        <tr>
                          <th>{t('demo.campaign.content')}</th>
                          <th>{t('demo.tasks.filter.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {needsAttention.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <Link
                                href={`/app/content?item=${item.id}&campaign=${campaign.id}`}
                                className="oma-task-title-btn"
                              >
                                <span className="oma-task-title-text">
                                  {pickCopy(item.title, locale)}
                                </span>
                              </Link>
                            </td>
                            <td>
                              <StatusChip
                                status={item.status}
                                label={statusLabel(item.status, locale)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {tab === 'content' ? (
            content.length === 0 ? (
              <EmptyState
                title={t('demo.empty')}
                action={
                  <OmaLinkButton href={`/app/content?campaign=${campaign.id}`} type="primary">
                    {t('demo.content.create')}
                  </OmaLinkButton>
                }
              />
            ) : (
              <div className="oma-req-table-wrap oma-campaign-table" data-testid="demo-campaign-content-tab">
                <table className="oma-req-table oma-task-table">
                  <thead>
                    <tr>
                      <th>{t('demo.campaign.content')}</th>
                      <th>{t('demo.campaign.channels')}</th>
                      <th>{t('demo.tasks.filter.assignee')}</th>
                      <th>{t('demo.campaigns.col.dates')}</th>
                      <th>{t('demo.tasks.filter.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.map((item) => (
                      <tr key={item.id}>
                        <td className="oma-task-title-cell">
                          <Link
                            href={`/app/content?item=${item.id}&campaign=${campaign.id}`}
                            className="oma-task-title-btn"
                            data-testid={`demo-campaign-content-${item.id}`}
                          >
                            <MediaSurface
                              src={item.previewAsset}
                              alt={mediaAlt(
                                pickCopy(item.title, locale),
                                item.channel,
                                item.contentType,
                              )}
                              className="oma-content-list-thumb"
                            />
                            <span className="oma-task-title-text">
                              {pickCopy(item.title, locale)}
                            </span>
                          </Link>
                        </td>
                        <td>{item.channel}</td>
                        <td>{item.assignee || '—'}</td>
                        <td className="oma-ltr oma-task-due-cell">
                          <span className="oma-task-due-text">
                            {item.scheduledAt?.slice(0, 10) ?? '—'}
                          </span>
                        </td>
                        <td>
                          <StatusChip
                            status={item.status}
                            label={statusLabel(item.status, locale)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {tab === 'tasks' ? (
            tasks.length === 0 ? (
              <EmptyState title={t('demo.empty')} />
            ) : (
              <div className="oma-req-table-wrap oma-campaign-table">
                <table className="oma-req-table oma-task-table">
                  <thead>
                    <tr>
                      <th>{t('demo.tasks.col.title') || 'Task'}</th>
                      <th>{t('demo.tasks.filter.status')}</th>
                      <th>{t('demo.tasks.filter.assignee')}</th>
                      <th>{t('demo.tasks.filter.priority')}</th>
                      <th>{t('demo.requests.col.due')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id}>
                        <td className="oma-task-title-cell">
                          <Link href={`/app/tasks?task=${task.id}`} className="oma-task-title-btn">
                            <span className="oma-task-title-text">
                              {pickCopy(task.title, locale)}
                            </span>
                          </Link>
                        </td>
                        <td>
                          <StatusChip status={task.status} />
                        </td>
                        <td>{task.assignee || '—'}</td>
                        <td>
                          <StatusChip status={task.priority} />
                        </td>
                        <td className="oma-ltr oma-task-due-cell">
                          <span className="oma-task-due-text">{task.dueAt || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {tab === 'deliverables' ? (
            deliverables.length === 0 ? (
              <EmptyState title={t('demo.empty')} />
            ) : (
              <div className="oma-req-table-wrap oma-campaign-table">
                <table className="oma-req-table oma-task-table">
                  <thead>
                    <tr>
                      <th>{t('demo.campaign.deliverables')}</th>
                      <th>{t('demo.filter.status')}</th>
                      <th>{t('demo.campaigns.col.owner')}</th>
                      <th>{t('demo.requests.col.due')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliverables.map((item) => (
                      <tr key={item.id}>
                        <td className="oma-task-title-cell">
                          <Link
                            href={`/app/deliverables/${item.id}`}
                            className="oma-task-title-btn"
                          >
                            <span>
                              <span className="oma-task-title-text">
                                {pickCopy(item.title, locale)}
                              </span>
                              <span className="oma-task-title-meta">{item.type}</span>
                            </span>
                          </Link>
                        </td>
                        <td>
                          <StatusChip status={item.reviewStatus} />
                        </td>
                        <td>{item.owner || '—'}</td>
                        <td className="oma-ltr oma-task-due-cell">
                          <span className="oma-task-due-text">{item.dueAt || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {tab === 'activity' ? (
            activity.length === 0 ? (
              <EmptyState title={t('demo.empty')} />
            ) : (
              <div className="oma-req-table-wrap oma-campaign-table">
                <table className="oma-req-table oma-task-table">
                  <thead>
                    <tr>
                      <th>{t('demo.campaign.activity')}</th>
                      <th>{t('demo.campaigns.col.dates')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((item) => (
                      <tr key={item.id}>
                        <td>{pickCopy(item.summary, locale)}</td>
                        <td className="oma-ltr oma-task-due-cell">
                          <span className="oma-task-due-text">{item.at}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </>
      ) : null}

      <Dialog open={editOpen} title={t('demo.campaign.edit')} onClose={() => setEditOpen(false)}>
        <div className="oma-stack" style={{ gap: 12 }}>
          <label>
            {t('demo.create.name') || 'Name'}
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.campaign.objective')}
            <TextArea
              value={editForm.objective}
              onChange={(e) => setEditForm((f) => ({ ...f, objective: e.target.value }))}
              rows={3}
            />
          </label>
          <label>
            {t('demo.campaign.audience')}
            <TextArea
              value={editForm.audience}
              onChange={(e) => setEditForm((f) => ({ ...f, audience: e.target.value }))}
              rows={2}
            />
          </label>
          <label>
            {t('demo.campaign.channels')}
            <Input
              value={editForm.channels}
              onChange={(e) => setEditForm((f) => ({ ...f, channels: e.target.value }))}
              placeholder="instagram, tiktok"
            />
          </label>
          <div className="oma-chip-row">
            <label>
              {t('demo.campaign.timeline')}
              <DateField
                value={editForm.start}
                onChange={(e) => setEditForm((f) => ({ ...f, start: e.target.value }))}
              />
            </label>
            <label>
              →
              <DateField
                value={editForm.end}
                onChange={(e) => setEditForm((f) => ({ ...f, end: e.target.value }))}
              />
            </label>
          </div>
          <label>
            Track
            <SelectField
              value={editForm.track}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, track: e.target.value as 'ORGANIC' | 'PAID' }))
              }
            >
              <option value="ORGANIC">{t('demo.organic')}</option>
              <option value="PAID">{t('demo.paid')}</option>
            </SelectField>
          </label>
          <label>
            {t('demo.filter.status')}
            <SelectField
              value={editForm.status}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
            >
              {['DRAFT', 'UPCOMING', 'ACTIVE', 'IN_REVIEW', 'NEEDS_ATTENTION', 'COMPLETED'].map(
                (s) => (
                  <option key={s} value={s}>
                    {statusLabel(s, locale)}
                  </option>
                ),
              )}
            </SelectField>
          </label>
          <div className="oma-chip-row">
            <Button type="default" onClick={() => setEditOpen(false)} disabled={saving}>
              {t('demo.create.cancel')}
            </Button>
            <Button
              type="primary"
              disabled={saving || !editForm.name.trim()}
              onClick={() => {
                void (async () => {
                  if (!campaignId) return;
                  setSaving(true);
                  try {
                    const updated = await updateCampaignProduction(campaignId, {
                      name: { en: editForm.name.trim(), ar: editForm.name.trim() },
                      objective: {
                        en: editForm.objective.trim(),
                        ar: editForm.objective.trim(),
                      },
                      audience: {
                        en: editForm.audience.trim(),
                        ar: editForm.audience.trim(),
                      },
                      channels: editForm.channels
                        .split(',')
                        .map((c) => c.trim())
                        .filter(Boolean),
                      track: editForm.track,
                      timelineStart: editForm.start,
                      timelineEnd: editForm.end,
                      status: editForm.status,
                    });
                    setCampaign(toCampaignRow(updated));
                    setEditOpen(false);
                    toast.push(
                      locale.toLowerCase().startsWith('ar') ? 'تم حفظ الحملة' : 'Campaign saved',
                      'success',
                    );
                  } catch (err) {
                    toast.push(apiErrorMessage(err, 'Save failed'), 'danger');
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
            >
              {saving ? '…' : t('demo.content.saved') || 'Save'}
            </Button>
            <Button
              type="default"
              disabled={saving}
              onClick={() => {
                void (async () => {
                  if (!campaignId) return;
                  setSaving(true);
                  try {
                    await archiveCampaignProduction(campaignId);
                    toast.push(
                      locale.toLowerCase().startsWith('ar') ? 'تمت الأرشفة' : 'Archived',
                      'success',
                    );
                    setEditOpen(false);
                    router.push('/app/campaigns');
                  } catch (err) {
                    toast.push(apiErrorMessage(err, 'Archive failed'), 'danger');
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
            >
              Archive
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={confirmClose}
        title={t('demo.create.cancel')}
        onClose={() => setConfirmClose(false)}
      >
        <p>{t('demo.content.unsaved')}</p>
        <div className="oma-chip-row">
          <Button type="default" onClick={() => setConfirmClose(false)}>
            {t('demo.create.cancel')}
          </Button>
          <Button
            type="primary"
            onClick={() => {
              setConfirmClose(false);
              router.push('/app/campaigns');
            }}
          >
            OK
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
