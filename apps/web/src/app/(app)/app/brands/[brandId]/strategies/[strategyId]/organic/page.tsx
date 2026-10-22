'use client';

import { OmaTopLoader } from '../../../../../../../../components/ui/oma-top-loader';
import { Button, Input } from '@oma/ui/controls';

import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../../../../../../../../lib/api';
import type { BrandDetail } from '../../../../../../../../lib/brand-types';
import type { StrategyVersionDetail } from '../../../../../../../../lib/strategy-types';
import {
  getApiError,
  isPermissionDenied,
  isTenantRequired,
} from '../../../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../../../components/brand/brand-workspace-shell';
import { StrategySubnav } from '../../../../../../../../components/strategy/strategy-subnav';
import { TrackTabs } from '../../../../../../../../components/strategy/track-tabs';
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../components/shell/select-company';
import { useT } from '../../../../../../../../lib/use-locale';

async function loadLatestVersion(brandId: string, strategyId: string) {
  const brandRes = await api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`);
  const strat = await api<{ data: { latest_version: { id: string } | null } }>(
    `/api/v1/brands/${brandId}/strategies/${strategyId}`,
  );
  if (!strat.data.latest_version) throw new Error('No version');
  const ver = await api<{ data: StrategyVersionDetail }>(
    `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${strat.data.latest_version.id}`,
  );
  return { brand: brandRes.data, version: ver.data };
}

export default function StrategyOrganicPage() {
  const t = useT();
  const params = useParams<{ brandId: string; strategyId: string }>();
  const { brandId, strategyId } = params;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [version, setVersion] = useState<StrategyVersionDetail | null>(null);
  const [frequency, setFrequency] = useState('');
  const [cta, setCta] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await loadLatestVersion(brandId, strategyId);
      setBrand(data.brand);
      setVersion(data.version);
      setFrequency(String(data.version.organic?.frequency ?? ''));
      setCta(String(data.version.organic?.message_cta ?? data.version.organic?.messageCta ?? ''));
    } catch (err) {
      if (isTenantRequired(err)) setTenantRequired(true);
      else if (isPermissionDenied(err)) setDenied(true);
      else setError(getApiError(err).message);
    }
  }, [brandId, strategyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!version?.organic) return;
    try {
      const res = await api<{ data: StrategyVersionDetail }>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${version.id}/organic`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            row_version:
              (version.organic as { rowVersion?: number; row_version?: number }).row_version ??
              (version.organic as { rowVersion?: number }).rowVersion ??
              1,
            frequency,
            message_cta: cta,
          }),
        },
      );
      setVersion(res.data);
      setMessage(t('strategy.saved'));
    } catch (err) {
      setError(getApiError(err).message);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (!brand || !version) return <OmaTopLoader label={t('common.loading')} />;
  const editable = version.status === 'DRAFT';

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <StrategySubnav brandId={brandId} strategyId={strategyId} />
      <TrackTabs brandId={brandId} strategyId={strategyId} />
      <header className="oma-page-header">
        <h2>{t('strategy.organic.title')}</h2>
      </header>
      <form
        className="oma-panel oma-sectioned-form"
        onSubmit={onSave}
        data-testid="strategy-organic-form"
      >
        <section className="oma-form-section">
          <h2>
            <span className="oma-track-pill oma-track-pill--organic">
              {t('strategy.nav.organic')}
            </span>
          </h2>
          <div className="oma-form-grid">
            <label>
              Frequency
              <Input
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                disabled={!editable}
                data-testid="organic-frequency"
              />
            </label>
            <label>
              CTA
              <Input
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                disabled={!editable}
                data-testid="organic-cta"
              />
            </label>
          </div>
        </section>
        {message ? (
          <p className="oma-save-status" data-state="saved" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="oma-save-status" data-state="error" role="alert">
            {error}
          </p>
        ) : null}
        {editable ? (
          <Button type="primary" htmlType="submit">
            {t('strategy.organic.save')}
          </Button>
        ) : (
          <p>{t('strategy.warning.immutable')}</p>
        )}
      </form>
    </BrandWorkspaceShell>
  );
}
