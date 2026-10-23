'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '../../../../components/ui/page-skeleton';

const TasksPage = dynamic(() => import('./tasks-client'), {
  ssr: false,
  loading: () => <PageSkeleton rows={8} />,
});

export default function TasksRoutePage() {
  return <TasksPage />;
}
