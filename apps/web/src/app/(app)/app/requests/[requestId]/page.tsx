'use client';
import { Button, DateField, Input, SelectField, TextArea } from '@oma/ui/controls';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DemoGraph, DemoLocaleCopy } from '@oma/demo';
import { DemoDisclosure } from '../../../../../components/demo/demo-disclosure';
import { Dialog } from '../../../../../components/ui/dialog';
import { StatusChip } from '../../../../../components/ui/status-chip';
import { useToast } from '../../../../../components/ui/toast';
import { pickCopy } from '../../../../../lib/demo/use-demo-api';
import {
  getRequest,
  updateRequest,
  convertRequestToTask,
  toRequestRow,
  opsError,
} from '../../../../../lib/ops-api';
import {
  briefCompleteness,
  briefIsReady,
  canTransitionRequestStatus,
  requestCompleteness,
  requestMissingFields,
  type RequestRow,
} from '../../../../../lib/demo/stage4-requests';
import { useLocale, useT } from '../../../../../lib/use-locale';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  UserOutlined,
  CalendarOutlined,
  FlagOutlined,
  LinkOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

type Brief = DemoGraph['briefs'][number];
type Task = DemoGraph['tasks'][number];
type RequestDetail = RequestRow & { brief: Brief | null; tasks?: Task[] };

const emptyCopy = (): DemoLocaleCopy => ({ en: '', ar: '' });

function safeCopy(value: unknown, locale: string): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'object' && value !== null && 'en' in value && 'ar' in value) {
    return pickCopy(value as DemoLocaleCopy, locale);
  }
  return String(value);
}

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
    <label className="oma-brief-field">
      <span className="oma-brief-field__label">{label}</span>
      <TextArea
        rows={rows}
        value={value}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value)}
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
      const detail = await getRequest(requestId);
      const data = toRequestRow(detail.data);
      data.conversionTaskIds = (detail.tasks ?? []).map((x) => x.id);
      setRow(data);
      setBriefDraft({
        id: '',
        requestId,
        overview: emptyCopy(),
        objective: emptyCopy(),
        audience: emptyCopy(),
        keyMessage: emptyCopy(),
        deliverableType: emptyCopy(),
        channels: data.channels ?? [],
        formats: data.formats ?? [],
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
      });
      setDirty(false);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      setError(opsError(err, 'Failed to load request'));
      setRow(null);
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
      const saved = briefDraft;
      toast.push(
        locale.toLowerCase().startsWith('ar')
          ? 'الموجز محفوظ محلياً (قريباً على الخادم)'
          : 'Brief saved locally (server brief domain coming next)',
        'success',
      );
      setBriefDraft(saved);
      setDirty(false);
      toast.push(t('demo.brief.saved'), 'success');
      await load();
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
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
      await updateRequest(requestId, {
        status: patch.status,
        priority: patch.priority,
        assigneeUserId: patch.assignee ?? undefined,
        dueAt: patch.dueAt,
        campaignId: patch.campaignId,
        contentId: patch.contentId,
        title: patch.title,
        description: patch.description,
      });
      toast.push(t('demo.requests.updated'), 'success');
      await load();
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    }
  }

  async function convert() {
    if (!requestId) return;
    setConverting(true);
    try {
      const task = await convertRequestToTask(requestId);
      toast.push(t('demo.requests.converted'), 'success');
      await load();
      if (task?.id) router.push(`/app/tasks?task=${task.id}`);
    } catch (err) {
      toast.push(opsError(err, t('demo.requests.convertFailed')), 'danger');
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="oma-req-detail" data-testid="demo-request-detail">
      {/* Planable-style top bar: back + title chips + actions */}
      <header className="oma-req-detail__top">
        <div className="oma-req-detail__top-left">
          <Link href="/app/requests" className="oma-req-detail__back" data-testid="demo-request-back">
            <ArrowLeftOutlined />
            <span>{t('demo.requests.back')}</span>
          </Link>
          {row ? (
            <div className="oma-req-detail__top-meta">
              <span className="oma-req-detail__top-id">{row.id.replace('demo-request-', '#')}</span>
              <StatusChip status={row.status} />
              <StatusChip status={row.priority} />
            </div>
          ) : null}
        </div>
        {row ? (
          <div className="oma-req-detail__top-actions">
            <Button
              type="default"
              data-testid="demo-request-close"
              onClick={() => setConfirmClose(true)}
            >
              {t('demo.requests.close')}
            </Button>
            <Button
              type="primary"
              data-testid="demo-request-convert"
              disabled={!ready || converting}
              onClick={() => void convert()}
            >
              {converting ? t('demo.create.creating') : t('demo.requests.convert')}
            </Button>
          </div>
        ) : null}
      </header>

      <DemoDisclosure />

      {loading ? <p className="oma-muted oma-req-detail__pad">{t('demo.loading')}</p> : null}
      {unavailable ? (
        <p className="oma-muted oma-req-detail__pad" data-testid="demo-request-denied">
          {t('demo.unavailable')}
        </p>
      ) : null}
      {error ? (
        <div className="oma-card oma-req-detail__pad" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {row ? (
        <div className="oma-req-detail__workspace">
          <div className="oma-req-detail__main">
            {/* Title block */}
            <div className="oma-req-detail__title-block">
              <div className="oma-req-detail__chips">
                <StatusChip status={row.status} />
                <StatusChip status={row.priority} />
                <span className="oma-req-detail__id">{row.id.replace('demo-request-', '#')}</span>
              </div>
              <h1 className="oma-req-detail__title">{safeCopy(row.title, locale)}</h1>
              <p className="oma-req-detail__desc">{safeCopy(row.description, locale)}</p>
            </div>

            {/* Triage card */}
            <section className="oma-req-detail__card" data-testid="demo-request-completeness">
              <header className="oma-req-detail__card-head">
                <strong>{t('demo.requests.triage')}</strong>
                <span className="oma-req-detail__meta">
                  {requestCompleteness(row, briefDraft)}%
                </span>
              </header>
              {requestMissingFields(row).length ? (
                <p className="oma-callout" data-testid="demo-request-missing">
                  {t('demo.requests.missing')}: {requestMissingFields(row).join(', ')}
                </p>
              ) : null}
              <div className="oma-req-detail__fields">
                <label>
                  {t('demo.requests.filter.status')}
                  <SelectField
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
                  </SelectField>
                </label>
                <label>
                  {t('demo.requests.filter.priority')}
                  <SelectField
                    value={row.priority}
                    data-testid="demo-request-priority"
                    onChange={(e) => void patchRequest({ priority: e.target.value })}
                  >
                    {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </SelectField>
                </label>
                <label>
                  {t('demo.requests.filter.assignee')}
                  <Input
                    defaultValue={row.assignee ?? ''}
                    data-testid="demo-request-assignee"
                    onBlur={(e) => void patchRequest({ assignee: e.target.value.trim() || null })}
                  />
                </label>
                <label>
                  {t('demo.requests.col.due')}
                  <DateField
                    defaultValue={row.dueAt}
                    data-testid="demo-request-due"
                    onBlur={(e) => void patchRequest({ dueAt: e.target.value })}
                  />
                </label>
              </div>
              <div className="oma-req-detail__links">
                {row.campaignId ? (
                  <Link
                    href={`/app/campaigns/${row.campaignId}`}
                    className="oma-req-detail__link"
                    data-testid="demo-request-campaign-link"
                  >
                    <LinkOutlined /> {t('demo.create.campaign')}: {row.campaignId}
                  </Link>
                ) : (
                  <span className="oma-muted">{t('demo.requests.noCampaign')}</span>
                )}
                {row.contentId ? (
                  <Link
                    href={`/app/content?item=${row.contentId}`}
                    className="oma-req-detail__link"
                    data-testid="demo-request-content-link"
                  >
                    <LinkOutlined /> {t('nav.content')}: {row.contentId}
                  </Link>
                ) : null}
              </div>
            </section>

            {/* Brief card */}
            {briefDraft ? (
              <section className="oma-req-detail__card oma-req-detail__card--brief">
                <header className="oma-req-detail__card-head">
                  <div className="oma-req-detail__card-head-text">
                    <strong>
                      <FileTextOutlined /> {t('demo.request.brief')}
                    </strong>
                    <span className="oma-req-detail__meta">
                      {t('demo.brief.readiness')}: {briefDraft.readiness} · {briefCompleteness(briefDraft)}%
                    </span>
                  </div>
                  <Button
                    type="primary"
                    data-testid="demo-brief-save"
                    disabled={saving}
                    onClick={() => void saveBrief()}
                  >
                    {saving ? t('demo.brief.saving') : t('demo.brief.save')}
                  </Button>
                </header>
                <p className="oma-callout oma-callout--info" data-testid="demo-brief-ai-honesty">
                  {t('demo.honesty.ai')}
                </p>
                <div className="oma-brief-layout">
                  <div className="oma-brief-col">
                    <BriefField
                      label={t('demo.brief.overview') || 'Overview'}
                      value={safeCopy(briefDraft.overview, locale)}
                      testId="demo-brief-overview"
                      onChange={(v) => patchBriefCopy('overview', v)}
                    />
                    <BriefField
                      label={t('demo.brief.objective')}
                      value={safeCopy(briefDraft.objective, locale)}
                      testId="demo-brief-objective"
                      onChange={(v) => patchBriefCopy('objective', v)}
                    />
                    <BriefField
                      label={t('demo.brief.audience')}
                      value={safeCopy(briefDraft.audience, locale)}
                      testId="demo-brief-audience"
                      onChange={(v) => patchBriefCopy('audience', v)}
                    />
                    <BriefField
                      label={t('demo.brief.message')}
                      value={safeCopy(briefDraft.keyMessage, locale)}
                      testId="demo-brief-key-message"
                      onChange={(v) => patchBriefCopy('keyMessage', v)}
                    />
                    <BriefField
                      label={t('demo.brief.deliverable') || 'Deliverable'}
                      value={safeCopy(briefDraft.deliverableType, locale)}
                      testId="demo-brief-deliverable"
                      onChange={(v) => patchBriefCopy('deliverableType', v)}
                    />
                    <label className="oma-brief-field">
                      <span className="oma-brief-field__label">{t('demo.brief.channels')}</span>
                      <Input
                        data-testid="demo-brief-channels"
                        value={safeCopy(briefDraft.channels, locale)}
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
                  </div>
                  <div className="oma-brief-col">
                    <label className="oma-brief-field">
                      <span className="oma-brief-field__label">
                        {t('demo.brief.formats') || 'Formats'}
                      </span>
                      <Input
                        data-testid="demo-brief-formats"
                        value={safeCopy(briefDraft.formats, locale)}
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
                      label={t('demo.brief.tone') || 'Tone'}
                      value={safeCopy(briefDraft.tone, locale)}
                      testId="demo-brief-tone"
                      onChange={(v) => patchBriefCopy('tone', v)}
                    />
                    <BriefField
                      label={t('demo.brief.mandatory') || 'Mandatory'}
                      value={safeCopy(briefDraft.mandatory, locale)}
                      testId="demo-brief-mandatory"
                      onChange={(v) => patchBriefCopy('mandatory', v)}
                    />
                    <BriefField
                      label={t('demo.brief.cta') || 'CTA'}
                      value={safeCopy(briefDraft.cta, locale)}
                      testId="demo-brief-cta"
                      onChange={(v) => patchBriefCopy('cta', v)}
                    />
                    <BriefField
                      label={t('demo.brief.acceptance') || 'Acceptance'}
                      value={safeCopy(briefDraft.acceptance, locale)}
                      testId="demo-brief-acceptance"
                      onChange={(v) => patchBriefCopy('acceptance', v)}
                    />
                    <BriefField
                      label={t('demo.brief.timeline')}
                      value={safeCopy(briefDraft.timelineNote, locale)}
                      testId="demo-brief-timeline"
                      onChange={(v) => patchBriefCopy('timelineNote', v)}
                    />
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
              </section>
            ) : null}

            {/* Tasks card */}
            <section className="oma-req-detail__card">
              <header className="oma-req-detail__card-head">
                <strong>{t('demo.tasks.title')}</strong>
              </header>
              {(row.tasks ?? []).length === 0 ? (
                <p className="oma-muted">{t('demo.requests.noTasks')}</p>
              ) : (
                <ul className="oma-req-detail__task-list">
                  {(row.tasks ?? []).map((task) => (
                    <li key={task.id}>
                      <Link
                        href={`/app/tasks?task=${task.id}`}
                        className="oma-req-detail__link"
                        data-testid={`demo-request-task-${task.id}`}
                      >
                        {pickCopy(task.title, locale)}
                        <span className="oma-req-detail__task-status">{task.status}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Sidebar summary */}
          <aside className="oma-req-detail__side">
            <div className="oma-req-detail__side-card">
              <h3>{locale.toLowerCase().startsWith('ar') ? 'الملخص' : 'Summary'}</h3>
              <div className="oma-req-detail__side-row">
                <UserOutlined />
                <div>
                  <span className="oma-req-detail__side-label">
                    {t('demo.requests.filter.requester')}
                  </span>
                  <strong>{row.requester}</strong>
                </div>
              </div>
              <div className="oma-req-detail__side-row">
                <UserOutlined />
                <div>
                  <span className="oma-req-detail__side-label">
                    {t('demo.requests.filter.assignee')}
                  </span>
                  <strong>{row.assignee ?? t('demo.requests.unassigned')}</strong>
                </div>
              </div>
              <div className="oma-req-detail__side-row">
                <CalendarOutlined />
                <div>
                  <span className="oma-req-detail__side-label">{t('demo.requests.col.due')}</span>
                  <strong className="oma-ltr">{row.dueAt}</strong>
                </div>
              </div>
              <div className="oma-req-detail__side-row">
                <FlagOutlined />
                <div>
                  <span className="oma-req-detail__side-label">
                    {t('demo.requests.filter.priority')}
                  </span>
                  <strong>{row.priority}</strong>
                </div>
              </div>
              <div className="oma-req-detail__side-row">
                <CheckOutlined />
                <div>
                  <span className="oma-req-detail__side-label">
                    {t('demo.requests.filter.status')}
                  </span>
                  <strong>{row.status}</strong>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <Dialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title={t('demo.requests.close')}
      >
        <div className="oma-stack">
          <label>
            {t('demo.requests.closeReason')}
            <TextArea
              value={closeReason}
              data-testid="demo-request-close-reason"
              onChange={(e) => setCloseReason(e.target.value)}
            />
          </label>
          <div className="oma-chip-row">
            <Button type="default" onClick={() => setConfirmClose(false)}>
              {t('demo.create.cancel')}
            </Button>
            <Button
              type="primary"
              data-testid="demo-request-close-confirm"
              disabled={!closeReason.trim()}
              onClick={() => {
                void patchRequest({ status: 'CLOSED' });
                setConfirmClose(false);
              }}
            >
              {t('demo.requests.close')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
