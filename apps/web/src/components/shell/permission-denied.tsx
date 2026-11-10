'use client';

import { useT } from '../../lib/use-locale';
import { ErrorState } from '../ui/error-state';

export function PermissionDenied({ message }: { message?: string }) {
  const t = useT();
  return (
    <ErrorState
      kind="forbidden"
      code="403"
      title={t('errors.permissionTitle')}
      body={message ?? t('errors.permission')}
    />
  );
}
