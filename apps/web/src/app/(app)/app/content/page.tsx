import { Suspense } from 'react';
import ContentPage from './content-client';

export default function ContentRoutePage() {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <ContentPage />
    </Suspense>
  );
}
