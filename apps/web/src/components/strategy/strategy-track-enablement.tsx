'use client';

import { Button, CheckboxField, TextArea } from '@oma/ui/controls';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import type { StrategyVersionDetail } from '../../lib/strategy-types';
import { useT } from '../../lib/use-locale';

type Props = {
  brandId: string;
  strategyId: string;
  version: StrategyVersionDetail;
  editable: boolean;
  onUpdated: (next: StrategyVersionDetail) => void;
};

export function StrategyTrackEnablement({
  brandId,
  strategyId,
  version,
  editable,
  onUpdated,
}: Props) {
  const t = useT();
  const [organicEnabled, setOrganicEnabled] = useState(version.organic_enabled);
  const [paidEnabled, setPaidEnabled] = useState(version.paid_enabled);
  const [organicRationale, setOrganicRationale] = useState(
    version.organic_disabled_rationale ?? '',
  );
  const [paidRationale, setPaidRationale] = useState(version.paid_disabled_rationale ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setOrganicEnabled(version.organic_enabled);
    setPaidEnabled(version.paid_enabled);
    setOrganicRationale(version.organic_disabled_rationale ?? '');
    setPaidRationale(version.paid_disabled_rationale ?? '');
  }, [
    version.organic_enabled,
    version.paid_enabled,
    version.organic_disabled_rationale,
    version.paid_disabled_rationale,
  ]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editable) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api<{ data: StrategyVersionDetail }>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${version.id}/tracks/enablement`,
        {
          method: 'POST',
          body: JSON.stringify({
            row_version: version.row_version,
            organic_enabled: organicEnabled,
            paid_enabled: paidEnabled,
            organic_disabled_rationale: organicEnabled ? null : organicRationale.trim() || null,
            paid_disabled_rationale: paidEnabled ? null : paidRationale.trim() || null,
          }),
        },
      );
      onUpdated(res.data);
      setSaved(true);
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="oma-plx-listening-panel oma-plx-brand-section"
      data-testid="strategy-track-enablement"
    >
      <header className="oma-plx-brand-section__head">
        <h3 className="oma-plx-brand-section__title">{t('strategy.enablement.title')}</h3>
        <p className="oma-muted oma-plx-brand-section__desc">{t('strategy.enablement.hint')}</p>
      </header>
      <form className="oma-plx-brand-section__body oma-stack" onSubmit={onSubmit}>
        <fieldset className="oma-chip-row" disabled={!editable || busy}>
          <label className="oma-plx-listening-card oma-plx-brand-catalog-card">
            <CheckboxField
              checked={organicEnabled}
              onChange={(e) => setOrganicEnabled(e.target.checked)}
              data-testid="enablement-organic"
            />{' '}
            {t('strategy.nav.organic')}
          </label>
          <label className="oma-plx-listening-card oma-plx-brand-catalog-card">
            <CheckboxField
              checked={paidEnabled}
              onChange={(e) => setPaidEnabled(e.target.checked)}
              data-testid="enablement-paid"
            />{' '}
            {t('strategy.nav.paid')}
          </label>
        </fieldset>
        {!organicEnabled ? (
          <label className="oma-field-span">
            {t('strategy.enablement.organicOff')}
            <TextArea
              value={organicRationale}
              onChange={(e) => setOrganicRationale(e.target.value)}
              disabled={!editable || busy}
              rows={2}
              data-testid="enablement-organic-rationale"
            />
          </label>
        ) : null}
        {!paidEnabled ? (
          <label className="oma-field-span">
            {t('strategy.enablement.paidOff')}
            <TextArea
              value={paidRationale}
              onChange={(e) => setPaidRationale(e.target.value)}
              disabled={!editable || busy}
              rows={2}
              data-testid="enablement-paid-rationale"
            />
          </label>
        ) : null}
        {error ? (
          <p className="oma-save-status" data-state="error" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="oma-save-status" data-state="saved" role="status">
            {t('strategy.saved')}
          </p>
        ) : null}
        {editable ? (
          <Button type="primary" htmlType="submit" disabled={busy}>
            {t('strategy.enablement.save')}
          </Button>
        ) : null}
      </form>
    </section>
  );
}
