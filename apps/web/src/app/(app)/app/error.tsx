'use client';

import { useEffect } from 'react';
import { ErrorState, errorKindOf } from '../../../components/ui/error-state';

/** In-app error boundary: standalone 500 / offline card above the shell. */
export default function AppError({
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
  return <ErrorState kind={kind} code={kind === 'server' ? '500' : undefined} onRetry={reset} />;
}
