'use client';

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
import { AiHonestyBanner } from '../../../../../../../../components/strategy/honesty-banners';
import { StrategyStatusBadge } from '../../../../../../../../components/strategy/status-badge';
import { SubmitEligibility } from '../../../../../../../../components/strategy/submit-eligibility';
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../components/shell/select-company';
import { useT } from '../../../../../../../../lib/use-locale';

export default function StrategyReviewPage() {
  const t = useT();
  const params = useParams<{ brandId: string; strategyId: string }>();
  const { brandId, strategyId } = params;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [version, setVersion] = useState<StrategyVersionDetail | null>(null);
  const [comment, setComment] = useState('');
  const [unknowns, setUnknowns] = useState(false);
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
      setUnknowns(ver.data.unknowns_acknowledged);
    } catch (err) {
      if (isTenantRequired(err)) setTenantRequired(true);
      else if (isPermissionDenied(err)) setDenied(true);
      else setError(getApiError(err).message);
    }
  }, [brandId, strategyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, body: Record<string, unknown>) {
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ data: StrategyVersionDetail }>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setVersion(res.data);
      setMessage(t('strategy.saved'));
    } catch (err) {
      setError(getApiError(err).message);
    }
  }

  async function onComment(e: FormEvent) {
    e.preventDefault();
    if (!version) return;
    await post(
      `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${version.id}/comments`,
      { body: comment },
    );
    setComment('');
    await load();
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (!brand || !version) return <p role="status">{t('common.loading')}</p>;

  const base = `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${version.id}`;

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <StrategySubnav brandId={brandId} strategyId={strategyId} />
      <header className="oma-page-header">
        <h2>{t('strategy.review.title')}</h2>
        <StrategyStatusBadge status={version.status} />
      </header>
      <AiHonestyBanner />
      {version.missing_source ? (
        <div className="oma-panel" role="status" data-testid="strategy-missing-profile">
          {t('strategy.warning.missingProfile')}
        </div>
      ) : null}
      <label className="oma-panel">
        <input
          type="checkbox"
          checked={unknowns}
          onChange={(e) => setUnknowns(e.target.checked)}
          data-testid="strategy-unknowns"
        />{' '}
        {t('strategy.review.unknowns')}
      </label>
      <div className="oma-panel oma-form-actions">
        {version.status === 'DRAFT' ? (
          <SubmitEligibility
            missingProfile={Boolean(version.missing_source)}
            label={t('strategy.review.submit')}
            onClick={() =>
              void post(`${base}/submit`, {
                row_version: version.row_version,
                unknowns_acknowledged: unknowns,
              })
            }
          />
        ) : null}
        {version.status === 'IN_REVIEW' ? (
          <>
            <button
              type="button"
              className="oma-btn"
              data-testid="strategy-approve"
              onClick={() =>
                void post(`${base}/approve`, {
                  row_version: version.row_version,
                  unknowns_acknowledged: unknowns,
                  comment: 'Package approved',
                })
              }
            >
              {t('strategy.review.approve')}
            </button>
            <button
              type="button"
              className="oma-btn oma-btn-secondary"
              onClick={() =>
                void post(`${base}/request-changes`, {
                  row_version: version.row_version,
                  comment: 'Please revise',
                })
              }
            >
              {t('strategy.review.requestChanges')}
            </button>
            <button
              type="button"
              className="oma-btn oma-btn-secondary"
              onClick={() =>
                void post(`${base}/reject`, {
                  row_version: version.row_version,
                  comment: 'Rejected',
                })
              }
            >
              {t('strategy.review.reject')}
            </button>
          </>
        ) : null}
        {['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'].includes(version.status) ? (
          <button
            type="button"
            className="oma-btn"
            data-testid="strategy-revise"
            onClick={() => void post(`${base}/revise`, {})}
          >
            Revise
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {error}
        </p>
      ) : null}
      <form className="oma-panel" onSubmit={onComment}>
        <label>
          {t('strategy.review.comment')}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            data-testid="strategy-comment"
            rows={3}
          />
        </label>
        <button type="submit" className="oma-btn">
          {t('strategy.review.comment')}
        </button>
      </form>
      <ul className="oma-discovery-list">
        {version.comments.map((c) => (
          <li key={c.id} className="oma-discovery-item">
            {c.body}
          </li>
        ))}
      </ul>
      {message ? <p role="status">{message}</p> : null}
    </BrandWorkspaceShell>
  );
}
