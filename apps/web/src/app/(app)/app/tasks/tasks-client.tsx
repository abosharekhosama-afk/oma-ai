'use client';
import { TasksShimmer } from '../../../../components/ui/screen-shimmer';

import { useReloadOnBrandChange } from '../../../../lib/active-brand';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DemoGraph, DemoTaskStatus } from '@oma/demo';
import {
  Button,
  Checkbox,
  DatePicker,
  Drawer as AntDrawer,
  Input,
  SelectField,
  TextArea,
} from '@oma/ui/controls';
import { Dialog } from '../../../../components/ui/dialog';
import { AssigneePicker } from '../../../../components/ui/assignee-picker';
import { EntityLink } from '../../../../components/ui/entity-link';
import { StatusChip, statusLabel } from '../../../../components/ui/status-chip';
import { useToast } from '../../../../components/ui/toast';
import { daysFromToday, formatCommentTime } from '../../../../lib/calendar-today';
import dayjs from 'dayjs';
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
  type TaskFilters,
  type TaskRow,
} from '../../../../lib/demo/stage4-tasks';
import { clearBreadcrumbViewSlot } from '../../../../lib/breadcrumb-view-slot';
import { PlxHeaderFilter } from '../../../../components/ui/plx-header-filter';
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
} from '../../../../components/ui/lucide-icons';

type ViewMode = 'board' | 'list';
type Brand = DemoGraph['brands'][number];
type Campaign = { id: string; brandId: string; name: { en: string; ar: string } };

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
  const [filterSheet, setFilterSheet] = useState(false);
  const [filterSection, setFilterSection] = useState<string | null>('search');
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [creating, setCreating] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    brandId: '',
    campaignId: '',
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
      setCampaigns(ws.campaigns);
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

  // Refresh when the active brand changes in the header switcher.
  useReloadOnBrandChange(load);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => {
      if (mq.matches) setView('list');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = window.localStorage.getItem('oma.tasks.defaultView');
      if (window.matchMedia('(max-width: 767px)').matches) {
        setView('list');
      } else if (raw === 'board' || raw === 'list') {
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
    setView('board');
  }, [searchParams]);

  useEffect(() => {
    const el = document.getElementById('oma-content-view-slot');
    if (!el) return;
    clearBreadcrumbViewSlot(el);
    return () => clearBreadcrumbViewSlot(el);
  }, []);

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

  const filtered = useMemo(() => filterTasks(rows, filters, locale), [rows, filters, locale]);
  const byBoard = useMemo(() => groupTasksByBoard(filtered), [filtered]);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
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
      const campaignOk = campaigns.some(
        (c) => c.id === createForm.campaignId && c.brandId === createForm.brandId,
      );
      const description = createForm.description.trim();
      const createdApi = await createTask(createForm.brandId, {
        title: { en: createForm.title.trim(), ar: createForm.title.trim() },
        description: description ? { en: description, ar: description } : undefined,
        status: 'BACKLOG',
        priority: createForm.priority,
        campaignId: campaignOk ? createForm.campaignId : null,
        assigneeUserId: createForm.assignee?.trim() ? createForm.assignee.trim() : null,
        dueAt: createForm.dueAt ? `${createForm.dueAt}T12:00:00.000Z` : null,
      });
      const created = toTaskRow(createdApi);
      setCreateOpen(false);
      setCreateForm((f) => ({ ...f, title: '', description: '', campaignId: '' }));
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

  const filterLabel = locale.toLowerCase().startsWith('ar') ? 'تصفية' : 'Filter';
  const filterPanelTitle =
    locale.toLowerCase().startsWith('ar') ? 'تصفية وترتيب' : 'Filter & sort';

  return (
    <div
      className="oma-plx-deliverables oma-plx-tasks"
      data-testid="demo-tasks"
      data-view="board"
      data-prefs={prefsLoaded ? '1' : '0'}
      data-filter-open={filterSheet ? 'true' : 'false'}
    >
      <PlxHeaderFilter
        headerSlot={headerSlot}
        open={filterSheet}
        onOpenChange={setFilterSheet}
        filterTestId="demo-task-open-filters"
        filterLabel={filterLabel}
        filterCount={filterCount}
        panelTitle={filterPanelTitle}
        panelTestId="demo-task-filters"
        createTestId="demo-create-task"
        createLabel={t('demo.tasks.create')}
        onCreateClick={() => setCreateOpen(true)}
        footer={
          filterCount > 0 ? (
            <Button
              type="default"
              data-testid="demo-task-clear-filters"
              onClick={() => setFilters(EMPTY_TASK_FILTERS)}
            >
              {t('demo.requests.clearFilters') || 'Clear filters'}
            </Button>
          ) : null
        }
      >
        <div className="oma-filter-accordion-list oma-plx-deliv-filter-accordion-list">
          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'search' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'search' ? null : 'search'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
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
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
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
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
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
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
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
      </PlxHeaderFilter>

      <div className="oma-plx-listening__intro oma-plx-deliv__intro">
        <div>
          <h1 className="oma-plx-listening__title">{t('demo.tasks.title')}</h1>
          <p className="oma-plx-deliv__subtitle">{t('demo.tasks.subtitle')}</p>
        </div>
        {!loading && !unavailable && !error ? (
          <p className="oma-plx-listening__next-check" data-testid="demo-task-result-count">
            {filtered.length} / {rows.length}
          </p>
        ) : null}
      </div>

      {loading ? <TasksShimmer part="body" /> : null}
      {unavailable ? (
        <p className="oma-muted" data-testid="demo-tasks-denied">
          {t('demo.unavailable')}
        </p>
      ) : null}
      {error ? (
        <p className="oma-inbox-error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !unavailable && !error ? (
        <div className="oma-plx-deliv-workspace oma-plx-tasks-workspace">
          <div className="oma-plx-deliv-workspace__main">
            <section className="oma-plx-listening-panel oma-plx-tasks-panel">
              <TasksKanbanBoard
                byBoard={byBoard}
                onOpenTask={openTask}
                onMoveTask={(id, status) => void patchTask(id, { status })}
                disabled={saving}
                onAddInColumn={() => setCreateOpen(true)}
              />
            </section>
          </div>
        </div>
      ) : null}

      <AntDrawer
        open={Boolean(selected)}
        onClose={closeTask}
        placement={locale.toLowerCase().startsWith('ar') ? 'left' : 'right'}
        mask={false}
        closable={false}
        title={null}
        keyboard
        destroyOnHidden
        rootClassName="oma-task-detail-drawer"
        styles={{ body: { padding: 0 } }}
      >
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
                <button
                  type="button"
                  className="oma-req-filter-panel__close"
                  aria-label={t('common.cancel')}
                  onClick={closeTask}
                >
                  <CloseOutlined />
                </button>
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
                      {[
                        selected.status === 'OVERDUE' ? 'IN_PROGRESS' : selected.status,
                        ...moveOptions(selected.status),
                      ]
                        .filter((s, index, all) => all.indexOf(s) === index)
                        .map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(t, s)}
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
                          {statusLabel(t, s)}
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
      </AntDrawer>

      <Dialog
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title={t('demo.tasks.create')}
        size="lg"
        className="oma-compose-dialog"
      >
        <div className="oma-compose" data-testid="demo-create-task-dialog">
          <div className="oma-compose__grid">
            <label className="oma-compose__wide">
              {t('demo.create.title')}
              <Input
                value={createForm.title}
                data-testid="demo-create-task-title"
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label className="oma-compose__wide">
              {t('demo.requests.description')}
              <TextArea
                rows={3}
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label>
              {t('demo.requests.filter.brand')}
              <SelectField
                value={createForm.brandId}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    brandId: e.target.value,
                    campaignId: campaigns.some(
                      (c) => c.id === f.campaignId && c.brandId === e.target.value,
                    )
                      ? f.campaignId
                      : '',
                  }))
                }
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {pickCopy(b.name, locale)}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              {t('demo.create.campaign')}
              <SelectField
                value={createForm.campaignId}
                onChange={(e) => setCreateForm((f) => ({ ...f, campaignId: e.target.value }))}
              >
                <option value="">{t('demo.optional')}</option>
                {campaigns
                  .filter((c) => c.brandId === createForm.brandId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {pickCopy(c.name, locale)}
                    </option>
                  ))}
              </SelectField>
            </label>
            <label>
              {t('demo.tasks.filter.priority')}
              <SelectField
                value={createForm.priority}
                onChange={(e) => setCreateForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              {t('demo.requests.col.due')}
              <DatePicker
                value={createForm.dueAt ? dayjs(createForm.dueAt) : null}
                onChange={(_, dateString) =>
                  setCreateForm((f) => ({
                    ...f,
                    dueAt: Array.isArray(dateString) ? (dateString[0] ?? '') : dateString,
                  }))
                }
              />
            </label>
            <label className="oma-compose__wide">
              {t('demo.tasks.filter.assignee')}
              <SelectField
                value={createForm.assignee}
                data-testid="demo-create-task-assignee"
                onChange={(e) => setCreateForm((f) => ({ ...f, assignee: e.target.value }))}
              >
                <option value="">{t('demo.requests.unassigned')}</option>
                {members
                  .filter((m) => m.user?.id)
                  .map((m) => (
                    <option key={m.id} value={m.user?.id || ''}>
                      {m.user?.name || m.user?.email || m.invited_email || 'Member'}
                    </option>
                  ))}
              </SelectField>
            </label>
          </div>
          <div className="oma-compose__footer">
            <Button type="default" disabled={creating} onClick={() => setCreateOpen(false)}>
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
