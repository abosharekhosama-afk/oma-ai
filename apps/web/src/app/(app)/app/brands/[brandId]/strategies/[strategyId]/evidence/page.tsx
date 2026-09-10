'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../../../../../lib/api';
import type { BrandDetail } from '../../../../../../../../lib/brand-types';
import type { StrategyVersionDetail } from '../../../../../../../../lib/strategy-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../../../components/brand/brand-workspace-shell';
import { StrategySubnav } from '../../../../../../../../components/strategy/strategy-subnav';
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../components/shell/select-company';
import { useT } from '../../../../../../../../lib/use-locale';

export default function StrategyEvidencePage() {
  const t = useT();
  const params = useParams<{ brandId: string; strategyId: string }>();
  const { brandId, strategyId } = params;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [version, setVersion] = useState<StrategyVersionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  const load = useCallback(async () => {
    try {
      const brandRes = await api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`);
      const strat = await api<{ data: { latest_version: { id: string } | null } }>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}`,
      );
      const ver = await api<{ data: StrategyVersionDetail }>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${strat.data.latest_version!.id}`,
      );
      setBrand(brandRes.data);
      setVersion(ver.data);
    } catch (err) {
      if (isTenantRequired(err)) setTenantRequired(true);
      else if (isPermissionDenied(err)) setDenied(true);
      else setError(getApiError(err).message);
    }
  }, [brandId, strategyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (!brand || !version) return <p role="status">{t('common.loading')}</p>;

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <StrategySubnav brandId={brandId} strategyId={strategyId} />
      <header className="oma-page-header">
        <h2>{t('strategy.evidence.title')}</h2>
      </header>
      {version.missing_source ? (
        <p role="status">{t('strategy.warning.missingProfile')}</p>
      ) : (
        <p role="status">Evidence-backed: linked profile {version.linked_approved_profile_version_id}</p>
      )}
      {error ? <p role="alert">{error}</p> : null}
      {version.evidence_links.length === 0 ? (
        <div className="oma-card" data-testid="strategy-evidence-empty">
          <p>{t('strategy.evidence.empty')}</p>
        </div>
      ) : (
        <ul className="oma-discovery-list" data-testid="strategy-evidence-list">
          {version.evidence_links.map((link) => (
            <li key={link.id} className="oma-card">
              {link.label ?? link.evidence_excerpt_id ?? link.id}
            </li>
          ))}
        </ul>
      )}
    </BrandWorkspaceShell>
  );
}
