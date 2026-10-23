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
  const [unavailable, setUnavailable] = useState(false);
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
        setTasks([]);
        setDeliverables([]);
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
        setError(apiErrorMessage(err, locale.toLowerCase().startsWith('ar') ? 'تعذّر تحميل الحملة' : 'Failed to load campaign'));
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

          <div className="oma-ws-tabs oma-workspace-tabs" role="tablist" aria-label="Campaign workspace">
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
