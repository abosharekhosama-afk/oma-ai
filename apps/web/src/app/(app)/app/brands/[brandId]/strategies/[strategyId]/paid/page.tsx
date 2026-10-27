'use client';
import { DetailShimmer } from '../../../../../../../../components/ui/shimmer';

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
import { PaidPlanningBanner } from '../../../../../../../../components/strategy/honesty-banners';
import { TrackTabs } from '../../../../../../../../components/strategy/track-tabs';
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../components/shell/select-company';
import { useT } from '../../../../../../../../lib/use-locale';

export default function StrategyPaidPage() {
  const t = useT();
  const params = useParams<{ brandId: string; strategyId: string }>();
  const { brandId, strategyId } = params;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [version, setVersion] = useState<StrategyVersionDetail | null>(null);
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [message, setMessage] = useState<string | null>(null);
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
      setBudget(String(ver.data.paid?.budget_amount ?? ''));
      setCurrency(String(ver.data.paid?.budget_currency ?? 'USD'));
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
    if (!version?.paid) return;
    try {
      const res = await api<{ data: StrategyVersionDetail }>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${version.id}/paid`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            row_version: (version.paid as { row_version?: number }).row_version ?? 1,
            budget_amount: budget || null,
            budget_currency: currency,
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
  if (!brand || !version) return <DetailShimmer />;
  const editable = version.status === 'DRAFT';

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <StrategySubnav brandId={brandId} strategyId={strategyId} />
      <TrackTabs brandId={brandId} strategyId={strategyId} />
      <header className="oma-page-header">
        <h2>{t('strategy.paid.title')}</h2>
      </header>
      <PaidPlanningBanner />
      <form
        className="oma-panel oma-sectioned-form"
        onSubmit={onSave}
        data-testid="strategy-paid-form"
      >
        <section className="oma-form-section">
          <h2>
            <span className="oma-track-pill oma-track-pill--paid">{t('strategy.nav.paid')}</span>
          </h2>
          <div className="oma-form-grid">
            <label>
              {t('strategy.paid.budget')}
              <Input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                disabled={!editable}
                data-testid="paid-budget"
              />
            </label>
            <label>
              Currency
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={!editable}
                data-testid="paid-currency"
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
            {t('strategy.paid.save')}
          </Button>
        ) : (
          <p>{t('strategy.warning.immutable')}</p>
        )}
      </form>
    </BrandWorkspaceShell>
  );
}
