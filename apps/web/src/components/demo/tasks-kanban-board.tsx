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
import { StatusChip } from '../ui/status-chip';
import {
  BOARD_COLUMNS,
  canTransitionTaskStatus,
  checklistProgress,
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

function KanbanCardBody({
  task,
  dragHandleProps,
}: {
  task: TaskRow;
  dragHandleProps?: Record<string, unknown>;
}) {
  const t = useT();
  const locale = useLocale();
  const progress = checklistProgress(task);
  return (
    <>
      <div className="oma-kanban-card-main" {...dragHandleProps}>
        <strong>{pickCopy(task.title, locale)}</strong>
        <div className="oma-chip-row">
          <StatusChip status={task.priority} />
          <span className="oma-kanban-meta">{task.type}</span>
          {task.status === 'BLOCKED' || task.status === 'IN_REVIEW' ? (
            <StatusChip status={task.status} />
          ) : null}
        </div>
        <div className="oma-kanban-meta">
          {task.assignee} · {task.dueAt}
          {taskIsOverdue(task) ? ` · ${t('demo.requests.overdue')}` : ''}
        </div>
        {task.campaignId || task.requestId ? (
          <div className="oma-kanban-meta">
            {[task.campaignId, task.requestId].filter(Boolean).join(' · ')}
          </div>
        ) : null}
        {progress.total ? (
          <div className="oma-kanban-meta" data-testid={`demo-task-progress-${task.id}`}>
            {progress.done}/{progress.total} · {progress.pct}%
          </div>
        ) : null}
      </div>
    </>
  );
}

function SortableTaskCard({
  task,
  onOpen,
  onA11yMove,
  moveOptions,
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
      className={`oma-kanban-card${isDragging ? ' is-dragging' : ''}`}
      data-overdue={taskIsOverdue(task) ? 'true' : 'false'}
      data-testid={`demo-task-card-${task.id}`}
      data-status={task.status}
      {...attributes}
      {...listeners}
    >
      <div className="oma-kanban-card-toolbar">
        <span className="oma-kanban-drag-affordance" aria-hidden>
          ⋮⋮
        </span>
        <button
          type="button"
          className="oma-kanban-card-open"
          data-testid={`demo-task-open-${task.id}`}
          aria-label={`${t('demo.tasks.detail')}: ${pickCopy(task.title, locale)}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {t('demo.tasks.open')}
        </button>
      </div>
      <KanbanCardBody task={task} />
      <label className="oma-kanban-a11y-move" onPointerDown={(e) => e.stopPropagation()}>
        <span className="oma-sr-only">{t('demo.tasks.move')}</span>
        <select
          className="oma-select"
          value={task.status === 'OVERDUE' ? 'IN_PROGRESS' : task.status}
          aria-label={`${t('demo.tasks.move')} ${pickCopy(task.title, locale)}`}
          data-testid={`demo-task-move-${task.id}`}
          onChange={(e) => onA11yMove(e.target.value as DemoTaskStatus)}
        >
          {moveOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

function DroppableColumn({
  id,
  title,
  count,
  children,
  isOver,
}: {
  id: DemoTaskStatus;
  title: string;
  count: number;
  children: React.ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: columnId(id), data: { type: 'column', status: id } });
  return (
    <section
      ref={setNodeRef}
      className={`oma-kanban-col${isOver ? ' is-over' : ''}`}
      data-testid={`demo-kanban-${id}`}
      data-column={id}
    >
      <h3>
        <span>{title}</span>
        <span data-testid={`demo-kanban-count-${id}`}>{count}</span>
      </h3>
      <div className="oma-kanban-cards">{children}</div>
    </section>
  );
}

export function TasksKanbanBoard({ byBoard, onOpenTask, onMoveTask, disabled }: Props) {
  const t = useT();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<DemoTaskStatus | null>(null);
  const [localBoard, setLocalBoard] = useState(byBoard);

  // Sync when parent data changes (after load / successful patch)
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

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragOver(event: DragOverEvent) {
    const col = resolveOverColumn(event.over ? String(event.over.id) : undefined);
    setOverColumn(col);
  }

  async function onDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const fromCol = findColumnForTask(taskId, localBoard);
    const toCol = resolveOverColumn(event.over ? String(event.over.id) : undefined);
    setActiveId(null);
    setOverColumn(null);
    if (!fromCol || !toCol || disabled) return;

    const task = (localBoard[fromCol] ?? []).find((x) => x.id === taskId);
    if (!task) return;

    if (fromCol === toCol) {
      const list = [...(localBoard[fromCol] ?? [])];
      const oldIndex = list.findIndex((x) => x.id === taskId);
      const overId = event.over ? String(event.over.id) : null;
      const newIndex = overId ? list.findIndex((x) => x.id === overId) : oldIndex;
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        setLocalBoard((prev) => ({
          ...prev,
          [fromCol]: arrayMove(list, oldIndex, newIndex),
        }));
      }
      return;
    }

    const targetStatus: DemoTaskStatus = toCol;
    if (!canTransitionTaskStatus(task.status, targetStatus)) {
      await onMoveTask(taskId, targetStatus);
      return;
    }

    setLocalBoard((prev) => {
      const next: Record<string, TaskRow[]> = { ...prev };
      next[fromCol] = (prev[fromCol] ?? []).filter((x) => x.id !== taskId);
      next[toCol] = [{ ...task, status: targetStatus }, ...(prev[toCol] ?? [])];
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
      <div className="oma-kanban" data-testid="demo-tasks-board" data-dnd="true">
        {BOARD_COLUMNS.map((col) => {
          const items = localBoard[col.id] ?? [];
          return (
            <DroppableColumn
              key={col.id}
              id={col.id}
              title={t(`demo.tasks.column.${col.id}`)}
              count={items.length}
              isOver={overColumn === col.id}
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
              {items.length === 0 ? (
                <div className="oma-kanban-drop-hint" aria-hidden>
                  {t('demo.tasks.dropHere')}
                </div>
              ) : null}
            </DroppableColumn>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="oma-kanban-card is-overlay" data-testid="demo-kanban-drag-overlay">
            <KanbanCardBody task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
