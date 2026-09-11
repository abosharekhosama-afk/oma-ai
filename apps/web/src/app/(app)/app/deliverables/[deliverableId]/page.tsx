import { Suspense } from 'react';
import DeliverableDetailClient from './deliverable-client';

export default function DeliverableDetailPage() {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <DeliverableDetailClient />
    </Suspense>
  );
}
