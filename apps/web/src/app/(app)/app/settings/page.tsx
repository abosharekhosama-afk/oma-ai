'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '../../../../components/ui/page-skeleton';

const Client = dynamic(() => import('./settings-client'), {
  ssr: false,
  loading: () => <PageSkeleton rows={6} />,
});

export default function Page() {
  return <Client />;
}
