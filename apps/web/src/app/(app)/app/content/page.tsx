'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import { ContentShimmer } from '../../../../components/ui/screen-shimmer';

const loadClient = () => import('./content-client');
const ContentPage = dynamic(loadClient, {
  ssr: false,
  loading: () => <ContentShimmer />,
});

export default function ContentRoutePage() {
  // Start the data requests while the (large) content chunk downloads; the client's identical
  // GETs reuse these in-flight/cached responses instead of waiting for the chunk first.
  useEffect(() => {
    void import('../../../../lib/content-api')
      .then((m) => m.loadContentWorkspace({ full: false }))
      .catch(() => undefined);
  }, []);
  return (
    <Suspense fallback={<ContentShimmer />}>
      <ContentPage />
    </Suspense>
  );
}
