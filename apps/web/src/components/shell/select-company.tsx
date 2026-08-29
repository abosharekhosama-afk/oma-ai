'use client';

import { useT } from '../../lib/use-locale';

/**
 * The API refuses tenant-scoped reads until the session carries an active
 * company. That refusal is expected, so it is shown as an instruction rather
 * than as an error.
 */
export function SelectCompany() {
  const t = useT();
  return (
    <div className="oma-card" role="status">
      <h2>{t('home.noTenantTitle')}</h2>
      <p className="oma-muted">{t('home.noTenantBody')}</p>
    </div>
  );
}
