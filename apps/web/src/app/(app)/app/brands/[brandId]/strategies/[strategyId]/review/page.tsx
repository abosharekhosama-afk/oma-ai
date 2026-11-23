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
import { StrategyWorkspaceShell } from '../../../../../../../../components/strategy/strategy-workspace-shell';
import { StrategyPageAi } from '../../../../../../../../components/strategy/strategy-page-ai';
import {
  BrandPlxPageHead,
  BrandPlxSection,
} from '../../../../../../../../components/brand/brand-plx-section';
import { StrategySubnav } from '../../../../../../../../components/strategy/strategy-subnav';
import { StrategyVersionStatusChip } from '../../../../../../../../components/strategy/status-badge';
import { SubmitEligibility } from '../../../../../../../../components/strategy/submit-eligibility';
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../../components/shell/select-company';
import { useT } from '../../../../../../../../lib/use-locale';
import { StrategyLinkProfilePanel } from '../../../../../../../../components/strategy/strategy-link-profile-panel';
import { StrategyDraftPreview } from '../../../../../../../../components/strategy/strategy-draft-preview';
import { OmaLinkButton } from '../../../../../../../../components/ui/oma-link-button';
import { StrategySubmitBlockers } from '../../../../../../../../components/strategy/strategy-submit-blockers';
import type { StrategyBlockingItem } from '@oma/domain/browser';
import {
  blockingItemsFromDetails,
  useStrategyReadiness,
} from '../../../../../../../../lib/strategy-readiness';

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
  /** Blocking items returned by a refused submit/approve (overrides the readiness preview). */
  const [refused, setRefused] = useState<StrategyBlockingItem[] | null>(null);
  const { readiness, reload: reloadReadiness } = useStrategyReadiness(
    brandId,
    strategyId,
    version?.id,
    `${version?.status}:${version?.row_version}`,
  );

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
    setRefused(null);
    try {
      const res = await api<{ data: StrategyVersionDetail }>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setVersion(res.data);
      setMessage(t('strategy.saved'));
    } catch (err) {
      const apiErr = getApiError(err);
      const items = blockingItemsFromDetails(apiErr.details);
      if (apiErr.code === 'APPROVAL_INELIGIBLE' && items.length > 0) {
        // Show exactly what is missing instead of a generic refusal.
        setRefused(items);
        void reloadReadiness();
      } else {
        setError(apiErr.message);
      }
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
  const gateAction =
    version.status === 'DRAFT' ? 'submit' : version.status === 'IN_REVIEW' ? 'approve' : null;
  const blockers: StrategyBlockingItem[] | null =
    refused ?? (readiness && readiness.action === gateAction ? readiness.blocking_reasons : null);
  const openBlockers = (blockers ?? []).filter(
    (b) => !(unknowns && b.code === 'UNKNOWNS_ACK_REQUIRED'),
  );

  return (
    <StrategyWorkspaceShell brandId={brandId} brandName={brand.name}>
      <StrategySubnav
        brandId={brandId}
        strategyId={strategyId}
        refreshKey={`${version.status}:${version.row_version}`}
      />
      <div className="oma-strategy-page-stack">
        <BrandPlxPageHead
          title={t('strategy.review.title')}
          actions={<StrategyVersionStatusChip status={version.status} />}
        />
        <StrategyPageAi
          brandId={brandId}
          strategyId={strategyId}
          version={version}
          focus="review"
          onApplied={() => void load()}
        />
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
        {version.status === 'DRAFT' || version.status === 'IN_REVIEW' ? (
          <label className="oma-strategy-ack" id="strategy-unknowns">
            <CheckboxField
              checked={unknowns}
              onChange={(e) => setUnknowns(e.target.checked)}
              data-testid="strategy-unknowns"
            />{' '}
            {t('strategy.review.unknowns')}
          </label>
        ) : null}
        <BrandPlxSection
          title={t('strategy.overview.actionsTitle')}
          testId="strategy-review-actions"
        >
          {gateAction && blockers ? (
            <StrategySubmitBlockers
              brandId={brandId}
              strategyId={strategyId}
              action={gateAction}
              items={blockers}
              unknownsChecked={unknowns}
            />
          ) : null}
          <div className="oma-form-actions">
            {version.status === 'DRAFT' ? (
              <SubmitEligibility
                missingProfile={Boolean(version.missing_source)}
                disabled={openBlockers.length > 0}
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
                  disabled={openBlockers.length > 0}
                  onClick={() =>
                    void post(`${base}/approve`, {
                      row_version: version.row_version,
                      unknowns_acknowledged: unknowns,
                      comment: t('strategy.review.autoComment.approved'),
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
                      comment: t('strategy.review.autoComment.changes'),
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
                      comment: t('strategy.review.autoComment.rejected'),
                    })
                  }
                >
                  {t('strategy.review.reject')}
                </Button>
              </>
            ) : null}
            {version.status === 'APPROVED' ? (
              <OmaLinkButton
                type="primary"
                data-testid="strategy-start-execution"
                href={`/app/brands/${brandId}/strategies/${strategyId}/execution`}
              >
                {readiness?.journey.current === 'execute' || !readiness
                  ? t('strategy.executionTab.start')
                  : t('strategy.executionTab.open')}
              </OmaLinkButton>
            ) : null}
            {['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'].includes(version.status) ? (
              <Button
                type={version.status === 'APPROVED' ? 'default' : 'primary'}
                data-testid="strategy-revise"
                onClick={() => void post(`${base}/revise`, {})}
              >
                {t('strategy.versions.revise')}
              </Button>
            ) : null}
          </div>
        </BrandPlxSection>
        {error ? (
          <p role="alert" style={{ color: 'var(--status-danger)' }}>
            {error}
          </p>
        ) : null}
        <BrandPlxSection
          title={t('strategy.review.commentsTitle')}
          testId="strategy-review-comment-form"
        >
          <form onSubmit={onComment} className="oma-strategy-comment-form">
            <label className="oma-sr-only" htmlFor="strategy-comment-input">
              {t('strategy.review.comment')}
            </label>
            <TextArea
              id="strategy-comment-input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('strategy.review.commentPlaceholder')}
              data-testid="strategy-comment"
              rows={3}
            />
            <Button type="default" htmlType="submit" disabled={!comment.trim()}>
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
      </div>
    </StrategyWorkspaceShell>
  );
}
