'use client';
import { DetailShimmer } from '../../../../../../../../components/ui/shimmer';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../../../../../lib/api';
import type { BrandDetail } from '../../../../../../../../lib/brand-types';
import type { StrategyVersionDetail } from '../../../../../../../../lib/strategy-types';
import {
  getApiError,
  isPermissionDenied,
  isTenantRequired,
} from '../../../../../../../../lib/brand-api';
import { StrategyWorkspaceShell } from '../../../../../../../../components/strategy/strategy-workspace-shell';
import { StrategyAiAssistantLink } from '../../../../../../../../components/strategy/strategy-ai-assistant-link';
import { BrandPlxPageHead } from '../../../../../../../../components/brand/brand-plx-section';
import { StrategySubnav } from '../../../../../../../../components/strategy/strategy-subnav';
import { PaidPlanningBanner } from '../../../../../../../../components/strategy/honesty-banners';
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../components/shell/select-company';
import { useT } from '../../../../../../../../lib/use-locale';
import { StrategyPlanEditor } from '../../../../../../../../components/strategy/strategy-plan-editor';

export default function StrategyPaidPage() {
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
  if (!brand || !version) return <DetailShimmer />;

  return (
    <StrategyWorkspaceShell brandId={brandId} brandName={brand.name}>
      <StrategySubnav brandId={brandId} strategyId={strategyId} />
      <div className="oma-strategy-page-stack">
        <BrandPlxPageHead title={t('strategy.paid.title')} />
        <StrategyAiAssistantLink brandId={brandId} strategyId={strategyId} />
        <PaidPlanningBanner />
        {error ? (
          <p className="oma-save-status" data-state="error" role="alert">
            {error}
          </p>
        ) : null}
        <StrategyPlanEditor
          brandId={brandId}
          strategyId={strategyId}
          versionId={version.id}
          track="paid"
        />
      </div>
    </StrategyWorkspaceShell>
  );
}
