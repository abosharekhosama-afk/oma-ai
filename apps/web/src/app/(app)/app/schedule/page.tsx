'use client';
import { Button, DateField, Input, SelectField, SurfaceButton } from '@oma/ui/controls';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApprovalPolicy, DemoGraph } from '@oma/demo';
import { resolveContentWorkflow } from '@oma/demo';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { Dialog } from '../../../../components/ui/dialog';
import { Drawer } from '../../../../components/ui/drawer';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatusMark } from '../../../../components/content/content-card';
import { useToast } from '../../../../components/ui/toast';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import {
  EMPTY_SCHEDULE_FILTERS,
  activeScheduleFilterCount,
  bucketForScheduleRow,
  displayForScheduleBucket,
  filterSchedule,
  groupScheduleByDay,
  hasIntegrationBlocker,
  internalReady,
  isValidPlannedAt,
  readinessScore,
  scheduleDayKey,
  shiftWeek,
  weekDays,
  type ScheduleFilters,
  type ScheduleRow,
  type ScheduleView,
} from '../../../../lib/demo/stage6-schedule';
import { useLocale, useT } from '../../../../lib/use-locale';

export default function SchedulePage() {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [campaigns, setCampaigns] = useState<DemoGraph['campaigns']>([]);
  const [contents, setContents] = useState<DemoGraph['contentItems']>([]);
  const [policy, setPolicy] = useState<ApprovalPolicy>('OPTIONAL');
  const [filters, setFilters] = useState<ScheduleFilters>(EMPTY_SCHEDULE_FILTERS);
  const [view, setView] = useState<ScheduleView>('calendar');
  const [anchor, setAnchor] = useState('2026-09-11');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [plannedAtDraft, setPlannedAtDraft] = useState('');
  const [channelDraft, setChannelDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [posts, graph] = await Promise.all([
        demoApi<ScheduleRow[]>('/schedule'),
        demoApi<DemoGraph>('/graph').catch(() => null),
      ]);
      setRows(posts);
      if (graph) {
        setCampaigns(graph.campaigns);
        setContents(graph.contentItems);
        setPolicy(graph.demoPreferences.approvalPolicy);
      }
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (isDemoForbidden(err)) setUnavailable(true);
      else setError(demoErrorMessage(err, 'Demo unavailable'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => filterSchedule(rows, filters, locale), [rows, filters, locale]);
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const byDay = useMemo(() => groupScheduleByDay(filtered), [filtered]);
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const selectedContent = contents.find((item) => item.id === selected?.contentId) ?? null;
  const selectedWorkflow = selectedContent ? resolveContentWorkflow(selectedContent, policy) : null;
  const scheduleBlocked =
    selected?.state === 'BLOCKED' || Boolean(selectedWorkflow?.scheduleBlocked);
  const filterCount = activeScheduleFilterCount(filters);
  const channels = useMemo(
    () => [...new Set(rows.flatMap((r) => r.channels).filter(Boolean))],
    [rows],
  );
  const owners = useMemo(() => [...new Set(rows.map((r) => r.owner))], [rows]);

  // Mobile defaults to agenda via CSS/test; avoid remount thrash from matchMedia.

  async function saveReschedule() {
    if (!selected) return;
    if (!isValidPlannedAt(plannedAtDraft)) {
      toast.push(t('demo.schedule.invalidDate'), 'danger');
      return;
    }
    const channels = channelDraft
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      const updated = await demoApi<ScheduleRow>(`/schedule/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          plannedAt:
            plannedAtDraft.length === 16
              ? `${plannedAtDraft}:00+03:00`
              : plannedAtDraft.includes('+')
                ? plannedAtDraft
                : `${plannedAtDraft}+03:00`,
          channels: channels.length ? channels : selected.channels,
        }),
      });
      setRows((list) => list.map((r) => (r.id === updated.id ? updated : r)));
      setRescheduleOpen(false);
      toast.push(t('demo.schedule.saved'), 'success');
    } catch (err) {
      toast.push(demoErrorMessage(err, 'Demo unavailable'), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function setScheduleState(state: ScheduleRow['state']) {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await demoApi<ScheduleRow>(`/schedule/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ state }),
      });
      setRows((list) => list.map((r) => (r.id === updated.id ? updated : r)));
      toast.push(t('demo.schedule.saved'), 'success');
    } catch (err) {
      toast.push(demoErrorMessage(err, 'Demo unavailable'), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected) return;
    setSaving(true);
    try {
      await demoApi(`/schedule/${selected.id}`, { method: 'DELETE', body: '{}' });
      setRows((list) => list.filter((r) => r.id !== selected.id));
      setSelectedId(null);
      toast.push(t('demo.schedule.removed'), 'success');
    } catch (err) {
      toast.push(demoErrorMessage(err, 'Demo unavailable'), 'danger');
    } finally {
      setSaving(false);
    }
  }

  function openItem(id: string) {
    const row = rows.find((r) => r.id === id);
    setSelectedId(id);
    if (row) {
      setPlannedAtDraft(row.plannedAt.slice(0, 16));
      setChannelDraft(row.channels.join(', '));
    }
  }

  return (
    <div className="oma-stack" data-testid="demo-schedule">
      <PageHeader
        title={t('demo.schedule.title')}
        description={t('demo.schedule.subtitle')}
        meta={
          <span className="oma-muted" data-testid="demo-schedule-tz">
            {t('demo.schedule.timezone')}: Asia/Dubai
          </span>
        }
      />
      <DemoDisclosure message={t('demo.schedule.honesty')} />
      <p className="oma-honesty-inline">{t('demo.schedule.planningPreview')}</p>

      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {!loading && !unavailable && !error ? (
        <>
          <div className="oma-stage5-tabs" role="tablist" data-testid="demo-schedule-views">
            {(['calendar', 'agenda', 'queue'] as ScheduleView[]).map((v) => (
              <Button
                type={view === v ? 'primary' : 'default'}
                aria-pressed={view === v}
                data-testid={`demo-schedule-view-${v}`}
                onClick={() => setView(v)}
              >
                {t(`demo.schedule.view.${v}`)}
              </Button>
            ))}
          </div>

          <div className="oma-chip-row">
            <Button
              type="default"
              data-testid="demo-schedule-prev"
              onClick={() => setAnchor((a) => shiftWeek(a, -1))}
            >
              {t('demo.schedule.prev')}
            </Button>
            <Button
              type="default"
              data-testid="demo-schedule-today"
              onClick={() => setAnchor('2026-09-11')}
            >
              {t('demo.schedule.today')}
            </Button>
            <Button
              type="default"
              data-testid="demo-schedule-next"
              onClick={() => setAnchor((a) => shiftWeek(a, 1))}
            >
              {t('demo.schedule.next')}
            </Button>
            <span className="oma-muted" data-testid="demo-schedule-range">
              {days[0]} → {days[6]}
            </span>
          </div>

          <div className="oma-stage5-toolbar" data-testid="demo-schedule-filters">
            <label className="oma-stage5-search">
              {t('demo.schedule.search')}
              <Input
                value={filters.q}
                data-testid="demo-schedule-search"
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              />
            </label>
            <label>
              {t('demo.schedule.filter.channel')}
              <SelectField
                value={filters.channel}
                data-testid="demo-schedule-filter-channel"
                onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {channels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              {t('demo.schedule.filter.readiness')}
              <SelectField
                value={filters.readiness}
                data-testid="demo-schedule-filter-readiness"
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    readiness: e.target.value as ScheduleFilters['readiness'],
                  }))
                }
              >
                <option value="all">{t('demo.filter.all')}</option>
                <option value="ready">{t('demo.schedule.ready')}</option>
                <option value="blocked">{t('demo.schedule.blocked')}</option>
                <option value="integration">{t('demo.schedule.integrationBlock')}</option>
              </SelectField>
            </label>
            <label>
              {t('demo.schedule.filter.campaign')}
              <SelectField
                value={filters.campaignId}
                onChange={(e) => setFilters((f) => ({ ...f, campaignId: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {pickCopy(c.name, locale)}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              {t('demo.schedule.filter.owner')}
              <SelectField
                value={filters.owner}
                onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {owners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </SelectField>
            </label>
            {filterCount > 0 ? (
              <Button
                type="default"
                data-testid="demo-schedule-clear"
                onClick={() => setFilters(EMPTY_SCHEDULE_FILTERS)}
              >
                {t('demo.requests.clearFilters')} ({filterCount})
              </Button>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <EmptyState title={t('demo.empty')} body={t('demo.schedule.emptyHint')} />
          ) : null}

          <section data-testid="demo-schedule-saved" className="oma-stack">
            <h2>{t('demo.content.savedColumn')}</h2>
            {contents
              .filter((item) => resolveContentWorkflow(item, policy).plannedAt == null)
              .map((item) => (
                <Link key={item.id} href={`/app/content?item=${item.id}`} className="oma-text-link">
                  {pickCopy(item.title, locale)}
                </Link>
              ))}
          </section>

          {view === 'calendar' ? (
            <div className="oma-sched-week" data-testid="demo-schedule-calendar">
              {days.map((day) => (
                <div
                  key={day}
                  className="oma-sched-day"
                  data-today={day === '2026-09-11' ? 'true' : 'false'}
                  data-testid={`demo-sched-day-${day}`}
                >
                  <div className="oma-sched-day-label">{day}</div>
                  {(byDay.get(day) ?? []).map((post) => (
                    <SurfaceButton
                      key={post.id}
                      data-state={post.state}
                      data-testid={`demo-sched-item-${post.id}`}
                      onClick={() => openItem(post.id)}
                      className="oma-sched-pill"
                    >
                      <strong>{pickCopy(post.title, locale)}</strong>
                      <span>{post.channels.join(', ') || '—'}</span>
                      <StatusMark
                        display={displayForScheduleBucket(bucketForScheduleRow(post))}
                        locale={locale}
                      />
                      <span data-testid={`demo-sched-bucket-${post.id}`}>
                        {t(`demo.schedule.bucket.${bucketForScheduleRow(post)}`)}
                      </span>
                    </SurfaceButton>
                  ))}
                </div>
              ))}
            </div>
          ) : null}

          {(view === 'agenda' || view === 'queue') && (
            <div
              className={view === 'agenda' ? 'oma-sched-agenda' : 'oma-sched-queue'}
              data-testid={`demo-schedule-${view}`}
            >
              {filtered.map((post) => {
                const score = readinessScore(post);
                return (
                  <article
                    key={post.id}
                    className="oma-sched-card"
                    data-testid={`demo-sched-card-${post.id}`}
                  >
                    <div className="oma-sched-card-head">
                      <div>
                        <strong>{pickCopy(post.title, locale)}</strong>
                        <p className="oma-muted">
                          {post.plannedAt} · {post.timezone} · {post.channels.join(', ') || '—'}
                        </p>
                      </div>
                      <StatusMark
                        display={displayForScheduleBucket(bucketForScheduleRow(post))}
                        locale={locale}
                      />
                      <span data-testid={`demo-sched-bucket-${post.id}`}>
                        {t(`demo.schedule.bucket.${bucketForScheduleRow(post)}`)}
                      </span>
                    </div>
                    <p>
                      {t('demo.schedule.readiness')}: {score.ok}/{score.total} ({score.pct}%)
                      {internalReady(post) ? ` · ${t('demo.schedule.ready')}` : ''}
                      {hasIntegrationBlocker(post)
                        ? ` · ${t('demo.schedule.integrationBlock')}`
                        : ''}
                    </p>
                    {post.blockingReason ? (
                      <p className="oma-muted">{pickCopy(post.blockingReason, locale)}</p>
                    ) : null}
                    <p className="oma-muted" data-testid={`demo-sched-policy-${post.id}`}>
                      {policy}
                      {contents.find((item) => item.id === post.contentId)
                        ? ` · ${t('demo.content.approverProgress')
                            .replace(
                              '{approved}',
                              String(
                                resolveContentWorkflow(
                                  contents.find((item) => item.id === post.contentId)!,
                                  policy,
                                ).approverApproved,
                              ),
                            )
                            .replace(
                              '{required}',
                              String(
                                resolveContentWorkflow(
                                  contents.find((item) => item.id === post.contentId)!,
                                  policy,
                                ).approverRequired,
                              ),
                            )}`
                        : ''}
                    </p>
                    <div className="oma-chip-row">
                      <Button type="default" onClick={() => openItem(post.id)}>
                        {t('demo.schedule.open')}
                      </Button>
                      {post.contentId ? (
                        <Link
                          href={`/app/content?item=${post.contentId}`}
                          className="oma-text-link"
                        >
                          {post.contentId}
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div
            className="oma-sched-mobile-only oma-sched-agenda"
            data-testid="demo-schedule-mobile"
          >
            {filtered
              .filter(
                (p) =>
                  scheduleDayKey(p.plannedAt) >= days[0]! &&
                  scheduleDayKey(p.plannedAt) <= days[6]!,
              )
              .map((post) => (
                <SurfaceButton
                  key={post.id}
                  onClick={() => openItem(post.id)}
                  className="oma-sched-card"
                >
                  <strong>{pickCopy(post.title, locale)}</strong>
                  <span className="oma-muted">{post.plannedAt}</span>
                  <StatusMark
                    display={displayForScheduleBucket(bucketForScheduleRow(post))}
                    locale={locale}
                  />
                  <span>{t(`demo.schedule.bucket.${bucketForScheduleRow(post)}`)}</span>
                </SurfaceButton>
              ))}
          </div>
        </>
      ) : null}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        label={selected ? pickCopy(selected.title, locale) : t('demo.schedule.title')}
      >
        {selected ? (
          <div className="oma-stack" data-testid="demo-schedule-drawer">
            <StatusMark
              display={displayForScheduleBucket(bucketForScheduleRow(selected))}
              locale={locale}
            />
            <p data-testid="demo-schedule-truth">
              {selected.state === 'SCHEDULED_PREVIEW'
                ? t('demo.schedule.truth.scheduled')
                : selected.state === 'BLOCKED'
                  ? t('demo.schedule.truth.blocked')
                  : t('demo.schedule.truth.planned')}
            </p>
            {scheduleBlocked ? (
              <p data-testid="demo-schedule-block-reason">
                {selectedWorkflow?.scheduleBlocked
                  ? t('demo.content.scheduleBlocked')
                  : selected.blockingReason
                    ? pickCopy(selected.blockingReason, locale)
                    : t('demo.schedule.truth.blocked')}
              </p>
            ) : null}
            <p data-testid="demo-schedule-policy">
              {t('demo.content.policy')}: {policy}
            </p>
            {contents.find((item) => item.id === selected.contentId) ? (
              <p data-testid="demo-schedule-approver-progress">
                {t('demo.content.approverProgress')
                  .replace(
                    '{approved}',
                    String(
                      resolveContentWorkflow(
                        contents.find((item) => item.id === selected.contentId)!,
                        policy,
                      ).approverApproved,
                    ),
                  )
                  .replace(
                    '{required}',
                    String(
                      resolveContentWorkflow(
                        contents.find((item) => item.id === selected.contentId)!,
                        policy,
                      ).approverRequired,
                    ),
                  )}
              </p>
            ) : null}
            <div className="oma-chip-row">
              <Button
                type="primary"
                data-testid="demo-schedule-command"
                disabled={saving || scheduleBlocked}
                title={scheduleBlocked ? t('demo.content.scheduleBlocked') : undefined}
                onClick={() => void setScheduleState('SCHEDULED_PREVIEW')}
              >
                {t('demo.content.schedule')}
              </Button>
              <Button
                type="default"
                data-testid="demo-schedule-unschedule"
                disabled={saving}
                onClick={() => void setScheduleState('PLANNED')}
              >
                {t('demo.content.unschedule')}
              </Button>
            </div>
            <p className="oma-muted">
              {selected.plannedAt} · {selected.timezone}
            </p>
            <p>{pickCopy(selected.caption, locale)}</p>
            <p>
              {t('demo.schedule.filter.owner')}: {selected.owner}
            </p>
            <h3>{t('demo.schedule.readiness')}</h3>
            <ul className="oma-readiness-list" data-testid="demo-schedule-readiness">
              {selected.readiness.map((r, i) => (
                <li key={i} data-ok={r.ok ? 'true' : 'false'}>
                  {r.ok ? '✓' : '✗'} {pickCopy(r.check, locale)}
                  <span className="oma-muted"> ({r.kind})</span>
                </li>
              ))}
            </ul>
            {selected.blockingReason ? (
              <p role="status">{pickCopy(selected.blockingReason, locale)}</p>
            ) : null}
            <p className="oma-honesty-inline" data-testid="demo-publish-blocked">
              {t('demo.schedule.publishBlocked')}
            </p>
            <div className="oma-chip-row">
              <Button
                type="primary"
                data-testid="demo-schedule-reschedule"
                onClick={() => setRescheduleOpen(true)}
              >
                {t('demo.schedule.reschedule')}
              </Button>
              <Button
                type="default"
                data-testid="demo-schedule-remove"
                disabled={saving}
                onClick={() => void removeSelected()}
              >
                {t('demo.schedule.remove')}
              </Button>
              {selected.contentId ? (
                <Link
                  href={`/app/content?item=${selected.contentId}`}
                  className="oma-text-link"
                  data-testid="demo-schedule-content-link"
                >
                  {selected.contentId}
                </Link>
              ) : null}
              {selected.campaignId ? (
                <Link
                  href={`/app/campaigns/${selected.campaignId}`}
                  className="oma-text-link"
                  data-testid="demo-schedule-campaign-link"
                >
                  {selected.campaignId}
                </Link>
              ) : null}
              {selected.deliverableId ? (
                <Link
                  href={`/app/deliverables/${selected.deliverableId}`}
                  className="oma-text-link"
                  data-testid="demo-schedule-deliverable-link"
                >
                  {selected.deliverableId}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </Drawer>

      <Dialog
        open={rescheduleOpen}
        onClose={() => !saving && setRescheduleOpen(false)}
        title={t('demo.schedule.reschedule')}
      >
        <div className="oma-stack" data-testid="demo-schedule-reschedule-dialog">
          <label>
            {t('demo.schedule.plannedAt')}
            <DateField
              value={plannedAtDraft.includes('T') ? plannedAtDraft.slice(0, 16) : plannedAtDraft}
              data-testid="demo-schedule-planned-at"
              onChange={(e) => setPlannedAtDraft(e.target.value)}
              showTime
            />
          </label>
          <label>
            {t('demo.schedule.filter.channel')}
            <Input
              value={channelDraft}
              data-testid="demo-schedule-channels"
              onChange={(e) => setChannelDraft(e.target.value)}
              placeholder="Instagram, LinkedIn"
            />
          </label>
          <p className="oma-muted">{t('demo.schedule.publishBlocked')}</p>
          <div className="oma-chip-row">
            <Button type="default" onClick={() => setRescheduleOpen(false)}>
              {t('demo.create.cancel')}
            </Button>
            <Button
              type="primary"
              data-testid="demo-schedule-save"
              disabled={saving}
              onClick={() => void saveReschedule()}
            >
              {t('demo.schedule.save')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
