'use client';

import dynamic from 'next/dynamic';
import { BoardShimmer } from '../../../../components/ui/shimmer';

const TasksPage = dynamic(() => import('./tasks-client'), {
  ssr: false,
  loading: () => <BoardShimmer />,
});

export default function TasksRoutePage() {
  return <TasksPage />;
}
