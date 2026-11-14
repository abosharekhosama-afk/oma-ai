'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import { groupProposalItems, type StrategyAiProposalItem } from '../../lib/strategy-ai-ui';
import { useT } from '../../lib/use-locale';
import { AiHonestyBanner } from './honesty-banners';

type Props = {
  brandId: string;
  strategyId: string;
  versionId: string;
  versionStatus: string;
  linkedProfileVersionId: string | null;
  organicEnabled: boolean;
  paidEnabled: boolean;
  onApplied?: () => void;
};

type ProposeResponse = {
  data?: {
    run_id: string;
    proposal?: { items?: StrategyAiProposalItem[]; banner?: string };
    used_approved_profile?: boolean;
    brand_profile_version_id?: string | null;
    requires_acceptance?: boolean;
  };
};

export function StrategyAiAssistant({
  brandId,
  strategyId,
  versionId,
  versionStatus,
  linkedProfileVersionId,
  organicEnabled,
  paidEnabled,
  onApplied,
}: Props) {
  const t = useT();
  const [aiAvailability, setAiAvailability] = useState<string>('NOT_CONFIGURED');
  const [strategyAiMode, setStrategyAiMode] = useState<string>('live');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{
    run_id: string;
    items: StrategyAiProposalItem[];
  } | null>(null);

  const editable = versionStatus === 'DRAFT' || versionStatus === 'IN_REVIEW';

  useEffect(() => {
    void api<{ data?: { availability?: string; strategy_ai_mode?: string } }>('/api/v1/ai/status')
      .then((res) => {
        setAiAvailability(res.data?.availability ?? 'NOT_CONFIGURED');
        setStrategyAiMode(res.data?.strategy_ai_mode ?? 'live');
      })
      .catch(() => setAiAvailability('NOT_CONFIGURED'));
  }, []);

  const grouped = useMemo(
    () => (proposal ? groupProposalItems(proposal.items) : new Map()),
    [proposal],
  );

  const propose = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<ProposeResponse>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/ai/propose`,
        { method: 'POST', body: '{}' },
      );
      setProposal({
        run_id: res.data?.run_id ?? '',
        items: res.data?.proposal?.items ?? [],
      });
      setMessage(
        res.data?.used_approved_profile
          ? 'strategy.ai.usedProfile'
          : 'strategy.ai.noApprovedProfile',
      );
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }, [brandId, strategyId, versionId, t]);

  async function accept() {
    if (!proposal) return;
    setBusy(true);
    setError(null);
    try {
      await api(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/ai/propose/accept`,
        { method: 'POST', body: JSON.stringify({ run_id: proposal.run_id }) },
      );
      setMessage('strategy.ai.accepted');
      setProposal(null);
      onApplied?.();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!proposal) return;
    setBusy(true);
    try {
      await api(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/ai/propose/reject`,
        { method: 'POST', body: JSON.stringify({ run_id: proposal.run_id }) },
      );
      setProposal(null);
      setMessage('strategy.ai.rejected');
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const profileId = linkedProfileVersionId;

  return (
    <section className="oma-panel oma-stack" data-testid="strategy-ai-assistant">
      <header>
        <h3>{t('strategy.ai.panelTitle')}</h3>
        <p className="oma-muted">{t('strategy.ai.panelHint')}</p>
      </header>

      <AiHonestyBanner availability={aiAvailability} />

      {strategyAiMode !== 'live' ? (
        <p className="oma-banner oma-banner-warning" role="status">
          {t('strategy.ai.modeBlocked').replace('{mode}', strategyAiMode)}
        </p>
      ) : null}

      <dl className="oma-detail-dl">
        <div>
          <dt>{t('strategy.ai.sourceProfile')}</dt>
          <dd>
            {profileId ? (
              <Link href={`/app/brands/${brandId}/profiles/${profileId}`} className="oma-text-link">
                {t('brand.detail.viewProfile')}
              </Link>
            ) : (
              <span className="oma-muted">{t('strategy.ai.linkProfileFirst')}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('strategy.overview.tracks')}</dt>
          <dd>
            {organicEnabled ? t('strategy.nav.organic') : '—'} ·{' '}
            {paidEnabled ? t('strategy.nav.paid') : '—'}
          </dd>
        </div>
      </dl>

      {!editable ? (
        <p className="oma-muted" role="status">
          {t('strategy.ai.readOnlyVersion')}
        </p>
      ) : (
        <Button
          type="default"
          disabled={busy || aiAvailability !== 'AVAILABLE' || strategyAiMode !== 'live'}
          onClick={() => void propose()}
        >
          {busy ? t('strategy.ai.proposing') : t('strategy.ai.propose')}
        </Button>
      )}

      {message ? (
        <div role="status" className="oma-stack">
          <p>{message.startsWith('strategy.') ? t(message) : message}</p>
          {message === 'strategy.ai.accepted' ? (
            <div className="oma-banner oma-banner-info" data-testid="strategy-ai-next-steps">
              <p>{t('strategy.ai.nextStepsAfterAccept')}</p>
              <div className="oma-chip-row">
                <Link
                  href={`/app/brands/${brandId}/strategies/${strategyId}/edit`}
                  className="oma-text-link"
                >
                  {t('strategy.nav.foundation')}
                </Link>
                <Link
                  href={`/app/brands/${brandId}/strategies/${strategyId}/organic`}
                  className="oma-text-link"
                >
                  {t('strategy.nav.organic')}
                </Link>
                <Link
                  href={`/app/brands/${brandId}/strategies/${strategyId}/review`}
                  className="oma-text-link"
                >
                  {t('strategy.nav.review')}
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {error}
        </p>
      ) : null}

      {proposal && proposal.items.length > 0 ? (
        <div className="oma-stack" data-testid="strategy-ai-proposal-preview">
          <p className="oma-badge">{t('strategy.ai.proposalBanner')}</p>
          {[...grouped.entries()].map(([section, items]) => (
            <div key={section}>
              <h4>{t(`strategy.ai.section.${section}`) || section}</h4>
              <ul>
                {items.map((item: StrategyAiProposalItem) => (
                  <li key={`${item.field}-${item.value.slice(0, 24)}`}>
                    <strong>{item.field}</strong>
                    {item.kind ? (
                      <span className="oma-badge oma-badge-muted"> {item.kind}</span>
                    ) : null}
                    <p>{item.value}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="oma-chip-row">
            <Button type="primary" disabled={busy} onClick={() => void accept()}>
              {t('strategy.ai.accept')}
            </Button>
            <Button type="default" disabled={busy} onClick={() => void reject()}>
              {t('strategy.ai.reject')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
