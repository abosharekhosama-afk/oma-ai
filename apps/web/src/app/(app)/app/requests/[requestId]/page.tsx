'use client';
import { Button, DateField, Input, SelectField, TextArea } from '@oma/ui/controls';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { DemoGraph, DemoLocaleCopy } from '@oma/demo';
import { Dialog } from '../../../../../components/ui/dialog';
import { EntityLink } from '../../../../../components/ui/entity-link';
import { StatusChip } from '../../../../../components/ui/status-chip';
import { useToast } from '../../../../../components/ui/toast';
import { pickCopy } from '../../../../../lib/demo/use-demo-api';
import {
  getRequest,
  updateRequest,
  convertRequestToTask,
  toRequestRow,
  opsError,
  encodeRequestBrief,
  decodeRequestBrief,
  type RequestBriefPayload,
} from '../../../../../lib/ops-api';
import {
  addContentComment,
  contentApiError,
  deleteContentComment,
  getContentDetail,
  type ContentCommentDto,
} from '../../../../../lib/content-api';
import { formatCommentTime } from '../../../../../lib/calendar-today';
import {
  allowedNextStatuses,
  canConvertRequest,
  canTransitionApiRequestStatus,
  toApiRequestStatus,
  statusLabel,
  priorityLabel,
  canCloseRequest,
} from '../../../../../lib/request-workflow-ui';
import { OmaTopLoader } from '../../../../../components/ui/oma-top-loader';
import { listWorkspaceMembers, type WorkspaceMember } from '../../../../../lib/team-api';
import {
  briefCompleteness,
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
  FileTextOutlined,
} from '@ant-design/icons';

type Brief = DemoGraph['briefs'][number];
type LinkedTask = {
  id: string;
  status: string;
  title?: unknown;
  assignee?: string | null;
  dueAt?: string;
};
type RequestDetail = RequestRow & { brief: Brief | null; tasks?: LinkedTask[] };

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
  const isAr = locale.toLowerCase().startsWith('ar');
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
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [comments, setComments] = useState<ContentCommentDto[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);

  const load = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const detail = await getRequest(requestId);
      const data = toRequestRow(detail.data) as RequestDetail;
      data.conversionTaskIds = (detail.tasks ?? []).map((x) => x.id);
      data.tasks = (detail.tasks ?? []).map((task) => ({
        id: task.id,
        status: task.status,
        title: task.title,
        assignee:
          (task as { assignee_name?: string | null }).assignee_name ||
          (task.assignee_user_id ? 'Team member' : null),
        dueAt: task.due_at ? String(task.due_at).slice(0, 10) : '',
      })) as RequestDetail['tasks'];
      setRow(data);

      const decoded = decodeRequestBrief(detail.data.description);
      const empty = emptyCopy();
      const apiBrief = detail.data.brief;
      const copyOr = (
        api: { en?: string; ar?: string } | undefined,
        legacy: { en: string; ar: string } | undefined,
      ) => (api?.en?.trim() ? { en: api.en, ar: api.ar || api.en } : (legacy ?? empty));
      setBriefDraft({
        id: decoded || apiBrief ? 'server' : '',
        requestId,
        overview: decoded?.overview ?? empty,
        objective: copyOr(apiBrief?.objective, decoded?.objective),
        audience: copyOr(apiBrief?.audience, decoded?.audience),
        keyMessage: copyOr(apiBrief?.key_message, decoded?.keyMessage),
        deliverableType: decoded?.deliverableType ?? empty,
        channels: decoded?.channels ?? data.channels ?? [],
        formats: decoded?.formats ?? data.formats ?? [],
        tone: decoded?.tone ?? empty,
        mandatory: decoded?.mandatory ?? empty,
        cta: decoded?.cta ?? empty,
        references: [],
        doList: [],
        dontList: [],
        timelineNote: decoded?.timelineNote ?? empty,
        stakeholders: [],
        acceptance: decoded?.acceptance ?? empty,
        dueAt: data.dueAt,
        attachmentAssets: [],
        readiness: (decoded?.readiness as Brief['readiness']) || 'DRAFT',
      });
      setDirty(false);
      setError(null);
      setUnavailable(false);
      if (data.contentId) {
        try {
          const detail = await getContentDetail(data.contentId);
          setComments(detail.comments ?? []);
        } catch {
          setComments([]);
        }
      } else {
        setComments([]);
      }
    } catch (err) {
      setError(
        opsError(
          err,
          locale.toLowerCase().startsWith('ar') ? 'تعذّر تحميل الطلب' : 'Failed to load request',
        ),
      );
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [requestId, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    listWorkspaceMembers()
      .then((data) => {
        if (!cancelled) setMembers(data);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Production gate matches the API: objective, audience, and key message.
  // briefIsReady stays the fuller demo checklist and is not the convert lock.
  const ready = Boolean(
    briefDraft &&
    briefDraft.objective.en.trim() &&
    briefDraft.audience.en.trim() &&
    briefDraft.keyMessage.en.trim(),
  );

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
    if (!requestId || !briefDraft || !row) return;
    setSaving(true);
    try {
      const payload: RequestBriefPayload = {
        overview: briefDraft.overview,
        objective: briefDraft.objective,
        audience: briefDraft.audience,
        keyMessage: briefDraft.keyMessage,
        deliverableType: briefDraft.deliverableType,
        tone: briefDraft.tone,
        mandatory: briefDraft.mandatory,
        cta: briefDraft.cta,
        acceptance: briefDraft.acceptance,
        timelineNote: briefDraft.timelineNote,
        channels: briefDraft.channels,
        formats: briefDraft.formats,
        readiness: ready ? 'READY' : 'DRAFT',
      };
      const plain =
        (typeof briefDraft.overview === 'object' && briefDraft.overview?.en) ||
        (typeof briefDraft.objective === 'object' && briefDraft.objective?.en) ||
        '';
      const description = encodeRequestBrief(payload, String(plain || ''));
      const updated = await updateRequest(requestId, {
        description,
        channels: briefDraft.channels ?? [],
        formats: briefDraft.formats ?? [],
        brief: {
          objective: briefDraft.objective,
          audience: briefDraft.audience,
          keyMessage: briefDraft.keyMessage,
        },
      });
      setRow((prev) => ({ ...(prev || ({} as RequestDetail)), ...toRequestRow(updated) }));
      setBriefDraft((b) =>
        b ? { ...b, readiness: payload.readiness as Brief['readiness'], id: 'server' } : b,
      );
      setDirty(false);
      toast.push(
        locale.toLowerCase().startsWith('ar') ? 'تم حفظ الموجز' : 'Brief saved',
        'success',
      );
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function patchRequest(patch: Record<string, unknown>) {
    if (!requestId || !row) return;
    if (typeof patch.status === 'string') {
      if (!canTransitionApiRequestStatus(row.status, patch.status)) {
        toast.push(t('demo.requests.invalidTransition'), 'danger');
        return;
      }
      patch = { ...patch, status: toApiRequestStatus(patch.status) };
    }
    try {
      const body: Record<string, unknown> = { ...patch };
      if (body.status === undefined) delete body.status;
      if ('assignee' in body) {
        body.assigneeUserId = body.assignee || null;
        delete body.assignee;
      }
      if (typeof body.dueAt === 'string' && body.dueAt && !String(body.dueAt).includes('T')) {
        body.dueAt = `${body.dueAt}T12:00:00.000Z`;
      }
      const updated = await updateRequest(requestId, body);
      setRow((prev) => ({ ...(prev || ({} as RequestDetail)), ...toRequestRow(updated) }));
      toast.push(t('demo.requests.saved'), 'success');
    } catch (err) {
      toast.push(opsError(err, t('demo.unavailable')), 'danger');
    }
  }

  async function convert() {
    if (!requestId) return;
    if (row && !canConvertRequest(row.status)) {
      toast.push(
        isAr ? 'لا يمكن تحويل الطلب في الحالة الحالية' : 'Cannot convert request in current state',
        'danger',
      );
      return;
    }
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
          <Link
            href="/app/requests"
            className="oma-req-detail__back"
            data-testid="demo-request-back"
          >
            <ArrowLeftOutlined />
            <span>{t('demo.requests.back')}</span>
          </Link>
          {row ? (
            <div className="oma-req-detail__top-meta">
              <span className="oma-req-detail__top-id">{pickCopy(row.title, locale)}</span>
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
              disabled={!canCloseRequest(row.status)}
              onClick={() => setConfirmClose(true)}
            >
              {t('demo.requests.close')}
            </Button>
            <Button
              type="primary"
              data-testid="demo-request-convert"
              disabled={!ready || converting || !canConvertRequest(row.status)}
              onClick={() => void convert()}
            >
              {converting ? t('demo.create.creating') : t('demo.requests.convert')}
            </Button>
          </div>
        ) : null}
      </header>

      {loading ? <OmaTopLoader /> : null}
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
              <h1 className="oma-req-detail__title">
                <Input
                  key={row.id + '-title'}
                  defaultValue={safeCopy(row.title, locale)}
                  data-testid="demo-request-title-edit"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== safeCopy(row.title, locale)) {
                      void patchRequest({ title: { en: v, ar: v } });
                    }
                  }}
                />
              </h1>
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
                    value={toApiRequestStatus(row.status)}
                    data-testid="demo-request-status"
                    onChange={(e) => void patchRequest({ status: e.target.value })}
                  >
                    {allowedNextStatuses(row.status).map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s, isAr)}
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
                  {members.length > 0 ? (
                    <SelectField
                      value={(row as { assigneeId?: string | null }).assigneeId ?? ''}
                      data-testid="demo-request-assignee"
                      onChange={(e) =>
                        void patchRequest({
                          assignee: e.target.value || null,
                          status:
                            e.target.value && toApiRequestStatus(row.status) === 'OPEN'
                              ? 'ASSIGNED'
                              : undefined,
                        })
                      }
                    >
                      <option value="">{t('demo.requests.unassigned')}</option>
                      {members
                        .filter((m) => m.user?.id)
                        .map((m) => (
                          <option key={m.id} value={m.user!.id}>
                            {m.user?.name || m.user?.email || t('entity.type.member')}
                          </option>
                        ))}
                    </SelectField>
                  ) : (
                    <Input
                      defaultValue={(row as { assigneeId?: string | null }).assigneeId ?? ''}
                      data-testid="demo-request-assignee"
                      placeholder="User id"
                      onBlur={(e) => void patchRequest({ assignee: e.target.value.trim() || null })}
                    />
                  )}
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
                  <EntityLink
                    type="campaign"
                    id={row.campaignId}
                    href={`/app/campaigns/${row.campaignId}`}
                    className="oma-req-detail__link"
                    testId="demo-request-campaign-link"
                  />
                ) : (
                  <span className="oma-muted">{t('demo.requests.noCampaign')}</span>
                )}
                {row.contentId ? (
                  <EntityLink
                    type="content"
                    id={row.contentId}
                    href={`/app/content?item=${row.contentId}`}
                    className="oma-req-detail__link"
                    testId="demo-request-content-link"
                  />
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
                      {t('demo.brief.readiness')}: {briefDraft.readiness} ·{' '}
                      {briefCompleteness(briefDraft)}%
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

            <section
              className="oma-req-detail__card oma-req-detail__comments"
              data-testid="demo-request-comments"
            >
              <header className="oma-req-detail__card-head">
                <strong>{isAr ? 'التعليقات' : 'Comments'}</strong>
                <span className="oma-req-detail__meta">{comments.length}</span>
              </header>
              {row.contentId ? (
                <>
                  {comments.length === 0 ? (
                    <p className="oma-muted">
                      {isAr
                        ? 'لا تعليقات بعد. ابدأ المحادثة من هنا أو من بطاقة المحتوى.'
                        : 'No comments yet. Start the conversation here or from the content card.'}
                    </p>
                  ) : (
                    <div className="oma-comment-thread">
                      {comments.map((comment) => (
                        <article key={comment.id} className="oma-comment">
                          <span className="oma-plan-post__avatar">
                            {(comment.author_user_id || 'U').slice(0, 1).toUpperCase()}
                          </span>
                          <div className="oma-comment__body">
                            <div className="oma-comment-meta">
                              <strong>
                                {comment.author_user_id?.slice(0, 8) || (isAr ? 'أنت' : 'You')}
                              </strong>
                              <span className="oma-ltr">
                                {formatCommentTime(comment.at, locale)}
                              </span>
                            </div>
                            <p className="oma-comment-body">
                              {isAr
                                ? comment.body.ar || comment.body.en
                                : comment.body.en || comment.body.ar}
                            </p>
                            <button
                              type="button"
                              className="oma-comment-delete"
                              onClick={() => {
                                if (!row.contentId) return;
                                void deleteContentComment(row.contentId, comment.id)
                                  .then(() =>
                                    setComments((prev) =>
                                      prev.filter((item) => item.id !== comment.id),
                                    ),
                                  )
                                  .catch((err) =>
                                    toast.push(
                                      contentApiError(err, 'Comment delete failed'),
                                      'danger',
                                    ),
                                  );
                              }}
                            >
                              {isAr ? 'حذف' : 'Delete'}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  <div className="oma-plan-post__comment-box">
                    <textarea
                      className="oma-plan-post__comment-input"
                      rows={2}
                      value={commentDraft}
                      placeholder={isAr ? 'اكتب تعليقاً…' : 'Leave a comment…'}
                      onChange={(e) => setCommentDraft(e.target.value)}
                    />
                    <button
                      type="button"
                      className="oma-plan-post__comment-send"
                      disabled={!commentDraft.trim() || commentSaving}
                      onClick={() => {
                        if (!row.contentId || !commentDraft.trim()) return;
                        setCommentSaving(true);
                        void addContentComment(row.contentId, {
                          en: commentDraft.trim(),
                          ar: commentDraft.trim(),
                        })
                          .then((created) => {
                            setComments((prev) => [...prev, created]);
                            setCommentDraft('');
                          })
                          .catch((err) =>
                            toast.push(contentApiError(err, 'Comment failed'), 'danger'),
                          )
                          .finally(() => setCommentSaving(false));
                      }}
                    >
                      {isAr ? 'إرسال' : 'Send'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="oma-muted">
                  {isAr
                    ? 'اربط هذا الطلب بمحتوى لتفعيل تعليقات دورة الحياة.'
                    : 'Link this request to content to enable lifecycle comments.'}
                </p>
              )}
            </section>

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
                        {safeCopy(task.title, locale)}
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
                  <strong>{priorityLabel(row.priority, isAr)}</strong>
                </div>
              </div>
              <div className="oma-req-detail__side-row">
                <CheckOutlined />
                <div>
                  <span className="oma-req-detail__side-label">
                    {t('demo.requests.filter.status')}
                  </span>
                  <strong>{statusLabel(row.status, isAr)}</strong>
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
                void patchRequest({ status: 'CANCELLED' });
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
