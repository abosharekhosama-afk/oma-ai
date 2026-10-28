'use client';
import { DetailShimmer } from '../../../../../components/ui/shimmer';
import { Button, SelectField, TextArea } from '@oma/ui/controls';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Dialog } from '../../../../../components/ui/dialog';
import { StatusChip, statusLabel } from '../../../../../components/ui/status-chip';
import {
  PostPreview,
  type PreviewApprovalState,
} from '../../../../../components/content/post-preview';
import {
  MediaSurface,
  kindFromMime,
  kindFromUrl,
  mediaIdFromUrl,
  versionMime,
} from '../../../../../components/content/media-surface';
import { getContentDetail, type ApiContent } from '../../../../../lib/content-api';
import { listBrands } from '../../../../../lib/workspace-extras-api';
import { useToast } from '../../../../../components/ui/toast';
import { pickCopy } from '../../../../../lib/demo/use-demo-api';
import {
  getDeliverableDetail,
  reviewDeliverable,
  addDeliverableComment,
  toDeliverableRowFromDetail,
  addDeliverableVersion,
  addDeliverableAnnotation,
  resolveDeliverableAnnotation,
  updateDeliverable,
  opsError,
} from '../../../../../lib/ops-api';
import dynamic from 'next/dynamic';

const MediaPickerDialog = dynamic(
  () => import('../../../../../components/content/media-picker').then((m) => m.MediaPickerDialog),
  { ssr: false },
);
import type { MediaAsset } from '../../../../../lib/workdrive-api';
import {
  approvedVersion,
  canAddProductionVersion,
  canSubmitForReview,
  canTransitionReview,
  currentVersion,
  mapClientToNormalized,
  mapNormalizedToPercent,
  unresolvedCount,
  type DeliverableRow,
} from '../../../../../lib/demo/stage5-deliverables';
import { useCapabilities } from '../../../../../lib/use-capabilities';
import { EntityLink } from '../../../../../components/ui/entity-link';
import { useLocale, useT } from '../../../../../lib/use-locale';
import { formatCommentTime } from '../../../../../lib/calendar-today';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  CommentOutlined,
  EyeOutlined,
  HistoryOutlined,
  LinkOutlined,
  UploadOutlined,
} from '@ant-design/icons';

type Decision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';

/**
 * Version preview. Files uploaded to WorkDrive are served through `/api/v1/media/:id/view`;
 * images render inline, videos fall back to the streamed player, other files (PDF, documents)
 * show an "Open file" link.
 */
function DeliverableHero({
  src,
  openLabel,
  contentType,
  mime,
}: {
  src: string;
  openLabel: string;
  contentType?: string;
  mime?: string | null;
}) {
  // Stored WorkDrive URLs (`/api/v1/media/:id/view|stream`) have no extension: trust the MIME,
  // then the URL. Non-media files (PDF, documents) keep the "Open file" link.
  const knownKind = kindFromMime(mime) ?? kindFromUrl(src);
  const isKnownMedia = mime
    ? knownKind !== null
    : knownKind !== null || Boolean(contentType) || mediaIdFromUrl(src) !== null;
  if (isKnownMedia)
    return (
      <MediaSurface
        src={src}
        mime={mime}
        contentType={contentType}
        className="oma-deliv-detail__hero"
        controls
        preload="metadata"
        alt=""
      />
    );
  return (
    <div className="oma-deliv-detail__hero-empty">
      <a className="oma-text-link" href={src} target="_blank" rel="noreferrer">
        {openLabel}
      </a>
    </div>
  );
}

function reviewToPreviewState(status: string): PreviewApprovalState {
  if (status === 'APPROVED') return 'APPROVED';
  if (status === 'CHANGES_REQUESTED') return 'CHANGES_REQUESTED';
  if (status === 'REJECTED') return 'REJECTED';
  if (status === 'AWAITING_REVIEW' || status === 'IN_REVIEW') return 'PENDING';
  return 'NOT_REQUESTED';
}
type CommentFilter = 'all' | 'unresolved' | 'resolved';

export default function DeliverableDetailClient() {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const caps = useCapabilities();
  const canDecide =
    !caps.loading && caps.can(['deliverable.review.decide', 'deliverable.review'], 'any');
  const canVersion =
    !caps.loading &&
    caps.can(['deliverable.version.create', 'deliverable.write', 'deliverable.update'], 'any');
  const canAnnotate =
    !caps.loading &&
    caps.can(
      [
        'deliverable.annotate',
        'deliverable.write',
        'deliverable.update',
        'deliverable.review',
        'deliverable.review.decide',
      ],
      'any',
    );
  const router = useRouter();
  const params = useParams<{ deliverableId: string }>();
  const search = useSearchParams();
  const deliverableId = params.deliverableId;
  const reviewMode = search.get('review') === '1';
  const versionParam = search.get('version');
  const compareMode = search.get('compare') === '1';

  const [row, setRow] = useState<DeliverableRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | 'new-version' | 'attach'>(null);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [zoom, setZoom] = useState<'fit' | 'in'>('fit');
  const [commentFilter, setCommentFilter] = useState<CommentFilter>('all');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [draftPin, setDraftPin] = useState<{ x: number; y: number } | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [decisionOpen, setDecisionOpen] = useState<Decision | null>(null);
  const [linked, setLinked] = useState<{ content: ApiContent; brand: string } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [generalDraft, setGeneralDraft] = useState('');
  const tRef = useRef(t);
  tRef.current = t;
  const stageRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!deliverableId) return;
    setLoading(true);
    try {
      const payload = await getDeliverableDetail(deliverableId);
      const data = toDeliverableRowFromDetail(payload);
      const versions = Array.isArray(data.versions) ? data.versions : [];
      if (!versions.length) {
        // ensure at least one version slot so render never touches empty assets
        data.versions = [
          {
            id: data.id,
            label: 'v1',
            assets: [],
            notes: { en: '', ar: '' },
            createdAt: new Date().toISOString(),
            createdBy: data.reviewer || 'Team member',
            immutable: false,
            reviewDecision: null,
            status: 'DRAFT' as never,
          },
        ];
        data.currentVersionId = data.id;
      }
      setRow(data);
      const vs = data.versions;
      const initial =
        versionParam && vs.some((v) => v.id === versionParam)
          ? versionParam
          : data.currentVersionId || vs[0]?.id || data.id;
      setSelectedVersionId(initial);
      const v0 = vs[0]?.id ?? data.id;
      const v1 = vs[1]?.id ?? v0;
      setCompareA(vs.find((v) => v.id === data.approvedVersionId)?.id ?? v0);
      setCompareB(data.currentVersionId || v1);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      setError(opsError(err, tRef.current('demo.unavailable')));
    } finally {
      setLoading(false);
    }
    // `t` is a fresh closure every render; reading it through a ref keeps `load`
    // stable so the effect below does not refetch in a loop.
  }, [deliverableId, versionParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedVersion = useMemo(() => {
    if (!row || !selectedVersionId) return null;
    return row.versions.find((v) => v.id === selectedVersionId) ?? currentVersion(row);
  }, [row, selectedVersionId]);

  const linkedContentId = row?.contentId ?? null;
  useEffect(() => {
    if (!linkedContentId) {
      setLinked(null);
      return;
    }
    let live = true;
    void Promise.all([getContentDetail(linkedContentId), listBrands().catch(() => [])])
      .then(([detail, brands]) => {
        if (!live) return;
        const b = brands.find((x) => x.id === detail.data.brand_id);
        setLinked({ content: detail.data, brand: b?.name ?? '' });
      })
      .catch(() => live && setLinked(null));
    return () => {
      live = false;
    };
  }, [linkedContentId]);

  const approved = useMemo(() => (row ? approvedVersion(row) : null), [row]);

  const versionAnnotations = useMemo(() => {
    if (!row || !selectedVersion) return [];
    return (row.annotations ?? []).filter((a) => a.versionId === selectedVersion.id);
  }, [row, selectedVersion]);

  const filteredThreads = useMemo(() => {
    let list = versionAnnotations;
    if (commentFilter === 'unresolved') list = list.filter((a) => !a.resolved);
    if (commentFilter === 'resolved') list = list.filter((a) => a.resolved);
    return list;
  }, [versionAnnotations, commentFilter]);

  const generalComments = useMemo(() => {
    if (!row || !selectedVersion) return [];
    return (row.comments ?? []).filter((c) => c.versionId === selectedVersion.id);
  }, [row, selectedVersion]);

  function setReviewUrl(next: { review?: boolean; version?: string; compare?: boolean }) {
    const params = new URLSearchParams(search.toString());
    if (next.review === false) params.delete('review');
    if (next.review === true) params.set('review', '1');
    if (next.version) params.set('version', next.version);
    if (next.compare === true) params.set('compare', '1');
    if (next.compare === false) params.delete('compare');
    const qs = params.toString();
    router.replace(`/app/deliverables/${deliverableId}${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  function onCanvasClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (
      !canAnnotate ||
      !row ||
      !selectedVersion ||
      selectedVersion.immutable ||
      selectedVersion.status === 'APPROVED' ||
      row.reviewStatus === 'APPROVED'
    ) {
      toast.push(t('demo.review.immutableHint'), 'danger');
      return;
    }
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraftPin(mapClientToNormalized(event.clientX, event.clientY, rect));
    setDraftBody('');
    setSelectedPinId(null);
  }

  async function selectVersion(versionId: string) {
    setSelectedVersionId(versionId);
    setDraftPin(null);
    setSelectedPinId(null);
    setReviewUrl({ review: reviewMode, version: versionId, compare: compareMode });
  }

  async function saveAnnotation() {
    if (!row || !selectedVersion || !draftPin || !draftBody.trim()) return;
    setSaving(true);
    try {
      await addDeliverableAnnotation(row.id, {
        body: draftBody.trim(),
        x: draftPin.x,
        y: draftPin.y,
        versionId: selectedVersion.id,
      });
      const payload = await getDeliverableDetail(row.id);
      setRow(toDeliverableRowFromDetail(payload));
      setDraftPin(null);
      setDraftBody('');
      toast.push(t('demo.review.annotationSaved'), 'success');
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function toggleResolve(annotationId: string, resolved: boolean) {
    if (!row) return;
    setSaving(true);
    try {
      await resolveDeliverableAnnotation(annotationId, resolved);
      const payload = await getDeliverableDetail(row.id);
      setRow(toDeliverableRowFromDetail(payload));
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  /**
   * Upload flow: the picker uploads the file to the brand's WorkDrive "deliverables" folder
   * (directly from the browser), then the file is attached here:
   * - "attach": the current draft version has no file yet, so it gets this file;
   * - "new-version": a new version (v2, v3…) is created with this file and becomes current.
   */
  async function attachUploaded(asset: MediaAsset, mode: 'new-version' | 'attach') {
    if (!row) return;
    setSaving(true);
    try {
      if (mode === 'attach') await updateDeliverable(row.id, { asset_id: asset.id });
      else await addDeliverableVersion(row.id, { asset_id: asset.id });
      const payload = await getDeliverableDetail(row.id);
      const data = toDeliverableRowFromDetail(payload);
      setRow(data);
      const latest = data.versions[data.versions.length - 1];
      if (latest)
        setSelectedVersionId(mode === 'attach' ? data.currentVersionId || latest.id : latest.id);
      toast.push(
        mode === 'attach' ? t('deliverables.upload.attached') : t('demo.review.revisionAdded'),
        'success',
      );
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function addGeneralComment() {
    const body = generalDraft.trim();
    if (!row || !body) return;
    setSaving(true);
    try {
      await addDeliverableComment(row.id, {
        body: { en: body, ar: body },
        versionId: selectedVersion?.id ?? null,
      });
      const payload = await getDeliverableDetail(row.id);
      setRow(toDeliverableRowFromDetail(payload));
      setGeneralDraft('');
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    if (!row) return;
    setSaving(true);
    try {
      await reviewDeliverable(row.id, 'submit');
      const payload = await getDeliverableDetail(row.id);
      setRow(toDeliverableRowFromDetail(payload));
      toast.push(t('demo.review.submitted'), 'success');
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDecision() {
    if (!row || !selectedVersion || !decisionOpen) return;
    if (
      (decisionOpen === 'CHANGES_REQUESTED' || decisionOpen === 'REJECTED') &&
      !decisionReason.trim()
    ) {
      toast.push(t('demo.review.reasonRequired'), 'danger');
      return;
    }
    if (!canTransitionReview(row.reviewStatus, decisionOpen)) {
      toast.push(t('demo.review.invalidTransition'), 'danger');
      return;
    }
    setSaving(true);
    try {
      const action =
        decisionOpen === 'APPROVED'
          ? 'approve'
          : decisionOpen === 'REJECTED'
            ? 'reject'
            : decisionOpen === 'CHANGES_REQUESTED'
              ? 'request_changes'
              : 'submit';
      await reviewDeliverable(
        row.id,
        action as 'submit' | 'approve' | 'request_changes' | 'reject',
      );
      // Persist the reviewer's reason on the record (the review endpoint takes no body text).
      const reason = decisionReason.trim();
      if (reason) {
        try {
          await addDeliverableComment(row.id, {
            body: { en: reason, ar: reason },
            versionId: selectedVersion?.id ?? null,
          });
        } catch {
          // Decision already saved; a failed reason comment must not roll it back.
        }
      }
      // Reload the full detail so versions, approved pin, comments stay in sync.
      const payload = await getDeliverableDetail(row.id);
      setRow(toDeliverableRowFromDetail(payload));
      setDecisionOpen(null);
      setDecisionReason('');
      toast.push(t('demo.review.decisionSaved'), 'success');
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && draftPin) {
        setDraftPin(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draftPin]);

  const openUnresolved = row ? unresolvedCount(row) : 0;
  const reviewLabel = reviewMode
    ? t('demo.reviews.closeReview') ||
      (locale.toLowerCase().startsWith('ar') ? 'إغلاق المراجعة' : 'Close review')
    : t('demo.reviews.openReview');

  return (
    <div
      className="oma-deliv-detail"
      data-testid="demo-deliverable-detail"
      data-review={reviewMode ? 'true' : 'false'}
    >
      <header className="oma-deliv-detail__top">
        <div className="oma-deliv-detail__top-start">
          <Link href="/app/deliverables" className="oma-deliv-detail__back">
            <ArrowLeftOutlined className="oma-dir-icon" />
            <span>{t('demo.deliverables.back')}</span>
          </Link>
          {row ? (
            <div className="oma-deliv-detail__title-wrap">
              <h1 className="oma-deliv-detail__title">{pickCopy(row.title, locale)}</h1>
              <div className="oma-deliv-detail__chips">
                <span className="oma-deliv-detail__type">{statusLabel(t, row.type)}</span>
                <StatusChip status={row.reviewStatus} />
                {row.reviewStatus === 'APPROVED' || selectedVersion?.immutable ? (
                  <span
                    className="oma-deliv-detail__badge"
                    data-testid="deliverable-immutable-badge"
                  >
                    {t('demo.review.immutable')}
                  </span>
                ) : null}
                <span className="oma-muted" data-testid="demo-active-version-label">
                  {selectedVersion?.label ?? '—'}
                </span>
                <span className="oma-deliv-detail__unresolved">
                  {unresolvedCount(row)} {locale.toLowerCase().startsWith('ar') ? 'مفتوح' : 'open'}
                </span>
              </div>
            </div>
          ) : (
            <h1 className="oma-deliv-detail__title">{t('demo.deliverables.title')}</h1>
          )}
        </div>
        {row ? (
          <div className="oma-deliv-detail__top-actions">
            <Button
              type={reviewMode ? 'primary' : 'default'}
              data-testid="demo-open-review"
              className="oma-deliv-detail__act oma-deliv-detail__act--icon"
              aria-label={reviewLabel}
              data-tooltip={reviewLabel}
              onClick={() =>
                setReviewUrl({
                  review: !reviewMode,
                  version: selectedVersionId ?? undefined,
                })
              }
            >
              {reviewMode ? <CloseOutlined /> : <EyeOutlined />}{' '}
              <span className="oma-deliv-detail__act-label">{reviewLabel}</span>
            </Button>
            {canVersion && canSubmitForReview(row.reviewStatus) ? (
              <Button
                type="primary"
                data-testid="demo-submit-review"
                className="oma-deliv-detail__act oma-deliv-detail__act--primary"
                disabled={saving}
                onClick={() => void submitForReview()}
              >
                {t('demo.review.submit')}
              </Button>
            ) : null}
            {canVersion && canAddProductionVersion(row.reviewStatus) ? (
              <Button
                type="default"
                data-testid="demo-add-revision"
                className="oma-deliv-detail__act oma-deliv-detail__act--icon"
                aria-label={t('deliverables.upload.newVersion')}
                data-tooltip={t('deliverables.upload.newVersion')}
                disabled={saving}
                onClick={() => setPicker('new-version')}
              >
                <UploadOutlined />{' '}
                <span className="oma-deliv-detail__act-label">
                  {t('deliverables.upload.newVersion')}
                </span>
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      {picker !== null ? (
        <MediaPickerDialog
          open
          brandId={row?.brandId ?? null}
          kind="deliverables"
          t={t}
          locale={locale}
          canConnect={!caps.loading && caps.can(['tenant.manage'], 'any')}
          onClose={() => setPicker(null)}
          onPick={(asset) => {
            const mode = picker ?? 'new-version';
            setPicker(null);
            void attachUploaded(asset, mode);
          }}
        />
      ) : null}

      {loading ? <DetailShimmer /> : null}
      {unavailable ? (
        <p className="oma-muted oma-deliv-detail__pad">{t('demo.unavailable')}</p>
      ) : null}
      {error ? (
        <div className="oma-card oma-deliv-detail__pad" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {row ? (
        reviewMode ? (
          <div
            className="oma-review-workspace"
            data-testid="demo-review-workspace"
            aria-label={t('demo.reviews.openReview')}
          >
            <div className="oma-review-toolbar">
              <div className="oma-chip-row">
                <strong data-testid="demo-review-version-chrome">{selectedVersion?.label}</strong>
                <span className="oma-muted">{statusLabel(t, row.type)}</span>
                {selectedVersion?.immutable ? (
                  <span className="oma-deliv-detail__badge">{t('demo.review.immutable')}</span>
                ) : null}
              </div>
              <div className="oma-chip-row">
                <Button
                  type={zoom === 'fit' ? 'primary' : 'default'}
                  data-testid="demo-zoom-fit"
                  onClick={() => setZoom('fit')}
                >
                  Fit
                </Button>
                <Button
                  type={zoom === 'in' ? 'primary' : 'default'}
                  data-testid="demo-zoom-in"
                  onClick={() => setZoom('in')}
                >
                  100%
                </Button>
                <Button
                  type={compareMode ? 'primary' : 'default'}
                  data-testid="demo-compare-toggle"
                  onClick={() =>
                    setReviewUrl({
                      review: true,
                      version: selectedVersionId ?? undefined,
                      compare: !compareMode,
                    })
                  }
                >
                  Compare
                </Button>
                <Button
                  type="default"
                  data-testid="demo-exit-review"
                  onClick={() => setReviewUrl({ review: false })}
                >
                  <CloseOutlined /> Exit
                </Button>
              </div>
            </div>

            <div className="oma-review-body">
              <aside className="oma-review-versions" data-testid="demo-version-list">
                <h3>
                  <HistoryOutlined /> {t('demo.deliverable.versions') || 'Versions'}
                </h3>
                {row.versions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className="oma-review-version-item"
                    aria-current={
                      selectedVersionId === v.id || selectedVersion?.id === v.id
                        ? 'true'
                        : undefined
                    }
                    data-testid={`demo-version-${v.id}`}
                    onClick={() => void selectVersion(v.id)}
                  >
                    <strong>{v.label}</strong>
                    <span className="oma-muted">
                      {statusLabel(t, v.status)} · {v.createdBy}
                    </span>
                  </button>
                ))}
              </aside>

              <div className="oma-review-canvas-wrap">
                {compareMode ? (
                  <div className="oma-review-compare" data-testid="demo-version-compare">
                    <div className="oma-chip-row" style={{ gridColumn: '1 / -1' }}>
                      <label>
                        A
                        <SelectField
                          value={compareA}
                          data-testid="demo-compare-a"
                          onChange={(e) => setCompareA(e.target.value)}
                        >
                          {row.versions.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label}
                            </option>
                          ))}
                        </SelectField>
                      </label>
                      <label>
                        B
                        <SelectField
                          value={compareB}
                          data-testid="demo-compare-b"
                          onChange={(e) => setCompareB(e.target.value)}
                        >
                          {row.versions.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label}
                            </option>
                          ))}
                        </SelectField>
                      </label>
                    </div>
                    {[compareA, compareB].map((id, idx) => {
                      const v = row.versions.find((x) => x.id === id);
                      return (
                        <figure key={`${id}-${idx}`}>
                          {v?.assets?.[0] ? (
                            <MediaSurface
                              src={v.assets[0]}
                              mime={versionMime(v)}
                              contentType={linked?.content.content_type}
                              alt=""
                              preload="metadata"
                              controls
                            />
                          ) : null}
                          <figcaption>
                            {v?.label} · {statusLabel(t, v?.status)} · {v?.createdBy}
                          </figcaption>
                        </figure>
                      );
                    })}
                    <p className="oma-honesty-inline" style={{ gridColumn: '1 / -1' }}>
                      {t('demo.review.noPixelDiff')}
                    </p>
                  </div>
                ) : selectedVersion?.assets && selectedVersion.assets[0] ? (
                  <div
                    ref={stageRef}
                    className="oma-review-canvas-stage"
                    data-zoom={zoom}
                    data-testid="demo-media-canvas"
                    onClick={onCanvasClick}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      if (
                        !canAnnotate ||
                        !selectedVersion ||
                        selectedVersion.immutable ||
                        selectedVersion.status === 'APPROVED' ||
                        row.reviewStatus === 'APPROVED'
                      ) {
                        toast.push(t('demo.review.immutableHint'), 'danger');
                        return;
                      }
                      setDraftPin({ x: 0.5, y: 0.5 });
                      setDraftBody('');
                    }}
                    role="img"
                    tabIndex={0}
                    aria-label={t('demo.review.canvasLabel')}
                  >
                    <span className="oma-review-version-label">
                      {selectedVersion.label}
                      {selectedVersion.immutable ? ` · ${t('demo.review.immutable')}` : ''}
                    </span>
                    <MediaSurface
                      src={selectedVersion.assets[0]}
                      mime={versionMime(selectedVersion)}
                      contentType={linked?.content.content_type}
                      className="oma-review-media"
                      controls
                      preload="metadata"
                      alt=""
                    />
                    {versionAnnotations.map((a) => {
                      const pos = mapNormalizedToPercent(a.x, a.y);
                      return (
                        <Button
                          key={a.id}
                          type="default"
                          style={pos}
                          data-resolved={a.resolved ? 'true' : 'false'}
                          data-selected={selectedPinId === a.id ? 'true' : 'false'}
                          data-testid={`demo-pin-${a.id}`}
                          aria-label={`Annotation ${a.number}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPinId(a.id);
                          }}
                          className="oma-review-pin"
                        >
                          {a.number}
                        </Button>
                      );
                    })}
                    {draftPin ? (
                      <span
                        className="oma-review-pin oma-review-pin-draft"
                        style={mapNormalizedToPercent(draftPin.x, draftPin.y)}
                      >
                        +
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="oma-deliv-empty-file" data-testid="deliverable-no-file-review">
                    <p className="oma-muted">{t('review.noAssets')}</p>
                    {canVersion &&
                    row.reviewStatus !== 'APPROVED' &&
                    !selectedVersion?.immutable ? (
                      <Button
                        type="primary"
                        data-testid="deliverable-upload-file-review"
                        disabled={saving}
                        onClick={() => setPicker('attach')}
                      >
                        <UploadOutlined /> {t('deliverables.upload.file')}
                      </Button>
                    ) : null}
                  </div>
                )}

                {draftPin ? (
                  <div className="oma-review-draft-box" data-testid="demo-annotation-draft">
                    <TextArea
                      rows={2}
                      value={draftBody}
                      data-testid="demo-annotation-body"
                      onChange={(e) => setDraftBody(e.target.value)}
                      placeholder={t('demo.review.commentPlaceholder') || 'Add a comment…'}
                    />
                    <div className="oma-chip-row">
                      <Button type="default" onClick={() => setDraftPin(null)}>
                        {t('demo.create.cancel')}
                      </Button>
                      <Button
                        type="primary"
                        data-testid="demo-annotation-save"
                        disabled={saving || !draftBody.trim()}
                        onClick={() => void saveAnnotation()}
                      >
                        {t('demo.brief.save') || 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="oma-review-comments" data-testid="demo-review-comments">
                <h3>
                  <CommentOutlined /> {t('demo.review.comments') || 'Comments'}
                </h3>
                <div className="oma-review-seg" role="tablist" aria-label="Comments filter">
                  {(['all', 'unresolved', 'resolved'] as CommentFilter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      role="tab"
                      aria-selected={commentFilter === f}
                      className="oma-review-seg__btn"
                      data-active={commentFilter === f ? 'true' : 'false'}
                      data-testid={`demo-comment-filter-${f}`}
                      onClick={() => setCommentFilter(f)}
                    >
                      {f === 'all'
                        ? locale.toLowerCase().startsWith('ar')
                          ? 'الكل'
                          : 'All'
                        : f === 'unresolved'
                          ? locale.toLowerCase().startsWith('ar')
                            ? 'مفتوح'
                            : 'Open'
                          : locale.toLowerCase().startsWith('ar')
                            ? 'محلول'
                            : 'Resolved'}
                    </button>
                  ))}
                </div>
                <ul className="oma-review-thread-list">
                  {filteredThreads.map((a) => (
                    <li
                      key={a.id}
                      className="oma-review-thread"
                      data-selected={selectedPinId === a.id ? 'true' : 'false'}
                      data-testid={`demo-thread-${a.id}`}
                      onClick={() => setSelectedPinId(a.id)}
                    >
                      <div className="oma-review-thread__head">
                        <strong>#{a.number}</strong>
                        <span className="oma-muted">{a.author}</span>
                        <time dateTime={a.at}>{a.at}</time>
                      </div>
                      <p>{pickCopy(a.body, locale)}</p>
                      <Button
                        type="default"
                        data-testid={`demo-resolve-${a.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleResolve(a.id, !a.resolved);
                        }}
                      >
                        {a.resolved
                          ? t('demo.review.unresolve') || 'Unresolve'
                          : t('demo.review.resolve') || 'Resolve'}
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="oma-review-general" data-testid="demo-review-general">
                  <h4>{t('demo.review.general')}</h4>
                  {generalComments.length === 0 ? (
                    <p className="oma-muted">{t('demo.review.noComments')}</p>
                  ) : null}
                  {generalComments.map((c) => (
                    <div
                      key={c.id}
                      className="oma-review-thread"
                      data-testid={`demo-comment-${c.id}`}
                    >
                      <div className="oma-review-thread__head">
                        <strong>{c.author}</strong>
                        <time dateTime={c.at}>{formatCommentTime(c.at, locale)}</time>
                      </div>
                      <p>{pickCopy(c.body, locale)}</p>
                    </div>
                  ))}
                  {canAnnotate ? (
                    <div className="oma-review-general__composer">
                      <TextArea
                        rows={2}
                        value={generalDraft}
                        data-testid="demo-review-general-body"
                        aria-label={t('demo.review.commentPlaceholder')}
                        placeholder={t('demo.review.commentPlaceholder')}
                        onChange={(e) => setGeneralDraft(e.target.value)}
                      />
                      <Button
                        type="primary"
                        size="small"
                        data-testid="demo-review-general-save"
                        disabled={saving || !generalDraft.trim()}
                        onClick={() => void addGeneralComment()}
                      >
                        {t('demo.review.addComment')}
                      </Button>
                    </div>
                  ) : null}
                </div>

                {canDecide ? (
                  <div className="oma-review-decision" data-testid="demo-review-decision">
                    <h4>{t('demo.review.decision') || 'Decision'}</h4>
                    <div className="oma-chip-row">
                      {(['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'] as Decision[]).map((d) => (
                        <Button
                          key={d}
                          type="default"
                          data-testid={`demo-decision-${d}`}
                          disabled={
                            saving ||
                            !selectedVersion ||
                            row.reviewStatus === d ||
                            !canTransitionReview(row.reviewStatus, d)
                          }
                          onClick={() => setDecisionOpen(d)}
                        >
                          {d === 'APPROVED' ? <CheckOutlined /> : null}{' '}
                          {d === 'APPROVED'
                            ? t('demo.deliverable.approve')
                            : d === 'CHANGES_REQUESTED'
                              ? t('demo.deliverable.requestChanges')
                              : t('demo.deliverable.reject')}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        ) : (
          <div className="oma-deliv-detail__workspace">
            <div className="oma-deliv-detail__main">
              <section className="oma-deliv-detail__card oma-deliv-detail__preview">
                {selectedVersion?.assets && selectedVersion.assets[0] ? (
                  <DeliverableHero
                    key={selectedVersion.assets[0]}
                    src={selectedVersion.assets[0]}
                    mime={versionMime(selectedVersion)}
                    openLabel={t('deliverables.upload.openFile')}
                    contentType={linked?.content.content_type}
                  />
                ) : (
                  <div className="oma-deliv-detail__hero-empty" data-testid="deliverable-no-file">
                    <span>{t('review.noAssets')}</span>
                    {canVersion &&
                    row.reviewStatus !== 'APPROVED' &&
                    !selectedVersion?.immutable ? (
                      <Button
                        type="primary"
                        data-testid="deliverable-upload-file"
                        disabled={saving}
                        onClick={() => setPicker('attach')}
                      >
                        <UploadOutlined /> {t('deliverables.upload.file')}
                      </Button>
                    ) : null}
                  </div>
                )}
                <div className="oma-deliv-detail__preview-meta">
                  <strong data-testid="demo-active-version-label-main">
                    {selectedVersion?.label ?? '—'}
                  </strong>
                  <span className="oma-muted">
                    {statusLabel(t, selectedVersion?.status)} · {selectedVersion?.createdBy}
                  </span>
                </div>
              </section>

              {linked ? (
                <section
                  className="oma-deliv-detail__card oma-plan-post__preview-pane"
                  data-testid="deliverable-post-preview"
                >
                  <PostPreview
                    channel={linked.content.channel}
                    contentType={linked.content.content_type}
                    brandName={linked.brand || pickCopy(row.title, locale)}
                    caption={linked.content.caption ? pickCopy(linked.content.caption, locale) : ''}
                    title={pickCopy(linked.content.title, locale)}
                    media={selectedVersion?.assets?.[0] || linked.content.preview_asset_url}
                    when={linked.content.scheduled_at || linked.content.planned_at}
                    whenKind={
                      linked.content.scheduled_at
                        ? 'scheduled'
                        : linked.content.planned_at
                          ? 'planned'
                          : null
                    }
                    locale={locale}
                    size="detail"
                    review={{
                      state: reviewToPreviewState(row.reviewStatus),
                      canApprove: canDecide && canTransitionReview(row.reviewStatus, 'APPROVED'),
                      canRequestChanges:
                        canDecide && canTransitionReview(row.reviewStatus, 'CHANGES_REQUESTED'),
                      canRequestApproval: false,
                      commentCount: (row.comments ?? []).length,
                      busy: saving,
                      onApprove: () => setDecisionOpen('APPROVED'),
                      onRequestChanges: () => setDecisionOpen('CHANGES_REQUESTED'),
                      onRequestApproval: () => undefined,
                      onComment: () =>
                        document
                          .querySelector(
                            '[data-testid="demo-review-comments"], .oma-deliv-detail__comments',
                          )
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                    }}
                  />
                </section>
              ) : null}

              {row.changeRequests?.length ? (
                <section className="oma-deliv-detail__card">
                  <header className="oma-deliv-detail__card-head">
                    <strong>{t('demo.deliverable.changeRequests')}</strong>
                  </header>
                  <ul className="oma-deliv-detail__list">
                    {row.changeRequests.map((cr) => (
                      <li key={cr.id}>
                        <strong>{cr.author}</strong>
                        <span>{pickCopy(cr.body, locale)}</span>
                        <time className="oma-muted" dateTime={cr.at}>
                          {cr.at}
                        </time>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="oma-deliv-detail__card">
                <header className="oma-deliv-detail__card-head">
                  <strong>
                    <HistoryOutlined /> {t('demo.deliverable.versions') || 'Versions'}
                  </strong>
                </header>
                <div className="oma-deliv-detail__versions">
                  {row.versions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="oma-deliv-detail__version"
                      data-active={selectedVersion?.id === v.id ? 'true' : 'false'}
                      data-testid={`demo-version-${v.id}`}
                      onClick={() => void selectVersion(v.id)}
                    >
                      {v.assets && v.assets[0] ? (
                        <MediaSurface
                          src={v.assets[0]}
                          mime={versionMime(v)}
                          contentType={linked?.content.content_type}
                          alt=""
                        />
                      ) : (
                        <div className="oma-deliv-detail__version-ph" />
                      )}
                      <span>
                        <strong>{v.label}</strong>
                        <span className="oma-muted">{statusLabel(t, v.status)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <aside className="oma-deliv-detail__side">
              <div className="oma-deliv-detail__side-card">
                <h3>{t('demo.deliverable.meta') || 'Details'}</h3>
                <div className="oma-deliv-detail__side-row">
                  <span className="oma-deliv-detail__side-label">
                    {t('demo.deliverables.filter.owner') || 'Owner'}
                  </span>
                  <strong>{row.owner}</strong>
                </div>
                <div className="oma-deliv-detail__side-row">
                  <span className="oma-deliv-detail__side-label">
                    {t('demo.deliverables.filter.reviewer')}
                  </span>
                  <strong>{row.reviewer}</strong>
                </div>
                <div className="oma-deliv-detail__side-row">
                  <span className="oma-deliv-detail__side-label">
                    {t('demo.deliverables.col.due') || 'Due'}
                  </span>
                  <strong className="oma-ltr">{row.dueAt}</strong>
                </div>
                <div className="oma-deliv-detail__side-row">
                  <span className="oma-deliv-detail__side-label">
                    {t('demo.tasks.filter.status')}
                  </span>
                  <StatusChip status={row.reviewStatus} />
                </div>
                {approved ? (
                  <p className="oma-muted" data-testid="demo-approved-version">
                    {t('demo.review.approvedVersion')}: {approved.label} (
                    {t('demo.review.immutable')})
                  </p>
                ) : null}
              </div>

              <div className="oma-deliv-detail__side-card">
                <h3>
                  <LinkOutlined /> {t('entity.related')}
                </h3>
                <nav className="oma-deliv-detail__links" aria-label={t('entity.related')}>
                  {row.campaignId ? (
                    <EntityLink
                      type="campaign"
                      id={row.campaignId}
                      href={`/app/campaigns/${row.campaignId}`}
                      className="oma-deliv-detail__link"
                      testId="demo-deliv-campaign-link"
                    />
                  ) : null}
                  {row.contentId ? (
                    <EntityLink
                      type="content"
                      id={row.contentId}
                      href={`/app/content?item=${row.contentId}`}
                      className="oma-deliv-detail__link"
                      testId="demo-deliv-content-link"
                    />
                  ) : null}
                  {row.requestId ? (
                    <EntityLink
                      type="request"
                      id={row.requestId}
                      href={`/app/requests/${row.requestId}`}
                      className="oma-deliv-detail__link"
                      testId="demo-deliv-request-link"
                    />
                  ) : null}
                  {row.taskId ? (
                    <EntityLink
                      type="task"
                      id={row.taskId}
                      href={`/app/tasks?task=${row.taskId}`}
                      className="oma-deliv-detail__link"
                      testId="demo-deliv-task-link"
                    />
                  ) : null}
                </nav>
              </div>
            </aside>
          </div>
        )
      ) : null}

      <Dialog
        open={Boolean(decisionOpen)}
        onClose={() => !saving && setDecisionOpen(null)}
        title={
          decisionOpen === 'APPROVED'
            ? t('demo.deliverable.approve')
            : decisionOpen === 'CHANGES_REQUESTED'
              ? t('demo.deliverable.requestChanges')
              : t('demo.deliverable.reject')
        }
      >
        <div className="oma-stack" data-testid="demo-decision-dialog">
          <p>
            {t('demo.review.targetVersion')}: {selectedVersion?.label}
          </p>
          {decisionOpen === 'APPROVED' && openUnresolved > 0 ? (
            <p className="oma-callout" data-testid="demo-unresolved-warning">
              {t('demo.review.unresolvedWarning')}: {openUnresolved}
            </p>
          ) : null}
          {decisionOpen !== 'APPROVED' ? (
            <label>
              {t('demo.review.reason')}
              <TextArea
                rows={3}
                value={decisionReason}
                data-testid="demo-decision-reason"
                onChange={(e) => setDecisionReason(e.target.value)}
              />
            </label>
          ) : (
            <label>
              {t('demo.review.optionalNote')}
              <TextArea
                rows={2}
                value={decisionReason}
                data-testid="demo-decision-reason"
                onChange={(e) => setDecisionReason(e.target.value)}
              />
            </label>
          )}
          <div className="oma-chip-row">
            <Button type="default" onClick={() => setDecisionOpen(null)}>
              {t('demo.create.cancel')}
            </Button>
            <Button
              type="primary"
              data-testid="demo-decision-confirm"
              disabled={saving}
              onClick={() => void confirmDecision()}
            >
              {t('demo.review.confirm')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
