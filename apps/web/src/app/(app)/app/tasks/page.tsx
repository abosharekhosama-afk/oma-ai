'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { DemoGraph, DemoTaskStatus } from '@oma/demo';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { StatusChip } from '../../../../components/ui/status-chip';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../../../lib/use-locale';

type Task = DemoGraph['tasks'][number];
type ViewMode = 'kanban' | 'list';

const COLUMNS: DemoTaskStatus[] = [
  'BACKLOG',
  'IN_PROGRESS',
  'BLOCKED',
  'IN_REVIEW',
  'DONE',
  'OVERDUE',
];

export default function TasksPage() {
  const t = useT();
  const locale = useLocale();
  const [rows, setRows] = useState<Task[]>([]);
  const [view, setView] = useState<ViewMode>('kanban');
  const [selected, setSelected] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await demoApi<Task[]>('/tasks');
        if (!cancelled) setRows(data);
      } catch (err) {
        if (cancelled) return;
        if (isDemoForbidden(err)) setUnavailable(true);
        else setError(demoErrorMessage(err, t('demo.unavailable')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((c) => [c, [] as Task[]])) as Record<
      DemoTaskStatus,
      Task[]
    >;
    for (const task of rows) map[task.status]?.push(task);
    return map;
  }, [rows]);

  return (
    <div className="oma-stack" data-testid="demo-tasks">
      <header className="oma-page-header oma-page-header-stack">
        <div>
          <h1>{t('demo.tasks.title')}</h1>
          <p className="oma-muted">{t('demo.tasks.subtitle')}</p>
        </div>
        <div className="oma-view-toggle" role="group">
          <button
            type="button"
            className="oma-btn oma-btn-secondary"
            aria-pressed={view === 'kanban'}
            onClick={() => setView('kanban')}
          >
            {t('demo.view.kanban')}
          </button>
          <button
            type="button"
            className="oma-btn oma-btn-secondary"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            {t('demo.view.list')}
          </button>
        </div>
      </header>
      <DemoDisclosure />
      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {view === 'kanban' ? (
        <div className="oma-kanban">
          {COLUMNS.map((col) => (
            <div key={col} className="oma-kanban-col">
              <h3>
                {col} ({byStatus[col].length})
              </h3>
              {byStatus[col].map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="oma-kanban-card"
                  onClick={() => setSelected(task)}
                >
                  <strong>{pickCopy(task.title, locale)}</strong>
                  <div className="oma-muted" style={{ fontSize: 12 }}>
                    {task.assignee} · {task.dueAt}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <ul className="oma-compact-list">
          {rows.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                className="oma-compact-row oma-linkish"
                onClick={() => setSelected(task)}
              >
                <strong>{pickCopy(task.title, locale)}</strong>
                <StatusChip status={task.status} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <>
          <button
            type="button"
            className="oma-drawer-backdrop"
            aria-label={t('common.cancel')}
            onClick={() => setSelected(null)}
          />
          <aside
            className="oma-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-drawer-title"
          >
            <div className="oma-drawer-header">
              <h2 id="task-drawer-title">{pickCopy(selected.title, locale)}</h2>
              <button
                type="button"
                className="oma-btn oma-btn-secondary"
                onClick={() => setSelected(null)}
              >
                {t('common.cancel')}
              </button>
            </div>
            <div className="oma-chip-row">
              <StatusChip status={selected.status} />
              <StatusChip status={selected.priority} />
            </div>
            <p>
              {selected.assignee} · {selected.department}
            </p>
            <p className="oma-muted">Due {selected.dueAt}</p>
            {selected.requestId ? (
              <p>
                <Link href={`/app/requests/${selected.requestId}`} className="oma-text-link">
                  {selected.requestId}
                </Link>
              </p>
            ) : null}
            {selected.deliverableId ? (
              <p>
                <Link
                  href={`/app/deliverables/${selected.deliverableId}`}
                  className="oma-text-link"
                >
                  {selected.deliverableId}
                </Link>
              </p>
            ) : null}
            <h3>{t('demo.tasks.checklist')}</h3>
            <ul>
              {selected.checklist.map((c) => (
                <li key={c.id}>
                  <label>
                    <input type="checkbox" checked={c.done} readOnly /> {pickCopy(c.label, locale)}
                  </label>
                </li>
              ))}
            </ul>
            <h3>{t('demo.tasks.comments')}</h3>
            {selected.comments.length === 0 ? (
              <p className="oma-muted">{t('demo.empty')}</p>
            ) : (
              <ul className="oma-stack">
                {selected.comments.map((c) => (
                  <li key={c.id} className="oma-card">
                    <strong>{c.author}</strong>
                    <p>{pickCopy(c.body, locale)}</p>
                    <span className="oma-muted">{new Date(c.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </>
      ) : null}
    </div>
  );
}
