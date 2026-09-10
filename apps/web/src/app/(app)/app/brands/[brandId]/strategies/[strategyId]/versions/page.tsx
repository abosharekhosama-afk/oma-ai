'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../../../../../lib/api';
import type { BrandDetail } from '../../../../../../../../lib/brand-types';
import {
  getApiError,
  isPermissionDenied,
  isTenantRequired,
} from '../../../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../../../components/brand/brand-workspace-shell';
import { StrategySubnav } from '../../../../../../../../components/strategy/strategy-subnav';
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../components/shell/select-company';
import { StatusChip } from '../../../../../../../../components/ui/status-chip';
import { useT } from '../../../../../../../../lib/use-locale';

type VersionRow = {
  id: string;
  status: string;
  version_number: number;
  created_at: string;
};

export default function StrategyVersionsPage() {
  const t = useT();
  const params = useParams<{ brandId: string; strategyId: string }>();
  const { brandId, strategyId } = params;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  const load = useCallback(async () => {
    try {
      const [brandRes, list] = await Promise.all([
        api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`),
        api<{ data: VersionRow[] }>(`/api/v1/brands/${brandId}/strategies/${strategyId}/versions`),
      ]);
      setBrand(brandRes.data);
      setVersions(list.data);
    } catch (err) {
      if (isTenantRequired(err)) setTenantRequired(true);
      else if (isPermissionDenied(err)) setDenied(true);
      else setError(getApiError(err).message);
    }
  }, [brandId, strategyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function revise(versionId: string) {
    try {
      await api(`/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/revise`, {
        method: 'POST',
        body: '{}',
      });
      await load();
    } catch (err) {
      setError(getApiError(err).message);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (!brand) return <p role="status">{t('common.loading')}</p>;

  const left = versions[1]?.id;
  const right = versions[0]?.id;

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <StrategySubnav brandId={brandId} strategyId={strategyId} />
      <header className="oma-page-header">
        <h2>{t('strategy.versions.title')}</h2>
        {left && right ? (
          <Link
            href={`/app/brands/${brandId}/strategies/${strategyId}/versions/compare?leftId=${left}&rightId=${right}`}
            className="oma-btn"
            data-testid="strategy-compare"
          >
            {t('strategy.versions.compare')}
          </Link>
        ) : null}
      </header>
      {error ? <p role="alert">{error}</p> : null}
      <ul className="oma-discovery-list" data-testid="strategy-versions">
        {versions.map((v) => (
          <li key={v.id} className="oma-card oma-discovery-item">
            <div>
              <strong>v{v.version_number}</strong> <StatusChip status={v.status} />
            </div>
            {['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'].includes(v.status) ? (
              <button type="button" className="oma-btn" onClick={() => void revise(v.id)}>
                {t('strategy.versions.revise')}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </BrandWorkspaceShell>
  );
}
