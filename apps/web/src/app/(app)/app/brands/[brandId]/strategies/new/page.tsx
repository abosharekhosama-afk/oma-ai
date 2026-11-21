'use client';
import { DetailShimmer } from '../../../../../../../components/ui/shimmer';

import { Button, CheckboxField, Input } from '@oma/ui/controls';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../../../../../../../lib/api';
import type { BrandDetail } from '../../../../../../../lib/brand-types';
import {
  getApiError,
  isPermissionDenied,
  isTenantRequired,
} from '../../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../../components/brand/brand-workspace-shell';
import { BrandPlxPageHead, BrandPlxSection } from '../../../../../../../components/brand/brand-plx-section';
import { PermissionDenied } from '../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../components/shell/select-company';
import { useT } from '../../../../../../../lib/use-locale';
import {
  StrategyCreationJourney,
  newStrategyJourneySteps,
} from '../../../../../../../components/strategy/strategy-creation-journey';

export default function NewStrategyPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [name, setName] = useState('');
  const [organicEnabled, setOrganicEnabled] = useState(true);
  const [paidEnabled, setPaidEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  const journeySteps = useMemo(() => newStrategyJourneySteps(brandId, null, t), [brandId, t]);

  useEffect(() => {
    api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`)
      .then((res) => setBrand(res.data))
      .catch((err) => {
        if (isTenantRequired(err)) setTenantRequired(true);
        else if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      });
  }, [brandId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ data: { id: string } }>(`/api/v1/brands/${brandId}/strategies`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          linked_approved_profile_version_id:
            brand?.current_approved_profile_version_id ?? undefined,
          organic_enabled: organicEnabled,
          paid_enabled: paidEnabled,
        }),
      });
      router.push(`/app/brands/${brandId}/strategies/${res.data.id}/edit`);
    } catch (err) {
      if (isPermissionDenied(err)) setDenied(true);
      else setError(getApiError(err).message);
      setSaving(false);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (!brand) return <DetailShimmer />;

  const profileReady = Boolean(brand.current_approved_profile_version_id);

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <BrandPlxPageHead
        title={t('strategy.new.title')}
        actions={<Link href={`/app/brands/${brandId}/strategies`}>{t('brand.create.back')}</Link>}
      />
      <div className="oma-strategy-new-layout">
        <StrategyCreationJourney brandId={brandId} steps={journeySteps} />
        <BrandPlxSection title={t('strategy.new.formTitle')} testId="strategy-create-section">
          <p className="oma-muted" role="note">
            {profileReady ? t('strategy.new.profileReady') : t('strategy.warning.missingProfile')}
          </p>
          <form className="oma-panel oma-stack" onSubmit={onSubmit} data-testid="strategy-create-form">
            <label className="oma-field-span">
              {t('strategy.new.name')}
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={160}
                data-testid="strategy-name"
                placeholder={t('strategy.new.namePlaceholder')}
              />
            </label>
            <fieldset className="oma-chip-row oma-strategy-track-toggles">
              <legend className="oma-sr-only">{t('strategy.overview.tracks')}</legend>
              <label className="oma-plx-listening-card oma-plx-brand-catalog-card">
                <CheckboxField
                  checked={organicEnabled}
                  onChange={(e) => setOrganicEnabled(e.target.checked)}
                />{' '}
                {t('strategy.nav.organic')}
              </label>
              <label className="oma-plx-listening-card oma-plx-brand-catalog-card">
                <CheckboxField
                  checked={paidEnabled}
                  onChange={(e) => setPaidEnabled(e.target.checked)}
                />{' '}
                {t('strategy.nav.paid')}
              </label>
            </fieldset>
            {profileReady ? (
              <p className="oma-banner oma-banner-info" role="status">
                {t('strategy.new.autoLinkProfile')}
              </p>
            ) : null}
            {error ? (
              <p role="alert" style={{ color: 'var(--status-danger)' }}>
                {error}
              </p>
            ) : null}
            <Button type="primary" disabled={saving || !profileReady} htmlType="submit">
              {t('strategy.new.submit')}
            </Button>
          </form>
        </BrandPlxSection>
      </div>
    </BrandWorkspaceShell>
  );
}