'use client';
import { DetailShimmer } from '../../../../../../../components/ui/shimmer';

import { OmaLinkButton } from '../../../../../../../components/ui/oma-link-button';
import { Button } from '@oma/ui/controls';

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
import { BrandWorkspaceShell } from '../../../../../../../components/brand/brand-workspace-shell';
import { StrategySubnav } from '../../../../../../../components/strategy/strategy-subnav';
import { StrategyAiAssistant } from '../../../../../../../components/strategy/strategy-ai-assistant';
import { CurrentStrategyControls } from '../../../../../../../components/strategy/current-strategy-controls';
import { ConflictBanner } from '../../../../../../../components/strategy/conflict-banner';
import { StrategyStatusBadge } from '../../../../../../../components/strategy/status-badge';
import { PermissionDenied } from '../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../components/shell/select-company';
import {
  DemoStrategyDocument,
  isDemoStrategyRoute,
} from '../../../../../../../components/demo/demo-strategy-document';
import { useT } from '../../../../../../../lib/use-locale';
import { StrategyOverviewSummary } from '../../../../../../../components/strategy/strategy-overview-summary';
import { StrategyPlanRequestsPanel } from '../../../../../../../components/strategy/strategy-plan-requests-panel';

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

  async function setCurrent(strategy_id: string | null) {
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
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <StrategySubnav brandId={brandId} strategyId={strategyId} />
      <header className="oma-page-header">
        <div>
          <h2 data-testid="strategy-name-heading">{strategy.name}</h2>
          <div className="oma-chip-row">
            <StrategyStatusBadge status={strategy.status} />
            {latest ? <StrategyStatusBadge status={latest.status} /> : null}
            {strategy.is_current ? (
              <span className="oma-badge oma-badge-muted" data-testid="strategy-current-badge">
                {t('strategy.list.current')}
              </span>
            ) : null}
            {latest ? (
              <span className="oma-strategy-tracks">
                <span
                  className={
                    latest.organic_enabled
                      ? 'oma-track-pill oma-track-pill--organic'
                      : 'oma-track-pill oma-track-pill--off'
                  }
                >
                  {t('strategy.nav.organic')}
                </span>
                <span
                  className={
                    latest.paid_enabled
                      ? 'oma-track-pill oma-track-pill--paid'
                      : 'oma-track-pill oma-track-pill--off'
                  }
                >
                  {t('strategy.nav.paid')}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </header>

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

      {latest?.status === 'APPROVED' && !latest.missing_source ? (
        <StrategyPlanRequestsPanel
          brandId={brandId}
          strategyId={strategyId}
          versionId={latest.id}
        />
      ) : null}

      {latest && (latest.status === 'DRAFT' || latest.status === 'IN_REVIEW') ? (
        <StrategyAiAssistant
          brandId={brandId}
          strategyId={strategyId}
          versionId={latest.id}
          versionStatus={latest.status}
          linkedProfileVersionId={latest.linked_approved_profile_version_id}
          organicEnabled={latest.organic_enabled}
          paidEnabled={latest.paid_enabled}
          onApplied={() => void load()}
        />
      ) : null}

      {message ? <p role="status">{message}</p> : null}
      <ConflictBanner show={Boolean(error && error === t('strategy.conflict'))} />
      {error && error !== t('strategy.conflict') ? (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {error}
        </p>
      ) : null}

      <div className="oma-panel" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <CurrentStrategyControls
          canSet={Boolean(strategy.has_approved_version)}
          isCurrent={Boolean(strategy.is_current)}
          onSet={() => void setCurrent(strategyId)}
          onClear={() => void setCurrent(null)}
        />
        {strategy.status === 'ACTIVE' ? (
          <Button type="default" onClick={() => void archive()}>
            {t('strategy.overview.archive')}
          </Button>
        ) : null}
        <OmaLinkButton
          href={`/app/brands/${brandId}/strategies/${strategyId}/review`}
          type="primary"
        >
          {t('strategy.nav.review')}
        </OmaLinkButton>
      </div>
    </BrandWorkspaceShell>
  );
}
