'use client';

import { DetailShimmer } from '../../../../../../components/ui/shimmer';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../../../lib/api';
import type { BrandDetail } from '../../../../../../lib/brand-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import { BrandHubCard } from '../../../../../../components/brand/brand-hub-card';
import { AiUnavailableBanner } from '../../../../../../components/brand/ai-unavailable-banner';
import { StatusChip } from '../../../../../../components/ui/status-chip';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../components/shell/select-company';
import { buildBrandJourneySteps } from '../../../../../../lib/brand-journey';
import { useT } from '../../../../../../lib/use-locale';

export default function BrandIntelligenceHubPage() {
  const t = useT();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);
  const [platformAi, setPlatformAi] = useState<
    'AVAILABLE' | 'NOT_CONFIGURED' | 'BUDGET_EXHAUSTED' | null
  >(null);
  const [strategyAiMode, setStrategyAiMode] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`),
      api<{ data?: { availability?: string; strategy_ai_mode?: string } }>(
        '/api/v1/ai/status',
      ).catch(() => ({ data: undefined })),
    ])
      .then(([brandRes, aiRes]) => {
        setBrand(brandRes.data);
        const avail = aiRes.data?.availability;
        if (avail === 'AVAILABLE' || avail === 'NOT_CONFIGURED' || avail === 'BUDGET_EXHAUSTED') {
          setPlatformAi(avail);
        } else {
          setPlatformAi('NOT_CONFIGURED');
        }
        setStrategyAiMode(aiRes.data?.strategy_ai_mode ?? null);
      })
      .catch((err) => {
        if (isTenantRequired(err)) setTenantRequired(true);
        else if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      })
      .finally(() => setLoading(false));
  }, [brandId]);

  const journey = useMemo(() => (brand ? buildBrandJourneySteps(brand, t) : []), [brand, t]);

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (loading) return <DetailShimmer />;
  if (error || !brand) {
    return (
      <div className="oma-plx-listening-card" role="alert">
        {error ?? t('common.notFound')}
      </div>
    );
  }

  const base = `/app/brands/${brandId}`;
  const approvedProfileId = brand.current_approved_profile_version_id;
  const strategyHref = brand.current_approved_strategy_id
    ? `${base}/strategies/${brand.current_approved_strategy_id}`
    : `${base}/strategies`;

  return (
    <BrandWorkspaceShell
      brandId={brandId}
      brandName={brand.name}
      brandLogoUrl={brand.logo_url}
      websiteUrl={brand.website?.normalized_url}
      scanStatus={brand.latest_scan?.status}
      latestScanId={brand.latest_scan?.id}
      journey={journey}
    >
      <header className="oma-plx-brand-page-head">
        <h2>{t('brand.intelligence.hubTitle')}</h2>
        <p className="oma-muted">{t('brand.intelligence.hubBody')}</p>
      </header>

      {platformAi && platformAi !== 'AVAILABLE' ? (
        <AiUnavailableBanner aiAvailability="NOT_CONFIGURED" platformAvailability={platformAi} />
      ) : null}

      {strategyAiMode ? (
        <p className="oma-muted oma-plx-listening__next-check" data-testid="strategy-ai-mode-hint">
          {t('brand.intelligence.strategyAiMode').replace('{mode}', strategyAiMode)}
        </p>
      ) : null}

      <div className="oma-plx-brand-hub-grid" data-testid="brand-intelligence-hub">
        <BrandHubCard
          href={`${base}/profiles`}
          title={t('brand.nav.profiles')}
          description={t('brand.intelligence.profilesHint')}
          meta={
            approvedProfileId ? (
              <StatusChip status="APPROVED" />
            ) : (
              <span className="oma-muted">{t('brand.detail.noApprovedProfile')}</span>
            )
          }
          foot={t('home.action.open')}
          testId="brand-hub-profiles"
        />
        {approvedProfileId ? (
          <BrandHubCard
            href={`${base}/profiles/${approvedProfileId}`}
            title={t('brand.intelligence.approvedProfileTitle')}
            description={t('brand.intelligence.approvedProfileHint')}
            foot={t('brand.detail.viewProfile')}
            testId="brand-hub-approved-profile"
          />
        ) : null}
        <BrandHubCard
          href={strategyHref}
          title={t('brand.nav.strategies')}
          description={t('brand.intelligence.strategiesHint')}
          meta={
            brand.current_approved_strategy_id ? (
              <StatusChip status="APPROVED" />
            ) : (
              <span className="oma-muted">{t('brand.detail.noStrategy')}</span>
            )
          }
          foot={t('home.action.open')}
          testId="brand-hub-strategies"
        />
      </div>
    </BrandWorkspaceShell>
  );
}
