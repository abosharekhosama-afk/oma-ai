'use client';

import { ErrorState } from '../../../components/ui/error-state';

/** In-app 404 (unknown /app/* route or notFound()) — rendered inside the shell. */
export default function AppNotFound() {
  return <ErrorState kind="notFound" code="404" />;
}
