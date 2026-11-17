'use client';

import { DetailShimmer } from '../../../../../../components/ui/shimmer';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../../../lib/api';
import type { BrandDetail, Paginated, ProfileDetail } from '../../../../../../lib/brand-types';
import type { StrategyListItem } from '../../../../../../lib/strategy-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import { BrandHubCard } from '../../../../../../components/brand/brand-hub-card';
import { BrandPlxPageHead } from '../../../../../../components/brand/brand-plx-section';
import { StatusChip } from '../../../../../../components/ui/status-chip';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../components/shell/select-company';
import { buildBrandJourneySteps } from '../../../../../../lib/brand-journey';
import { useLocale, useT } from '../../../../../../lib/use-locale';
import { aiProviderName, formatBrandDateTime } from '../../../../../../lib/brand-format';
import {
  insightReviewProgress,
  type AiStatusSummary,
} from '../../../../../../lib/brand-intelligence';

type ProfileVersionSummary = {
  id: string;
  status: string;
  created_at: string;
  approved_at: string | null;
};

export default function BrandIntelligenceHubPage() {
  const t = useT();
  const locale = useLocale();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [ai, setAi] = useState<AiStatusSummary | null>(null);
  const [versions, setVersions] = useState<ProfileVersionSummary[]>([]);
  const [latestProfile, setLatestProfile] = useState<ProfileDetail | null>(null);
  const [strategies, setStrategies] = useState<StrategyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [brandRes, aiRes, versionsRes, strategiesRes] = await Promise.all([
          api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`),
          api<{ data?: AiStatusSummary }>('/api/v1/ai/status').catch(() => ({ data: undefined })),
          api<Paginated<ProfileVersionSummary>>(`/api/v1/brands/${brandId}/profiles`).catch(() => ({
            data: [] as ProfileVersionSummary[],
          })),
          api<{ data: StrategyListItem[] }>(`/api/v1/brands/${brandId}/strategies`).catch(() => ({
            data: [] as StrategyListItem[],
          })),
        ]);
        setBrand(brandRes.data);
        setAi(aiRes.data ?? null);
        setVersions(versionsRes.data);
        setStrategies(strategiesRes.data);
        const profileId =
          brandRes.data.latest_profile_version_id ??
          brandRes.data.current_approved_profile_version_id;
        if (profileId) {
          const profileRes = await api<{ data: ProfileDetail }>(
            `/api/v1/brands/${brandId}/profiles/${profileId}`,
          ).catch(() => null);
          setLatestProfile(profileRes?.data ?? null);
        }
      } catch (err) {
        if (isTenantRequired(err)) setTenantRequired(true);
        else if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [brandId]);

  const journey = useMemo(() => (brand ? buildBrandJourneySteps(brand, t) : []), [brand, t]);
  const review = useMemo(
    () => insightReviewProgress(latestProfile?.insights ?? []),
    [latestProfile],
  );

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (loading) return <DetailShimmer />;
  if (error || !brand) {
    return (
      <div className="oma-banner oma-banner-danger" role="alert">
        <p>{error ?? t('common.notFound')}</p>
      </div>
    );
  }

  const base = `/app/brands/${brandId}`;
  const approvedProfileId = brand.current_approved_profile_version_id;
  const approvedVersion = versions.find((v) => v.id === approvedProfileId) ?? null;
  const profileHref = latestProfile
    ? `${base}/profiles/${latestProfile.id}`
    : approvedProfileId
      ? `${base}/profiles/${approvedProfileId}`
      : `${base}/profiles`;
  const currentStrategy =
    strategies.find((s) => s.id === brand.current_approved_strategy_id) ??
    strategies.find((s) => s.is_current) ??
    null;
  const strategyHref = currentStrategy
    ? `${base}/strategies/${currentStrategy.id}`
    : `${base}/strategies`;
  const approvedStrategies = strategies.filter((s) => s.has_approved_version).length;

  const availability = ai?.availability ?? 'NOT_CONFIGURED';
  const aiReady = availability === 'AVAILABLE';
  const providerName = aiProviderName(ai?.provider);
  const modeKey = ai?.strategy_ai_mode ? `brand.intelligence.aiMode.${ai.strategy_ai_mode}` : null;
  const modeLabel = modeKey && t(modeKey) !== modeKey ? t(modeKey) : null;

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
      <BrandPlxPageHead
        title={t('brand.intelligence.hubTitle')}
        description={t('brand.intelligence.hubBody')}
      />

      <div className="oma-plx-brand-hub-grid" data-testid="brand-intelligence-hub">
        <BrandHubCard
          href={profileHref}
          title={t('brand.intelligence.profileCardTitle')}
          description={
            approvedVersion?.approved_at
              ? t('brand.intelligence.approvedOn').replace(
                  '{date}',
                  formatBrandDateTime(approvedVersion.approved_at, locale),
                )
              : t('brand.detail.noApprovedProfile')
          }
          meta={
            latestProfile ? (
              <StatusChip status={latestProfile.status} />
            ) : (
              <StatusChip tone="neutral" label={t('brand.intelligence.noProfileYet')} />
            )
          }
          foot={
            latestProfile && latestProfile.status !== 'APPROVED'
              ? t('brand.intelligence.reviewDraft')
              : t('brand.detail.viewProfile')
          }
          testId="brand-hub-profiles"
        >
          <dl className="oma-hub-facts">
            <div>
              <dt>{t('brand.intelligence.versions')}</dt>
              <dd>{versions.length}</dd>
            </div>
            <div>
              <dt>{t('brand.intelligence.insightsReviewed')}</dt>
              <dd>{review.total > 0 ? `${review.reviewed}/${review.total}` : '0'}</dd>
            </div>
            <div>
              <dt>{t('brand.intelligence.insightsPending')}</dt>
              <dd>{review.pending}</dd>
            </div>
            {latestProfile?.identity_completeness ? (
              <div>
                <dt>{t('brand.intelligence.identityCompleteness')}</dt>
                <dd>
                  {latestProfile.identity_completeness.percent}%
                  {latestProfile.identity_completeness.narrative_ready
                    ? ` · ${t('brand.intelligence.identityNarrativeReady')}`
                    : ''}
                </dd>
              </div>
            ) : null}
          </dl>
          {review.total > 0 ? (
            <div
              className="oma-progress oma-hub-progress"
              role="progressbar"
              aria-label={t('brand.intelligence.insightsReviewed')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={review.percent}
            >
              <div className="oma-progress-bar" style={{ width: `${review.percent}%` }} />
            </div>
          ) : null}
        </BrandHubCard>

        <BrandHubCard
          href={strategyHref}
          title={t('brand.nav.strategies')}
          description={currentStrategy ? currentStrategy.name : t('brand.detail.noStrategy')}
          meta={
            currentStrategy ? <StatusChip tone="info" label={t('strategy.list.current')} /> : null
          }
          foot={currentStrategy ? t('brand.detail.openStrategyCta') : t('strategy.list.create')}
          testId="brand-hub-strategies"
        >
          <dl className="oma-hub-facts">
            <div>
              <dt>{t('brand.intelligence.strategiesTotal')}</dt>
              <dd>{strategies.length}</dd>
            </div>
            <div>
              <dt>{t('strategy.list.hasApproved')}</dt>
              <dd>{approvedStrategies}</dd>
            </div>
            <div>
              <dt>{t('brand.intelligence.lastUpdated')}</dt>
              <dd>
                {strategies[0]
                  ? formatBrandDateTime(
                      [...strategies].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]!
                        .updated_at,
                      locale,
                    )
                  : '—'}
              </dd>
            </div>
          </dl>
        </BrandHubCard>

        <section
          className={`oma-plx-listening-card oma-ai-engine-card${aiReady ? '' : ' is-offline'}`}
          aria-labelledby="ai-engine-title"
          data-testid="brand-hub-ai"
        >
          <div className="oma-plx-listening-card__name-row">
            <strong id="ai-engine-title" className="oma-plx-brand-hub-card__title">
              {t('brand.intelligence.aiEngineTitle')}
            </strong>
            <StatusChip
              tone={
                aiReady ? 'success' : availability === 'BUDGET_EXHAUSTED' ? 'danger' : 'warning'
              }
              label={t(`brand.intelligence.aiAvailability.${availability}`)}
            />
          </div>
          <dl className="oma-hub-facts oma-hub-facts--stack">
            <div>
              <dt>{t('brand.intelligence.aiProvider')}</dt>
              <dd>{providerName ?? t('brand.intelligence.aiProviderNone')}</dd>
            </div>
            {ai?.default_model ? (
              <div>
                <dt>{t('brand.intelligence.aiModels')}</dt>
                <dd className="oma-ltr">
                  {ai.reasoning_model && ai.reasoning_model !== ai.default_model
                    ? `${ai.default_model} · ${ai.reasoning_model}`
                    : ai.default_model}
                </dd>
              </div>
            ) : null}
            {modeLabel ? (
              <div data-testid="strategy-ai-mode-hint">
                <dt>{t('brand.intelligence.strategyAiModeLabel')}</dt>
                <dd>{modeLabel}</dd>
              </div>
            ) : null}
          </dl>
          <p className="oma-muted oma-ai-engine-card__note">
            {aiReady
              ? t('brand.intelligence.aiReadyNote')
              : availability === 'BUDGET_EXHAUSTED'
                ? t('brand.ai.budgetBody')
                : t('brand.ai.setupChecklist')}
          </p>
        </section>
      </div>
    </BrandWorkspaceShell>
  );
}
