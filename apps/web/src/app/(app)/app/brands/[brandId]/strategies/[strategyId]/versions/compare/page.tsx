'use client';

import { OmaTopLoader } from '../../../../../../../../../components/ui/oma-top-loader';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../../../../../../lib/api';
import type { BrandDetail } from '../../../../../../../../../lib/brand-types';
import {
  getApiError,
  isPermissionDenied,
  isTenantRequired,
} from '../../../../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../../../../components/brand/brand-workspace-shell';
import { StrategySubnav } from '../../../../../../../../../components/strategy/strategy-subnav';
import { PermissionDenied } from '../../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../../components/shell/select-company';
import { useT } from '../../../../../../../../../lib/use-locale';

export default function StrategyComparePage() {
  const t = useT();
  const params = useParams<{ brandId: string; strategyId: string }>();
  const search = useSearchParams();
  const { brandId, strategyId } = params;
  const leftId = search.get('leftId') ?? '';
  const rightId = search.get('rightId') ?? '';
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [diff, setDiff] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const brandRes = await api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`);
        setBrand(brandRes.data);
        if (!leftId || !rightId) return;
        const res = await api<{ data: { diff_summary: Record<string, unknown> } }>(
          `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/compare?leftId=${leftId}&rightId=${rightId}`,
        );
        setDiff(res.data.diff_summary);
      } catch (err) {
        if (isTenantRequired(err)) setTenantRequired(true);
        else if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      }
    }
    void load();
  }, [brandId, strategyId, leftId, rightId]);

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (!brand) return <OmaTopLoader label={t('common.loading')} />;

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <StrategySubnav brandId={brandId} strategyId={strategyId} />
      <header className="oma-page-header">
        <h2>{t('strategy.versions.compare')}</h2>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      <div className="oma-compare-panels" data-testid="strategy-compare-diff">
        <div className="oma-panel">
          <h2>{leftId || 'Left'}</h2>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {diff ? JSON.stringify(diff, null, 2) : t('common.loading')}
          </pre>
        </div>
        <div className="oma-panel">
          <h2>{rightId || 'Right'}</h2>
          <p className="oma-muted">{t('strategy.versions.compare')}</p>
        </div>
      </div>
    </BrandWorkspaceShell>
  );
}
