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
import type { DemoTaskStatus } from '@oma/demo';
import {
  BOARD_COLUMNS,
  canTransitionTaskStatus,
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

/** Column accent: top border + header dot */
const COLUMN_ACCENT: Record<string, { border: string; dot: string }> = {
  BACKLOG: { border: 'border-t-slate-400', dot: 'bg-slate-400' },
  READY: { border: 'border-t-sky-500', dot: 'bg-sky-500' },
  IN_PROGRESS: { border: 'border-t-blue-500', dot: 'bg-blue-500' },
  IN_REVIEW: { border: 'border-t-amber-500', dot: 'bg-amber-500' },
  BLOCKED: { border: 'border-t-red-500', dot: 'bg-red-500' },
  DONE: { border: 'border-t-emerald-500', dot: 'bg-emerald-500' },
  OVERDUE: { border: 'border-t-rose-500', dot: 'bg-rose-500' },
};

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-slate-50 text-slate-600 border-slate-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  URGENT: 'bg-rose-50 text-rose-700 border-rose-200',
};

function PriorityBadge({ priority }: { priority: string }) {
  const p = (priority || 'MEDIUM').toUpperCase();
  const cls = PRIORITY_BADGE[p] || PRIORITY_BADGE.MEDIUM;
  return (
    <span
      className={`inline-flex items-center border text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}
    >
      {p.charAt(0) + p.slice(1).toLowerCase()}
    </span>
  );
}

function formatDue(dueAt: string, overdue: boolean, isAr: boolean): string {
  if (!dueAt) return isAr ? 'بدون موعد' : 'No due date';
  try {
    const d = new Date(dueAt.length <= 10 ? `${dueAt}T12:00:00` : dueAt);
    const label = d.toLocaleDateString(isAr ? 'ar' : undefined, {
      month: 'short',
      day: 'numeric',
    });
    if (overdue) return isAr ? `متأخر · ${label}` : `Overdue · ${label}`;
    return label;
  } catch {
    return dueAt.slice(0, 10);
  }
}

function KanbanCardBody({ task }: { task: TaskRow }) {
  const locale = useLocale();
  const isAr = locale.toLowerCase().startsWith('ar');
  const overdue = taskIsOverdue(task);
  const assignee =
    !task.assignee || task.assignee === 'Unassigned' ? null : task.assignee;
  const subtitle =
    (task as { brandName?: string; campaignName?: string | null; requestTitle?: string | null })
      .brandName ||
    (task as { campaignName?: string | null }).campaignName ||
    (task as { requestTitle?: string | null }).requestTitle ||
    task.department ||
    '';

  return (
    <>
      {/* Header: priority + drag affordance */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <PriorityBadge priority={task.priority || 'MEDIUM'} />
        <span
          className="text-slate-300 group-hover:text-slate-500 transition-colors select-none text-[11px] leading-none tracking-tighter pt-0.5"
          aria-hidden
        >
          ⠿
        </span>
      </div>

      {/* Body */}
      <h4 className="font-semibold text-slate-800 text-sm mb-1 line-clamp-2 leading-snug">
        {pickCopy(task.title, locale)}
      </h4>
      {subtitle ? (
        <p className="text-xs text-slate-500 line-clamp-1 mb-0">{subtitle}</p>
      ) : null}

      {/* Footer */}
      <div className="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            overdue ? 'text-rose-500' : 'text-slate-400'
          }`}
        >
          <svg
            className="w-3.5 h-3.5 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M8 4.75V8l2 1.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          {formatDue(task.dueAt, overdue, isAr)}
        </span>
        {assignee ? (
          <span
            className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0"
            title={assignee}
          >
            {initials(assignee)}
          </span>
        ) : (
          <span
            className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center shrink-0 border border-slate-200"
            title={isAr ? 'غير مسند' : 'Unassigned'}
          >
            —
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
  onA11yMove: (status: DemoTaskStatus) => void;
  moveOptions: DemoTaskStatus[];
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
      className={[
        'bg-white border border-slate-200 rounded-xl p-4 shadow-sm',
        'hover:shadow-md transition-all cursor-grab active:cursor-grabbing',
        'group relative',
        isDragging ? 'opacity-40 shadow-none ring-2 ring-blue-200' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-overdue={taskIsOverdue(task) ? 'true' : 'false'}
      data-testid={`demo-task-card-${task.id}`}
      data-status={task.status}
      {...attributes}
      {...listeners}
      onDoubleClick={(e) => {
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
      {/* Screen-reader only open control for accessibility without cluttering the card */}
      <button
        type="button"
        className="sr-only"
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
  const { setNodeRef } = useDroppable({ id: columnId(id), data: { type: 'column', status: id } });
  const accent = COLUMN_ACCENT[id] || COLUMN_ACCENT.BACKLOG;
  const t = useT();

  return (
    <section
      ref={setNodeRef}
      className={[
        'bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col gap-3 min-h-[500px] min-w-[260px] w-[280px] shrink-0',
        'border-t-[3px]',
        accent.border,
        isOver ? 'ring-2 ring-blue-300/60 bg-blue-50/40' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={`demo-kanban-${id}`}
      data-column={id}
    >
      <header className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full shrink-0 ${accent.dot}`} aria-hidden />
        <h3 className="font-semibold text-slate-800 text-sm flex-1 truncate m-0">{title}</h3>
        <span
          className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-medium tabular-nums"
          data-testid={`demo-kanban-count-${id}`}
        >
          {count}
        </span>
        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors text-lg leading-none"
            aria-label={t('demo.tasks.create') || 'Add task'}
            title={t('demo.tasks.create') || 'Add task'}
          >
            +
          </button>
        ) : null}
      </header>

      <div className="oma-kanban-cards flex flex-col gap-3 flex-1">{children}</div>

      {empty ? (
        <div
          className={[
            'border-2 border-dashed border-slate-200 rounded-xl p-6 text-center',
            'text-slate-400 text-xs transition-colors',
            isOver ? 'border-blue-400 bg-blue-50/50 text-blue-500' : 'hover:border-slate-400',
          ].join(' ')}
          aria-hidden
        >
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<DemoTaskStatus | null>(null);
  const [localBoard, setLocalBoard] = useState(byBoard);

  const boardKey = useMemo(
    () =>
      BOARD_COLUMNS.map(
        (c) => `${c.id}:${(byBoard[c.id] ?? []).map((x) => `${x.id}:${x.status}`).join(',')}`,
      ).join('|'),
    [byBoard],
  );
  useEffect(() => {
    setLocalBoard(byBoard);
  }, [boardKey, byBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const col of BOARD_COLUMNS) {
      const hit = (localBoard[col.id] ?? []).find((x) => x.id === activeId);
      if (hit) return hit;
    }
    return null;
  }, [activeId, localBoard]);

  function moveOptions(status: DemoTaskStatus) {
    return (
      ['BACKLOG', 'READY', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'] as DemoTaskStatus[]
    ).filter((s) => canTransitionTaskStatus(status === 'OVERDUE' ? 'OVERDUE' : status, s));
  }

  function resolveOverColumn(overId: string | undefined): DemoTaskStatus | null {
    if (!overId) return null;
    const asCol = parseColumnId(overId);
    if (asCol) return asCol;
    return findColumnForTask(overId, localBoard);
  }

  function onDragStart(e: DragStartEvent) {
    if (disabled) return;
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    setOverColumn(resolveOverColumn(e.over ? String(e.over.id) : undefined));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setOverColumn(null);
    if (disabled) return;
    const taskId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
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

    // Same column reorder (local only)
    if (fromCol === toCol) {
      const list = [...(localBoard[fromCol] ?? [])];
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
        className="oma-kanban bg-slate-100 p-4 md:p-6 rounded-2xl overflow-x-auto"
        data-testid="demo-tasks-board"
        data-dnd="true"
        data-reorder-persistence="local-only"
        dir="auto"
      >
        <div className="flex gap-4 items-start min-w-min pb-2">
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
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-lg w-[260px] rotate-[2deg] cursor-grabbing"
            data-testid="demo-kanban-drag-overlay"
          >
            <KanbanCardBody task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
