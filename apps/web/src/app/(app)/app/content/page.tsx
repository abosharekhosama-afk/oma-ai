'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { ContentCalSkeleton } from '../../../../components/ui/page-skeleton';

const ContentPage = dynamic(() => import('./content-client'), {
  ssr: false,
  loading: () => <ContentCalSkeleton />,
});

export default function ContentRoutePage() {
  return (
    <Suspense fallback={<ContentCalSkeleton />}>
      <ContentPage />
    </Suspense>
  );
}
