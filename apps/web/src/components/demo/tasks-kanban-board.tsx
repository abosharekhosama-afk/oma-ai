'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState } from 'react';
import { briefDisplayText } from '../../lib/ops-api';
import type { DemoTaskStatus } from '@oma/demo';
import {
  BOARD_COLUMNS,
  canTransitionTaskStatus,
  taskIsDueSoon,
  taskIsOverdue,
  type TaskRow,
} from '../../lib/demo/stage4-tasks';
import { pickCopy } from '../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../lib/use-locale';

type Props = {
  byBoard: Record<string, TaskRow[]>;
  onOpenTask: (id: string) => void;
  onMoveTask: (id: string, status: DemoTaskStatus) => Promise<void> | void;
  disabled?: boolean;
  onAddInColumn?: (status: DemoTaskStatus) => void;
};

function columnId(status: DemoTaskStatus) {
  return `col:${status}`;
}

function parseColumnId(id: string | null | undefined): DemoTaskStatus | null {
  if (!id?.startsWith('col:')) return null;
  return id.slice(4) as DemoTaskStatus;
}

function findColumnForTask(
  taskId: string,
  board: Record<string, TaskRow[]>,
): DemoTaskStatus | null {
  for (const col of BOARD_COLUMNS) {
    if ((board[col.id] ?? []).some((t) => t.id === taskId)) return col.id;
  }
  return null;
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

const COLUMN_ACCENT: Record<string, string> = {
  BACKLOG: 'backlog',
  READY: 'ready',
  IN_PROGRESS: 'progress',
  IN_REVIEW: 'review',
  BLOCKED: 'blocked',
  DONE: 'done',
  OVERDUE: 'overdue',
};

function isAr(locale: string) {
  return locale.toLowerCase().startsWith('ar');
}

/** High / Urgent only — Medium/Low are the quiet default and render nothing. */
function PriorityFlag({ priority }: { priority: string }) {
  const t = useT();
  const p = (priority || '').toUpperCase();
  if (p !== 'HIGH' && p !== 'URGENT') return null;
  return (
    <span
      className={`oma-kb-card__flag oma-kb-card__flag--${p.toLowerCase()}`}
      data-testid="demo-task-card-priority"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M3.5 14V2.5h8.2l-1.6 3 1.6 3H3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {t(`demo.tasks.card.priority.${p.toLowerCase()}`)}
    </span>
  );
}

function formatDueLabel(dueAt: string, locale: string): string {
  try {
    const d = new Date(dueAt.length <= 10 ? `${dueAt}T12:00:00` : dueAt);
    return d.toLocaleDateString(isAr(locale) ? 'ar' : 'en', { month: 'short', day: 'numeric' });
  } catch {
    return dueAt.slice(0, 10);
  }
}

function DueDate({ task }: { task: TaskRow }) {
  const t = useT();
  const locale = useLocale();
  if (!task.dueAt) return null;
  const label = formatDueLabel(task.dueAt, locale);
  const done = task.status === 'DONE';
  const overdue = taskIsOverdue(task);
  const soon = !overdue && !done && taskIsDueSoon(task);
  const tone = done ? 'done' : overdue ? 'overdue' : soon ? 'soon' : 'plain';
  return (
    <span className={`oma-kb-card__due oma-kb-card__due--${tone}`} data-tone={tone}>
      {tone === 'overdue' ? null : (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2 6.5h12M5 1.8v2.4M11 1.8v2.4" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      )}
      {tone === 'overdue' ? `${t('demo.tasks.card.overdue')} · ${label}` : label}
    </span>
  );
}

function campaignLabel(task: TaskRow, locale: string): string {
  const c = task.campaignName;
  if (!c) return '';
  return typeof c === 'string' ? c : pickCopy(c, locale);
}

function KanbanCardBody({ task }: { task: TaskRow }) {
  const t = useT();
  const locale = useLocale();
  const assignee = !task.assignee || task.assignee === 'Unassigned' ? null : String(task.assignee);
  const campaign = campaignLabel(task, locale);
  const description = task.description ? briefDisplayText(task.description, locale) : '';
  const context = [task.department, task.brandName]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v && v !== '—')
    .join(' · ');
  const comments = task.commentCount ?? 0;
  const checkTotal = task.checklistTotal ?? 0;
  const checkDone = task.checklistDone ?? 0;

  return (
    <>
      {campaign ? (
        <div className="oma-kb-card__labels">
          <span className="oma-kb-card__tag" data-testid="demo-task-card-campaign">
            {campaign}
          </span>
        </div>
      ) : null}
      <h4 className="oma-kb-card__title">{pickCopy(task.title, locale)}</h4>
      {description ? <p className="oma-kb-card__desc">{description}</p> : null}
      {context ? <p className="oma-kb-card__ctx">{context}</p> : null}
      <div className="oma-kb-card__meta">
        <PriorityFlag priority={String(task.priority || '')} />
        <DueDate task={task} />
        {comments > 0 ? (
          <span
            className="oma-kb-card__count"
            title={t('demo.tasks.card.comments')}
            aria-label={`${comments} ${t('demo.tasks.card.comments')}`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
            {comments}
          </span>
        ) : null}
        {checkTotal > 0 ? (
          <span
            className={`oma-kb-card__count${checkDone === checkTotal ? ' is-complete' : ''}`}
            title={t('demo.tasks.card.checklist')}
            aria-label={`${t('demo.tasks.card.checklist')} ${checkDone}/${checkTotal}`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect
                x="2.5"
                y="2.5"
                width="11"
                height="11"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M5.5 8l2 2 3.5-4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <span className="oma-ltr">{`${checkDone}/${checkTotal}`}</span>
          </span>
        ) : null}
        {assignee ? (
          <span className="oma-kb-card__avatar oma-task-avatar" title={assignee}>
            {initials(assignee)}
          </span>
        ) : (
          <span
            className="oma-kb-card__avatar oma-kb-card__avatar--empty oma-task-avatar"
            title={t('demo.tasks.card.unassigned')}
            aria-label={t('demo.tasks.card.unassigned')}
          >
            +
          </span>
        )}
      </div>
    </>
  );
}

function SortableTaskCard({
  task,
  onOpen,
}: {
  task: TaskRow;
  onOpen: () => void;
  onA11yMove?: (status: DemoTaskStatus) => void;
  moveOptions?: DemoTaskStatus[];
}) {
  const t = useT();
  const locale = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`oma-kb-card oma-kb-card--${String(task.status).toLowerCase()}${
        isDragging ? ' is-dragging' : ''
      }`}
      data-overdue={taskIsOverdue(task) ? 'true' : 'false'}
      data-testid={`demo-task-card-${task.id}`}
      data-status={task.status}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // PointerSensor needs 6px of movement to start a drag, so a plain click opens.
        e.stopPropagation();
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${t('demo.tasks.detail')}: ${pickCopy(task.title, locale)}`}
    >
      <KanbanCardBody task={task} />
      <button
        type="button"
        className="oma-sr-only"
        tabIndex={-1}
        data-testid={`demo-task-open-${task.id}`}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        {t('demo.tasks.open')}
      </button>
    </article>
  );
}

function DroppableColumn({
  id,
  title,
  count,
  children,
  isOver,
  empty,
  onAdd,
}: {
  id: DemoTaskStatus;
  title: string;
  count: number;
  children: React.ReactNode;
  isOver: boolean;
  empty: boolean;
  onAdd?: () => void;
}) {
  const { setNodeRef } = useDroppable({
    id: columnId(id),
    data: { type: 'column', status: id },
  });
  const accent = COLUMN_ACCENT[id] || 'backlog';
  const t = useT();

  return (
    <section
      ref={setNodeRef}
      className={`oma-kb-col oma-kb-col--${accent}${isOver ? ' is-over' : ''}`}
      data-testid={`demo-kanban-${id}`}
      data-column={id}
      data-accent={accent}
    >
      <header className="oma-kb-col__head">
        <span className="oma-kb-col__dot" aria-hidden />
        <h3 className="oma-kb-col__title">{title}</h3>
        <span className="oma-kb-col__count" data-testid={`demo-kanban-count-${id}`}>
          {count}
        </span>
        {onAdd ? (
          <button
            type="button"
            className="oma-kb-col__add"
            onClick={onAdd}
            aria-label={t('demo.tasks.create') || 'Add task'}
            title={t('demo.tasks.create') || 'Add task'}
          >
            +
          </button>
        ) : null}
      </header>

      <div className="oma-kb-col__cards">{children}</div>

      {empty ? (
        <div className={`oma-kb-col__empty${isOver ? ' is-over' : ''}`} aria-hidden>
          {t('demo.tasks.dropHere') || 'Drop tasks here'}
        </div>
      ) : null}
    </section>
  );
}

export function TasksKanbanBoard({
  byBoard,
  onOpenTask,
  onMoveTask,
  disabled,
  onAddInColumn,
}: Props) {
  const t = useT();
  const [localBoard, setLocalBoard] = useState(byBoard);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<DemoTaskStatus | null>(null);

  useEffect(() => {
    setLocalBoard(byBoard);
  }, [byBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const col of BOARD_COLUMNS) {
      const found = (localBoard[col.id] ?? []).find((x) => x.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, localBoard]);

  function moveOptions(status: DemoTaskStatus): DemoTaskStatus[] {
    return BOARD_COLUMNS.map((c) => c.id).filter(
      (s) => s !== status && canTransitionTaskStatus(status, s),
    );
  }

  function onDragStart(e: DragStartEvent) {
    if (disabled) return;
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const overId = e.over?.id ? String(e.over.id) : null;
    const col = parseColumnId(overId) ?? findColumnForTask(overId ?? '', localBoard);
    setOverColumn(col);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setOverColumn(null);
    if (disabled) return;

    const taskId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const fromCol = findColumnForTask(taskId, localBoard);
    if (!fromCol) return;

    let toCol = parseColumnId(overId);
    if (!toCol) {
      toCol = findColumnForTask(overId, localBoard);
    }
    if (!toCol) return;

    const task = (localBoard[fromCol] ?? []).find((x) => x.id === taskId);
    if (!task) return;

    if (fromCol === toCol) {
      const list = localBoard[fromCol] ?? [];
      const oldIndex = list.findIndex((x) => x.id === taskId);
      const newIndex = list.findIndex((x) => x.id === overId);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        setLocalBoard((prev) => ({
          ...prev,
          [fromCol]: arrayMove(list, oldIndex, newIndex),
        }));
      }
      return;
    }

    if (!canTransitionTaskStatus(fromCol, toCol)) return;

    const targetStatus = toCol;
    setLocalBoard((prev) => {
      const next: Record<string, TaskRow[]> = { ...prev };
      next[fromCol] = (prev[fromCol] ?? []).filter((x) => x.id !== taskId);
      next[toCol!] = [{ ...task, status: targetStatus }, ...(prev[toCol!] ?? [])];
      return next;
    });
    await onMoveTask(taskId, targetStatus);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={(e) => void onDragEnd(e)}
      onDragCancel={() => {
        setActiveId(null);
        setOverColumn(null);
      }}
    >
      <div
        className="oma-kb-board"
        data-testid="demo-tasks-board"
        data-dnd="true"
        data-reorder-persistence="local-only"
        dir="auto"
      >
        <div className="oma-kb-board__grid">
          {BOARD_COLUMNS.map((col) => {
            const items = localBoard[col.id] ?? [];
            return (
              <DroppableColumn
                key={col.id}
                id={col.id}
                title={t(`demo.tasks.column.${col.id}`)}
                count={items.length}
                isOver={overColumn === col.id}
                empty={items.length === 0}
                onAdd={onAddInColumn ? () => onAddInColumn(col.id) : undefined}
              >
                <SortableContext
                  items={items.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {items.map((task) => (
                    <SortableTaskCard
                      key={task.id}
                      task={task}
                      onOpen={() => onOpenTask(task.id)}
                      onA11yMove={(status) => void onMoveTask(task.id, status)}
                      moveOptions={moveOptions(task.status)}
                    />
                  ))}
                </SortableContext>
              </DroppableColumn>
            );
          })}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div
            className={`oma-kb-card oma-kb-card--overlay oma-kb-card--${String(activeTask.status).toLowerCase()}`}
            data-testid="demo-kanban-drag-overlay"
          >
            <KanbanCardBody task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
