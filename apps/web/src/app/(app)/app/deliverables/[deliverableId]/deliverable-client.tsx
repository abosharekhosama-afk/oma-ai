'use client';
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
import { DemoDisclosure } from '../../../../../components/demo/demo-disclosure';
import { Dialog } from '../../../../../components/ui/dialog';
import { PageHeader, Panel } from '../../../../../components/ui/page-header';
import { StatusChip } from '../../../../../components/ui/status-chip';
import { useToast } from '../../../../../components/ui/toast';
import { pickCopy } from '../../../../../lib/demo/use-demo-api';
import {
  getDeliverableDetail,
  updateDeliverable,
  reviewDeliverable,
  toDeliverableRow,
  toDeliverableRowFromDetail,
  addDeliverableVersion,
  addDeliverableAnnotation,
  resolveDeliverableAnnotation,
  addDeliverableComment,
  opsError,
} from '../../../../../lib/ops-api';
import {
  approvedVersion,
  canTransitionReview,
  currentVersion,
  mapClientToNormalized,
  mapNormalizedToPercent,
  unresolvedCount,
  type DeliverableRow,
} from '../../../../../lib/demo/stage5-deliverables';
import { useLocale, useT } from '../../../../../lib/use-locale';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  CommentOutlined,
  EyeOutlined,
  HistoryOutlined,
  LinkOutlined,
  PlusOutlined,
} from '@ant-design/icons';

type Decision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';
type CommentFilter = 'all' | 'unresolved' | 'resolved';

export default function DeliverableDetailClient() {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
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
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [zoom, setZoom] = useState<'fit' | 'in'>('fit');
  const [commentFilter, setCommentFilter] = useState<CommentFilter>('all');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [draftPin, setDraftPin] = useState<{ x: number; y: number } | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [generalBody, setGeneralBody] = useState('');
  const [decisionOpen, setDecisionOpen] = useState<Decision | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!deliverableId) return;
    setLoading(true);
    try {
      const payload = await getDeliverableDetail(deliverableId);
      const data = toDeliverableRowFromDetail(payload);
      setRow(data);
      const initial =
        versionParam && data.versions.some((v) => v.id === versionParam)
          ? versionParam
          : data.currentVersionId;
      setSelectedVersionId(initial);
      const v0 = data.versions[0]?.id ?? '';
      const v1 = data.versions[1]?.id ?? v0;
      setCompareA(data.versions.find((v) => v.id === data.approvedVersionId)?.id ?? v0);
      setCompareB(data.currentVersionId || v1);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (false) setUnavailable(true);
      else setError(opsError(err, t('demo.unavailable')));
    } finally {
      setLoading(false);
    }
  }, [deliverableId, versionParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedVersion = useMemo(() => {
    if (!row || !selectedVersionId) return null;
    return row.versions.find((v) => v.id === selectedVersionId) ?? currentVersion(row);
  }, [row, selectedVersionId]);

  const approved = useMemo(() => (row ? approvedVersion(row) : null), [row]);

  const versionAnnotations = useMemo(() => {
    if (!row || !selectedVersion) return [];
    return row.annotations.filter((a) => a.versionId === selectedVersion.id);
  }, [row, selectedVersion]);

  const filteredThreads = useMemo(() => {
    let list = versionAnnotations;
    if (commentFilter === 'unresolved') list = list.filter((a) => !a.resolved);
    if (commentFilter === 'resolved') list = list.filter((a) => a.resolved);
    return list;
  }, [versionAnnotations, commentFilter]);

  const generalComments = useMemo(() => {
    if (!row || !selectedVersion) return [];
    return row.comments.filter((c) => c.versionId === selectedVersion.id);
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

  async function addGeneral() {
    if (!row || !selectedVersion || !generalBody.trim()) return;
    setSaving(true);
    try {
      await addDeliverableComment(row.id, {
        body: generalBody.trim(),
        versionId: selectedVersion.id,
      });
      const payload = await getDeliverableDetail(row.id);
      setRow(toDeliverableRowFromDetail(payload));
      setGeneralBody('');
      toast.push(t('demo.review.commentSaved'), 'success');
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

  async function addRevision() {
    if (!row) return;
    setSaving(true);
    try {
      await addDeliverableVersion(row.id, { label: undefined });
      const payload = await getDeliverableDetail(row.id);
      const data = toDeliverableRowFromDetail(payload);
      setRow(data);
      const latest = data.versions[data.versions.length - 1];
      if (latest) setSelectedVersionId(latest.id);
      toast.push(t('demo.review.revisionAdded') || 'Revision added', 'success');
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    if (!row || !selectedVersion) return;
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
      const api = await reviewDeliverable(row.id, action as 'submit' | 'approve' | 'request_changes' | 'reject');
      const updated = {
        ...toDeliverableRow(api),
        decisions: [
          ...(row.decisions || []),
          {
            id: `dec-${Date.now()}`,
            decision: decisionOpen,
            actor: 'You',
            at: new Date().toISOString(),
            reason: decisionReason.trim()
              ? { en: decisionReason.trim(), ar: decisionReason.trim() }
              : undefined,
            versionId: selectedVersion?.id,
          },
        ],
      } as DeliverableRow;
      setRow(updated);
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

  return (
    <div className="oma-deliv-detail" data-testid="demo-deliverable-detail" data-review={reviewMode ? 'true' : 'false'}>
      <header className="oma-deliv-detail__top">
        <div className="oma-deliv-detail__top-start">
          <Link href="/app/deliverables" className="oma-deliv-detail__back">
            <ArrowLeftOutlined />
            <span>{t('demo.deliverables.back')}</span>
          </Link>
          {row ? (
            <div className="oma-deliv-detail__title-wrap">
              <h1 className="oma-deliv-detail__title">{pickCopy(row.title, locale)}</h1>
              <div className="oma-deliv-detail__chips">
                <span className="oma-deliv-detail__type">{row.type}</span>
                <StatusChip status={row.reviewStatus} />
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
              onClick={() =>
                setReviewUrl({
                  review: !reviewMode,
                  version: selectedVersionId ?? undefined,
                })
              }
            >
              {reviewMode ? <CloseOutlined /> : <EyeOutlined />}{' '}
              {reviewMode
                ? t('demo.reviews.closeReview') || (locale.toLowerCase().startsWith('ar') ? 'إغلاق المراجعة' : 'Close review')
                : t('demo.reviews.openReview')}
            </Button>
            <Button
              type="default"
              data-testid="demo-add-revision"
              disabled={saving}
              onClick={() => void addRevision()}
            >
              <PlusOutlined /> {t('demo.review.addRevision')}
            </Button>
          </div>
        ) : null}
      </header>

      <DemoDisclosure message={t('demo.reviewHonesty')} />
      <p className="oma-honesty-inline oma-deliv-detail__honesty">{t('demo.deliverable.storageHonesty')}</p>

      {loading ? <p className="oma-muted oma-deliv-detail__pad">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted oma-deliv-detail__pad">{t('demo.unavailable')}</p> : null}
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
                <span className="oma-muted">{row.type}</span>
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
                    aria-current={selectedVersionId === v.id || selectedVersion?.id === v.id ? 'true' : undefined}
                    data-testid={`demo-version-${v.id}`}
                    onClick={() => void selectVersion(v.id)}
                  >
                    <strong>{v.label}</strong>
                    <span className="oma-muted">
                      {v.status} · {v.createdBy}
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
                          <img src={v?.assets[0] ?? ''} alt="" />
                          <figcaption>
                            {v?.label} · {v?.status} · {v?.createdBy}
                          </figcaption>
                        </figure>
                      );
                    })}
                    <p className="oma-honesty-inline" style={{ gridColumn: '1 / -1' }}>
                      {t('demo.review.noPixelDiff')}
                    </p>
                  </div>
                ) : selectedVersion?.assets[0] ? (
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
                        !selectedVersion ||
                        selectedVersion.immutable ||
                        selectedVersion.status === 'APPROVED'
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
                    <img src={selectedVersion.assets[0]} alt="" draggable={false} />
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
                  <p className="oma-muted oma-deliv-detail__pad">{t('demo.empty')}</p>
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
                      {f === 'all' ? (locale.toLowerCase().startsWith('ar') ? 'الكل' : 'All')
                        : f === 'unresolved' ? (locale.toLowerCase().startsWith('ar') ? 'مفتوح' : 'Open')
                        : (locale.toLowerCase().startsWith('ar') ? 'محلول' : 'Resolved')}
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
                        {a.resolved ? t('demo.review.unresolve') || 'Unresolve' : t('demo.review.resolve') || 'Resolve'}
                      </Button>
                    </li>
                  ))}
                </ul>
                {generalComments.length ? (
                  <div className="oma-review-general">
                    <h4>{t('demo.review.general') || 'General'}</h4>
                    {generalComments.map((c) => (
                      <div key={c.id} className="oma-review-thread" data-testid={`demo-comment-${c.id}`}>
                        <div className="oma-review-thread__head">
                          <strong>{c.author}</strong>
                          <time dateTime={c.at}>{c.at}</time>
                        </div>
                        <p>{pickCopy(c.body, locale)}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="oma-review-decision" data-testid="demo-review-decision">
                  <h4>{t('demo.review.decision') || 'Decision'}</h4>
                  <div className="oma-chip-row">
                    {(['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'] as Decision[]).map((d) => (
                      <Button
                        key={d}
                        type="default"
                        data-testid={`demo-decision-${d}`}
                        disabled={saving || !selectedVersion || !canTransitionReview(row.reviewStatus, d)}
                        onClick={() => setDecisionOpen(d)}
                      >
                        {d === 'APPROVED' ? <CheckOutlined /> : null} {d}
                      </Button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <div className="oma-deliv-detail__workspace">
            <div className="oma-deliv-detail__main">
              <section className="oma-deliv-detail__card oma-deliv-detail__preview">
                {selectedVersion?.assets[0] ? (
                  <img
                    src={selectedVersion.assets[0]}
                    alt=""
                    className="oma-deliv-detail__hero"
                    data-testid="demo-deliv-preview"
                  />
                ) : (
                  <div className="oma-deliv-detail__hero-empty">{t('demo.empty')}</div>
                )}
                <div className="oma-deliv-detail__preview-meta">
                  <strong data-testid="demo-active-version-label-main">
                    {selectedVersion?.label ?? '—'}
                  </strong>
                  <span className="oma-muted">
                    {selectedVersion?.status} · {selectedVersion?.createdBy}
                  </span>
                </div>
              </section>

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
                      {v.assets[0] ? <img src={v.assets[0]} alt="" /> : <div className="oma-deliv-detail__version-ph" />}
                      <span>
                        <strong>{v.label}</strong>
                        <span className="oma-muted">{v.status}</span>
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
                  <span className="oma-deliv-detail__side-label">{t('demo.deliverables.filter.owner') || 'Owner'}</span>
                  <strong>{row.owner}</strong>
                </div>
                <div className="oma-deliv-detail__side-row">
                  <span className="oma-deliv-detail__side-label">{t('demo.deliverables.filter.reviewer')}</span>
                  <strong>{row.reviewer}</strong>
                </div>
                <div className="oma-deliv-detail__side-row">
                  <span className="oma-deliv-detail__side-label">{t('demo.deliverables.col.due') || 'Due'}</span>
                  <strong className="oma-ltr">{row.dueAt}</strong>
                </div>
                <div className="oma-deliv-detail__side-row">
                  <span className="oma-deliv-detail__side-label">Status</span>
                  <StatusChip status={row.reviewStatus} />
                </div>
                {approved ? (
                  <p className="oma-muted" data-testid="demo-approved-version">
                    {t('demo.review.approvedVersion')}: {approved.label} ({t('demo.review.immutable')})
                  </p>
                ) : null}
              </div>

              <div className="oma-deliv-detail__side-card">
                <h3>
                  <LinkOutlined /> {locale.toLowerCase().startsWith('ar') ? 'روابط' : 'Links'}
                </h3>
                <nav className="oma-deliv-detail__links" aria-label="Breadcrumb">
                  <Link href={`/app/campaigns/${row.campaignId}`} className="oma-deliv-detail__link">
                    {row.campaignId}
                  </Link>
                  {row.contentId ? (
                    <Link href={`/app/content?item=${row.contentId}`} className="oma-deliv-detail__link">
                      {row.contentId}
                    </Link>
                  ) : null}
                  {row.requestId ? (
                    <Link href={`/app/requests/${row.requestId}`} className="oma-deliv-detail__link">
                      {row.requestId}
                    </Link>
                  ) : null}
                  {row.taskId ? (
                    <Link href={`/app/tasks?task=${row.taskId}`} className="oma-deliv-detail__link">
                      {row.taskId}
                    </Link>
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
