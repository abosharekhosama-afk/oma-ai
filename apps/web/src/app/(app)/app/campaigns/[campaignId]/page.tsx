'use client';
import { OmaLinkButton } from '../../../../../components/ui/oma-link-button';
import { Button } from '@oma/ui/controls';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../../components/demo/demo-disclosure';
import { TrackPill } from '../../../../../components/demo/track-pill';
import { EmptyState, ErrorState, DeniedState } from '../../../../../components/ui/empty-state';
import { PageHeader, Panel } from '../../../../../components/ui/page-header';
import { StatusChip } from '../../../../../components/ui/status-chip';
import { Dialog } from '../../../../../components/ui/dialog';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../../lib/demo/use-demo-api';
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
        setBrand(graph.brands.find((b) => b.id === row?.brandId) ?? null);
        setStrategy(graph.strategies.find((s) => s.id === row?.strategyId) ?? null);
        setContent(graph.contentItems.filter((c) => c.campaignId === campaignId));
        setTasks(graph.tasks.filter((task) => task.campaignId === campaignId).slice(0, 6));
        setDeliverables(graph.deliverables.filter((d) => d.campaignId === campaignId));
        const scoped = graph.activity.filter((a) => a.campaignId === campaignId);
        setActivity((scoped.length ? scoped : graph.activity).slice(0, 8));
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
                {strategy ? (
                  <Link
                    href={strategyHref(campaign.brandId, campaign.strategyId)}
                    className="oma-text-link"
                    data-testid="demo-campaign-strategy-link"
                  >
                    {pickCopy(strategy.name, locale)}
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

      <DemoDisclosure />

      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <DeniedState title={t('demo.unavailable')} /> : null}
      {error ? <ErrorState title={error} /> : null}

      {campaign ? (
        <>
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
              <Button
                type="default"
                role="tab"
                aria-selected={tab === id}
                data-testid={`demo-campaign-tab-${id}`}
                onClick={() => setTab(id)}
                className="oma-workspace-tab"
              >
                {label}
              </Button>
            ))}
          </div>

          {tab === 'overview' ? (
            <div className="oma-workboard-split">
              <div className="oma-workboard-primary">
                <Panel title={t('demo.campaign.goal')}>
                  <div className="oma-status-rows">
                    <div>
                      <span className="oma-status-label">{t('demo.campaign.objective')}</span>
                      <span>{pickCopy(campaign.objective, locale)}</span>
                    </div>
                    <div>
                      <span className="oma-status-label">{t('demo.campaign.audience')}</span>
                      <span>{pickCopy(campaign.audience, locale)}</span>
                    </div>
                    <div>
                      <span className="oma-status-label">{t('demo.campaign.channels')}</span>
                      <span>{campaign.channels.join(' · ')}</span>
                    </div>
                    <div>
                      <span className="oma-status-label">{t('demo.campaign.timeline')}</span>
                      <span className="oma-ltr">
                        {campaign.timeline.start} → {campaign.timeline.end}
                      </span>
                    </div>
                    <div>
                      <span className="oma-status-label">{t('demo.campaign.budget')}</span>
                      <span>
                        {t('demo.planningOnly')}
                        {campaign.budget.amount > 0
                          ? ` — ${campaign.budget.currency} ${campaign.budget.amount.toLocaleString()}`
                          : ''}
                      </span>
                    </div>
                    <div>
                      <span className="oma-status-label">{t('demo.campaign.scheduleReady')}</span>
                      <span>{t(`demo.campaign.scheduleReady.${ready}`)}</span>
                    </div>
                  </div>
                  <Link
                    href={strategyHref(campaign.brandId, campaign.strategyId)}
                    className="oma-text-link"
                  >
                    {t('demo.campaign.openStrategy')}
                  </Link>
                </Panel>
                <Panel title={t('demo.campaign.kpis')}>
                  <div className="oma-status-rows">
                    {campaign.kpis.map((kpi, i) => (
                      <div key={i}>
                        <span className="oma-status-label">{pickCopy(kpi.name, locale)}</span>
                        <span>
                          {kpi.target} · {Math.round(kpi.progress * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel title={t('demo.campaign.milestones')}>
                  <div className="oma-status-rows">
                    <div>
                      <span className="oma-status-label">{t('demo.filter.status')}</span>
                      <StatusChip
                        status={campaign.status}
                        label={statusLabel(campaign.status, locale)}
                      />
                    </div>
                    <div>
                      <span className="oma-status-label">{t('demo.campaigns.col.next')}</span>
                      <span>{campaignNextAction(campaign, content, locale)}</span>
                    </div>
                  </div>
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
                    <ul className="oma-dense-list">
                      {needsAttention.map((item) => (
                        <li key={item.id}>
                          <Link href={`/app/content?item=${item.id}`} className="oma-work-row">
                            <span>
                              <strong>{pickCopy(item.title, locale)}</strong>
                              <StatusChip
                                status={item.status}
                                label={statusLabel(item.status, locale)}
                              />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
                <Panel title={t('demo.campaign.pipeline')}>
                  <div className="oma-status-rows">
                    {Object.entries(pipeline).map(([status, count]) => (
                      <div key={status}>
                        <span className="oma-status-label">{statusLabel(status, locale)}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                    <div>
                      <span className="oma-status-label">{t('demo.campaigns.col.review')}</span>
                      <span>{statusLabel(review, locale)}</span>
                    </div>
                  </div>
                  <ul className="oma-dense-list">
                    {content.slice(0, 5).map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/app/content?item=${item.id}&campaign=${campaign.id}`}
                          className="oma-work-row"
                          data-testid={`demo-campaign-content-${item.id}`}
                        >
                          <span className="oma-chip-row">
                            <img
                              src={item.previewAsset}
                              alt={mediaAlt(
                                pickCopy(item.title, locale),
                                item.channel,
                                item.contentType,
                              )}
                              width={32}
                              height={32}
                              className="oma-content-list-thumb"
                            />
                            <strong>{pickCopy(item.title, locale)}</strong>
                          </span>
                          <StatusChip
                            status={item.status}
                            label={statusLabel(item.status, locale)}
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link href={`/app/content?campaign=${campaign.id}`} className="oma-text-link">
                    {t('demo.content.title')}
                  </Link>
                </Panel>
                <Panel title={t('demo.campaign.team')}>
                  <p className="oma-muted" style={{ margin: 0 }}>
                    {team.filter(Boolean).join(' · ')}
                  </p>
                </Panel>
                <Panel title={t('demo.campaign.activity')}>
                  <ul className="oma-dense-list">
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
                <EmptyState
                  title={t('demo.empty')}
                  action={
                    <OmaLinkButton href={`/app/content?campaign=${campaign.id}`} type="primary">
                      {t('demo.content.create')}
                    </OmaLinkButton>
                  }
                />
              ) : (
                <ul className="oma-dense-list" data-testid="demo-campaign-content-tab">
                  {content.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/app/content?item=${item.id}&campaign=${campaign.id}`}
                        className="oma-work-row"
                        data-testid={`demo-campaign-content-${item.id}`}
                      >
                        <span className="oma-chip-row">
                          <img
                            src={item.previewAsset}
                            alt={mediaAlt(
                              pickCopy(item.title, locale),
                              item.channel,
                              item.contentType,
                            )}
                            width={32}
                            height={32}
                            className="oma-content-list-thumb"
                          />
                          <strong>{pickCopy(item.title, locale)}</strong>
                        </span>
                        <span className="oma-muted">
                          {item.assignee} · {item.scheduledAt?.slice(0, 10) ?? '—'}
                        </span>
                        <StatusChip status={item.status} label={statusLabel(item.status, locale)} />
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
                <ul className="oma-dense-list">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <Link href="/app/tasks" className="oma-work-row">
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
                <ul className="oma-dense-list">
                  {deliverables.map((d) => (
                    <li key={d.id}>
                      <Link href={`/app/deliverables/${d.id}`} className="oma-work-row">
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
              <ul className="oma-dense-list">
                {activity.map((a) => (
                  <li key={a.id}>
                    <div className="oma-work-row">
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
        <Button type="default" onClick={() => setEditOpen(false)}>
          {t('demo.create.cancel')}
        </Button>
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
