'use client';

import { useT } from '../../lib/use-locale';

export function PermissionDenied({ message }: { message?: string }) {
  const t = useT();
  return (
    <div className="oma-card" role="alert" data-testid="permission-denied">
      <h2>{t('errors.permissionTitle')}</h2>
      <p>{message ?? t('errors.permission')}</p>
    </div>
  );
}
