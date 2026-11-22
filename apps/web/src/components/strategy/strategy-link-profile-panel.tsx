'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import type { BrandDetail } from '../../lib/brand-types';
import { useT } from '../../lib/use-locale';

type Props = {
  brandId: string;
  strategyId: string;
  versionId: string;
  rowVersion: number;
  linkedProfileVersionId: string | null;
  missingSource: boolean;
  versionEditable: boolean;
  onLinked?: () => void;
};

export function StrategyLinkProfilePanel({
  brandId,
  strategyId,
  versionId,
  rowVersion,
  linkedProfileVersionId,
  missingSource,
  versionEditable,
  onLinked,
}: Props) {
  const t = useT();
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`)
      .then((res) => setBrand(res.data))
      .catch(() => setBrand(null));
  }, [brandId]);

  const linkApproved = useCallback(async () => {
    const approvedId = brand?.current_approved_profile_version_id;
    if (!approvedId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/link-profile`,
        {
          method: 'POST',
          body: JSON.stringify({
            profile_version_id: approvedId,
            role: 'approved',
            row_version: rowVersion,
          }),
        },
      );
      setMessage(t('strategy.linkProfile.success'));
      onLinked?.();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }, [brand, brandId, onLinked, rowVersion, strategyId, t, versionId]);

  const currentApprovedId = brand?.current_approved_profile_version_id ?? null;
  const staleLink = Boolean(
    !missingSource &&
    linkedProfileVersionId &&
    currentApprovedId &&
    currentApprovedId !== linkedProfileVersionId,
  );

  if (staleLink && currentApprovedId) {
    // The linked profile was replaced by a newer approved one: submit is blocked
    // (LINKED_PROFILE_NOT_APPROVED) until the draft points at the current profile.
    return (
      <section
        className="oma-banner oma-banner-warning oma-stack"
        id="strategy-link-profile"
        data-testid="strategy-profile-stale"
        aria-label={t('strategy.linkProfile.staleTitle')}
      >
        <strong>{t('strategy.linkProfile.staleTitle')}</strong>
        <p className="oma-muted">{t('strategy.linkProfile.staleHint')}</p>
        <LinkProfileActions
          approvedId={currentApprovedId}
          brandId={brandId}
          versionEditable={versionEditable}
          busy={busy}
          onLink={() => void linkApproved()}
        />
        {message ? <p role="status">{message}</p> : null}
        {error ? (
          <p role="alert" style={{ color: 'var(--status-danger)' }}>
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  if (!missingSource && linkedProfileVersionId) {
    return (
      <div
        className="oma-banner oma-banner-info"
        role="status"
        id="strategy-link-profile"
        data-testid="strategy-profile-linked"
      >
        <strong>{t('strategy.linkProfile.linkedTitle')}</strong>
        <p className="oma-muted">{t('strategy.linkProfile.linkedHint')}</p>
        <p>
          <Link
            href={`/app/brands/${brandId}/profiles/${linkedProfileVersionId}`}
            className="oma-text-link"
          >
            {t('brand.detail.viewProfile')}
          </Link>
        </p>
      </div>
    );
  }

  if (!missingSource) return null;

  const approvedId = currentApprovedId;

  return (
    <section
      className="oma-plx-listening-panel oma-plx-brand-section oma-stack"
      id="strategy-link-profile"
      data-testid="strategy-missing-profile"
      aria-label={t('strategy.linkProfile.title')}
    >
      <h3>{t('strategy.linkProfile.title')}</h3>
      <p className="oma-muted">{t('strategy.linkProfile.body')}</p>
      {approvedId ? (
        <LinkProfileActions
          approvedId={approvedId}
          brandId={brandId}
          versionEditable={versionEditable}
          busy={busy}
          onLink={() => void linkApproved()}
        />
      ) : (
        <p>
          <Link href={`/app/brands/${brandId}/profiles`} className="oma-text-link">
            {t('strategy.linkProfile.approveProfileCta')}
          </Link>
        </p>
      )}
      {message ? <p role="status">{message}</p> : null}
      {error ? (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}

function LinkProfileActions({
  approvedId,
  brandId,
  versionEditable,
  busy,
  onLink,
}: {
  approvedId: string;
  brandId: string;
  versionEditable: boolean;
  busy: boolean;
  onLink: () => void;
}) {
  const t = useT();
  return (
    <div className="oma-chip-row">
      <Link href={`/app/brands/${brandId}/profiles/${approvedId}`} className="oma-text-link">
        {t('strategy.linkProfile.viewApproved')}
      </Link>
      {versionEditable ? (
        <Button type="primary" disabled={busy} onClick={onLink} data-testid="strategy-link-profile">
          {t('strategy.linkProfile.action')}
        </Button>
      ) : (
        <p className="oma-muted">{t('strategy.linkProfile.reviseToLink')}</p>
      )}
    </div>
  );
}
