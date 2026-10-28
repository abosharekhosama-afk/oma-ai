'use client';

import dynamic from 'next/dynamic';
import { TasksShimmer } from '../../../../components/ui/screen-shimmer';

const TasksPage = dynamic(() => import('./tasks-client'), {
  ssr: false,
  loading: () => <TasksShimmer />,
});

export default function TasksRoutePage() {
  return <TasksPage />;
}
