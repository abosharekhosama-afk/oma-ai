'use client';

import { OmaTopLoader } from '../../../../../../../components/ui/oma-top-loader';
import { OmaLinkButton } from '../../../../../../../components/ui/oma-link-button';
import { Button } from '@oma/ui/controls';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../../../../../lib/api';
import {
  apiMutate,
  getApiError,
  isPermissionDenied,
  newIdempotencyKey,
} from '../../../../../../../lib/brand-api';
import type { BrandDetail, ScanDetail } from '../../../../../../../lib/brand-types';
import { BrandWorkspaceShell } from '../../../../../../../components/brand/brand-workspace-shell';
import { AiUnavailableBanner } from '../../../../../../../components/brand/ai-unavailable-banner';
import { ConnectorModeBanner } from '../../../../../../../components/brand/connector-mode-banner';
import { PermissionDenied } from '../../../../../../../components/shell/permission-denied';
import { StatusChip } from '../../../../../../../components/ui/status-chip';
import { useT } from '../../../../../../../lib/use-locale';

const TERMINAL = new Set(['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED']);
const PHASES = ['QUEUED', 'CRAWLING', 'EXTRACTING', 'ANALYZING'] as const;
const POLL_MS = 2500;

function phaseIndex(status: string): number {
  if (status === 'SUCCEEDED' || status === 'PARTIAL') return PHASES.length;
  if (status === 'FAILED' || status === 'CANCELLED') {
    const i = PHASES.indexOf(status as (typeof PHASES)[number]);
    return i >= 0 ? i : Math.max(0, PHASES.length - 1);
  }
  const i = PHASES.indexOf(status as (typeof PHASES)[number]);
  return i >= 0 ? i : 0;
}

export default function ScanDetailPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ brandId: string; scanId: string }>();
  const { brandId, scanId } = params;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const liveRef = useRef<HTMLDivElement>(null);
  const lastAnnounced = useRef('');

  const loadScan = useCallback(async () => {
    const res = await api<{ data: ScanDetail }>(`/api/v1/brands/${brandId}/scans/${scanId}`);
    setScan(res.data);
    return res.data;
  }, [brandId, scanId]);

  useEffect(() => {
    Promise.all([api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`), loadScan()])
      .then(([brandRes]) => setBrand(brandRes.data))
      .catch((err) => {
        if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      })
      .finally(() => setLoading(false));
  }, [brandId, loadScan]);

  useEffect(() => {
    if (!scan || TERMINAL.has(scan.status)) return;
    const id = window.setInterval(() => {
      loadScan().catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [scan, loadScan]);

  useEffect(() => {
    if (!scan || !liveRef.current) return;
    const msg = t('brand.scan.progressLive')
      .replace('{status}', scan.status)
      .replace('{percent}', String(scan.progress_percent));
    if (msg !== lastAnnounced.current) {
      lastAnnounced.current = msg;
      liveRef.current.textContent = msg;
    }
  }, [scan, t]);

  async function handleCancel() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await apiMutate<{ data: ScanDetail }>(
        `/api/v1/brands/${brandId}/scans/${scanId}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
      setScan(res.data);
    } catch (err) {
      setActionError(getApiError(err).message);
      await loadScan().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function handleRetry() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await apiMutate<{ data: { scan_attempt_id: string } }>(
        `/api/v1/brands/${brandId}/scans/${scanId}/retry`,
        {
          method: 'POST',
          body: JSON.stringify({}),
          idempotencyKey: newIdempotencyKey('brand:scan-retry'),
        },
      );
      router.push(`/app/brands/${brandId}/scans/${res.data.scan_attempt_id}`);
    } catch (err) {
      setActionError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (loading) return <OmaTopLoader label={t('common.loading')} />;
  if (error || !brand || !scan) {
    return (
      <div className="oma-card" role="alert">
        <p style={{ color: 'var(--status-danger)' }}>{error ?? t('common.notFound')}</p>
      </div>
    );
  }

  const isPartial = scan.status === 'PARTIAL';
  const isFailed = scan.status === 'FAILED';
  const isCancelled = scan.status === 'CANCELLED';
  const canRetry = ['FAILED', 'PARTIAL', 'CANCELLED'].includes(scan.status);
  const inProgress = !TERMINAL.has(scan.status);
  const activePhase = phaseIndex(scan.status);

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name} scanStatus={scan.status}>
      <AiUnavailableBanner aiAvailability={scan.ai_availability} />

      <ConnectorModeBanner mode={scan.connector_mode} />

      {isPartial ? (
        <div className="oma-banner oma-banner-warning" role="alert">
          <strong>{t('brand.scan.partialTitle')}</strong>
          <p>{t('brand.scan.partialBody')}</p>
        </div>
      ) : null}

      {isFailed ? (
        <div className="oma-banner oma-banner-danger" role="alert">
          <strong>{t('brand.scan.failedTitle')}</strong>
          <p>{t('brand.scan.failedBody')}</p>
          {scan.error_code ? <p className="oma-muted">{scan.error_code}</p> : null}
        </div>
      ) : null}

      {isCancelled ? (
        <div className="oma-banner oma-banner-warning" role="status">
          <strong>{t('brand.scan.cancelledTitle')}</strong>
          <p>{t('brand.scan.cancelledBody')}</p>
        </div>
      ) : null}

      <div className="oma-panel">
        <h2>{t('brand.scan.progressTitle')}</h2>
        <div
          ref={liveRef}
          className="oma-sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        />

        <ol className="oma-scan-phases" aria-label={t('brand.scan.phasesTitle')}>
          {PHASES.map((phase, index) => {
            const done = activePhase > index || TERMINAL.has(scan.status);
            const current = scan.status === phase;
            return (
              <li
                key={phase}
                className={
                  current
                    ? 'oma-scan-phase is-current'
                    : done
                      ? 'oma-scan-phase is-done'
                      : 'oma-scan-phase'
                }
              >
                <StatusChip
                  status={current ? scan.status : done ? 'SUCCEEDED' : 'QUEUED'}
                  label={t(`brand.scan.phase.${phase}`)}
                />
              </li>
            );
          })}
        </ol>

        <div className="oma-progress" aria-hidden="true">
          <div className="oma-progress-bar" style={{ width: `${scan.progress_percent}%` }} />
        </div>
        <p aria-hidden="true">
          {scan.progress_percent}% —{' '}
          <span className="oma-badge" data-testid="scan-status">
            {scan.status}
          </span>
        </p>
        <div className="oma-scan-stats" aria-label={t('brand.scan.progressTitle')}>
          <div className="oma-scan-stat">
            <strong>{scan.pages_fetched}</strong>
            <span>{t('brand.scan.pagesFetched')}</span>
          </div>
          <div className="oma-scan-stat">
            <strong>{scan.pages_failed}</strong>
            <span>{t('brand.scan.pagesFailed')}</span>
          </div>
          <div className="oma-scan-stat">
            <strong>{scan.pages_skipped}</strong>
            <span>{t('brand.scan.pagesSkipped')}</span>
          </div>
        </div>
        {actionError ? (
          <p role="alert" style={{ color: 'var(--status-danger)' }}>
            {actionError}
          </p>
        ) : null}
        <div className="oma-form-actions">
          {inProgress ? (
            <Button type="default" disabled={busy} onClick={() => void handleCancel()}>
              {t('brand.scan.cancel')}
            </Button>
          ) : null}
          {canRetry ? (
            <Button type="primary" disabled={busy} onClick={() => void handleRetry()}>
              {t('brand.scan.retry')}
            </Button>
          ) : null}
          {scan.profile_version_id ? (
            <OmaLinkButton
              href={`/app/brands/${brandId}/profiles/${scan.profile_version_id}`}
              type="primary"
            >
              {t('brand.scan.viewProfile')}
            </OmaLinkButton>
          ) : null}
          <Link href={`/app/brands/${brandId}/discovery/pages`}>
            {t('brand.discovery.pagesTitle')}
          </Link>
          <Link href={`/app/brands/${brandId}`}>{t('brand.scan.backToBrand')}</Link>
        </div>
      </div>
    </BrandWorkspaceShell>
  );
}
