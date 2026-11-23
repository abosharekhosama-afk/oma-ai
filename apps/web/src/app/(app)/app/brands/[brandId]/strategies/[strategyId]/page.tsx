'use client';
import { DetailShimmer } from '../../../../../../../components/ui/shimmer';

import { Button } from '@oma/ui/controls';

import { OmaLinkButton } from '../../../../../../../components/ui/oma-link-button';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../../../../lib/api';
import type { BrandDetail } from '../../../../../../../lib/brand-types';
import type {
  StrategyDetail,
  StrategyVersionDetail,
} from '../../../../../../../lib/strategy-types';
import { StrategyLinkProfilePanel } from '../../../../../../../components/strategy/strategy-link-profile-panel';
import { StrategyDraftPreview } from '../../../../../../../components/strategy/strategy-draft-preview';
import {
  getApiError,
  isPermissionDenied,
  isTenantRequired,
} from '../../../../../../../lib/brand-api';
import { StrategyWorkspaceShell } from '../../../../../../../components/strategy/strategy-workspace-shell';
import { StrategySubnav } from '../../../../../../../components/strategy/strategy-subnav';
import { StrategyPageAi } from '../../../../../../../components/strategy/strategy-page-ai';
import { CurrentStrategyControls } from '../../../../../../../components/strategy/current-strategy-controls';
import { ConflictBanner } from '../../../../../../../components/strategy/conflict-banner';
import { PermissionDenied } from '../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../components/shell/select-company';
import {
  DemoStrategyDocument,
  isDemoStrategyRoute,
} from '../../../../../../../components/demo/demo-strategy-document';
import { useT } from '../../../../../../../lib/use-locale';
import { StrategyOverviewSummary } from '../../../../../../../components/strategy/strategy-overview-summary';
import { BrandPlxSection } from '../../../../../../../components/brand/brand-plx-section';
import { StrategyKpiPanel } from '../../../../../../../components/strategy/strategy-kpi-panel';
import { useStrategyReadiness } from '../../../../../../../lib/strategy-readiness';

export default function StrategyOverviewPage() {
  const params = useParams<{ brandId: string; strategyId: string }>();
  const { brandId, strategyId } = params;

  if (isDemoStrategyRoute(brandId, strategyId)) {
    return <DemoStrategyDocument brandId={brandId} strategyId={strategyId} />;
  }

  return <FeatureStrategyOverview brandId={brandId} strategyId={strategyId} />;
}

function FeatureStrategyOverview({ brandId, strategyId }: { brandId: string; strategyId: string }) {
  const t = useT();
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [strategy, setStrategy] = useState<StrategyDetail | null>(null);
  const [brandVersion, setBrandVersion] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);
  const [versionDetail, setVersionDetail] = useState<StrategyVersionDetail | null>(null);
  const { readiness } = useStrategyReadiness(
    brandId,
    strategyId,
    versionDetail?.id,
    `${versionDetail?.status}:${versionDetail?.row_version}`,
  );
  const load = useCallback(async () => {
    try {
      const [brandRes, stratRes, currentRes] = await Promise.all([
        api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`),
        api<{ data: StrategyDetail }>(`/api/v1/brands/${brandId}/strategies/${strategyId}`),
        api<{ data: { brand_version: number } }>(`/api/v1/brands/${brandId}/current-strategy`),
      ]);
      setBrand(brandRes.data);
      setStrategy(stratRes.data);
      setBrandVersion(currentRes.data.brand_version);
      const latestId = stratRes.data.latest_version?.id;
      if (latestId) {
        const ver = await api<{ data: StrategyVersionDetail }>(
          `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${latestId}`,
        );
        setVersionDetail(ver.data);
      } else {
        setVersionDetail(null);
      }
    } catch (err) {
      if (isTenantRequired(err)) setTenantRequired(true);
      else if (isPermissionDenied(err)) setDenied(true);
      else setError(getApiError(err).message);
    }
  }, [brandId, strategyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setCurrent(strategy_id: string) {
    setMessage(null);
    setError(null);
    try {
      await api(`/api/v1/brands/${brandId}/current-strategy`, {
        method: 'POST',
        body: JSON.stringify({ strategy_id, brand_version: brandVersion }),
      });
      setMessage(t('strategy.saved'));
      await load();
    } catch (err) {
      const apiErr = getApiError(err);
      setError(apiErr.code === 'CONFLICT_VERSION' ? t('strategy.conflict') : apiErr.message);
    }
  }

  async function archive() {
    if (!strategy) return;
    try {
      await api(`/api/v1/brands/${brandId}/strategies/${strategyId}/archive`, {
        method: 'POST',
        body: JSON.stringify({ version: strategy.version }),
      });
      await load();
    } catch (err) {
      setError(getApiError(err).message);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (!brand || !strategy) {
    return error ? (
      <div className="oma-card" role="alert">
        {error}
      </div>
    ) : (
      <DetailShimmer />
    );
  }

  const latest = strategy.latest_version;

  return (
    <StrategyWorkspaceShell brandId={brandId} brandName={brand.name} brandLogoUrl={brand.logo_url}>
      <div className="oma-strategy-page-stack">
        <StrategySubnav
          brandId={brandId}
          strategyId={strategyId}
          refreshKey={`${strategy.version}:${latest?.status}:${latest?.row_version}:${strategy.is_current}`}
        />

        <StrategyOverviewSummary brandId={brandId} strategyId={strategyId} strategy={strategy} />

        {latest ? (
          <StrategyLinkProfilePanel
            brandId={brandId}
            strategyId={strategyId}
            versionId={latest.id}
            rowVersion={latest.row_version}
            linkedProfileVersionId={latest.linked_approved_profile_version_id}
            missingSource={latest.missing_source}
            versionEditable={latest.status === 'DRAFT' || latest.status === 'IN_REVIEW'}
            onLinked={() => void load()}
          />
        ) : null}

        {versionDetail && latest && (latest.status === 'DRAFT' || latest.status === 'IN_REVIEW') ? (
          <StrategyDraftPreview brandId={brandId} strategyId={strategyId} version={versionDetail} />
        ) : null}

        {strategy.has_approved_version ? (
          <BrandPlxSection
            title={t('strategy.tab.execution')}
            testId="strategy-overview-execution-link"
          >
            <p className="oma-muted">{t('strategy.executionTab.lead')}</p>
            <OmaLinkButton
              type="primary"
              data-testid="strategy-start-execution"
              href={`/app/brands/${brandId}/strategies/${strategyId}/execution`}
            >
              {readiness?.journey.current === 'execute' || !readiness
                ? t('strategy.executionTab.start')
                : t('strategy.executionTab.open')}
            </OmaLinkButton>
          </BrandPlxSection>
        ) : null}

        {latest && latest.status === 'DRAFT' && !latest.missing_source ? (
          <StrategyKpiPanel
            brandId={brandId}
            strategyId={strategyId}
            versionId={latest.id}
            editable
          />
        ) : null}

        <StrategyPageAi
          brandId={brandId}
          strategyId={strategyId}
          version={versionDetail}
          focus="overview"
          onApplied={() => void load()}
        />

        {message ? <p role="status">{message}</p> : null}
        <ConflictBanner show={Boolean(error && error === t('strategy.conflict'))} />
        {error && error !== t('strategy.conflict') ? (
          <p role="alert" className="oma-brand-inline-error">
            {error}
          </p>
        ) : null}

        {strategy.status === 'ACTIVE' ? (
          <BrandPlxSection
            title={t('strategy.overview.actionsTitle')}
            testId="strategy-overview-actions"
          >
            <div className="oma-form-actions">
              <CurrentStrategyControls
                canSet={Boolean(strategy.has_approved_version)}
                isCurrent={Boolean(strategy.is_current)}
                inferred={Boolean(strategy.current_inferred)}
                onSet={() => void setCurrent(strategyId)}
              />
              <Button type="default" danger onClick={() => void archive()}>
                {t('strategy.overview.archive')}
              </Button>
            </div>
          </BrandPlxSection>
        ) : null}
      </div>
    </StrategyWorkspaceShell>
  );
}
