'use client';

import { OmaTopLoader } from '../../../../../../../../components/ui/oma-top-loader';
import { Button, TextArea } from '@oma/ui/controls';

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
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../components/shell/select-company';
import { useT } from '../../../../../../../../lib/use-locale';

export default function StrategyFoundationPage() {
  const t = useT();
  const params = useParams<{ brandId: string; strategyId: string }>();
  const { brandId, strategyId } = params;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [version, setVersion] = useState<StrategyVersionDetail | null>(null);
  const [goals, setGoals] = useState('');
  const [positioning, setPositioning] = useState('');
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
      if (!strat.data.latest_version) throw new Error('No version');
      const ver = await api<{ data: StrategyVersionDetail }>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${strat.data.latest_version.id}`,
      );
      setBrand(brandRes.data);
      setVersion(ver.data);
      const f = ver.data.foundation ?? {};
      const g = f.goals as Array<{ value?: string }> | undefined;
      const p = f.positioning as { value?: string } | string | undefined;
      setGoals(Array.isArray(g) ? (g[0]?.value ?? '') : '');
      setPositioning(typeof p === 'string' ? p : (p?.value ?? ''));
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
    if (!version) return;
    setMessage(null);
    setError(null);
    try {
      const res = await api<{ data: StrategyVersionDetail }>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${version.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            row_version: version.row_version,
            foundation: {
              ...version.foundation,
              goals: [{ value: goals, infoClass: 'USER_AUTHORED' }],
              positioning: { value: positioning, infoClass: 'USER_AUTHORED' },
            },
          }),
        },
      );
      setVersion(res.data);
      setMessage(t('strategy.saved'));
    } catch (err) {
      const apiErr = getApiError(err);
      setError(apiErr.code === 'CONFLICT_VERSION' ? t('strategy.conflict') : apiErr.message);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (!brand || !version) return <OmaTopLoader label={t('common.loading')} />;

  const editable = version.status === 'DRAFT';

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <StrategySubnav brandId={brandId} strategyId={strategyId} />
      <header className="oma-page-header">
        <h2>{t('strategy.foundation.title')}</h2>
      </header>
      {version.missing_source ? (
        <p className="oma-muted" role="status">
          {t('strategy.warning.missingProfile')}
        </p>
      ) : null}
      {!editable ? <p role="status">{t('strategy.warning.immutable')}</p> : null}
      <div className="oma-doc-canvas oma-editor-shell" data-testid="strategy-document-canvas">
        <nav className="oma-doc-outline" aria-label={t('strategy.foundation.title')}>
          <a href="#strategy-goals">{t('strategy.foundation.goals')}</a>
          <a href="#strategy-positioning">{t('strategy.foundation.positioning')}</a>
          <a href={`/app/brands/${brandId}/strategies/${strategyId}/organic`}>
            {t('strategy.nav.organic')}
          </a>
          <a href={`/app/brands/${brandId}/strategies/${strategyId}/paid`}>
            {t('strategy.nav.paid')}
          </a>
          <a href={`/app/brands/${brandId}/strategies/${strategyId}/evidence`}>
            {t('strategy.nav.evidence')}
          </a>
        </nav>
        <form
          className="oma-panel oma-sectioned-form oma-doc-main"
          onSubmit={onSave}
          data-testid="strategy-foundation-form"
        >
          <section className="oma-form-section oma-doc-section" id="strategy-goals">
            <h2>{t('strategy.foundation.goals')}</h2>
            <p className="oma-help">{t('strategy.list.hint')}</p>
            <label className="oma-field-span">
              <TextArea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                disabled={!editable}
                data-testid="strategy-goals"
                rows={3}
              />
            </label>
          </section>
          <section className="oma-form-section oma-doc-section" id="strategy-positioning">
            <h2>{t('strategy.foundation.positioning')}</h2>
            <label className="oma-field-span">
              <TextArea
                value={positioning}
                onChange={(e) => setPositioning(e.target.value)}
                disabled={!editable}
                data-testid="strategy-positioning"
                rows={3}
              />
            </label>
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
              {t('strategy.foundation.save')}
            </Button>
          ) : null}
        </form>
      </div>
    </BrandWorkspaceShell>
  );
}
