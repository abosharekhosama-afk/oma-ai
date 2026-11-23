'use client';
import { DetailShimmer } from '../../../../../../../../components/ui/shimmer';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../../../../../lib/api';
import type { BrandDetail } from '../../../../../../../../lib/brand-types';
import type {
  StrategyDetail,
  StrategyVersionDetail,
} from '../../../../../../../../lib/strategy-types';
import { formatBrandDateTime } from '../../../../../../../../lib/brand-format';
import { StatusChip } from '../../../../../../../../components/ui/status-chip';
import {
  getApiError,
  isPermissionDenied,
  isTenantRequired,
} from '../../../../../../../../lib/brand-api';
import { StrategyWorkspaceShell } from '../../../../../../../../components/strategy/strategy-workspace-shell';
import {
  BrandPlxPageHead,
  BrandPlxSection,
} from '../../../../../../../../components/brand/brand-plx-section';
import { StrategySubnav } from '../../../../../../../../components/strategy/strategy-subnav';
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../components/shell/select-company';
import { useLocale, useT } from '../../../../../../../../lib/use-locale';

export default function StrategyEvidencePage() {
  const t = useT();
  const locale = useLocale();
  const params = useParams<{ brandId: string; strategyId: string }>();
  const { brandId, strategyId } = params;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [version, setVersion] = useState<StrategyVersionDetail | null>(null);
  const [linkedProfile, setLinkedProfile] = useState<
    NonNullable<StrategyDetail['latest_version']>['linked_profile'] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  const load = useCallback(async () => {
    try {
      const brandRes = await api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`);
      const strat = await api<{ data: StrategyDetail }>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}`,
      );
      const ver = await api<{ data: StrategyVersionDetail }>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${strat.data.latest_version!.id}`,
      );
      setBrand(brandRes.data);
      setVersion(ver.data);
      setLinkedProfile(strat.data.latest_version?.linked_profile ?? null);
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
      <BrandPlxPageHead title={t('strategy.evidence.title')} />
      {error ? <p role="alert">{error}</p> : null}
      <BrandPlxSection
        title={t('strategy.evidence.profileTitle')}
        testId="strategy-evidence-profile"
      >
        {version.linked_approved_profile_version_id ? (
          <div className="oma-strategy-evidence-row">
            <div>
              <strong>{t('strategy.evidence.profileName')}</strong>
              <p className="oma-muted">
                {linkedProfile?.approved_at
                  ? t('strategy.evidence.profileApprovedAt').replace(
                      '{date}',
                      formatBrandDateTime(linkedProfile.approved_at, locale),
                    )
                  : t('strategy.evidence.profileLinked')}
              </p>
            </div>
            <div className="oma-chip-row">
              <StatusChip tone="success" label={t('strategy.overview.evidenceYes')} />
              <Link
                className="oma-text-link"
                href={`/app/brands/${brandId}/profiles/${version.linked_approved_profile_version_id}`}
              >
                {t('brand.detail.viewProfile')}
              </Link>
            </div>
          </div>
        ) : (
          <p role="status" className="oma-muted">
            {t('strategy.warning.missingProfile')}
          </p>
        )}
      </BrandPlxSection>
      <BrandPlxSection
        title={t('strategy.evidence.extraTitle')}
        testId={version.evidence_links.length === 0 ? 'strategy-evidence-empty' : undefined}
      >
        {version.evidence_links.length === 0 ? (
          <p className="oma-muted">
            {version.linked_approved_profile_version_id
              ? t('strategy.evidence.extraEmptyWithProfile')
              : t('strategy.evidence.empty')}
          </p>
        ) : (
          <ul className="oma-plx-brand-data-grid" data-testid="strategy-evidence-list">
            {version.evidence_links.map((link) => (
              <li key={link.id} className="oma-plx-listening-card oma-plx-brand-catalog-card">
                {link.label ?? t('strategy.evidence.untitledExcerpt')}
              </li>
            ))}
          </ul>
        )}
      </BrandPlxSection>
    </StrategyWorkspaceShell>
  );
}
