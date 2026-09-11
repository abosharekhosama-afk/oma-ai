import { Suspense } from 'react';
import TasksPage from './tasks-client';

export default function TasksRoutePage() {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <TasksPage />
    </Suspense>
  );
}
