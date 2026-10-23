'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

function ContentSkeleton() {
  return (
    <div className="oma-content-cal-skeleton" role="status" aria-label="Loading content">
      <div className="oma-content-cal-skeleton__toolbar">
        <span className="oma-content-cal-skeleton__chip oma-skeleton" />
        <span className="oma-content-cal-skeleton__chip oma-skeleton" />
        <span className="oma-content-cal-skeleton__label oma-skeleton" />
        <span className="oma-content-cal-skeleton__spacer" />
        <span className="oma-content-cal-skeleton__btn oma-skeleton" />
      </div>
      <div className="oma-content-cal-skeleton__dows">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="oma-content-cal-skeleton__dow oma-skeleton" />
        ))}
      </div>
      <div className="oma-content-cal-skeleton__grid">
        {Array.from({ length: 21 }).map((_, i) => (
          <div key={i} className="oma-content-cal-skeleton__cell">
            <span className="oma-content-cal-skeleton__daynum oma-skeleton" />
            <span className="oma-content-cal-skeleton__post oma-skeleton" />
            {i % 3 === 0 ? <span className="oma-content-cal-skeleton__post oma-content-cal-skeleton__post--sm oma-skeleton" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

const ContentPage = dynamic(() => import('./content-client'), {
  ssr: false,
  loading: () => <ContentSkeleton />,
});

export default function ContentRoutePage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <ContentPage />
    </Suspense>
  );
}
