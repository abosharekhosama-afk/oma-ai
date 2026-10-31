'use client';
import { TableShimmer } from '../../../../components/ui/shimmer';
import { useReloadOnBrandChange } from '../../../../lib/active-brand';
import { CloseOutlined, FilterOutlined } from '@ant-design/icons';
import { Button, DateField, Input, SelectField, SurfaceButton } from '@oma/ui/controls';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApprovalPolicy, DemoGraph } from '@oma/demo';
import { resolveContentWorkflow } from '@oma/demo';
import { Dialog } from '../../../../components/ui/dialog';
import { Drawer } from '../../../../components/ui/drawer';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatusMark } from '../../../../components/content/content-card';
import { useToast } from '../../../../components/ui/toast';
import { pickCopy } from '../../../../lib/demo/use-demo-api';
import {
  archiveContent,
  contentApiError,
  loadScheduleWorkspace,
  scheduleContent,
  toContentRow,
  unscheduleContent,
} from '../../../../lib/content-api';
import { todayKey, wallTimeToIso } from '../../../../lib/calendar-today';
import { brandScheduleTimezone } from '../../../../lib/brand-schedule-timezone';
import { useActiveBrandId } from '../../../../lib/active-brand';
import {
  contentToScheduleRow,
  type ScheduleRowExtras,
} from '../../../../lib/schedule-production';
import {
  buildPublishStatusView,
  formatScheduleWhen,
} from '../../../../lib/publish-status';
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
import { scheduleBlockedHint, scheduleBlockReason } from '../../../../lib/content-workflow-ui';

type ScheduleRowView = ScheduleRow & ScheduleRowExtras;

function weekdayForScheduleDay(iso: string, locale: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    weekday: 'short',
    timeZone,
  }).format(d);
}

export default function SchedulePage() {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const activeBrandId = useActiveBrandId();
  const [rows, setRows] = useState<ScheduleRowView[]>([]);
  const [brands, setBrands] = useState<{ id: string; timezone?: string }[]>([]);
  const [campaigns, setCampaigns] = useState<DemoGraph['campaigns']>([]);
  const [contents, setContents] = useState<DemoGraph['contentItems']>([]);
  const [policy, setPolicy] = useState<ApprovalPolicy>('OPTIONAL');
  const [filters, setFilters] = useState<ScheduleFilters>(EMPTY_SCHEDULE_FILTERS);
  const [view, setView] = useState<ScheduleView>('calendar');
  const [anchor, setAnchor] = useState(() => todayKey());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [plannedAtDraft, setPlannedAtDraft] = useState('');
  const [channelDraft, setChannelDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const workspace = await loadScheduleWorkspace();
      setPolicy(workspace.policy);
      setBrands(workspace.brands.map((b) => ({ id: b.id, timezone: b.timezone })));
      setCampaigns(workspace.campaigns as DemoGraph['campaigns']);
      setContents(workspace.content as DemoGraph['contentItems']);
      const campaignById = new Map(
        workspace.campaigns.map((c) => {
          const named = c as { id: string; title?: { en: string; ar: string }; name?: { en: string; ar: string } };
          return [named.id, named.title ?? named.name ?? { en: '', ar: '' }] as const;
        }),
      );
      setRows(
        workspace.content.map((item) => {
          const row = item as typeof item & { timezone?: string; campaignId?: string };
          return contentToScheduleRow(row, workspace.policy, {
            timezone: row.timezone,
            campaignTitle: row.campaignId ? campaignById.get(row.campaignId) ?? null : null,
          });
        }),
      );
      setError(null);
      setUnavailable(false);
    } catch (err) {
      setError(contentApiError(err, t('errors.http')));
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh when the active brand changes in the header switcher.
  useReloadOnBrandChange(load);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => filterSchedule(rows, filters, locale), [rows, filters, locale]);
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const datedRows = useMemo(() => filtered.filter((row) => Boolean(row.plannedAt)), [filtered]);
  const byDay = useMemo(() => groupScheduleByDay(datedRows), [datedRows]);
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const scheduleTz = useMemo(
    () =>
      brandScheduleTimezone(
        activeBrandId ?? selected?.brandId ?? brands[0]?.id,
        brands,
        selected?.timezone,
      ),
    [activeBrandId, brands, selected?.brandId, selected?.timezone],
  );
  const todayInBrand = useMemo(() => todayKey(scheduleTz), [scheduleTz]);
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
      const scheduledAt = wallTimeToIso(plannedAtDraft, scheduleTz);
      if (!scheduledAt) {
        toast.push(t('demo.schedule.invalidDate'), 'danger');
        return;
      }
      const updated = await scheduleContent(selected.contentId, { scheduledAt, timezone: scheduleTz });
      const next = contentToScheduleRow(toContentRow(updated), policy);
      if (channels.length) next.channels = channels;
      setContents((list) =>
        list.map((item) => (item.id === updated.id ? toContentRow(updated) : item)),
      );
      setRows((list) => list.map((r) => (r.id === next.id ? next : r)));
      setRescheduleOpen(false);
      toast.push(t('demo.schedule.saved'), 'success');
    } catch (err) {
      toast.push(contentApiError(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function setScheduleState(state: ScheduleRow['state']) {
    if (!selected) return;
    setSaving(true);
    try {
      const updated =
        state === 'PLANNED'
          ? await unscheduleContent(selected.contentId)
          : await scheduleContent(selected.contentId, {
              scheduledAt:
                wallTimeToIso(selected.plannedAt, scheduleTz) ||
                selected.plannedAt ||
                new Date().toISOString(),
              timezone: scheduleTz,
            });
      const next = contentToScheduleRow(toContentRow(updated), policy);
      setContents((list) =>
        list.map((item) => (item.id === updated.id ? toContentRow(updated) : item)),
      );
      setRows((list) => list.map((r) => (r.id === next.id ? next : r)));
      toast.push(t('demo.schedule.saved'), 'success');
    } catch (err) {
      toast.push(contentApiError(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected) return;
    setSaving(true);
    try {
      await archiveContent(selected.contentId);
      setRows((list) => list.filter((r) => r.id !== selected.id));
      setContents((list) => list.filter((item) => item.id !== selected.contentId));
      setSelectedId(null);
      toast.push(t('demo.schedule.removed'), 'success');
    } catch (err) {
      toast.push(contentApiError(err, t('demo.unavailable')), 'danger');
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
            {t('demo.schedule.timezone')}:{' '}
            {scheduleTz}
          </span>
        }
      />
      {rows.every((row) => !row.externalPublishingConnected) ? (
        <p className="oma-honesty-inline oma-muted">{t('demo.schedule.planningPreview')}</p>
      ) : null}

      {loading ? <TableShimmer rows={8} avatar={false} /> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {!loading && !unavailable && !error ? (
        <>
          <div className="oma-sched-chrome">
            <div className="oma-sched-tabs" role="tablist" data-testid="demo-schedule-views">
              {(['calendar', 'agenda', 'queue'] as ScheduleView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  className="oma-sched-tabs__btn"
                  data-active={view === v ? 'true' : 'false'}
                  data-testid={`demo-schedule-view-${v}`}
                  onClick={() => setView(v)}
                >
                  {t(`demo.schedule.view.${v}`)}
                </button>
              ))}
            </div>
            <div className="oma-sched-chrome__actions">
              <div className="oma-sched-week-nav">
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
                  onClick={() => setAnchor(todayInBrand)}
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
              <button
                type="button"
                className="oma-sched-filter-btn"
                data-testid="demo-schedule-filter-toggle"
                data-active={filterSheet ? 'true' : 'false'}
                onClick={() => setFilterSheet((v) => !v)}
              >
                <FilterOutlined />
                <span>{t('demo.requests.filters') || 'Filter'}</span>
                {filterCount > 0 ? (
                  <span className="oma-sched-filter-btn__count">{filterCount}</span>
                ) : null}
              </button>
            </div>
          </div>

          <div className="oma-sched-layout" data-filter-open={filterSheet ? 'true' : 'false'}>
            <div className="oma-sched-main">
              {filtered.length === 0 ? (
                <EmptyState title={t('demo.empty')} body={t('demo.schedule.emptyHint')} />
              ) : null}

              <section data-testid="demo-schedule-saved" className="oma-stack">
                <h2>{t('demo.content.savedColumn')}</h2>
                {contents
                  .filter((item) => resolveContentWorkflow(item, policy).plannedAt == null)
                  .map((item) => (
                    <Link
                      key={item.id}
                      href={`/app/content?item=${item.id}`}
                      className="oma-text-link"
                    >
                      {pickCopy(item.title, locale)}
                    </Link>
                  ))}
              </section>

              {view === 'calendar' ? (
                <div className="oma-sched-calendar" data-testid="demo-schedule-calendar">
                  <div className="oma-sched-dow-row" data-testid="demo-schedule-weekdays">
                    {days.map((day) => (
                      <div key={`dow-${day}`} className="oma-sched-dow" role="columnheader">
                        {weekdayForScheduleDay(day, locale, scheduleTz)}
                      </div>
                    ))}
                  </div>
                  <div className="oma-sched-week">
                    {days.map((day) => (
                      <div
                        key={day}
                        className="oma-sched-day"
                        data-today={day === todayInBrand ? 'true' : 'false'}
                        data-testid={`demo-sched-day-${day}`}
                      >
                        <div className="oma-sched-day-label">
                          <span className="oma-sched-day-label__dow">
                            {weekdayForScheduleDay(day, locale, scheduleTz)}
                          </span>
                          <span className="oma-sched-day-label__num">
                            {Number(day.slice(8, 10))}
                          </span>
                          <span className="oma-sched-day-label__key oma-ltr">{day}</span>
                        </div>
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
                              {weekdayForScheduleDay(scheduleDayKey(post.plannedAt), locale, scheduleTz)} ·{' '}
                              {formatScheduleWhen(post.plannedAt, post.timezone, locale)} ·{' '}
                              {post.timezone} · {post.channels.join(', ') || t('demo.schedule.ownerEmpty')}
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
                      <span className="oma-muted">
                        {weekdayForScheduleDay(scheduleDayKey(post.plannedAt), locale, scheduleTz)} ·{' '}
                        {post.plannedAt}
                      </span>
                      <StatusMark
                        display={displayForScheduleBucket(bucketForScheduleRow(post))}
                        locale={locale}
                      />
                      <span>{t(`demo.schedule.bucket.${bucketForScheduleRow(post)}`)}</span>
                    </SurfaceButton>
                  ))}
              </div>
            </div>
            {filterSheet ? (
              <aside
                className="oma-req-filter-panel oma-sched-filter-panel"
                data-testid="demo-schedule-filters"
              >
                <header className="oma-req-filter-panel__head">
                  <strong>{t('demo.requests.filters') || 'Filters'}</strong>
                  <button
                    type="button"
                    className="oma-req-filter-panel__close"
                    aria-label="Close"
                    onClick={() => setFilterSheet(false)}
                  >
                    <CloseOutlined />
                  </button>
                </header>
                <div className="oma-sched-filter-body">
                  <label className="oma-brief-field">
                    <span className="oma-brief-field__label">{t('demo.schedule.search')}</span>
                    <Input
                      value={filters.q}
                      data-testid="demo-schedule-search"
                      onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                    />
                  </label>
                  <label className="oma-brief-field">
                    <span className="oma-brief-field__label">
                      {t('demo.schedule.filter.channel')}
                    </span>
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
                  <label className="oma-brief-field">
                    <span className="oma-brief-field__label">
                      {t('demo.schedule.filter.readiness')}
                    </span>
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
                  <label className="oma-brief-field">
                    <span className="oma-brief-field__label">
                      {t('demo.schedule.filter.campaign')}
                    </span>
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
                  <label className="oma-brief-field">
                    <span className="oma-brief-field__label">
                      {t('demo.schedule.filter.owner')}
                    </span>
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
              </aside>
            ) : null}
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
              {selected.state === 'BLOCKED' || scheduleBlocked
                ? scheduleBlockedHint(scheduleBlockReason(selectedContent ?? {}, policy), locale.startsWith('ar')) ||
                  t('demo.schedule.truth.waitingApproval')
                : selected.state === 'SCHEDULED_PREVIEW'
                  ? selected.externalPublishingConnected
                    ? t('demo.schedule.truth.scheduledConnected')
                    : t('demo.schedule.truth.scheduledDisconnected')
                  : t('demo.schedule.truth.planned')}
            </p>
            <p data-testid="demo-schedule-policy">
              {t('demo.content.policy')}:{' '}
              {policy === 'NONE'
                ? t('demo.content.policy.none')
                : policy === 'REQUIRED'
                  ? t('demo.content.policy.required')
                  : t('demo.content.policy.optional')}
            </p>
            {selectedWorkflow && policy !== 'NONE' ? (
              <p data-testid="demo-schedule-approver-progress">
                {t('demo.content.approverProgress')
                  .replace('{approved}', String(selectedWorkflow.approverApproved))
                  .replace('{required}', String(selectedWorkflow.approverRequired))}
              </p>
            ) : null}
            <div className="oma-chip-row">
              <Button
                type="primary"
                data-testid="demo-schedule-command"
                disabled={saving || scheduleBlocked}
                title={
                  scheduleBlocked
                    ? scheduleBlockedHint(
                        scheduleBlockReason(selectedContent ?? {}, policy),
                        locale.startsWith('ar'),
                      ) || t('demo.content.scheduleBlocked')
                    : undefined
                }
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
            <p className="oma-muted" data-testid="demo-schedule-when">
              {formatScheduleWhen(selected.plannedAt, selected.timezone, locale)}
              {selected.timezone ? ` · ${selected.timezone}` : ''}
            </p>
            <p>{pickCopy(selected.caption, locale)}</p>
            <p data-testid="demo-schedule-owner">
              {t('demo.schedule.filter.owner')}:{' '}
              {selected.owner?.trim() ? selected.owner : t('demo.schedule.ownerEmpty')}
            </p>
            <h3>{t('demo.schedule.readiness')}</h3>
            <ul className="oma-readiness-list" data-testid="demo-schedule-readiness">
              {selected.readiness.map((r, i) => (
                <li key={i} data-ok={r.ok ? 'true' : 'false'}>
                  {r.ok ? '✓' : '✗'} {pickCopy(r.check, locale)}
                  <span className="oma-muted">
                    {' '}
                    · {t(`demo.schedule.readiness.kind.${r.kind}`)}
                  </span>
                </li>
              ))}
            </ul>
            {(() => {
              const content = selectedContent as
                | (typeof selectedContent & {
                    scheduleState?: string;
                    scheduledAt?: string | null;
                    socialPageId?: string | null;
                    publishState?: string;
                    publishError?: string | null;
                    workerPickedAt?: string | null;
                    publishSkipReason?: string | null;
                    nextPublishAt?: string | null;
                    publishedAt?: string | null;
                    externalPostUrl?: string | null;
                  })
                | null;
              const status = buildPublishStatusView(
                {
                  scheduleState: content?.scheduleState ?? (selected.state === 'SCHEDULED_PREVIEW' ? 'SCHEDULED' : 'UNSCHEDULED'),
                  scheduledAt: content?.scheduledAt ?? selected.plannedAt,
                  plannedAt: selected.plannedAt,
                  publishState: selected.publishState ?? content?.publishState,
                  publishError: selected.publishError ?? content?.publishError,
                  workerPickedAt: selected.workerPickedAt ?? content?.workerPickedAt,
                  publishSkipReason: selected.publishSkipReason ?? content?.publishSkipReason,
                  nextPublishAt: selected.nextPublishAt ?? content?.nextPublishAt,
                  publishedAt: selected.publishedAt ?? content?.publishedAt,
                  externalPostUrl: selected.externalPostUrl ?? content?.externalPostUrl,
                  socialPageId: content?.socialPageId ?? (selected.externalPublishingConnected ? '1' : null),
                },
                locale.startsWith('ar') ? 'ar' : 'en',
              );
              if (!status) return null;
              return (
                <div className="oma-stack" data-testid="demo-schedule-publish-status">
                  <h3>{t('demo.schedule.publishStatus')}</h3>
                  <p data-testid="demo-schedule-publish-state">{t(status.stateLabelKey)}</p>
                  <ol className="oma-readiness-list" data-testid="demo-schedule-publish-timeline">
                    {status.steps.map((step) => (
                      <li
                        key={step.key}
                        data-ok={step.done ? 'true' : 'false'}
                        data-current={step.current ? 'true' : 'false'}
                      >
                        {step.done ? '✓' : step.current ? '●' : '○'}{' '}
                        {t(`demo.schedule.timeline.${step.key}`)}
                        {step.at
                          ? ` · ${formatScheduleWhen(step.at, selected.timezone, locale)}`
                          : ''}
                        {step.detail && step.key !== 'published' ? (
                          <span className="oma-muted"> — {step.detail}</span>
                        ) : null}
                        {step.key === 'published' && status.externalUrl ? (
                          <>
                            {' · '}
                            <a
                              href={status.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="oma-text-link"
                            >
                              {t('demo.schedule.viewPostLink')}
                            </a>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                  {status.errorHuman &&
                  (selected.publishState === 'FAILED' || selected.publishSkipReason) ? (
                    <p role="status" data-testid="demo-schedule-publish-error">
                      {status.errorHuman}
                    </p>
                  ) : null}
                </div>
              );
            })()}
            {selected.blockingReason ? (
              <p role="status">{pickCopy(selected.blockingReason, locale)}</p>
            ) : null}
            {!selected.externalPublishingConnected ? (
              <p className="oma-honesty-inline" data-testid="demo-publish-blocked">
                {t('demo.schedule.publishBlocked')}
              </p>
            ) : null}
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
                  {t('demo.schedule.openPost')}: {pickCopy(selected.title, locale)}
                </Link>
              ) : null}
              {selected.campaignId ? (
                <Link
                  href={`/app/campaigns/${selected.campaignId}`}
                  className="oma-text-link"
                  data-testid="demo-schedule-campaign-link"
                >
                  {t('demo.schedule.openCampaign')}
                  {selected.campaignTitle
                    ? `: ${pickCopy(selected.campaignTitle, locale)}`
                    : ''}
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
          {!selected?.externalPublishingConnected ? (
            <p className="oma-muted">{t('demo.schedule.publishBlocked')}</p>
          ) : null}
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
