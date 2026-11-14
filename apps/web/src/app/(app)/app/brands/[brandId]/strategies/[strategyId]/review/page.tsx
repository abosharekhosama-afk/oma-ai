'use client';
import { DetailShimmer } from '../../../../../../../../components/ui/shimmer';

import { Button, CheckboxField, TextArea } from '@oma/ui/controls';

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
import {
  BrandPlxPageHead,
  BrandPlxSection,
} from '../../../../../../../../components/brand/brand-plx-section';
import { StrategySubnav } from '../../../../../../../../components/strategy/strategy-subnav';
import { StrategyAiAssistant } from '../../../../../../../../components/strategy/strategy-ai-assistant';
import { StrategyStatusBadge } from '../../../../../../../../components/strategy/status-badge';
import { SubmitEligibility } from '../../../../../../../../components/strategy/submit-eligibility';
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../components/shell/select-company';
import { useT } from '../../../../../../../../lib/use-locale';
import { StrategyPlanRequestsPanel } from '../../../../../../../../components/strategy/strategy-plan-requests-panel';
import { StrategyLinkProfilePanel } from '../../../../../../../../components/strategy/strategy-link-profile-panel';
import { StrategyDraftPreview } from '../../../../../../../../components/strategy/strategy-draft-preview';

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
  if (!brand || !version) return <DetailShimmer />;

  const base = `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${version.id}`;

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <StrategySubnav brandId={brandId} strategyId={strategyId} />
      <BrandPlxPageHead
        title={t('strategy.review.title')}
        actions={<StrategyStatusBadge status={version.status} />}
      />
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
      <StrategyLinkProfilePanel
        brandId={brandId}
        strategyId={strategyId}
        versionId={version.id}
        rowVersion={version.row_version}
        linkedProfileVersionId={version.linked_approved_profile_version_id}
        missingSource={version.missing_source}
        versionEditable={version.status === 'DRAFT' || version.status === 'IN_REVIEW'}
        onLinked={() => void load()}
      />
      {version.status === 'DRAFT' || version.status === 'IN_REVIEW' ? (
        <StrategyDraftPreview brandId={brandId} strategyId={strategyId} version={version} />
      ) : null}
      <label className="oma-plx-listening-card oma-plx-brand-catalog-card">
        <CheckboxField
          checked={unknowns}
          onChange={(e) => setUnknowns(e.target.checked)}
          data-testid="strategy-unknowns"
        />{' '}
        {t('strategy.review.unknowns')}
      </label>
      <BrandPlxSection title={t('strategy.overview.actionsTitle')} testId="strategy-review-actions">
        <div className="oma-form-actions">
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
              <Button
                type="primary"
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
              </Button>
              <Button
                type="default"
                onClick={() =>
                  void post(`${base}/request-changes`, {
                    row_version: version.row_version,
                    comment: 'Please revise',
                  })
                }
              >
                {t('strategy.review.requestChanges')}
              </Button>
              <Button
                type="default"
                onClick={() =>
                  void post(`${base}/reject`, {
                    row_version: version.row_version,
                    comment: 'Rejected',
                  })
                }
              >
                {t('strategy.review.reject')}
              </Button>
            </>
          ) : null}
          {['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'].includes(version.status) ? (
            <Button
              type="primary"
              data-testid="strategy-revise"
              onClick={() => void post(`${base}/revise`, {})}
            >
              Revise
            </Button>
          ) : null}
        </div>
      </BrandPlxSection>
      {version.status === 'APPROVED' ? (
        <StrategyPlanRequestsPanel
          brandId={brandId}
          strategyId={strategyId}
          versionId={version.id}
        />
      ) : null}
      {error ? (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {error}
        </p>
      ) : null}
      <BrandPlxSection title={t('strategy.review.comment')} testId="strategy-review-comment-form">
        <form onSubmit={onComment}>
          <label>
            {t('strategy.review.comment')}
            <TextArea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              data-testid="strategy-comment"
              rows={3}
            />
          </label>
          <Button type="primary" htmlType="submit">
            {t('strategy.review.comment')}
          </Button>
        </form>
        <ul className="oma-plx-brand-data-grid">
          {version.comments.map((c) => (
            <li key={c.id} className="oma-plx-listening-card oma-plx-brand-insight-card">
              {c.body}
            </li>
          ))}
        </ul>
      </BrandPlxSection>
      {message ? <p role="status">{message}</p> : null}
    </BrandWorkspaceShell>
  );
}
