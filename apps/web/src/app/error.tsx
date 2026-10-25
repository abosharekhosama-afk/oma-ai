'use client';

import { useEffect } from 'react';
import { ErrorState, errorKindOf } from '../components/ui/error-state';

/** Root error boundary (500-style) — keeps the root layout, offers retry. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const kind = errorKindOf(error) === 'network' ? 'network' : 'server';
  return (
    <main id="main" className="oma-error-page">
      <ErrorState
        kind={kind}
        code={kind === 'server' ? '500' : undefined}
        onRetry={reset}
        detail={error.digest ? `Ref: ${error.digest}` : null}
      />
    </main>
  );
}
