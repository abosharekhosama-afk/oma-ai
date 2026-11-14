'use client';
import { DetailShimmer } from '../../../../../../../../components/ui/shimmer';

import { Button, Input, TextArea } from '@oma/ui/controls';

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
import { BrandPlxPageHead } from '../../../../../../../../components/brand/brand-plx-section';
import { StrategySubnav } from '../../../../../../../../components/strategy/strategy-subnav';
import { TrackTabs } from '../../../../../../../../components/strategy/track-tabs';
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../components/shell/select-company';
import { useT } from '../../../../../../../../lib/use-locale';
import { StrategyAiAssistant } from '../../../../../../../../components/strategy/strategy-ai-assistant';
import {
  textToTrackList,
  trackListToText,
} from '../../../../../../../../lib/strategy-foundation-format';

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
  const [pillars, setPillars] = useState('');
  const [channels, setChannels] = useState('');
  const [formats, setFormats] = useState('');
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
      setPillars(trackListToText(data.version.organic?.pillars));
      setChannels(trackListToText(data.version.organic?.channels));
      setFormats(trackListToText(data.version.organic?.formats));
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
            pillars: textToTrackList(pillars),
            channels: textToTrackList(channels),
            formats: textToTrackList(formats),
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
      <BrandPlxPageHead title={t('strategy.organic.title')} />
      {version.status === 'DRAFT' || version.status === 'IN_REVIEW' ? (
        <StrategyAiAssistant
          brandId={brandId}
          strategyId={strategyId}
          versionId={version.id}
          versionStatus={version.status}
          linkedProfileVersionId={version.linked_approved_profile_version_id}
          organicEnabled={version.organic_enabled}
          paidEnabled={version.paid_enabled}
          onApplied={() => void load()}
        />
      ) : null}
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
            <label className="oma-field-span">
              {t('strategy.organic.pillars')}
              <TextArea
                value={pillars}
                onChange={(e) => setPillars(e.target.value)}
                disabled={!editable}
                rows={4}
                data-testid="organic-pillars"
                placeholder={t('strategy.organic.listPlaceholder')}
              />
            </label>
            <label className="oma-field-span">
              {t('strategy.organic.channels')}
              <TextArea
                value={channels}
                onChange={(e) => setChannels(e.target.value)}
                disabled={!editable}
                rows={3}
                data-testid="organic-channels"
                placeholder={t('strategy.organic.listPlaceholder')}
              />
            </label>
            <label className="oma-field-span">
              {t('strategy.organic.formats')}
              <TextArea
                value={formats}
                onChange={(e) => setFormats(e.target.value)}
                disabled={!editable}
                rows={3}
                data-testid="organic-formats"
                placeholder={t('strategy.organic.listPlaceholder')}
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
