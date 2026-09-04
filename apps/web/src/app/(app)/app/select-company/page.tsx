'use client';

import { TenantSwitcher } from '../../../../components/shell/tenant-switcher';
import { useT } from '../../../../lib/use-locale';

export default function SelectCompanyPage() {
  const t = useT();
  return (
    <div className="oma-stack">
      <header className="oma-page-header">
        <div>
          <h1>{t('selectCompany.title')}</h1>
          <p className="oma-muted">{t('selectCompany.body')}</p>
        </div>
      </header>
      <div className="oma-card">
        <TenantSwitcher />
      </div>
    </div>
  );
}
