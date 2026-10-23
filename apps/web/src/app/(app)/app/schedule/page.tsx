'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '../../../../components/ui/page-skeleton';

const Client = dynamic(() => import('./schedule-client'), {
  ssr: false,
  loading: () => <PageSkeleton rows={10} />,
});

export default function Page() {
  return <Client />;
}
