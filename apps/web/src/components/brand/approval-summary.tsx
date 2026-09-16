'use client';

import { useId, useState } from 'react';
import type { ProfileDetail } from '../../lib/brand-types';
import { useT } from '../../lib/use-locale';

type ApprovalSummaryProps = {
  profile: ProfileDetail;
  scanStatus?: string | null;
  disabled?: boolean;
  onApprove: (payload: {
    acknowledge_incomplete: boolean;
    confirm_summary: boolean;
    reason?: string;
  }) => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
};

export function ApprovalSummary({
  profile,
  scanStatus,
  disabled,
  onApprove,
  onReject,
}: ApprovalSummaryProps) {
  const t = useT();
  const confirmId = useId();
  const ackId = useId();
  const [confirmSummary, setConfirmSummary] = useState(false);
  const [ackIncomplete, setAckIncomplete] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const isPartial = scanStatus === 'PARTIAL';
  const coverage = profile.coverage_snapshot ?? {};
  const serverBlocking = profile.eligibility.blocking_reasons.filter(
    (reason) => reason !== 'PARTIAL_ACK_REQUIRED' && reason !== 'CONFIRM_SUMMARY_REQUIRED',
  );
  const approveBlocked =
    serverBlocking.length > 0 || !confirmSummary || (isPartial && !ackIncomplete);

  async function handleApprove() {
    setBusy(true);
    try {
      await onApprove({
        acknowledge_incomplete: ackIncomplete,
        confirm_summary: confirmSummary,
        reason: reason || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    try {
      await onReject(reason || undefined);
    } finally {
      setBusy(false);
    }
  }

  if (profile.status !== 'NEEDS_REVIEW') return null;

  return (
    <section className="oma-panel oma-approval-summary" aria-labelledby="approval-summary-title">
      <h2 id="approval-summary-title">{t('brand.approval.title')}</h2>

      {isPartial ? (
        <div className="oma-banner oma-banner-warning" role="alert">
          <strong>{t('brand.approval.partialTitle')}</strong>
          <p>{t('brand.approval.partialBody')}</p>
          <ul>
            {(coverage.failed_pages as { url: string; reason: string }[] | undefined)?.map((p) => (
              <li key={p.url}>
                {p.url} — {p.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {serverBlocking.length > 0 ? (
        <div role="alert">
          <p>{t('brand.approval.blocking')}</p>
          <ul>
            {serverBlocking.map((r) => (
              <li key={r}>{t(`brand.blocking.${r}`)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label htmlFor={confirmId}>
        <input
          id={confirmId}
          type="checkbox"
          checked={confirmSummary}
          onChange={(e) => setConfirmSummary(e.target.checked)}
        />{' '}
        {t('brand.approval.confirmSummary')}
      </label>

      {isPartial ? (
        <label htmlFor={ackId}>
          <input
            id={ackId}
            type="checkbox"
            checked={ackIncomplete}
            onChange={(e) => setAckIncomplete(e.target.checked)}
          />{' '}
          {t('brand.approval.ackIncomplete')}
        </label>
      ) : null}

      <label>
        {t('brand.approval.reason')}
        <textarea
          className="oma-input"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>

      <div className="oma-approval-actions">
        <button
          type="button"
          className="oma-btn"
          disabled={disabled || busy || approveBlocked}
          onClick={() => void handleApprove()}
        >
          {t('brand.approval.approve')}
        </button>
        <button
          type="button"
          className="oma-btn-secondary"
          disabled={disabled || busy}
          onClick={() => void handleReject()}
        >
          {t('brand.approval.rejectVersion')}
        </button>
      </div>
    </section>
  );
}
