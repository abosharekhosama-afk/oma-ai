'use client';

import { OmaTopLoader } from '../../../../../../../components/ui/oma-top-loader';
import { Button } from '@oma/ui/controls';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../../../../lib/api';
import { apiMutate, getApiError, isPermissionDenied } from '../../../../../../../lib/brand-api';
import type { BrandDetail, InsightItem, ProfileDetail } from '../../../../../../../lib/brand-types';
import { BrandWorkspaceShell } from '../../../../../../../components/brand/brand-workspace-shell';
import { AiUnavailableBanner } from '../../../../../../../components/brand/ai-unavailable-banner';
import { ProfileSections } from '../../../../../../../components/brand/profile-sections';
import { ReviewCollaboration } from '../../../../../../../components/brand/review-collaboration';
import { InsightDecisionControls } from '../../../../../../../components/brand/insight-decision-controls';
import { ApprovalSummary } from '../../../../../../../components/brand/approval-summary';
import { EvidenceSidePanel } from '../../../../../../../components/brand/evidence-side-panel';
import { PermissionDenied } from '../../../../../../../components/shell/permission-denied';
import { useT } from '../../../../../../../lib/use-locale';

export default function ProfileEditorPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ brandId: string; versionId: string }>();
  const { brandId, versionId } = params;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({});

  const loadProfile = useCallback(async () => {
    const res = await api<{ data: ProfileDetail }>(
      `/api/v1/brands/${brandId}/profiles/${versionId}`,
    );
    setProfile(res.data);
    if (res.data.scan_attempt_id) {
      const scanRes = await api<{ data: { status: string } }>(
        `/api/v1/brands/${brandId}/scans/${res.data.scan_attempt_id}`,
      );
      setScanStatus(scanRes.data.status);
    }
    return res.data;
  }, [brandId, versionId]);

  useEffect(() => {
    Promise.all([api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`), loadProfile()])
      .then(([brandRes]) => setBrand(brandRes.data))
      .catch((err) => {
        if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      })
      .finally(() => setLoading(false));
  }, [brandId, loadProfile]);

  const editable = profile?.status === 'DRAFT' || profile?.status === 'NEEDS_REVIEW';

  const pendingInsights =
    profile?.insights.filter(
      (i) => i.info_state === 'AI_INFERRED' && i.review_status === 'PENDING',
    ) ?? [];

  const displayInsights: InsightItem[] =
    profile?.insights.map((i) => ({
      ...i,
      text_value: pendingEdits[i.id] ?? i.text_value,
    })) ?? [];

  async function saveEdits() {
    if (!profile) return;
    const patches = Object.entries(pendingEdits).map(([id, text_value]) => ({ id, text_value }));
    if (patches.length === 0) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await apiMutate<{ data: ProfileDetail }>(
        `/api/v1/brands/${brandId}/profiles/${versionId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ row_version: profile.row_version, insights: patches }),
        },
      );
      setProfile(res.data);
      setPendingEdits({});
    } catch (err) {
      setActionError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    if (!profile) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await apiMutate<{ data: ProfileDetail }>(
        `/api/v1/brands/${brandId}/profiles/${versionId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ row_version: profile.row_version }),
        },
      );
      setProfile(res.data);
    } catch (err) {
      setActionError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept(insightId: string) {
    if (!profile) return;
    const insight = profile.insights.find((i) => i.id === insightId);
    if (!insight) return;
    setBusy(true);
    try {
      await apiMutate(`/api/v1/brands/${brandId}/insights/${insightId}/accept`, {
        method: 'POST',
        body: JSON.stringify({ row_version: insight.row_version }),
      });
      await loadProfile();
    } catch (err) {
      setActionError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(insightId: string) {
    if (!profile) return;
    const insight = profile.insights.find((i) => i.id === insightId);
    if (!insight) return;
    setBusy(true);
    try {
      await apiMutate(`/api/v1/brands/${brandId}/insights/${insightId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ row_version: insight.row_version }),
      });
      await loadProfile();
    } catch (err) {
      setActionError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove(payload: {
    acknowledge_incomplete: boolean;
    confirm_summary: boolean;
    reason?: string;
  }) {
    if (!profile) return;
    await apiMutate(`/api/v1/brands/${brandId}/profiles/${versionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({
        row_version: profile.row_version,
        ...payload,
      }),
    });
    router.refresh();
    await loadProfile();
  }

  async function handleRejectVersion(reason?: string) {
    if (!profile) return;
    await apiMutate(`/api/v1/brands/${brandId}/profiles/${versionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ row_version: profile.row_version, reason }),
    });
    await loadProfile();
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (loading) return <OmaTopLoader label={t('common.loading')} />;
  if (error || !brand || !profile) {
    return (
      <div className="oma-card" role="alert">
        <p style={{ color: 'var(--status-danger)' }}>{error ?? t('common.notFound')}</p>
      </div>
    );
  }

  return (
    <BrandWorkspaceShell
      brandId={brandId}
      brandName={brand.name}
      aside={
        <ReviewCollaboration
          status={profile.status}
          blockingReasons={profile.eligibility.blocking_reasons}
          reviewHistory={profile.review_history ?? []}
          collaborationNote={
            typeof profile.sections?.collaboration_note === 'string'
              ? profile.sections.collaboration_note
              : ''
          }
          onSaveNote={
            editable
              ? async (note) => {
                  const res = await apiMutate<{ data: ProfileDetail }>(
                    `/api/v1/brands/${brandId}/profiles/${versionId}`,
                    {
                      method: 'PATCH',
                      body: JSON.stringify({
                        row_version: profile.row_version,
                        sections: { ...profile.sections, collaboration_note: note },
                      }),
                    },
                  );
                  setProfile(res.data);
                }
              : undefined
          }
        />
      }
    >
      <header className="oma-page-header">
        <div>
          <h2>{t('brand.profile.title')}</h2>
          <span className="oma-badge">{profile.status}</span>
        </div>
        <Link href={`/app/brands/${brandId}/profiles/${versionId}/compare`}>
          {t('brand.profile.compare')}
        </Link>
      </header>

      <AiUnavailableBanner aiAvailability={profile.ai_availability} />

      {profile.status === 'APPROVED' || profile.status === 'SUPERSEDED' ? (
        <div className="oma-banner oma-banner-info" role="status" data-testid="immutable-banner">
          <strong>{t('brand.profile.immutableTitle')}</strong>
          <p>{t('brand.profile.immutableBody')}</p>
        </div>
      ) : null}

      {scanStatus === 'PARTIAL' ? (
        <div className="oma-banner oma-banner-warning" role="alert">
          <strong>{t('brand.scan.partialTitle')}</strong>
          <p>{t('brand.scan.partialBody')}</p>
        </div>
      ) : null}

      {actionError ? (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {actionError}
        </p>
      ) : null}

      <ProfileSections
        sections={profile.sections}
        insights={displayInsights}
        editable={editable}
        onInsightChange={(id, text) => setPendingEdits((prev) => ({ ...prev, [id]: text }))}
        onViewEvidence={setEvidenceId}
      />

      {editable ? (
        <div className="oma-form-actions">
          {Object.keys(pendingEdits).length > 0 ? (
            <Button type="primary" disabled={busy} onClick={() => void saveEdits()}>
              {t('brand.profile.save')}
            </Button>
          ) : null}
          {profile.status === 'DRAFT' ? (
            <Button type="default" disabled={busy} onClick={() => void submitForReview()}>
              {t('brand.profile.submitReview')}
            </Button>
          ) : null}
        </div>
      ) : null}

      <section className="oma-card" aria-labelledby="insight-decisions-title">
        <h3 id="insight-decisions-title">{t('brand.insight.pendingTitle')}</h3>
        {pendingInsights.length === 0 ? (
          <p className="oma-muted" role="status">
            {t('brand.insight.pendingEmpty')}
          </p>
        ) : null}
        <ul className="oma-insight-list">
          {pendingInsights.map((insight) => (
            <li key={insight.id} className="oma-insight-item">
              <strong>{insight.field_key}</strong>
              <p>{insight.text_value}</p>
              <InsightDecisionControls
                insight={insight}
                profileRowVersion={profile.row_version}
                disabled={busy || !editable}
                onAccept={handleAccept}
                onReject={handleReject}
              />
            </li>
          ))}
        </ul>
      </section>

      <ApprovalSummary
        profile={profile}
        scanStatus={scanStatus}
        disabled={busy}
        onApprove={handleApprove}
        onReject={handleRejectVersion}
      />

      <EvidenceSidePanel
        brandId={brandId}
        evidenceId={evidenceId}
        onClose={() => setEvidenceId(null)}
      />
    </BrandWorkspaceShell>
  );
}
