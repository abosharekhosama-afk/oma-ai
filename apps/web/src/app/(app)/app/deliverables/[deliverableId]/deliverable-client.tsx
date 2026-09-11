'use client';

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
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../../lib/demo/use-demo-api';
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
      const data = await demoApi<DeliverableRow>(`/deliverables/${deliverableId}`);
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
      if (isDemoForbidden(err)) setUnavailable(true);
      else setError(demoErrorMessage(err, 'Demo unavailable'));
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
    try {
      const updated = await demoApi<DeliverableRow>(
        `/deliverables/${deliverableId}/current-version`,
        {
          method: 'PATCH',
          body: JSON.stringify({ versionId }),
        },
      );
      setRow(updated);
    } catch (err) {
      toast.push(demoErrorMessage(err, t('demo.unavailable')), 'danger');
    }
  }

  function onCanvasClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (!selectedVersion || selectedVersion.immutable || selectedVersion.status === 'APPROVED') {
      toast.push(t('demo.review.immutableHint'), 'danger');
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const coords = mapClientToNormalized(e.clientX, e.clientY, rect);
    setDraftPin(coords);
    setDraftBody('');
  }

  async function saveAnnotation() {
    if (!row || !selectedVersion || !draftPin || !draftBody.trim()) return;
    setSaving(true);
    try {
      const updated = await demoApi<DeliverableRow>(`/deliverables/${row.id}/annotations`, {
        method: 'POST',
        body: JSON.stringify({
          versionId: selectedVersion.id,
          x: draftPin.x,
          y: draftPin.y,
          author: 'Layla Haddad',
          body: { en: draftBody.trim(), ar: draftBody.trim() },
        }),
      });
      setRow(updated);
      setDraftPin(null);
      setDraftBody('');
      toast.push(t('demo.review.annotationSaved'), 'success');
    } catch (err) {
      toast.push(demoErrorMessage(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function addGeneral() {
    if (!row || !selectedVersion || !generalBody.trim()) return;
    setSaving(true);
    try {
      const updated = await demoApi<DeliverableRow>(`/deliverables/${row.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          versionId: selectedVersion.id,
          author: 'Layla Haddad',
          body: { en: generalBody.trim(), ar: generalBody.trim() },
        }),
      });
      setRow(updated);
      setGeneralBody('');
      toast.push(t('demo.review.commentSaved'), 'success');
    } catch (err) {
      toast.push(demoErrorMessage(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function toggleResolve(annotationId: string, resolved: boolean) {
    if (!row) return;
    try {
      const updated = await demoApi<DeliverableRow>(
        `/deliverables/${row.id}/annotations/${annotationId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ resolved }),
        },
      );
      setRow(updated);
    } catch (err) {
      toast.push(demoErrorMessage(err, t('demo.unavailable')), 'danger');
    }
  }

  async function addRevision() {
    if (!row) return;
    setSaving(true);
    try {
      const updated = await demoApi<DeliverableRow>(`/deliverables/${row.id}/revisions`, {
        method: 'POST',
        body: JSON.stringify({
          createdBy: row.owner,
          clientRequestId: `rev-${row.id}-${row.versions.length}`,
        }),
      });
      setRow(updated);
      setSelectedVersionId(updated.currentVersionId);
      toast.push(t('demo.review.revisionAdded'), 'success');
      setReviewUrl({ review: true, version: updated.currentVersionId });
    } catch (err) {
      toast.push(demoErrorMessage(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    if (!row || !selectedVersion) return;
    setSaving(true);
    try {
      const updated = await demoApi<DeliverableRow>(`/deliverables/${row.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ versionId: selectedVersion.id }),
      });
      setRow(updated);
      toast.push(t('demo.review.submitted'), 'success');
    } catch (err) {
      toast.push(demoErrorMessage(err, t('demo.unavailable')), 'danger');
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
      const updated = await demoApi<DeliverableRow>(`/deliverables/${row.id}/decide`, {
        method: 'POST',
        body: JSON.stringify({
          decision: decisionOpen,
          versionId: selectedVersion.id,
          actor: 'Layla Haddad',
          reason: decisionReason.trim()
            ? { en: decisionReason.trim(), ar: decisionReason.trim() }
            : undefined,
        }),
      });
      setRow(updated);
      setDecisionOpen(null);
      setDecisionReason('');
      toast.push(t('demo.review.decisionSaved'), 'success');
    } catch (err) {
      toast.push(demoErrorMessage(err, t('demo.unavailable')), 'danger');
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
    <div className="oma-stack" data-testid="demo-deliverable-detail">
      <div>
        <Link href="/app/deliverables" className="oma-text-link">
          ← {t('demo.deliverables.back')}
        </Link>
      </div>
      <PageHeader
        title={row ? pickCopy(row.title, locale) : t('demo.deliverables.title')}
        description={row ? row.id : undefined}
        meta={
          row ? (
            <>
              <span className="oma-badge oma-badge-muted">{row.type}</span>
              <StatusChip status={row.reviewStatus} />
              <span className="oma-muted" data-testid="demo-active-version-label">
                {selectedVersion?.label ?? '—'}
              </span>
            </>
          ) : null
        }
        actions={
          row ? (
            <div className="oma-chip-row">
              <button
                type="button"
                className="oma-btn oma-btn-secondary"
                data-testid="demo-open-review"
                onClick={() =>
                  setReviewUrl({ review: true, version: selectedVersionId ?? undefined })
                }
              >
                {t('demo.reviews.openReview')}
              </button>
              <button
                type="button"
                className="oma-btn oma-btn-secondary"
                data-testid="demo-add-revision"
                disabled={saving}
                onClick={() => void addRevision()}
              >
                {t('demo.review.addRevision')}
              </button>
            </div>
          ) : null
        }
      />
      <DemoDisclosure message={t('demo.reviewHonesty')} />
      <p className="oma-honesty-inline">{t('demo.deliverable.storageHonesty')}</p>

      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {row ? (
        <>
          <nav aria-label="Breadcrumb" className="oma-chip-row">
            <Link href={`/app/campaigns/${row.campaignId}`} className="oma-text-link">
              {row.campaignId}
            </Link>
            {row.contentId ? (
              <Link href={`/app/content?item=${row.contentId}`} className="oma-text-link">
                {row.contentId}
              </Link>
            ) : null}
            {row.requestId ? (
              <Link href={`/app/requests/${row.requestId}`} className="oma-text-link">
                {row.requestId}
              </Link>
            ) : null}
            {row.taskId ? (
              <Link href={`/app/tasks?task=${row.taskId}`} className="oma-text-link">
                {row.taskId}
              </Link>
            ) : null}
          </nav>

          <Panel title={t('demo.deliverable.meta')}>
            <div className="oma-task-fields">
              <p>
                <strong>{t('demo.deliverables.filter.owner')}:</strong> {row.owner}
              </p>
              <p>
                <strong>{t('demo.deliverables.filter.reviewer')}:</strong> {row.reviewer}
              </p>
              <p>
                <strong>{t('demo.deliverables.col.due')}:</strong> {row.dueAt}
              </p>
              <p>
                <strong>{t('demo.deliverables.col.comments')}:</strong> {openUnresolved}
              </p>
              {approved ? (
                <p data-testid="demo-approved-version">
                  {t('demo.review.approvedVersion')}: {approved.label} ({t('demo.review.immutable')}
                  )
                </p>
              ) : null}
            </div>
          </Panel>

          {row.changeRequests.length ? (
            <Panel title={t('demo.deliverable.changeRequests')}>
              <ul className="oma-stack">
                {row.changeRequests.map((cr) => (
                  <li key={cr.id}>
                    <strong>{cr.author}</strong>
                    <p>{pickCopy(cr.body, locale)}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {reviewMode ? (
            <section
              className="oma-review-workspace"
              data-testid="demo-review-workspace"
              aria-label={t('demo.reviews.openReview')}
              style={{ background: 'var(--oma-review-canvas)' }}
            >
              <div className="oma-review-toolbar">
                <div className="oma-chip-row">
                  <strong data-testid="demo-review-version-chrome">{selectedVersion?.label}</strong>
                  <span className="oma-muted">{row.type}</span>
                  <StatusChip status={row.reviewStatus} />
                </div>
                <div className="oma-chip-row">
                  <button
                    type="button"
                    className="oma-btn oma-btn-secondary"
                    data-testid="demo-review-zoom-fit"
                    onClick={() => setZoom('fit')}
                  >
                    {t('demo.review.fit')}
                  </button>
                  <button
                    type="button"
                    className="oma-btn oma-btn-secondary"
                    data-testid="demo-review-zoom-in"
                    onClick={() => setZoom('in')}
                  >
                    {t('demo.review.zoomIn')}
                  </button>
                  <button
                    type="button"
                    className="oma-btn oma-btn-secondary"
                    aria-pressed={compareMode}
                    data-testid="demo-review-compare-toggle"
                    onClick={() =>
                      setReviewUrl({
                        review: true,
                        version: selectedVersionId ?? undefined,
                        compare: !compareMode,
                      })
                    }
                  >
                    {t('demo.deliverable.compare')}
                  </button>
                  <button
                    type="button"
                    className="oma-btn oma-btn-secondary"
                    data-testid="demo-review-exit"
                    onClick={() => setReviewUrl({ review: false, compare: false })}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>

              <div className="oma-review-body">
                <aside className="oma-review-versions" data-testid="demo-version-rail">
                  <h3>{t('demo.deliverable.versions')}</h3>
                  {row.versions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="oma-review-version-item"
                      aria-current={v.id === selectedVersion?.id ? 'true' : undefined}
                      data-testid={`demo-version-${v.id}`}
                      onClick={() => void selectVersion(v.id)}
                    >
                      <strong>{v.label}</strong>
                      <span>{v.status}</span>
                      <span>{v.createdBy}</span>
                    </button>
                  ))}
                </aside>

                <div className="oma-review-canvas-wrap">
                  {compareMode ? (
                    <div className="oma-review-compare" data-testid="demo-version-compare">
                      <div className="oma-chip-row" style={{ gridColumn: '1 / -1' }}>
                        <label>
                          A
                          <select
                            className="oma-select"
                            value={compareA}
                            data-testid="demo-compare-a"
                            onChange={(e) => setCompareA(e.target.value)}
                          >
                            {row.versions.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          B
                          <select
                            className="oma-select"
                            value={compareB}
                            data-testid="demo-compare-b"
                            onChange={(e) => setCompareB(e.target.value)}
                          >
                            {row.versions.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.label}
                              </option>
                            ))}
                          </select>
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
                          <button
                            key={a.id}
                            type="button"
                            className="oma-review-pin"
                            style={{ left: pos.left, top: pos.top }}
                            data-resolved={a.resolved ? 'true' : 'false'}
                            data-selected={selectedPinId === a.id ? 'true' : 'false'}
                            data-testid={`demo-pin-${a.id}`}
                            aria-label={`Annotation ${a.number}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPinId(a.id);
                            }}
                          >
                            {a.number}
                          </button>
                        );
                      })}
                      {draftPin ? (
                        <span
                          className="oma-review-pin oma-review-pin-draft"
                          style={mapNormalizedToPercent(draftPin.x, draftPin.y)}
                          aria-hidden
                        >
                          +
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p data-testid="demo-unsupported-media">{t('demo.review.unsupported')}</p>
                  )}
                </div>

                <aside className="oma-review-comments" data-testid="demo-review-comments">
                  <h3>{t('demo.review.comments')}</h3>
                  <div className="oma-chip-row">
                    {(['all', 'unresolved', 'resolved'] as CommentFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className="oma-btn oma-btn-secondary"
                        aria-pressed={commentFilter === f}
                        onClick={() => setCommentFilter(f)}
                      >
                        {t(`demo.review.filter.${f}`)}
                      </button>
                    ))}
                  </div>

                  {draftPin ? (
                    <div className="oma-review-composer" data-testid="demo-annotation-draft">
                      <p>{t('demo.review.draftPin')}</p>
                      <textarea
                        className="oma-input"
                        rows={3}
                        value={draftBody}
                        data-testid="demo-annotation-body"
                        onChange={(e) => setDraftBody(e.target.value)}
                      />
                      <div className="oma-chip-row">
                        <button
                          type="button"
                          className="oma-btn oma-btn-secondary"
                          onClick={() => setDraftPin(null)}
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="button"
                          className="oma-btn oma-btn-primary"
                          data-testid="demo-annotation-save"
                          disabled={saving || !draftBody.trim()}
                          onClick={() => void saveAnnotation()}
                        >
                          {t('demo.review.saveAnnotation')}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {filteredThreads.map((a) => (
                    <article
                      key={a.id}
                      className="oma-review-thread"
                      data-selected={selectedPinId === a.id ? 'true' : 'false'}
                      data-testid={`demo-thread-${a.id}`}
                      onClick={() => setSelectedPinId(a.id)}
                    >
                      <strong>
                        #{a.number} {a.author}
                      </strong>
                      <p>{pickCopy(a.body, locale)}</p>
                      <time dateTime={a.at}>{a.at}</time>
                      <button
                        type="button"
                        className="oma-btn oma-btn-secondary"
                        data-testid={`demo-resolve-${a.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleResolve(a.id, !a.resolved);
                        }}
                      >
                        {a.resolved ? t('demo.review.reopen') : t('demo.review.resolve')}
                      </button>
                    </article>
                  ))}

                  {generalComments.map((c) => (
                    <article key={c.id} className="oma-review-thread">
                      <strong>{c.author}</strong>
                      <p>{pickCopy(c.body, locale)}</p>
                      <time dateTime={c.at}>{c.at}</time>
                    </article>
                  ))}

                  <div className="oma-review-composer">
                    <textarea
                      className="oma-input"
                      rows={2}
                      value={generalBody}
                      data-testid="demo-general-comment"
                      placeholder={t('demo.review.generalComment')}
                      onChange={(e) => setGeneralBody(e.target.value)}
                    />
                    <button
                      type="button"
                      className="oma-btn oma-btn-primary"
                      data-testid="demo-general-comment-submit"
                      disabled={saving}
                      onClick={() => void addGeneral()}
                    >
                      {t('demo.tasks.addComment')}
                    </button>
                  </div>

                  <div className="oma-approval-actions" style={{ marginTop: 16 }}>
                    <button
                      type="button"
                      className="oma-btn"
                      data-testid="demo-decide-approve"
                      onClick={() => setDecisionOpen('APPROVED')}
                    >
                      {t('demo.deliverable.approve')}
                    </button>
                    <button
                      type="button"
                      className="oma-btn oma-btn-secondary"
                      data-testid="demo-decide-changes"
                      onClick={() => setDecisionOpen('CHANGES_REQUESTED')}
                    >
                      {t('demo.deliverable.requestChanges')}
                    </button>
                    <button
                      type="button"
                      className="oma-btn oma-btn-secondary"
                      data-testid="demo-decide-reject"
                      onClick={() => setDecisionOpen('REJECTED')}
                    >
                      {t('demo.deliverable.reject')}
                    </button>
                    <button
                      type="button"
                      className="oma-btn oma-btn-secondary"
                      data-testid="demo-submit-review"
                      onClick={() => void submitForReview()}
                    >
                      {t('demo.review.submit')}
                    </button>
                  </div>
                  <p className="oma-honesty-inline">{t('demo.reviewHonesty')}</p>
                </aside>
              </div>
            </section>
          ) : (
            <Panel
              title={t('demo.deliverable.preview')}
              action={
                <button
                  type="button"
                  className="oma-btn oma-btn-primary"
                  onClick={() => setReviewUrl({ review: true })}
                >
                  {t('demo.reviews.openReview')}
                </button>
              }
            >
              {selectedVersion?.assets[0] ? (
                <img
                  src={selectedVersion.assets[0]}
                  alt=""
                  style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain' }}
                />
              ) : (
                <p className="oma-muted">{t('demo.review.unsupported')}</p>
              )}
              <div className="oma-approval-actions">
                <button
                  type="button"
                  className="oma-btn"
                  data-testid="demo-decide-approve"
                  onClick={() => {
                    setReviewUrl({ review: true });
                    setDecisionOpen('APPROVED');
                  }}
                >
                  {t('demo.deliverable.approve')}
                </button>
                <button
                  type="button"
                  className="oma-btn oma-btn-secondary"
                  data-testid="demo-decide-changes"
                  onClick={() => {
                    setReviewUrl({ review: true });
                    setDecisionOpen('CHANGES_REQUESTED');
                  }}
                >
                  {t('demo.deliverable.requestChanges')}
                </button>
                <button
                  type="button"
                  className="oma-btn oma-btn-secondary"
                  data-testid="demo-decide-reject"
                  onClick={() => {
                    setReviewUrl({ review: true });
                    setDecisionOpen('REJECTED');
                  }}
                >
                  {t('demo.deliverable.reject')}
                </button>
              </div>
            </Panel>
          )}

          <Panel title={t('demo.tasks.activity')}>
            <ul className="oma-activity-list" data-testid="demo-review-activity">
              {(row.activity ?? []).map((a) => (
                <li key={a.id}>
                  <strong>{a.actor}</strong>
                  <span>{pickCopy(a.summary, locale)}</span>
                  <time dateTime={a.at}>{a.at}</time>
                </li>
              ))}
            </ul>
          </Panel>
        </>
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
              <textarea
                className="oma-input"
                rows={3}
                value={decisionReason}
                data-testid="demo-decision-reason"
                onChange={(e) => setDecisionReason(e.target.value)}
              />
            </label>
          ) : (
            <label>
              {t('demo.review.optionalNote')}
              <textarea
                className="oma-input"
                rows={2}
                value={decisionReason}
                data-testid="demo-decision-reason"
                onChange={(e) => setDecisionReason(e.target.value)}
              />
            </label>
          )}
          <div className="oma-chip-row">
            <button
              type="button"
              className="oma-btn oma-btn-secondary"
              onClick={() => setDecisionOpen(null)}
            >
              {t('demo.create.cancel')}
            </button>
            <button
              type="button"
              className="oma-btn oma-btn-primary"
              data-testid="demo-decision-confirm"
              disabled={saving}
              onClick={() => void confirmDecision()}
            >
              {t('demo.review.confirm')}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
