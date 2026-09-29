'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DemoGraph, DemoTaskStatus } from '@oma/demo';
import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  OmaSelect,
  SelectField,
  SurfaceButton,
} from '@oma/ui/controls';
import dayjs from 'dayjs';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { Dialog } from '../../../../components/ui/dialog';
import { Drawer } from '../../../../components/ui/drawer';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatusChip } from '../../../../components/ui/status-chip';
import { useToast } from '../../../../components/ui/toast';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import { TasksKanbanBoard } from '../../../../components/demo/tasks-kanban-board';
import {
  BOARD_COLUMNS,
  EMPTY_TASK_FILTERS,
  activeTaskFilterCount,
  canTransitionTaskStatus,
  checklistProgress,
  filterTasks,
  groupTasksByBoard,
  productionSummary,
  taskIsOverdue,
  type TaskFilters,
  type TaskRow,
} from '../../../../lib/demo/stage4-tasks';
import { useLocale, useT } from '../../../../lib/use-locale';

type ViewMode = 'board' | 'list';
type Brand = DemoGraph['brands'][number];
type Campaign = DemoGraph['campaigns'][number];

export default function TasksPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [view, setView] = useState<ViewMode>('board');
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_TASK_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    brandId: '',
    assignee: 'Unassigned',
    priority: 'MEDIUM',
    dueAt: '2026-09-20',
    type: 'DESIGN',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const graph = await demoApi<DemoGraph>('/graph');
      setRows(graph.tasks);
      setBrands(graph.brands);
      setCampaigns(graph.campaigns);
      setCreateForm((f) => ({
        ...f,
        brandId: f.brandId || graph.brands[0]?.id || '',
      }));
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const prefs = await demoApi<{ defaultTaskView: ViewMode }>('/preferences');
        if (cancelled) return;
        if (prefs.defaultTaskView !== 'board' && prefs.defaultTaskView !== 'list') return;
        const urlView = new URLSearchParams(window.location.search).get('view');
        if (urlView !== 'board' && urlView !== 'list') {
          setView(prefs.defaultTaskView);
        }
      } catch {
        /* keep board default */
      } finally {
        if (!cancelled) setPrefsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingTask = useRef<string | null>(null);

  useEffect(() => {
    const task = searchParams.get('task');
    if (task) {
      pendingTask.current = null;
      setSelectedId(task);
    } else if (pendingTask.current) {
      setSelectedId(pendingTask.current);
    } else {
      setSelectedId(null);
    }
    const urlView = searchParams.get('view');
    if (urlView === 'board' || urlView === 'list') {
      setView(urlView);
    }
  }, [searchParams]);

  async function changeView(next: ViewMode) {
    setView(next);
    try {
      await demoApi('/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ defaultTaskView: next }),
      });
    } catch {
      /* non-blocking */
    }
  }

  const filtered = useMemo(() => filterTasks(rows, filters, locale), [rows, filters, locale]);
  const byBoard = useMemo(() => groupTasksByBoard(filtered), [filtered]);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const summary = useMemo(() => productionSummary(rows), [rows]);
  const filterCount = activeTaskFilterCount(filters);
  const assignees = useMemo(() => [...new Set(rows.map((r) => r.assignee))], [rows]);

  function openTask(id: string) {
    pendingTask.current = id;
    setSelectedId(id);
    router.replace(`/app/tasks?task=${id}`, { scroll: false });
  }

  function closeTask() {
    pendingTask.current = null;
    router.replace('/app/tasks', { scroll: false });
    setSelectedId(null);
  }

  async function patchTask(id: string, patch: Record<string, unknown>) {
    const current = rows.find((r) => r.id === id);
    if (
      current &&
      typeof patch.status === 'string' &&
      !canTransitionTaskStatus(current.status, patch.status as DemoTaskStatus)
    ) {
      toast.push(t('demo.tasks.invalidTransition'), 'danger');
      return;
    }
    setSaving(true);
    const prev = rows;
    if (current) {
      setRows((list) => list.map((r) => (r.id === id ? ({ ...r, ...patch } as TaskRow) : r)));
    }
    try {
      const updated = await demoApi<TaskRow>(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setRows((list) => list.map((r) => (r.id === id ? updated : r)));
      toast.push(t('demo.tasks.saved'), 'success');
    } catch (err) {
      setRows(prev);
      toast.push(demoErrorMessage(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function addCommentFromForm(form: HTMLFormElement) {
    if (!selected) return;
    const raw = String(new FormData(form).get('comment') ?? '').trim();
    if (!raw) return;
    try {
      const updated = await demoApi<TaskRow>(`/tasks/${selected.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          author: 'Layla Haddad',
          body: { en: raw, ar: raw },
        }),
      });
      setRows((list) => list.map((r) => (r.id === selected.id ? updated : r)));
      form.reset();
      toast.push(t('demo.tasks.commentAdded'), 'success');
    } catch (err) {
      toast.push(demoErrorMessage(err, t('demo.unavailable')), 'danger');
    }
  }

  async function addChecklistFromForm(form: HTMLFormElement) {
    if (!selected) return;
    const raw = String(new FormData(form).get('item') ?? '').trim();
    if (!raw) return;
    const item = {
      id: `c-${Date.now().toString(36)}`,
      label: { en: raw, ar: raw },
      done: false,
    };
    await patchTask(selected.id, { checklist: [...selected.checklist, item] });
    form.reset();
  }

  async function toggleChecklist(itemId: string) {
    if (!selected) return;
    const checklist = selected.checklist.map((c) =>
      c.id === itemId ? { ...c, done: !c.done } : c,
    );
    await patchTask(selected.id, { checklist });
  }

  async function createDeliverableFromTask() {
    if (!selected) return;
    setSaving(true);
    try {
      const deliv = await demoApi<DemoGraph['deliverables'][number]>(
        `/deliverables/from-task/${selected.id}`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setRows((list) =>
        list.map((r) => (r.id === selected.id ? { ...r, deliverableId: deliv.id } : r)),
      );
      toast.push(t('demo.tasks.deliverableCreated'), 'success');
      router.push(`/app/deliverables/${deliv.id}`);
    } catch (err) {
      toast.push(demoErrorMessage(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function submitCreate() {
    if (!createForm.title.trim() || !createForm.brandId) {
      toast.push(t('demo.create.validation'), 'danger');
      return;
    }
    setCreating(true);
    try {
      const created = await demoApi<TaskRow>('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: { en: createForm.title.trim(), ar: createForm.title.trim() },
          brandId: createForm.brandId,
          assignee: createForm.assignee,
          priority: createForm.priority,
          dueAt: createForm.dueAt,
          type: createForm.type,
          status: 'BACKLOG',
        }),
      });
      setCreateOpen(false);
      setCreateForm((f) => ({ ...f, title: '' }));
      await load();
      openTask(created.id);
      toast.push(t('demo.create.successTask'), 'success');
    } catch (err) {
      toast.push(demoErrorMessage(err, t('demo.create.validation')), 'danger');
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    if (!selected) return;
    const url = `${window.location.origin}/app/tasks?task=${selected.id}`;
    await navigator.clipboard.writeText(url);
    toast.push(t('demo.tasks.linkCopied'), 'success');
  }

  const moveOptions = (status: DemoTaskStatus) =>
    (
      [
        'BACKLOG',
        'READY',
        'IN_PROGRESS',
        'IN_REVIEW',
        'BLOCKED',
        'DONE',
        'OVERDUE',
      ] as DemoTaskStatus[]
    ).filter((s) => canTransitionTaskStatus(status, s));

  return (
    <div
      className="oma-stack"
      data-testid="demo-tasks"
      data-view={view}
      data-prefs={prefsLoaded ? '1' : '0'}
    >
      <PageHeader
        title={t('demo.tasks.title')}
        description={t('demo.tasks.subtitle')}
        actions={
          <div className="oma-chip-row">
            <div className="oma-view-toggle" role="group" aria-label={t('demo.tasks.views')}>
              <Button
                type={view === 'board' ? 'primary' : 'default'}
                aria-pressed={view === 'board'}
                data-testid="demo-tasks-view-board"
                onClick={() => void changeView('board')}
              >
                {t('demo.view.kanban')}
              </Button>
              <Button
                type={view === 'list' ? 'primary' : 'default'}
                aria-pressed={view === 'list'}
                data-testid="demo-tasks-view-list"
                onClick={() => void changeView('list')}
              >
                {t('demo.view.list')}
              </Button>
            </div>
            <Button
              type="primary"
              data-testid="demo-create-task"
              onClick={() => setCreateOpen(true)}
            >
              {t('demo.tasks.create')}
            </Button>
          </div>
        }
      />
      <DemoDisclosure />

      <div className="oma-prod-strip" data-testid="demo-production-summary">
        <div className="oma-prod-stat">
          <strong>{summary.wip}</strong>
          <span>{t('demo.tasks.wip')}</span>
        </div>
        <div className="oma-prod-stat">
          <strong>{summary.dueSoon}</strong>
          <span>{t('demo.tasks.dueSoon')}</span>
        </div>
        <div className="oma-prod-stat">
          <strong>{summary.blocked}</strong>
          <span>{t('demo.tasks.blocked')}</span>
        </div>
        <div className="oma-prod-stat">
          <strong>{summary.awaitingReview}</strong>
          <span>{t('demo.tasks.awaitingReview')}</span>
        </div>
      </div>

      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? (
        <p className="oma-muted" data-testid="demo-tasks-denied">
          {t('demo.unavailable')}
        </p>
      ) : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {!loading && !unavailable && !error ? (
        <>
          <div className="oma-stage4-toolbar" data-testid="demo-task-filters">
            <label className="oma-stage4-search">
              {t('demo.tasks.search')}
              <Input
                value={filters.q}
                data-testid="demo-task-search"
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              />
            </label>
            <label>
              {t('demo.tasks.filter.status')}
              <SelectField
                value={filters.status}
                data-testid="demo-task-filter-status"
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {BOARD_COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              {t('demo.tasks.filter.assignee')}
              <SelectField
                value={filters.assignee}
                data-testid="demo-task-filter-assignee"
                onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                <option value="unassigned">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              {t('demo.tasks.filter.priority')}
              <SelectField
                value={filters.priority}
                data-testid="demo-task-filter-priority"
                onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              {t('demo.tasks.filter.campaign')}
              <SelectField
                value={filters.campaignId}
                data-testid="demo-task-filter-campaign"
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
              {t('demo.tasks.sort')}
              <SelectField
                value={filters.sort}
                data-testid="demo-task-sort"
                onChange={(e) =>
                  setFilters((f) => ({ ...f, sort: e.target.value as TaskFilters['sort'] }))
                }
              >
                <option value="due">{t('demo.tasks.sortDue')}</option>
                <option value="priority">{t('demo.tasks.sortPriority')}</option>
                <option value="updated">{t('demo.tasks.sortUpdated')}</option>
                <option value="title">{t('demo.tasks.sortTitle')}</option>
              </SelectField>
            </label>
          </div>

          {filterCount > 0 ? (
            <div className="oma-filter-chips">
              <Button type="default" onClick={() => setFilters(EMPTY_TASK_FILTERS)}>
                {t('demo.requests.clearFilters')}
              </Button>
            </div>
          ) : null}

          <p className="oma-muted" data-testid="demo-task-result-count">
            {filtered.length} / {rows.length}
          </p>

          {filtered.length === 0 ? (
            <EmptyState title={t('demo.empty')} body={t('demo.tasks.emptyHint')} />
          ) : view === 'board' ? (
            <TasksKanbanBoard
              byBoard={byBoard}
              onOpenTask={openTask}
              disabled={saving}
              onMoveTask={(id, status) => patchTask(id, { status })}
            />
          ) : (
            <>
              <div className="oma-req-table-wrap oma-task-desktop" data-testid="demo-tasks-list">
                <table className="oma-task-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>{t('demo.create.title')}</th>
                      <th>{t('demo.tasks.filter.status')}</th>
                      <th>{t('demo.tasks.filter.priority')}</th>
                      <th>{t('demo.tasks.filter.assignee')}</th>
                      <th>{t('demo.tasks.filter.campaign')}</th>
                      <th>{t('demo.requests.title')}</th>
                      <th>{t('demo.requests.col.due')}</th>
                      <th>{t('demo.tasks.updated')}</th>
                      <th>{t('demo.tasks.progress')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((task) => {
                      const progress = checklistProgress(task);
                      return (
                        <tr
                          key={task.id}
                          data-overdue={taskIsOverdue(task) ? 'true' : 'false'}
                          data-testid={`demo-task-row-${task.id}`}
                          tabIndex={0}
                          onClick={() => openTask(task.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openTask(task.id);
                            }
                          }}
                        >
                          <td>{task.id.replace('demo-task-', '#')}</td>
                          <td>{pickCopy(task.title, locale)}</td>
                          <td>
                            <StatusChip status={task.status} />
                          </td>
                          <td>
                            <StatusChip status={task.priority} />
                          </td>
                          <td>{task.assignee}</td>
                          <td>{task.campaignId ?? '—'}</td>
                          <td>{task.requestId ?? '—'}</td>
                          <td>{task.dueAt}</td>
                          <td>{task.updatedAt.slice(0, 10)}</td>
                          <td>{progress.total ? `${progress.done}/${progress.total}` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="oma-task-mobile" aria-label={t('demo.tasks.title')}>
                {filtered.map((task) => (
                  <li key={task.id}>
                    <SurfaceButton
                      onClick={() => openTask(task.id)}
                      className="oma-task-mobile-card"
                    >
                      <strong>{pickCopy(task.title, locale)}</strong>
                      <StatusChip status={task.status} />
                      <span className="oma-muted">
                        {task.assignee} · {task.dueAt}
                      </span>
                    </SurfaceButton>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : null}

      <Drawer open={Boolean(selected)} onClose={closeTask} label={t('demo.tasks.detail')} wide>
        {selected ? (
          <div className="oma-task-drawer-body" data-testid="demo-task-drawer">
            <div className="oma-drawer-header">
              <div>
                <p className="oma-muted">{selected.id}</p>
                <h2 id="task-drawer-title">
                  <Input
                    defaultValue={pickCopy(selected.title, locale)}
                    data-testid="demo-task-title"
                    aria-label={t('demo.create.title')}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== pickCopy(selected.title, locale)) {
                        void patchTask(selected.id, { title: { en: v, ar: v } });
                      }
                    }}
                  />
                </h2>
              </div>
              <div className="oma-chip-row">
                <Button data-testid="demo-task-copy-link" onClick={() => void copyLink()}>
                  {t('demo.tasks.copyLink')}
                </Button>
                <Button onClick={closeTask}>{t('common.cancel')}</Button>
              </div>
            </div>

            <div className="oma-task-fields">
              <label>
                {t('demo.tasks.filter.status')}
                <OmaSelect
                  value={selected.status}
                  testId="demo-task-status"
                  disabled={saving}
                  onChange={(status) => void patchTask(selected.id, { status })}
                  options={moveOptions(selected.status).map((s) => ({ value: s, label: s }))}
                />
              </label>
              <label>
                {t('demo.tasks.filter.priority')}
                <OmaSelect
                  value={selected.priority}
                  testId="demo-task-priority"
                  onChange={(priority) => void patchTask(selected.id, { priority })}
                  options={['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((p) => ({
                    value: p,
                    label: p,
                  }))}
                />
              </label>
              <label>
                {t('demo.tasks.filter.assignee')}
                <Input
                  defaultValue={selected.assignee}
                  data-testid="demo-task-assignee"
                  onBlur={(e) => void patchTask(selected.id, { assignee: e.target.value })}
                />
              </label>
              <label>
                {t('demo.requests.col.due')}
                <DatePicker
                  data-testid="demo-task-due"
                  defaultValue={selected.dueAt ? dayjs(selected.dueAt) : undefined}
                  onChange={(_, dateString) =>
                    void patchTask(selected.id, {
                      dueAt: Array.isArray(dateString) ? (dateString[0] ?? '') : dateString,
                    })
                  }
                />
              </label>
            </div>

            <p>{pickCopy(selected.description, locale)}</p>
            {selected.blockedReason ? (
              <p className="oma-callout" data-testid="demo-task-blocked-reason">
                {pickCopy(selected.blockedReason, locale)}
              </p>
            ) : null}

            <div className="oma-chip-row">
              {selected.campaignId ? (
                <Link
                  href={`/app/campaigns/${selected.campaignId}`}
                  className="oma-text-link"
                  data-testid="demo-task-campaign-link"
                >
                  {selected.campaignId}
                </Link>
              ) : null}
              {selected.contentId ? (
                <Link
                  href={`/app/content?item=${selected.contentId}`}
                  className="oma-text-link"
                  data-testid="demo-task-content-link"
                >
                  {selected.contentId}
                </Link>
              ) : null}
              {selected.requestId ? (
                <Link
                  href={`/app/requests/${selected.requestId}`}
                  className="oma-text-link"
                  data-testid="demo-task-request-link"
                >
                  {selected.requestId}
                </Link>
              ) : null}
              {selected.deliverableId ? (
                <Link
                  href={`/app/deliverables/${selected.deliverableId}`}
                  className="oma-text-link"
                  data-testid="demo-task-deliverable-link"
                >
                  {t('demo.tasks.deliverableHandoff')}: {selected.deliverableId}
                </Link>
              ) : (
                <div className="oma-chip-row">
                  <span className="oma-muted">{t('demo.tasks.noDeliverable')}</span>
                  <Button
                    data-testid="demo-task-create-deliverable"
                    disabled={saving}
                    onClick={() => void createDeliverableFromTask()}
                  >
                    {t('demo.tasks.createDeliverable')}
                  </Button>
                </div>
              )}
            </div>

            <section data-testid="demo-task-checklist">
              <h3>{t('demo.tasks.checklist')}</h3>
              <ul className="oma-checklist">
                {selected.checklist.length === 0 ? (
                  <li className="oma-muted">{t('demo.tasks.checklistEmpty')}</li>
                ) : (
                  selected.checklist.map((c) => (
                    <li key={c.id}>
                      <label>
                        <Checkbox
                          checked={c.done}
                          data-testid={`demo-checklist-${c.id}`}
                          onChange={() => void toggleChecklist(c.id)}
                        />{' '}
                        {pickCopy(c.label, locale)}
                      </label>
                    </li>
                  ))
                )}
              </ul>
              <div className="oma-chip-row">
                <form
                  className="oma-chip-row"
                  style={{ flex: 1 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void addChecklistFromForm(e.currentTarget);
                  }}
                >
                  <Input
                    name="item"
                    data-testid="demo-checklist-new"
                    placeholder={t('demo.tasks.addChecklist')}
                  />
                  <Button htmlType="submit" data-testid="demo-checklist-add">
                    {t('demo.tasks.addChecklist')}
                  </Button>
                </form>
              </div>
            </section>

            <section data-testid="demo-task-comments">
              <h3>{t('demo.tasks.comments')}</h3>
              <ul className="oma-activity-list">
                {selected.comments.map((c) => (
                  <li key={c.id}>
                    <strong>{c.author}</strong>
                    <span>{pickCopy(c.body, locale)}</span>
                    <time dateTime={c.at}>{c.at}</time>
                  </li>
                ))}
              </ul>
              <form
                className="oma-chip-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addCommentFromForm(e.currentTarget);
                }}
              >
                <Input name="comment" data-testid="demo-task-comment-input" />
                <Button type="primary" htmlType="submit" data-testid="demo-task-comment-submit">
                  {t('demo.tasks.addComment')}
                </Button>
              </form>
            </section>

            <section data-testid="demo-task-activity">
              <h3>{t('demo.tasks.activity')}</h3>
              <ul className="oma-activity-list">
                {(selected.activity ?? []).map((a) => (
                  <li key={a.id}>
                    <strong>{a.actor}</strong>
                    <span>{pickCopy(a.summary, locale)}</span>
                    <time dateTime={a.at}>{a.at}</time>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </Drawer>

      <Dialog
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title={t('demo.tasks.create')}
      >
        <div className="oma-stack" data-testid="demo-create-task-dialog">
          <label>
            {t('demo.create.title')}
            <Input
              value={createForm.title}
              data-testid="demo-create-task-title"
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label>
            {t('demo.requests.filter.brand')}
            <SelectField
              value={createForm.brandId}
              onChange={(e) => setCreateForm((f) => ({ ...f, brandId: e.target.value }))}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {pickCopy(b.name, locale)}
                </option>
              ))}
            </SelectField>
          </label>
          <div className="oma-chip-row">
            <Button type="default" onClick={() => setCreateOpen(false)}>
              {t('demo.create.cancel')}
            </Button>
            <Button
              type="primary"
              data-testid="demo-create-task-submit"
              disabled={creating}
              onClick={() => void submitCreate()}
            >
              {creating ? t('demo.create.creating') : t('demo.create.confirm')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
