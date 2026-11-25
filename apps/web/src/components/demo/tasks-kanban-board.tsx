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
  taskIsOverdue,
  type TaskRow,
} from '../../lib/demo/stage4-tasks';
import { pickCopy } from '../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../lib/use-locale';
import { MediaSurface, kindFromMime, kindFromUrl } from '../content/media-surface';
import {
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CommentOutlined,
  EyeOutlined,
  FlagOutlined,
  InboxOutlined,
  LockOutlined,
  PlayCircleOutlined,
} from '../ui/lucide-icons';
import type { ReactNode } from 'react';

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

const COLUMN_ACCENT: Record<string, string> = {
  BACKLOG: 'backlog',
  READY: 'ready',
  IN_PROGRESS: 'progress',
  IN_REVIEW: 'review',
  BLOCKED: 'blocked',
  DONE: 'done',
  OVERDUE: 'overdue',
};

function ColumnSecIcon({ status }: { status: DemoTaskStatus }) {
  const cls = 'oma-plx-approvals__sec-ico oma-lucide--soft';
  const map: Record<string, ReactNode> = {
    BACKLOG: <InboxOutlined className={cls} width={14} height={14} />,
    READY: <ClockCircleOutlined className={cls} width={14} height={14} />,
    IN_PROGRESS: <PlayCircleOutlined className={cls} width={14} height={14} />,
    IN_REVIEW: <EyeOutlined className={cls} width={14} height={14} />,
    BLOCKED: <LockOutlined className={cls} width={14} height={14} />,
    DONE: <CheckCircleOutlined className={cls} width={14} height={14} />,
  };
  return map[status] ?? <CheckOutlined className={cls} width={14} height={14} />;
}

function isAr(locale: string) {
  return locale.toLowerCase().startsWith('ar');
}

function formatDueLabel(dueAt: string, locale: string): string {
  try {
    const d = new Date(dueAt.length <= 10 ? `${dueAt}T12:00:00` : dueAt);
    return d.toLocaleDateString(isAr(locale) ? 'ar' : 'en', { month: 'short', day: 'numeric' });
  } catch {
    return dueAt.slice(0, 10);
  }
}

function campaignLabel(task: TaskRow, locale: string): string {
  const c = task.campaignName;
  if (!c) return '';
  return typeof c === 'string' ? c : pickCopy(c, locale);
}

function KanbanCardBody({ task }: { task: TaskRow }) {
  const t = useT();
  const locale = useLocale();
  const campaign = campaignLabel(task, locale);
  const brand =
    typeof task.brandName === 'string' ? task.brandName.trim() : campaign || t('demo.tasks.detail');
  const comments = task.commentCount ?? 0;
  const title = pickCopy(task.title, locale);
  const caption = task.description ? briefDisplayText(task.description, locale) : title;
  const mediaUrl = task.previewAsset || '';
  const isVideo = (kindFromMime(task.previewAssetMime) ?? kindFromUrl(mediaUrl)) === 'video';
  const dueMeta = task.dueAt ? formatDueLabel(task.dueAt, locale) : '';
  const overdue = taskIsOverdue(task);
  const statusKey = String(task.status || 'BACKLOG');

  return (
    <>
      <header className="oma-plx-approvals-card__head">
        <span className="oma-plx-approvals-card__nets">
          <FlagOutlined
            className="oma-plx-approvals-card__clock oma-lucide--soft"
            width={14}
            height={14}
          />
        </span>
        <strong className="oma-plx-approvals-card__brand">{brand}</strong>
        {dueMeta ? (
          <span
            className="oma-plx-approvals-card__time"
            data-scheduled={overdue ? 'true' : 'false'}
          >
            {overdue ? <ClockCircleOutlined className="oma-plx-approvals-card__clock" /> : null}
            <span>{overdue ? `${t('demo.tasks.card.overdue')} · ${dueMeta}` : dueMeta}</span>
          </span>
        ) : null}
      </header>
      <div className="oma-plx-approvals-card__media">
        {mediaUrl ? (
          <>
            <MediaSurface src={mediaUrl} mime={task.previewAssetMime} alt={title} />
            {isVideo ? (
              <span className="oma-plx-approvals-card__media-badge" aria-hidden>
                <PlayCircleOutlined />
              </span>
            ) : null}
          </>
        ) : (
          <div className="oma-plx-approvals-card__media-empty" aria-hidden />
        )}
      </div>
      <p className="oma-plx-approvals-card__caption">{caption}</p>
      <footer className="oma-plx-approvals-card__foot">
        <span className="oma-plx-approvals-card__status oma-plx-approvals-card__status--pending">
          <span className="oma-plx-approvals-card__status-ring" />
          <span>{t(`demo.tasks.column.${statusKey}`)}</span>
        </span>
        {comments > 0 ? (
          <span className="oma-plx-approvals-card__comments">
            <CommentOutlined className="oma-lucide--soft" width={14} height={14} />
            <span>{comments}</span>
          </span>
        ) : null}
      </footer>
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
    <li>
      <article
        ref={setNodeRef}
        style={style}
        className={`oma-plx-approvals-card${isDragging ? ' is-dragging' : ''}`}
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
        {onA11yMove && moveOptions && moveOptions.length > 0 ? (
          <label className="oma-sr-only">
            {t('demo.tasks.move')}
            <select
              data-testid={`demo-task-move-${task.id}`}
              value=""
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                const next = e.target.value as DemoTaskStatus;
                if (next) onA11yMove(next);
              }}
            >
              <option value="">{t('demo.tasks.move')}</option>
              {moveOptions.map((status) => (
                <option key={status} value={status}>
                  {t(`demo.tasks.column.${status}`)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
    </li>
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
      className="oma-plx-approvals__column-wrap"
      data-testid={`demo-kanban-${id}`}
      data-column={id}
      data-accent={accent}
    >
      <header className="oma-plx-approvals__column-head">
        <span className="oma-plx-approvals__column-title">
          <ColumnSecIcon status={id} />
          <span>{title}</span>
        </span>
        <span
          className={`oma-plx-approvals__column-count oma-plx-approvals__column-count--task-${accent}`}
          data-testid={`demo-kanban-count-${id}`}
        >
          {count}
        </span>
        {onAdd ? (
          <button
            type="button"
            className="oma-plx-tasks-col__add oma-icon-action oma-icon-action--bare"
            onClick={onAdd}
            aria-label={t('demo.tasks.create') || 'Add task'}
            title={t('demo.tasks.create') || 'Add task'}
          >
            +
          </button>
        ) : null}
      </header>

      <div ref={setNodeRef} className={`oma-plx-approvals__column${isOver ? ' is-over' : ''}`}>
        <ul className="oma-plx-approvals__cards">{children}</ul>
        {empty ? (
          <p className="oma-plx-approvals__empty">
            {isOver ? t('demo.tasks.dropHere') : t('demo.tasks.dropHere')}
          </p>
        ) : null}
      </div>
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
        className="oma-plx-approvals__board oma-plx-tasks__board"
        data-testid="demo-tasks-board"
        data-dnd="true"
        data-reorder-persistence="local-only"
        dir="auto"
      >
        <div className="oma-plx-approvals__columns oma-plx-tasks__columns">
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
            className="oma-plx-approvals-card oma-plx-approvals-card--overlay"
            data-testid="demo-kanban-drag-overlay"
          >
            <KanbanCardBody task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
