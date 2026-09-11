'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../../components/demo/demo-disclosure';
import { EmptyState } from '../../../../../components/ui/empty-state';
import { PageHeader, Panel } from '../../../../../components/ui/page-header';
import { StatusChip } from '../../../../../components/ui/status-chip';
import { Dialog } from '../../../../../components/ui/dialog';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../../lib/demo/use-demo-api';
import { strategyHref } from '../../../../../lib/demo/stage3-campaigns';
import { statusLabel } from '../../../../../lib/demo/stage3-content';
import { useLocale, useT } from '../../../../../lib/use-locale';

type Campaign = DemoGraph['campaigns'][number];
type ContentItem = DemoGraph['contentItems'][number];
type Strategy = DemoGraph['strategies'][number];
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
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    (async () => {
      try {
        const graph = await demoApi<DemoGraph>('/graph');
        if (cancelled) return;
        const row = graph.campaigns.find((c) => c.id === campaignId) ?? null;
        setCampaign(row);
        setStrategy(graph.strategies.find((s) => s.id === row?.strategyId) ?? null);
        setContent(graph.contentItems.filter((c) => c.campaignId === campaignId));
        setTasks(graph.tasks.slice(0, 6));
        setDeliverables(graph.deliverables.filter((d) => d.campaignId === campaignId));
        setActivity(graph.activity.slice(0, 8));
        setError(null);
        if (!row) setError('Not found');
      } catch (err) {
        if (cancelled) return;
        if (isDemoForbidden(err)) setUnavailable(true);
        else setError(demoErrorMessage(err, 'Demo unavailable'));
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
          (c.scheduledAt && c.scheduledAt < '2026-09-10' && c.status !== 'PUBLISHED_DEMO'),
      ),
    [content],
  );

  const stages = ['Draft', 'Active', 'In review', 'Scheduled', 'Complete'];
  const stageIndex =
    campaign?.status === 'DRAFT'
      ? 0
      : campaign?.status === 'ACTIVE' || campaign?.status === 'NEEDS_ATTENTION'
        ? 1
        : campaign?.status === 'IN_REVIEW' || campaign?.status === 'UPCOMING'
          ? 2
          : campaign?.status === 'COMPLETED'
            ? 4
            : 3;

  return (
    <div className="oma-stack" data-testid="demo-campaign-detail">
      <div className="oma-breadcrumb" aria-label="Breadcrumb">
        <Link href="/app">{t('nav.home')}</Link>
        <span aria-hidden="true">/</span>
        <Link href="/app/campaigns">{t('demo.campaigns.back')}</Link>
        <span aria-hidden="true">/</span>
        <span>{campaign ? pickCopy(campaign.name, locale) : '…'}</span>
      </div>

      <PageHeader
        title={campaign ? pickCopy(campaign.name, locale) : t('demo.campaigns.title')}
        description={campaign ? pickCopy(campaign.objective, locale) : undefined}
        meta={
          campaign ? (
            <>
              <StatusChip status={campaign.status} label={statusLabel(campaign.status, locale)} />
              <span
                className={`oma-badge ${campaign.track === 'ORGANIC' ? 'oma-track-organic' : 'oma-track-paid'}`}
              >
                {campaign.track === 'ORGANIC' ? t('demo.organic') : t('demo.paid')}
              </span>
              <span className="oma-muted">{campaign.owner}</span>
              <span className="oma-muted oma-ltr">
                {campaign.timeline.start} → {campaign.timeline.end}
              </span>
              {strategy ? (
                <Link
                  href={strategyHref(campaign.brandId, campaign.strategyId)}
                  className="oma-text-link"
                  data-testid="demo-campaign-strategy-link"
                >
                  {pickCopy(strategy.name, locale)}
                </Link>
              ) : null}
            </>
          ) : null
        }
        actions={
          <>
            <button
              type="button"
              className="oma-btn oma-btn-secondary"
              onClick={() => setEditOpen(true)}
            >
              {t('demo.campaign.edit')}
            </button>
            <button
              type="button"
              className="oma-btn oma-btn-secondary"
              aria-haspopup="menu"
              onClick={() => setConfirmClose(true)}
            >
              ⋯
            </button>
          </>
        }
      />

      <DemoDisclosure />

      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <EmptyState title={t('demo.unavailable')} /> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {campaign ? (
        <>
          <div className="oma-stage-trail" aria-label={t('demo.campaign.milestones')}>
            {stages.map((label, i) => (
              <span key={label} className="oma-stage-trail-item" data-active={i === stageIndex}>
                {label}
              </span>
            ))}
          </div>

          {campaign.track === 'PAID' ? (
            <div className="oma-honesty-banner" data-testid="demo-paid-planning-only">
              {t('demo.planningOnly')} — {t('demo.campaign.externalNotConnected')}
            </div>
          ) : null}

          <p className="oma-ltr oma-muted" data-testid="demo-strategy-id">
            {campaign.strategyId}
          </p>

          <div className="oma-workspace-tabs" role="tablist" aria-label="Campaign workspace">
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
                className="oma-workspace-tab"
                aria-selected={tab === id}
                data-testid={`demo-campaign-tab-${id}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'overview' ? (
            <div className="oma-workboard-split">
              <div className="oma-workboard-primary">
                <Panel title={t('demo.campaign.goal')}>
                  <p style={{ marginTop: 0 }}>{pickCopy(campaign.objective, locale)}</p>
                  <h3>{t('demo.campaign.audience')}</h3>
                  <p>{pickCopy(campaign.audience, locale)}</p>
                  <h3>{t('demo.campaign.channels')}</h3>
                  <p>{campaign.channels.join(' · ')}</p>
                  <h3>{t('demo.campaign.budget')}</h3>
                  <p>
                    {t('demo.planningOnly')}
                    {campaign.budget.amount > 0
                      ? ` — ${campaign.budget.currency} ${campaign.budget.amount.toLocaleString()}`
                      : null}
                  </p>
                  <Link
                    href={strategyHref(campaign.brandId, campaign.strategyId)}
                    className="oma-text-link"
                  >
                    {t('demo.campaign.openStrategy')}
                  </Link>
                </Panel>
                <Panel title={t('demo.campaign.kpis')}>
                  <ul className="oma-stack">
                    {campaign.kpis.map((kpi, i) => (
                      <li key={i}>
                        <div className="oma-section-head">
                          <strong>{pickCopy(kpi.name, locale)}</strong>
                          <span className="oma-muted">{kpi.target}</span>
                        </div>
                        <div className="oma-progress-track" aria-hidden="true">
                          <div
                            className="oma-progress-fill"
                            style={{ width: `${Math.round(kpi.progress * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
              <div className="oma-workboard-side">
                <Panel
                  title={t('demo.campaign.needsAttention')}
                  priority={needsAttention.length > 0}
                >
                  {needsAttention.length === 0 ? (
                    <p className="oma-muted">{t('demo.empty')}</p>
                  ) : (
                    <ul className="oma-compact-list">
                      {needsAttention.map((item) => (
                        <li key={item.id}>
                          <Link href={`/app/content?item=${item.id}`} className="oma-compact-row">
                            <strong>{pickCopy(item.title, locale)}</strong>
                            <StatusChip
                              status={item.status}
                              label={statusLabel(item.status, locale)}
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
                <Panel title={t('demo.campaign.content')}>
                  <ul className="oma-compact-list">
                    {content.slice(0, 5).map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/app/content?item=${item.id}&campaign=${campaign.id}`}
                          className="oma-compact-row"
                          data-testid={`demo-campaign-content-${item.id}`}
                        >
                          <span className="oma-chip-row">
                            <img
                              src={item.previewAsset}
                              alt=""
                              width={32}
                              height={32}
                              style={{ borderRadius: 4, objectFit: 'cover' }}
                            />
                            <strong>{pickCopy(item.title, locale)}</strong>
                          </span>
                          <StatusChip status={item.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link href={`/app/content?campaign=${campaign.id}`} className="oma-text-link">
                    {t('demo.content.title')} →
                  </Link>
                </Panel>
                <Panel title={t('demo.campaign.activity')}>
                  <ul className="oma-compact-list">
                    {activity.map((a) => (
                      <li key={a.id} className="oma-muted">
                        {pickCopy(a.summary, locale)}
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </div>
          ) : null}

          {tab === 'content' ? (
            <Panel title={t('demo.campaign.content')}>
              {content.length === 0 ? (
                <p className="oma-muted">{t('demo.empty')}</p>
              ) : (
                <ul className="oma-compact-list">
                  {content.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/app/content?item=${item.id}&campaign=${campaign.id}`}
                        className="oma-compact-row"
                      >
                        <strong>{pickCopy(item.title, locale)}</strong>
                        <span className="oma-muted">
                          {item.assignee} · {item.scheduledAt?.slice(0, 10) ?? '—'}
                        </span>
                        <StatusChip status={item.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}

          {tab === 'tasks' ? (
            <Panel title={t('demo.campaign.tasks')} description={t('demo.campaign.tabLater')}>
              {tasks.length === 0 ? (
                <p className="oma-muted">{t('demo.empty')}</p>
              ) : (
                <ul className="oma-compact-list">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <Link href="/app/tasks" className="oma-compact-row">
                        <strong>{pickCopy(task.title, locale)}</strong>
                        <StatusChip status={task.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}

          {tab === 'deliverables' ? (
            <Panel
              title={t('demo.campaign.deliverables')}
              description={t('demo.campaign.tabLater')}
            >
              {deliverables.length === 0 ? (
                <p className="oma-muted">{t('demo.empty')}</p>
              ) : (
                <ul className="oma-compact-list">
                  {deliverables.map((d) => (
                    <li key={d.id}>
                      <Link href={`/app/deliverables/${d.id}`} className="oma-compact-row">
                        <strong>{pickCopy(d.title, locale)}</strong>
                        <StatusChip status={d.reviewStatus} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}

          {tab === 'activity' ? (
            <Panel title={t('demo.campaign.activity')}>
              <ul className="oma-compact-list">
                {activity.map((a) => (
                  <li key={a.id}>
                    <div className="oma-compact-row">
                      <strong>{pickCopy(a.summary, locale)}</strong>
                      <span className="oma-muted oma-ltr">{a.at}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </>
      ) : null}

      <Dialog open={editOpen} title={t('demo.campaign.edit')} onClose={() => setEditOpen(false)}>
        <p className="oma-muted">{t('demo.campaign.tabLater')}</p>
        <p className="oma-honesty-banner">{t('demo.planningOnly')}</p>
        <button
          type="button"
          className="oma-btn oma-btn-secondary"
          onClick={() => setEditOpen(false)}
        >
          {t('demo.create.cancel')}
        </button>
      </Dialog>

      <Dialog
        open={confirmClose}
        title={t('demo.create.cancel')}
        onClose={() => setConfirmClose(false)}
      >
        <p>{t('demo.content.unsaved')}</p>
        <div className="oma-chip-row">
          <button
            type="button"
            className="oma-btn oma-btn-secondary"
            onClick={() => setConfirmClose(false)}
          >
            {t('demo.create.cancel')}
          </button>
          <button
            type="button"
            className="oma-btn oma-btn-primary"
            onClick={() => {
              setConfirmClose(false);
              router.push('/app/campaigns');
            }}
          >
            OK
          </button>
        </div>
      </Dialog>
    </div>
  );
}
