'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OmaTopLoader } from '../../../../components/ui/oma-top-loader';
import { createPortal } from 'react-dom';
import type { DemoGraph, DemoTaskStatus } from '@oma/demo';
import { Button, Checkbox, Drawer as AntDrawer, Input, SelectField } from '@oma/ui/controls';
import { Dialog } from '../../../../components/ui/dialog';
import { Drawer } from '../../../../components/ui/drawer';
import { AssigneePicker } from '../../../../components/ui/assignee-picker';
import { EntityLink } from '../../../../components/ui/entity-link';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatusChip } from '../../../../components/ui/status-chip';
import { useToast } from '../../../../components/ui/toast';
import { daysFromToday, formatCommentTime } from '../../../../lib/calendar-today';
import { pickCopy } from '../../../../lib/demo/use-demo-api';
import {
  loadTasksWorkspace,
  createTask,
  updateTask,
  convertTaskToDeliverable,
  toTaskRow,
  opsError,
  addTaskChecklistItem,
  addTaskComment,
  getTaskDetail,
  updateTaskChecklistItem,
} from '../../../../lib/ops-api';
import { listWorkspaceMembers, type WorkspaceMember } from '../../../../lib/team-api';
import { TasksKanbanBoard } from '../../../../components/demo/tasks-kanban-board';
import {
  BOARD_COLUMNS,
  EMPTY_TASK_FILTERS,
  activeTaskFilterCount,
  canTransitionTaskStatus,
  filterTasks,
  groupTasksByBoard,
  productionSummary,
  type TaskFilters,
  type TaskRow,
} from '../../../../lib/demo/stage4-tasks';
import { useLocale, useT } from '../../../../lib/use-locale';
import {
  BarsOutlined,
  CloseOutlined,
  FilterOutlined,
  SearchOutlined,
  DownOutlined,
  UpOutlined,
  PlusOutlined,
  UserOutlined,
  FlagOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';

type ViewMode = 'board' | 'list';
type Brand = DemoGraph['brands'][number];

export default function TasksPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [view, setView] = useState<ViewMode>('board');
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_TASK_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [filterSection, setFilterSection] = useState<string | null>('search');
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [creating, setCreating] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [createForm, setCreateForm] = useState({
    title: '',
    brandId: '',
    assignee: '',
    priority: 'MEDIUM',
    dueAt: daysFromToday(14),
    type: 'DESIGN',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ws = await loadTasksWorkspace();
      setRows(ws.tasks);
      try {
        const mems = await listWorkspaceMembers();
        setMembers(mems);
      } catch {
        setMembers([]);
      }
      setBrands(ws.brands as Brand[]);
      setCreateForm((f) => ({
        ...f,
        brandId: f.brandId || ws.brands[0]?.id || '',
      }));
      setError(null);
      setUnavailable(false);
    } catch (err) {
      setError(opsError(err, 'Failed to load tasks'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = window.localStorage.getItem('oma.tasks.defaultView');
      if (raw === 'board' || raw === 'list') {
        const urlView = new URLSearchParams(window.location.search).get('view');
        if (urlView !== 'board' && urlView !== 'list') {
          setView(raw);
        }
      }
    } catch {
      /* keep board default */
    } finally {
      if (!cancelled) setPrefsLoaded(true);
    }
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

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const sync = () => {
      if (cancelled) return;
      const header = document.getElementById('oma-workspace-top-actions');
      setHeaderSlot(header);
      tries += 1;
      if (!header && tries < 30) {
        window.setTimeout(sync, 50);
      }
    };
    sync();
    return () => {
      cancelled = true;
      setHeaderSlot(null);
    };
  }, []);

  useEffect(() => {
    const el = document.getElementById('oma-content-view-slot');
    if (!el) return;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('data-testid', 'demo-tasks-view-toggle');
    el.style.cursor = 'pointer';
    const open = (e: Event) => {
      e.stopPropagation();
      setViewMenuOpen((v) => !v);
    };
    el.addEventListener('click', open);
    return () => el.removeEventListener('click', open);
  }, []);

  useEffect(() => {
    const el = document.getElementById('oma-content-view-slot');
    if (!el) return;
    el.textContent = view === 'board' ? t('demo.view.kanban') : t('demo.view.list');
    el.setAttribute('data-view', view);
  }, [view, t]);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const onDoc = () => setViewMenuOpen(false);
    const tmr = window.setTimeout(() => document.addEventListener('click', onDoc), 0);
    return () => {
      window.clearTimeout(tmr);
      document.removeEventListener('click', onDoc);
    };
  }, [viewMenuOpen]);

  async function changeView(next: ViewMode) {
    setView(next);
    try {
      /* view pref local */
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
      const apiStatus =
        patch.status === 'READY' || patch.status === 'BACKLOG'
          ? patch.status === 'READY'
            ? 'TODO'
            : 'BACKLOG'
          : patch.status;
      const updatedApi = await updateTask(id, {
        status: apiStatus ?? patch.status,
        title: patch.title,
        assigneeUserId: (() => {
          const p = patch as { assignee?: string; assigneeId?: string | null };
          if (p.assigneeId !== undefined) return p.assigneeId;
          if (p.assignee === 'Unassigned') return null;
          if (p.assignee === undefined) return undefined;
          // Resolve display name → user id
          const hit = members.find(
            (m) =>
              m.user?.id === p.assignee ||
              m.user?.name === p.assignee ||
              m.user?.email === p.assignee,
          );
          return hit?.user?.id || (p.assignee && p.assignee.length > 20 ? p.assignee : null);
        })(),
        dueAt: patch.dueAt,
      });
      const updated = toTaskRow(updatedApi);
      setRows((list) =>
        list.map((r) => (r.id === id ? ({ ...r, ...updated, ...patch } as TaskRow) : r)),
      );
      toast.push(t('demo.tasks.saved'), 'success');
    } catch (err) {
      setRows(prev);
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  /** Pull persisted checklist + comments for a task from the API and merge into its row. */
  const loadTaskDetail = useCallback(async (taskId: string) => {
    try {
      const detail = await getTaskDetail(taskId);
      setRows((list) =>
        list.map((r) =>
          r.id === taskId
            ? ({
                ...r,
                checklist: (detail.checklist ?? []).map((c) => ({
                  id: c.id,
                  label: c.title,
                  done: c.done,
                })),
                comments: (detail.comments ?? []).map((c) => ({
                  id: c.id,
                  author: c.author_name || 'Team member',
                  body: c.body,
                  at: c.created_at,
                })),
                checklistTotal: (detail.checklist ?? []).length,
                checklistDone: (detail.checklist ?? []).filter((c) => c.done).length,
                commentCount: (detail.comments ?? []).length,
              } as TaskRow)
            : r,
        ),
      );
    } catch {
      /* keep list row; detail is best-effort */
    }
  }, []);

  const rowsLoaded = rows.length > 0;
  useEffect(() => {
    if (selectedId && rowsLoaded) void loadTaskDetail(selectedId);
  }, [selectedId, rowsLoaded, loadTaskDetail]);

  async function addCommentFromForm(form: HTMLFormElement) {
    if (!selected) return;
    const raw = String(new FormData(form).get('comment') ?? '').trim();
    if (!raw) return;
    try {
      await addTaskComment(selected.id, { en: raw, ar: raw });
      form.reset();
      await loadTaskDetail(selected.id);
      toast.push(t('demo.tasks.commentAdded'), 'success');
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    }
  }

  async function addChecklistFromForm(form: HTMLFormElement) {
    if (!selected) return;
    const raw = String(new FormData(form).get('item') ?? '').trim();
    if (!raw) return;
    try {
      await addTaskChecklistItem(selected.id, { en: raw, ar: raw });
      form.reset();
      await loadTaskDetail(selected.id);
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    }
  }

  async function toggleChecklist(itemId: string) {
    if (!selected) return;
    const taskId = selected.id;
    const item = selected.checklist.find((c) => c.id === itemId);
    if (!item) return;
    setRows((list) =>
      list.map((r) =>
        r.id === taskId
          ? ({
              ...r,
              checklist: r.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)),
            } as TaskRow)
          : r,
      ),
    );
    try {
      await updateTaskChecklistItem(taskId, itemId, { done: !item.done });
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    }
    await loadTaskDetail(taskId);
  }

  async function createDeliverableFromTask() {
    if (!selected) return;
    setSaving(true);
    try {
      const deliv = await convertTaskToDeliverable(selected.id);
      setRows((list) =>
        list.map((r) => (r.id === selected.id ? { ...r, deliverableId: deliv.id } : r)),
      );
      toast.push(t('demo.tasks.deliverableCreated'), 'success');
      router.push(`/app/deliverables/${deliv.id}`);
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
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
      const createdApi = await createTask(createForm.brandId, {
        title: { en: createForm.title.trim(), ar: createForm.title.trim() },
        status: 'BACKLOG',
        assigneeUserId: createForm.assignee?.trim() ? createForm.assignee.trim() : null,
        dueAt: createForm.dueAt ? `${createForm.dueAt}T12:00:00.000Z` : null,
      });
      const created = toTaskRow(createdApi);
      setCreateOpen(false);
      setCreateForm((f) => ({ ...f, title: '' }));
      await load();
      openTask(created.id);
      toast.push(t('demo.create.successTask'), 'success');
    } catch (err) {
      toast.push(opsError(err, t('demo.create.validation')), 'danger');
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
      className="oma-tasks-page"
      data-testid="demo-tasks"
      data-view={view}
      data-prefs={prefsLoaded ? '1' : '0'}
    >
      {/* Filter & sort: side drawer, full viewport height from top: 0 (above the app header).
          Opens from the inline-end edge: right in LTR, left in RTL. */}
      <AntDrawer
        open={filterSheet}
        onClose={() => setFilterSheet(false)}
        placement={locale.toLowerCase().startsWith('ar') ? 'left' : 'right'}
        size={320}
        mask={false}
        closable={false}
        title={null}
        rootClassName="oma-tasks-filter-drawer"
        styles={{ body: { padding: 0 } }}
      >
        <aside
          className="oma-req-filter-panel oma-tasks-filter-drawer__panel"
          data-testid="demo-task-filters"
          data-anchor="viewport-top"
        >
          <header className="oma-req-filter-panel__head">
            <strong>
              {locale.toLowerCase().startsWith('ar') ? 'تصفية وترتيب' : 'Filter & sort'}
            </strong>
            <button
              type="button"
              className="oma-req-filter-panel__close"
              aria-label="Close"
              onClick={() => setFilterSheet(false)}
            >
              <CloseOutlined />
            </button>
          </header>
          <div className="oma-filter-accordion-list">
            <div className="oma-filter-accordion">
              <button
                type="button"
                className="oma-filter-accordion__row"
                data-open={filterSection === 'search' ? 'true' : 'false'}
                onClick={() => setFilterSection((s) => (s === 'search' ? null : 'search'))}
              >
                <span className="oma-filter-accordion__ico">
                  <SearchOutlined />
                </span>
                <span>{t('demo.tasks.search')}</span>
                <span className="oma-filter-accordion__caret">
                  {filterSection === 'search' ? <UpOutlined /> : <DownOutlined />}
                </span>
              </button>
              {filterSection === 'search' ? (
                <div className="oma-filter-accordion__body">
                  <Input
                    value={filters.q}
                    data-testid="demo-task-search"
                    onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                    placeholder={t('demo.tasks.search')}
                  />
                </div>
              ) : null}
            </div>

            <div className="oma-filter-accordion">
              <button
                type="button"
                className="oma-filter-accordion__row"
                data-open={filterSection === 'status' ? 'true' : 'false'}
                onClick={() => setFilterSection((s) => (s === 'status' ? null : 'status'))}
              >
                <span className="oma-filter-accordion__ico">
                  <UnorderedListOutlined />
                </span>
                <span>{t('demo.tasks.filter.status')}</span>
                <span className="oma-filter-accordion__caret">
                  {filterSection === 'status' ? <UpOutlined /> : <DownOutlined />}
                </span>
              </button>
              {filterSection === 'status' ? (
                <div className="oma-filter-accordion__body">
                  <label className="oma-filter-check">
                    <input
                      type="radio"
                      name="task-status"
                      data-testid="demo-task-filter-status"
                      checked={filters.status === 'all'}
                      onChange={() => setFilters((f) => ({ ...f, status: 'all' }))}
                    />
                    <span>{t('demo.filter.all')}</span>
                  </label>
                  {BOARD_COLUMNS.map((c) => (
                    <label key={c.id} className="oma-filter-check">
                      <input
                        type="radio"
                        name="task-status"
                        checked={filters.status === c.id}
                        onChange={() => setFilters((f) => ({ ...f, status: c.id }))}
                      />
                      <span>{c.id}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="oma-filter-accordion">
              <button
                type="button"
                className="oma-filter-accordion__row"
                data-open={filterSection === 'assignee' ? 'true' : 'false'}
                onClick={() => setFilterSection((s) => (s === 'assignee' ? null : 'assignee'))}
              >
                <span className="oma-filter-accordion__ico">
                  <UserOutlined />
                </span>
                <span>{t('demo.tasks.filter.assignee')}</span>
                <span className="oma-filter-accordion__caret">
                  {filterSection === 'assignee' ? <UpOutlined /> : <DownOutlined />}
                </span>
              </button>
              {filterSection === 'assignee' ? (
                <div className="oma-filter-accordion__body">
                  <label className="oma-filter-check">
                    <input
                      type="radio"
                      name="task-assignee"
                      data-testid="demo-task-filter-assignee"
                      checked={filters.assignee === 'all'}
                      onChange={() => setFilters((f) => ({ ...f, assignee: 'all' }))}
                    />
                    <span>{t('demo.filter.all')}</span>
                  </label>
                  <label className="oma-filter-check">
                    <input
                      type="radio"
                      name="task-assignee"
                      checked={filters.assignee === 'unassigned'}
                      onChange={() => setFilters((f) => ({ ...f, assignee: 'unassigned' }))}
                    />
                    <span>Unassigned</span>
                  </label>
                  {assignees.map((a) => (
                    <label key={a} className="oma-filter-check">
                      <input
                        type="radio"
                        name="task-assignee"
                        checked={filters.assignee === a}
                        onChange={() => setFilters((f) => ({ ...f, assignee: a }))}
                      />
                      <span>{a}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="oma-filter-accordion">
              <button
                type="button"
                className="oma-filter-accordion__row"
                data-open={filterSection === 'priority' ? 'true' : 'false'}
                onClick={() => setFilterSection((s) => (s === 'priority' ? null : 'priority'))}
              >
                <span className="oma-filter-accordion__ico">
                  <FlagOutlined />
                </span>
                <span>{t('demo.tasks.filter.priority')}</span>
                <span className="oma-filter-accordion__caret">
                  {filterSection === 'priority' ? <UpOutlined /> : <DownOutlined />}
                </span>
              </button>
              {filterSection === 'priority' ? (
                <div className="oma-filter-accordion__body">
                  {(['all', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const).map((pr) => (
                    <label key={pr} className="oma-filter-check">
                      <input
                        type="radio"
                        name="task-priority"
                        data-testid={pr === 'all' ? 'demo-task-filter-priority' : undefined}
                        checked={filters.priority === pr}
                        onChange={() => setFilters((f) => ({ ...f, priority: pr }))}
                      />
                      <span>{pr === 'all' ? t('demo.filter.all') : pr}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {filterCount > 0 ? (
            <div className="oma-req-filter-panel__foot">
              <Button
                type="default"
                data-testid="demo-task-clear-filters"
                onClick={() => setFilters(EMPTY_TASK_FILTERS)}
              >
                {t('demo.requests.clearFilters') || 'Clear filters'}
              </Button>
            </div>
          ) : null}
        </aside>
      </AntDrawer>

      <PageHeader title={t('demo.tasks.title')} description={t('demo.tasks.subtitle')} />

      {headerSlot && headerSlot.isConnected
        ? createPortal(
            <div className="oma-workspace-header-actions">
              <button
                type="button"
                className="oma-req-filter-btn"
                data-testid="demo-task-open-filters"
                data-active={filterSheet ? 'true' : 'false'}
                onClick={() => setFilterSheet((v) => !v)}
              >
                <FilterOutlined />
                <span>{locale.toLowerCase().startsWith('ar') ? 'تصفية' : 'Filter'}</span>
                {filterCount > 0 ? (
                  <span className="oma-req-filter-btn__count">{filterCount}</span>
                ) : null}
              </button>
              <Button
                type="primary"
                data-testid="demo-create-task"
                onClick={() => setCreateOpen(true)}
              >
                <PlusOutlined /> {t('demo.tasks.create')}
              </Button>
            </div>,
            headerSlot,
          )
        : null}

      {viewMenuOpen && typeof document !== 'undefined'
        ? createPortal(
            <ul
              className="oma-view-menu__list oma-view-menu__list--card oma-view-menu__list--path"
              role="menu"
              data-testid="demo-tasks-view-menu"
            >
              <li role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={view === 'board'}
                  data-selected={view === 'board' ? 'true' : 'false'}
                  data-testid="demo-tasks-view-board"
                  className="oma-view-menu__item"
                  onClick={(e) => {
                    e.stopPropagation();
                    void changeView('board');
                    setViewMenuOpen(false);
                  }}
                >
                  <span className="oma-view-menu__item-icon" aria-hidden>
                    <UnorderedListOutlined />
                  </span>
                  <span>{t('demo.view.kanban')}</span>
                  <span className="oma-view-menu__check" aria-hidden>
                    {view === 'board' ? '✓' : ''}
                  </span>
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={view === 'list'}
                  data-selected={view === 'list' ? 'true' : 'false'}
                  data-testid="demo-tasks-view-list"
                  className="oma-view-menu__item"
                  onClick={(e) => {
                    e.stopPropagation();
                    void changeView('list');
                    setViewMenuOpen(false);
                  }}
                >
                  <span className="oma-view-menu__item-icon" aria-hidden>
                    <BarsOutlined />
                  </span>
                  <span>{t('demo.view.list')}</span>
                  <span className="oma-view-menu__check" aria-hidden>
                    {view === 'list' ? '✓' : ''}
                  </span>
                </button>
              </li>
            </ul>,
            document.body,
          )
        : null}

      <div className="oma-prod-strip" data-testid="demo-production-summary">
        <div className="oma-prod-stat" data-tone="wip">
          <span className="oma-prod-stat__label">{t('demo.tasks.wip')}</span>
          <strong className="oma-prod-stat__value">{summary.wip}</strong>
        </div>
        <div className="oma-prod-stat" data-tone="soon">
          <span className="oma-prod-stat__label">{t('demo.tasks.dueSoon')}</span>
          <strong className="oma-prod-stat__value">{summary.dueSoon}</strong>
        </div>
        <div className="oma-prod-stat" data-tone="blocked">
          <span className="oma-prod-stat__label">{t('demo.tasks.blocked')}</span>
          <strong className="oma-prod-stat__value">{summary.blocked}</strong>
        </div>
        <div className="oma-prod-stat" data-tone="review">
          <span className="oma-prod-stat__label">{t('demo.tasks.awaitingReview')}</span>
          <strong className="oma-prod-stat__value">{summary.awaitingReview}</strong>
        </div>
      </div>

      {loading ? <OmaTopLoader label={t('demo.loading')} /> : null}
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
          <div
            className="oma-req-workspace oma-tasks-workspace"
            data-filter-open={filterSheet ? 'true' : 'false'}
          >
            <div className="oma-req-main">
              {view === 'board' ? (
                <TasksKanbanBoard
                  byBoard={byBoard}
                  onOpenTask={openTask}
                  onMoveTask={(id, status) => void patchTask(id, { status })}
                  disabled={saving}

                  onAddInColumn={() => setCreateOpen(true)}
                />
              ) : (
                <div className="oma-req-table-wrap" data-testid="demo-task-table">
                  <table className="oma-req-table oma-task-table">
                    <thead>
                      <tr>
                        <th>{t('demo.tasks.col.title') || 'Task'}</th>
                        <th>{t('demo.tasks.filter.status')}</th>
                        <th>{t('demo.tasks.filter.assignee')}</th>
                        <th>{t('demo.tasks.filter.priority')}</th>
                        <th>{t('demo.tasks.filter.campaign')}</th>
                        <th>{t('demo.requests.col.due')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((task) => (
                        <tr
                          key={task.id}
                          data-testid={`demo-task-row-${task.id}`}
                          onClick={() => openTask(task.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="oma-task-title-cell">
                            <button
                              type="button"
                              className="oma-task-title-btn"
                              data-testid={`demo-task-open-${task.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openTask(task.id);
                              }}
                            >
                              <span className="oma-task-title-text">
                                {pickCopy(task.title, locale)}
                              </span>
                              <span className="oma-task-title-meta">
                                {task.type}
                                {(task as { campaignName?: string | null }).campaignName
                                  ? ` · ${(task as { campaignName?: string | null }).campaignName}`
                                  : (task as { requestTitle?: string | null }).requestTitle
                                    ? ` · ${(task as { requestTitle?: string | null }).requestTitle}`
                                    : ''}
                              </span>
                            </button>
                          </td>
                          <td>
                            <StatusChip status={task.status} />
                          </td>
                          <td>{task.assignee || t('demo.requests.unassigned')}</td>
                          <td>
                            <StatusChip status={task.priority} />
                          </td>
                          <td>
                            {(task as { campaignName?: string | null; brandName?: string })
                              .campaignName ||
                              (task as { brandName?: string }).brandName ||
                              '—'}
                          </td>
                          <td className="oma-ltr oma-task-due-cell">
                            <span className="oma-task-due-text">{task.dueAt}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      <Drawer open={Boolean(selected)} onClose={closeTask} label={t('demo.tasks.detail')} wide>
        {selected ? (
          <div className="oma-task-detail" data-testid="demo-task-drawer">
            <header className="oma-task-detail__head">
              <div className="oma-task-detail__head-main">
                <p className="oma-task-detail__id" title={selected.id}>
                  {[t('entity.type.task'), selected.brandName].filter(Boolean).join(' · ')}
                </p>
                <Input
                  className="oma-task-detail__title-input"
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
                <div className="oma-task-detail__chips">
                  <StatusChip status={selected.status} />
                  <StatusChip status={selected.priority} />
                </div>
              </div>
              <div className="oma-task-detail__head-actions">
                <Button data-testid="demo-task-copy-link" onClick={() => void copyLink()}>
                  {t('demo.tasks.copyLink')}
                </Button>
                <Button onClick={closeTask}>{t('common.cancel')}</Button>
              </div>
            </header>

            <div className="oma-task-detail__grid">
              <section className="oma-task-detail__card">
                <h3>{t('demo.tasks.filter.status')}</h3>
                <div className="oma-task-detail__fields">
                  <label>
                    {t('demo.tasks.filter.status')}
                    <SelectField
                      value={selected.status === 'OVERDUE' ? 'IN_PROGRESS' : selected.status}
                      data-testid="demo-task-status"
                      onChange={(e) => void patchTask(selected.id, { status: e.target.value })}
                    >
                      {moveOptions(selected.status).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </SelectField>
                  </label>
                  <label>
                    {t('demo.tasks.filter.priority')}
                    <SelectField
                      value={selected.priority}
                      data-testid="demo-task-priority"
                      onChange={(e) => void patchTask(selected.id, { priority: e.target.value })}
                    >
                      {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </SelectField>
                  </label>
                  <div className="oma-task-detail__field">
                    <span>{t('demo.tasks.filter.assignee')}</span>
                    <AssigneePicker
                      testId="demo-task-assignee"
                      members={members}
                      value={selected.assigneeUserId ?? null}
                      valueName={
                        selected.assignee && selected.assignee !== 'Unassigned'
                          ? String(selected.assignee)
                          : null
                      }
                      disabled={saving}
                      onChange={(choice) =>
                        void patchTask(selected.id, {
                          assignee: choice.userId ? choice.name : 'Unassigned',
                          assigneeId: choice.userId,
                          assigneeUserId: choice.userId,
                        } as never)
                      }
                    />
                  </div>
                  <label>
                    {t('demo.requests.col.due')}
                    <Input
                      className="oma-ltr"
                      defaultValue={selected.dueAt}
                      data-testid="demo-task-due"
                      onBlur={(e) => void patchTask(selected.id, { dueAt: e.target.value })}
                    />
                  </label>
                </div>
                {selected.blockedReason ? (
                  <p className="oma-callout" data-testid="demo-task-blocked-reason">
                    {pickCopy(selected.blockedReason, locale)}
                  </p>
                ) : null}
              </section>

              <section className="oma-task-detail__card">
                <h3>{t('entity.related')}</h3>
                <div className="oma-task-detail__links">
                  {selected.campaignId ? (
                    <EntityLink
                      type="campaign"
                      id={selected.campaignId}
                      name={selected.campaignName}
                      href={`/app/campaigns/${selected.campaignId}`}
                      className="oma-task-detail__link"
                      testId="demo-task-campaign-link"
                    />
                  ) : null}
                  {selected.contentId ? (
                    <EntityLink
                      type="content"
                      id={selected.contentId}
                      href={`/app/content?item=${selected.contentId}`}
                      className="oma-task-detail__link"
                      testId="demo-task-content-link"
                    />
                  ) : null}
                  {selected.requestId ? (
                    <EntityLink
                      type="request"
                      id={selected.requestId}
                      href={`/app/requests/${selected.requestId}`}
                      className="oma-task-detail__link"
                      testId="demo-task-request-link"
                    />
                  ) : null}
                  {selected.deliverableId ? (
                    <EntityLink
                      type="deliverable"
                      id={selected.deliverableId}
                      href={`/app/deliverables/${selected.deliverableId}`}
                      className="oma-task-detail__link"
                      testId="demo-task-deliverable-link"
                    />
                  ) : (
                    <div className="oma-task-detail__handoff">
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
              </section>

              <section className="oma-task-detail__card" data-testid="demo-task-checklist">
                <h3>{t('demo.tasks.checklist')}</h3>
                <ul className="oma-task-detail__checklist">
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
                          />
                          <span data-done={c.done ? 'true' : 'false'}>
                            {pickCopy(c.label, locale)}
                          </span>
                        </label>
                      </li>
                    ))
                  )}
                </ul>
                <form
                  className="oma-task-detail__add-row"
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
              </section>

              <section className="oma-task-detail__card" data-testid="demo-task-comments">
                <h3>{t('demo.tasks.comments')}</h3>
                <ul className="oma-task-detail__feed">
                  {selected.comments.map((c) => (
                    <li key={c.id}>
                      <div className="oma-task-detail__feed-head">
                        <strong>{c.author}</strong>
                        <time dateTime={c.at}>{formatCommentTime(c.at, locale)}</time>
                      </div>
                      <p>{pickCopy(c.body, locale)}</p>
                    </li>
                  ))}
                </ul>
                <form
                  className="oma-task-detail__add-row"
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

              <section className="oma-task-detail__card" data-testid="demo-task-activity">
                <h3>{t('demo.tasks.activity')}</h3>
                <ul className="oma-task-detail__feed">
                  {(selected.activity ?? []).map((a) => (
                    <li key={a.id}>
                      <div className="oma-task-detail__feed-head">
                        <strong>{a.actor}</strong>
                        <time dateTime={a.at}>{a.at}</time>
                      </div>
                      <p>{pickCopy(a.summary, locale)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
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
          <label>
            {t('demo.tasks.filter.assignee')}
            <SelectField
              value={createForm.assignee}
              data-testid="demo-create-task-assignee"
              onChange={(e) => setCreateForm((f) => ({ ...f, assignee: e.target.value }))}
            >
              <option value="">{t('demo.requests.unassigned')}</option>
              {members.map((m) => (
                <option key={m.id} value={m.user?.id || ''}>
                  {m.user?.name || m.user?.email || m.invited_email || 'Member'}
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
