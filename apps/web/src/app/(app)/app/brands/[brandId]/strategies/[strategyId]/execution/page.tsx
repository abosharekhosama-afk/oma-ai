'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../../../../../lib/api';
import type { BrandDetail } from '../../../../../../../../lib/brand-types';
import type { StrategyDetail } from '../../../../../../../../lib/strategy-types';
import {
  getApiError,
  isPermissionDenied,
  isTenantRequired,
} from '../../../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../../../components/brand/brand-workspace-shell';
import { StrategySubnav } from '../../../../../../../../components/strategy/strategy-subnav';
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../components/shell/select-company';
import { DetailShimmer } from '../../../../../../../../components/ui/shimmer';
import { BrandPlxPageHead } from '../../../../../../../../components/brand/brand-plx-section';
import { StrategyPlanRequestsPanel } from '../../../../../../../../components/strategy/strategy-plan-requests-panel';
import { StrategyExecutionPanel } from '../../../../../../../../components/strategy/strategy-execution-panel';
import { StrategyPaidExecutionPanel } from '../../../../../../../../components/strategy/strategy-paid-execution-panel';
import { StrategyKpiPanel } from '../../../../../../../../components/strategy/strategy-kpi-panel';
import { StrategyMonthlyReviewPanel } from '../../../../../../../../components/strategy/strategy-monthly-review-panel';
import { useT } from '../../../../../../../../lib/use-locale';

type VersionRow = { id: string; status: string; version_number: number };

/**
 * DEC-029 4.9: Execution tab — everything that happens after approval, for the
 * latest APPROVED version (even when a newer draft is being edited).
 */
export default function StrategyExecutionPage() {
  const t = useT();
  const { brandId, strategyId } = useParams<{ brandId: string; strategyId: string }>();
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [strategy, setStrategy] = useState<StrategyDetail | null>(null);
  const [approved, setApproved] = useState<VersionRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, s, v] = await Promise.all([
        api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`),
        api<{ data: StrategyDetail }>(`/api/v1/brands/${brandId}/strategies/${strategyId}`),
        api<{ data: VersionRow[] }>(`/api/v1/brands/${brandId}/strategies/${strategyId}/versions`),
      ]);
      setBrand(b.data);
      setStrategy(s.data);
      const approvedRows = v.data
        .filter((r) => r.status === 'APPROVED')
        .sort((a, b2) => b2.version_number - a.version_number);
      setApproved(approvedRows[0] ?? null);
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
  if (!brand || !strategy || approved === undefined) {
    return error ? (
      <div className="oma-card" role="alert">
        {error}
      </div>
    ) : (
      <DetailShimmer />
    );
  }

  return (
    <BrandWorkspaceShell
      brandId={brandId}
      brandName={brand.name}
      brandLogoUrl={brand.logo_url}
      websiteUrl={brand.website?.normalized_url}
      latestScanId={brand.latest_scan?.id}
    >
      <StrategySubnav brandId={brandId} strategyId={strategyId} />
      <BrandPlxPageHead title={t('strategy.tab.execution')} />
      {approved ? (
        <div data-testid="strategy-execution-tab">
          <p className="oma-muted">
            {t('strategy.executionTab.version')} v{approved.version_number}
            {strategy.latest_version && strategy.latest_version.id !== approved.id
              ? ` · ${t('strategy.executionTab.newerDraft')}`
              : ''}
          </p>
          <StrategyPlanRequestsPanel
            brandId={brandId}
            strategyId={strategyId}
            versionId={approved.id}
          />
          <StrategyExecutionPanel
            brandId={brandId}
            strategyId={strategyId}
            versionId={approved.id}
          />
          <StrategyKpiPanel
            brandId={brandId}
            strategyId={strategyId}
            versionId={approved.id}
            editable={false}
          />
          <StrategyPaidExecutionPanel
            brandId={brandId}
            strategyId={strategyId}
            versionId={approved.id}
          />
          <StrategyMonthlyReviewPanel
            brandId={brandId}
            strategyId={strategyId}
            versionId={approved.id}
            onDraftCreated={() => void load()}
          />
        </div>
      ) : (
        <div className="oma-card" data-testid="strategy-execution-empty-tab">
          <p>{t('strategy.executionTab.noApproved')}</p>
          <Link
            className="oma-text-link"
            href={`/app/brands/${brandId}/strategies/${strategyId}/review`}
          >
            {t('strategy.tab.review')}
          </Link>
        </div>
      )}
    </BrandWorkspaceShell>
  );
}
