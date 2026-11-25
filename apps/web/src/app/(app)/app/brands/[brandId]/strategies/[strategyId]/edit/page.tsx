'use client';
import { DetailShimmer } from '../../../../../../../../components/ui/shimmer';

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
import { StrategyWorkspaceShell } from '../../../../../../../../components/strategy/strategy-workspace-shell';
import { StrategyAiAssistantLink } from '../../../../../../../../components/strategy/strategy-ai-assistant-link';
import { BrandPlxPageHead } from '../../../../../../../../components/brand/brand-plx-section';
import { StrategySubnav } from '../../../../../../../../components/strategy/strategy-subnav';
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../components/shell/select-company';
import { useT } from '../../../../../../../../lib/use-locale';
import { StrategyLinkProfilePanel } from '../../../../../../../../components/strategy/strategy-link-profile-panel';
import { StrategyTrackEnablement } from '../../../../../../../../components/strategy/strategy-track-enablement';
import {
  readFoundationText,
  textToFoundationGoals,
} from '../../../../../../../../lib/strategy-foundation-format';
import { isMeaningfulPositioning } from '@oma/domain/browser';
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
      setGoals(readFoundationText(f.goals));
      setPositioning(readFoundationText(f.positioning));
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
    if (positioning.trim() && !isMeaningfulPositioning(positioning)) {
      setError(t('strategy.foundation.positioningTooShort'));
      return;
    }
    try {
      const res = await api<{ data: StrategyVersionDetail }>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${version.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            row_version: version.row_version,
            foundation: {
              ...version.foundation,
              goals: textToFoundationGoals(goals),
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
  if (!brand || !version) return <DetailShimmer />;

  const editable = version.status === 'DRAFT';

  return (
    <StrategyWorkspaceShell brandId={brandId} brandName={brand.name}>
      <StrategySubnav
        brandId={brandId}
        strategyId={strategyId}
        refreshKey={`${version.status}:${version.row_version}`}
      />
      <div className="oma-strategy-page-stack">
        <BrandPlxPageHead title={t('strategy.foundation.title')} />
        <StrategyAiAssistantLink brandId={brandId} strategyId={strategyId} />
        <StrategyLinkProfilePanel
          brandId={brandId}
          strategyId={strategyId}
          versionId={version.id}
          rowVersion={version.row_version}
          linkedProfileVersionId={version.linked_approved_profile_version_id}
          missingSource={version.missing_source}
          versionEditable={editable}
          onLinked={() => void load()}
        />
        {editable ? (
          <StrategyTrackEnablement
            brandId={brandId}
            strategyId={strategyId}
            version={version}
            editable={editable}
            onUpdated={(next) => setVersion(next)}
          />
        ) : null}
        {!editable ? <p role="status">{t('strategy.warning.immutable')}</p> : null}
        <div data-testid="strategy-document-canvas">
          <form
            className="oma-sectioned-form"
            onSubmit={onSave}
            data-testid="strategy-foundation-form"
          >
            <section className="oma-form-section oma-doc-section" id="strategy-goals">
              <h2>{t('strategy.foundation.goals')}</h2>
              <p className="oma-help">{t('strategy.foundation.goalsHint')}</p>
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
              <p className="oma-help">{t('strategy.foundation.positioningHint')}</p>
              <label className="oma-field-span">
                <TextArea
                  value={positioning}
                  onChange={(e) => setPositioning(e.target.value)}
                  disabled={!editable}
                  data-testid="strategy-positioning"
                  placeholder={t('strategy.foundation.positioningPlaceholder')}
                  aria-invalid={
                    positioning.trim() && !isMeaningfulPositioning(positioning) ? true : undefined
                  }
                  rows={3}
                />
              </label>
              {editable && positioning.trim() && !isMeaningfulPositioning(positioning) ? (
                <p
                  className="oma-field-hint"
                  data-state="warning"
                  data-testid="positioning-too-short"
                >
                  {t('strategy.foundation.positioningTooShort')}
                </p>
              ) : null}
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
      </div>
    </StrategyWorkspaceShell>
  );
}
