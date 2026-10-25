'use client';

import { useEffect } from 'react';
import { ErrorState, errorKindOf } from '../../../components/ui/error-state';

/** In-app error boundary: keeps the shell (rail/header) and shows a calm 500/offline panel. */
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
