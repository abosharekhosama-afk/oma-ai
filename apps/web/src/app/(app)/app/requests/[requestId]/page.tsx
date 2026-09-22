'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DemoGraph, DemoLocaleCopy } from '@oma/demo';
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
  briefCompleteness,
  briefIsReady,
  canTransitionRequestStatus,
  requestCompleteness,
  requestMissingFields,
  type RequestRow,
} from '../../../../../lib/demo/stage4-requests';
import { useLocale, useT } from '../../../../../lib/use-locale';

type Brief = DemoGraph['briefs'][number];
type Task = DemoGraph['tasks'][number];
type RequestDetail = RequestRow & { brief: Brief | null; tasks?: Task[] };

const emptyCopy = (): DemoLocaleCopy => ({ en: '', ar: '' });

function BriefField({
  label,
  value,
  onChange,
  testId,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
  rows?: number;
}) {
  return (
    <label>
      {label}
      <textarea
        className="oma-input"
        rows={rows}
        value={value}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value)}
        onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
      />
    </label>
  );
}

export default function RequestDetailPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ requestId: string }>();
  const requestId = params.requestId;
  const [row, setRow] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [briefDraft, setBriefDraft] = useState<Brief | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [converting, setConverting] = useState(false);

  const load = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const data = await demoApi<RequestDetail>(`/requests/${requestId}`);
      setRow(data);
      setBriefDraft(
        data.brief ?? {
          id: '',
          requestId,
          overview: emptyCopy(),
          objective: emptyCopy(),
          audience: emptyCopy(),
          keyMessage: emptyCopy(),
          deliverableType: emptyCopy(),
          channels: [],
          formats: [],
          tone: emptyCopy(),
          mandatory: emptyCopy(),
          cta: emptyCopy(),
          references: [],
          doList: [],
          dontList: [],
          timelineNote: emptyCopy(),
          stakeholders: [],
          acceptance: emptyCopy(),
          dueAt: data.dueAt,
          attachmentAssets: [],
          readiness: 'DRAFT',
        },
      );
      setDirty(false);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (isDemoForbidden(err)) setUnavailable(true);
      else setError(demoErrorMessage(err, 'Demo unavailable'));
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const missing = useMemo(() => (row ? requestMissingFields(row) : []), [row]);
  const completeness = useMemo(
    () => (row ? requestCompleteness(row, briefDraft) : 0),
    [row, briefDraft],
  );
  const ready = briefDraft ? briefIsReady(briefDraft) : false;

  function patchBriefCopy(key: keyof Brief, value: string) {
    setBriefDraft((b) => {
      if (!b) return b;
      const current = b[key];
      if (current && typeof current === 'object' && 'en' in current) {
        return { ...b, [key]: { en: value, ar: value } };
      }
      return b;
    });
    setDirty(true);
  }

  async function saveBrief() {
    if (!requestId || !briefDraft) return;
    setSaving(true);
    try {
      const saved = await demoApi<Brief>(`/requests/${requestId}/brief`, {
        method: 'POST',
        body: JSON.stringify({
          ...briefDraft,
          channels:
            typeof briefDraft.channels === 'string'
              ? String(briefDraft.channels)
                  .split(',')
                  .map((c) => c.trim())
                  .filter(Boolean)
              : briefDraft.channels,
          formats:
            typeof briefDraft.formats === 'string'
              ? String(briefDraft.formats)
                  .split(',')
                  .map((c) => c.trim())
                  .filter(Boolean)
              : briefDraft.formats,
          readiness: ready ? 'READY' : briefCompleteness(briefDraft) < 40 ? 'DRAFT' : 'INCOMPLETE',
        }),
      });
      setBriefDraft(saved);
      setDirty(false);
      toast.push(t('demo.brief.saved'), 'success');
      await load();
    } catch (err) {
      toast.push(demoErrorMessage(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function patchRequest(patch: Record<string, unknown>) {
    if (!requestId || !row) return;
    if (
      typeof patch.status === 'string' &&
      !canTransitionRequestStatus(row.status, patch.status as RequestRow['status'])
    ) {
      toast.push(t('demo.requests.invalidTransition'), 'danger');
      return;
    }
    try {
      await demoApi(`/requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      toast.push(t('demo.requests.updated'), 'success');
      await load();
    } catch (err) {
      toast.push(demoErrorMessage(err, t('demo.unavailable')), 'danger');
    }
  }

  async function convert() {
    if (!requestId) return;
    setConverting(true);
    try {
      if (dirty) await saveBrief();
      const result = await demoApi<{ tasks: Task[] }>(`/requests/${requestId}/convert`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.push(t('demo.requests.converted'), 'success');
      await load();
      const first = result.tasks[0];
      if (first) router.push(`/app/tasks?task=${first.id}`);
    } catch (err) {
      toast.push(demoErrorMessage(err, t('demo.requests.convertFailed')), 'danger');
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="oma-stack" data-testid="demo-request-detail">
      <div>
        <Link href="/app/requests" className="oma-text-link">
          ← {t('demo.requests.back')}
        </Link>
      </div>
      <PageHeader
        title={row ? pickCopy(row.title, locale) : t('demo.requests.title')}
        description={row ? row.id : undefined}
        meta={
          row ? (
            <>
              <StatusChip status={row.status} />
              <StatusChip status={row.priority} />
              <span className="oma-muted">
                {row.requester} · {row.assignee ?? t('demo.requests.unassigned')} · {row.dueAt}
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
                data-testid="demo-request-close"
                onClick={() => setConfirmClose(true)}
              >
                {t('demo.requests.close')}
              </button>
              <button
                type="button"
                className="oma-btn oma-btn-primary"
                data-testid="demo-request-convert"
                disabled={!ready || converting}
                onClick={() => void convert()}
              >
                {converting ? t('demo.create.creating') : t('demo.requests.convert')}
              </button>
            </div>
          ) : null
        }
      />
      <DemoDisclosure />

      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? (
        <p className="oma-muted" data-testid="demo-request-denied">
          {t('demo.unavailable')}
        </p>
      ) : null}
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {row ? (
        <>
          <div className="oma-chip-row" data-testid="demo-request-completeness">
            <span>
              {t('demo.requests.completeness')}: {completeness}%
            </span>
            {missing.length ? (
              <span className="oma-callout" data-testid="demo-request-missing">
                {t('demo.requests.missing')}: {missing.join(', ')}
              </span>
            ) : null}
          </div>

          <Panel title={t('demo.requests.triage')}>
            <div className="oma-task-fields">
              <label>
                {t('demo.requests.filter.status')}
                <select
                  className="oma-select"
                  value={row.status}
                  data-testid="demo-request-status"
                  onChange={(e) => void patchRequest({ status: e.target.value })}
                >
                  {[
                    'OPEN',
                    'ASSIGNED',
                    'IN_BRIEF',
                    'WAITING_INFO',
                    'READY_FOR_PRODUCTION',
                    'IN_PRODUCTION',
                    'DONE',
                    'CLOSED',
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('demo.requests.filter.priority')}
                <select
                  className="oma-select"
                  value={row.priority}
                  data-testid="demo-request-priority"
                  onChange={(e) => void patchRequest({ priority: e.target.value })}
                >
                  {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('demo.requests.filter.assignee')}
                <input
                  className="oma-input"
                  defaultValue={row.assignee ?? ''}
                  data-testid="demo-request-assignee"
                  onBlur={(e) => void patchRequest({ assignee: e.target.value.trim() || null })}
                />
              </label>
              <label>
                {t('demo.requests.col.due')}
                <input
                  className="oma-input"
                  type="date"
                  defaultValue={row.dueAt}
                  data-testid="demo-request-due"
                  onBlur={(e) => void patchRequest({ dueAt: e.target.value })}
                />
              </label>
            </div>
            <div className="oma-stack" style={{ marginTop: 12 }}>
              <p>{pickCopy(row.description, locale)}</p>
              {row.campaignId ? (
                <Link
                  href={`/app/campaigns/${row.campaignId}`}
                  className="oma-text-link"
                  data-testid="demo-request-campaign-link"
                >
                  {t('demo.create.campaign')}: {row.campaignId}
                </Link>
              ) : (
                <p className="oma-muted">{t('demo.requests.noCampaign')}</p>
              )}
              {row.contentId ? (
                <Link
                  href={`/app/content?item=${row.contentId}`}
                  className="oma-text-link"
                  data-testid="demo-request-content-link"
                >
                  {t('nav.content')}: {row.contentId}
                </Link>
              ) : null}
            </div>
          </Panel>

          {briefDraft ? (
            <Panel
              title={t('demo.request.brief')}
              description={`${t('demo.brief.readiness')}: ${briefDraft.readiness} · ${briefCompleteness(briefDraft)}%`}
              action={
                <button
                  type="button"
                  className="oma-btn oma-btn-primary"
                  data-testid="demo-brief-save"
                  disabled={saving}
                  onClick={() => void saveBrief()}
                >
                  {saving ? t('demo.brief.saving') : t('demo.brief.save')}
                </button>
              }
            >
              <p className="oma-callout oma-callout--info" data-testid="demo-brief-ai-honesty">
                {t('demo.honesty.ai')}
              </p>
              <div className="oma-brief-layout">
                <nav className="oma-brief-toc" aria-label={t('demo.brief.title')}>
                  <a href="#brief-overview">{t('demo.brief.overview')}</a>
                  <a href="#brief-objective">{t('demo.campaign.objective')}</a>
                  <a href="#brief-deliverable">{t('demo.brief.deliverable')}</a>
                  <a href="#brief-requirements">{t('demo.brief.acceptance')}</a>
                  <a href="#brief-timeline">{t('demo.brief.timeline')}</a>
                </nav>
                <div className="oma-brief-canvas">
                  <div className="oma-brief-grid" data-testid="demo-structured-brief">
                    <div className="oma-brief-section" id="brief-overview">
                      <h3>{t('demo.brief.overview')}</h3>
                      <BriefField
                        label={t('demo.brief.overview')}
                        value={pickCopy(briefDraft.overview, locale)}
                        testId="demo-brief-overview"
                        onChange={(v) => patchBriefCopy('overview', v)}
                      />
                    </div>
                    <div className="oma-brief-section" id="brief-objective">
                      <h3>{t('demo.campaign.objective')}</h3>
                      <BriefField
                        label={t('demo.campaign.objective')}
                        value={pickCopy(briefDraft.objective, locale)}
                        testId="demo-brief-objective"
                        onChange={(v) => patchBriefCopy('objective', v)}
                      />
                      <BriefField
                        label={t('demo.campaign.audience')}
                        value={pickCopy(briefDraft.audience, locale)}
                        testId="demo-brief-audience"
                        onChange={(v) => patchBriefCopy('audience', v)}
                      />
                      <BriefField
                        label={t('demo.brief.keyMessage')}
                        value={pickCopy(briefDraft.keyMessage, locale)}
                        testId="demo-brief-key-message"
                        onChange={(v) => patchBriefCopy('keyMessage', v)}
                      />
                    </div>
                    <div className="oma-brief-section" id="brief-deliverable">
                      <h3>{t('demo.brief.deliverable')}</h3>
                      <BriefField
                        label={t('demo.brief.deliverable')}
                        value={pickCopy(briefDraft.deliverableType, locale)}
                        testId="demo-brief-deliverable"
                        onChange={(v) => patchBriefCopy('deliverableType', v)}
                      />
                      <label>
                        {t('demo.create.channels')}
                        <input
                          className="oma-input"
                          value={briefDraft.channels.join(', ')}
                          data-testid="demo-brief-channels"
                          onChange={(e) => {
                            setBriefDraft((b) =>
                              b
                                ? {
                                    ...b,
                                    channels: e.target.value
                                      .split(',')
                                      .map((c) => c.trim())
                                      .filter(Boolean),
                                  }
                                : b,
                            );
                            setDirty(true);
                          }}
                        />
                      </label>
                      <label>
                        {t('demo.requests.formats')}
                        <input
                          className="oma-input"
                          value={briefDraft.formats.join(', ')}
                          data-testid="demo-brief-formats"
                          onChange={(e) => {
                            setBriefDraft((b) =>
                              b
                                ? {
                                    ...b,
                                    formats: e.target.value
                                      .split(',')
                                      .map((c) => c.trim())
                                      .filter(Boolean),
                                  }
                                : b,
                            );
                            setDirty(true);
                          }}
                        />
                      </label>
                      <BriefField
                        label={t('demo.brief.tone')}
                        value={pickCopy(briefDraft.tone, locale)}
                        testId="demo-brief-tone"
                        onChange={(v) => patchBriefCopy('tone', v)}
                      />
                      <BriefField
                        label={t('demo.brief.mandatory')}
                        value={pickCopy(briefDraft.mandatory, locale)}
                        testId="demo-brief-mandatory"
                        onChange={(v) => patchBriefCopy('mandatory', v)}
                      />
                      <BriefField
                        label={t('demo.brief.cta')}
                        value={pickCopy(briefDraft.cta, locale)}
                        testId="demo-brief-cta"
                        onChange={(v) => patchBriefCopy('cta', v)}
                      />
                    </div>
                    <div className="oma-brief-section" id="brief-requirements">
                      <h3>{t('demo.brief.acceptance')}</h3>
                      <BriefField
                        label={t('demo.brief.acceptance')}
                        value={pickCopy(briefDraft.acceptance, locale)}
                        testId="demo-brief-acceptance"
                        onChange={(v) => patchBriefCopy('acceptance', v)}
                      />
                      <p className="oma-muted">
                        {t('demo.brief.stakeholders')}:{' '}
                        {briefDraft.stakeholders.join(' · ') || t('demo.optional')}
                      </p>
                      <ul data-testid="demo-brief-references">
                        {briefDraft.references.map((ref) => (
                          <li key={ref}>{ref}</li>
                        ))}
                      </ul>
                      {briefDraft.attachmentAssets.length ? (
                        <div className="oma-chip-row">
                          {briefDraft.attachmentAssets.map((src) => (
                            <img
                              key={src}
                              src={src}
                              alt=""
                              width={96}
                              height={120}
                              className="oma-thumb-rounded"
                              style={{
                                width: 96,
                                height: 120,
                              }} /* INTENTIONAL_EXCEPTION: layout size only */
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="oma-muted" data-testid="demo-brief-no-upload">
                          Demo: no upload backend — references are text/asset placeholders only.
                        </p>
                      )}
                    </div>
                    <div className="oma-brief-section" id="brief-timeline">
                      <h3>{t('demo.brief.timeline')}</h3>
                      <BriefField
                        label={t('demo.brief.timeline')}
                        value={pickCopy(briefDraft.timelineNote, locale)}
                        testId="demo-brief-timeline"
                        onChange={(v) => patchBriefCopy('timelineNote', v)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <p data-testid="demo-brief-ready-state">
                {ready ? t('demo.brief.ready') : t('demo.brief.notReady')}
              </p>
              {!ready ? (
                <p className="oma-callout" data-testid="demo-brief-missing">
                  {t('demo.requests.missing')}: completeness {briefCompleteness(briefDraft)}%
                </p>
              ) : null}
            </Panel>
          ) : null}

          <Panel title={t('demo.tasks.title')}>
            {(row.tasks ?? []).length === 0 ? (
              <p className="oma-muted">{t('demo.requests.noTasks')}</p>
            ) : (
              <ul className="oma-compact-list">
                {(row.tasks ?? []).map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/app/tasks?task=${task.id}`}
                      className="oma-text-link"
                      data-testid={`demo-request-task-${task.id}`}
                    >
                      {pickCopy(task.title, locale)} · {task.status}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      ) : null}

      <Dialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title={t('demo.requests.close')}
      >
        <div className="oma-stack">
          <label>
            {t('demo.requests.closeReason')}
            <textarea
              className="oma-input"
              value={closeReason}
              data-testid="demo-request-close-reason"
              onChange={(e) => setCloseReason(e.target.value)}
            />
          </label>
          <div className="oma-chip-row">
            <button
              type="button"
              className="oma-btn oma-btn-secondary"
              onClick={() => setConfirmClose(false)}
            >
              {t('demo.create.cancel')}
            </button>
            <button
              type="button"
              className="oma-btn oma-btn-primary"
              data-testid="demo-request-close-confirm"
              disabled={!closeReason.trim()}
              onClick={() => {
                void patchRequest({ status: 'CLOSED' });
                setConfirmClose(false);
              }}
            >
              {t('demo.requests.close')}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
