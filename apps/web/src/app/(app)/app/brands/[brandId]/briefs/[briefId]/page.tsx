'use client';

import { Button, Input, Tag, TextArea } from '@oma/ui/controls';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BrandPlxPageHead } from '../../../../../../../components/brand/brand-plx-section';
import { BrandWorkspaceShell } from '../../../../../../../components/brand/brand-workspace-shell';
import { PermissionDenied } from '../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../components/shell/select-company';
import { ErrorState } from '../../../../../../../components/ui/empty-state';
import { DetailShimmer } from '../../../../../../../components/ui/shimmer';
import { api } from '../../../../../../../lib/api';
import {
  getApiError,
  isPermissionDenied,
  isTenantRequired,
} from '../../../../../../../lib/brand-api';
import { formatBrandDateTime } from '../../../../../../../lib/brand-format';
import type { BrandDetail } from '../../../../../../../lib/brand-types';
import {
  BRIEF_STATUS_TONE,
  briefAction,
  briefActionButtons,
  commentOnBrief,
  getBrief,
  newDeliverable,
  updateBrief,
  type BriefAction,
  type BriefContent,
  type BriefDetail,
} from '../../../../../../../lib/brief-api';
import { useLocale, useT } from '../../../../../../../lib/use-locale';

type TextField = Exclude<
  keyof BriefContent,
  'channels' | 'mandatories' | 'references' | 'deliverables' | 'due_at' | 'pillar_key'
>;

const PAIRS: Array<{ label: string; en: TextField; ar: TextField }> = [
  { label: 'briefs.field.objective', en: 'objective_en', ar: 'objective_ar' },
  { label: 'briefs.field.audience', en: 'audience_en', ar: 'audience_ar' },
  { label: 'briefs.field.keyMessage', en: 'key_message_en', ar: 'key_message_ar' },
  { label: 'briefs.field.cta', en: 'cta_en', ar: 'cta_ar' },
];

export default function BriefDetailPage() {
  const t = useT();
  const locale = useLocale();
  const { brandId, briefId } = useParams<{ brandId: string; briefId: string }>();
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [brief, setBrief] = useState<BriefDetail | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<BriefContent | null>(null);
  const [comment, setComment] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  const hydrate = useCallback((data: BriefDetail) => {
    setBrief(data);
    setTitle(data.title);
    setContent(data.current_version?.content ?? null);
  }, []);

  const load = useCallback(async () => {
    try {
      const [brandRes, briefRes] = await Promise.all([
        api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`),
        getBrief(brandId, briefId),
      ]);
      setBrand(brandRes.data);
      hydrate(briefRes.data);
    } catch (err) {
      if (isTenantRequired(err)) setTenantRequired(true);
      else if (isPermissionDenied(err)) setDenied(true);
      else setStatus({ kind: 'error', text: getApiError(err).message });
    }
  }, [brandId, briefId, hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<{ data: BriefDetail }>, message: string) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fn();
      hydrate(res.data);
      setStatus({ kind: 'saved', text: message });
    } catch (err) {
      setStatus({ kind: 'error', text: getApiError(err).message });
    } finally {
      setBusy(false);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (!brand || !brief || !content) {
    return status?.kind === 'error' ? (
      <ErrorState title={t('common.error')} body={status.text} />
    ) : (
      <DetailShimmer />
    );
  }

  const editable = brief.allowed_actions.includes('edit');
  const setField = (key: TextField, value: string) => setContent({ ...content, [key]: value });
  const actions = briefActionButtons(brief.allowed_actions);

  async function onAction(action: Exclude<BriefAction, 'edit'>) {
    if (!brief) return;
    if (action === 'request_changes' && !decisionNote.trim()) {
      setStatus({ kind: 'error', text: t('briefs.action.commentRequired') });
      return;
    }
    await run(
      () =>
        briefAction(brandId, brief.id, action, {
          row_version: brief.row_version,
          ...(decisionNote.trim() ? { comment: decisionNote.trim() } : {}),
        }),
      t(`briefs.action.done.${action}`),
    );
    setDecisionNote('');
  }

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <BrandPlxPageHead
        title={brief.title}
        description={t('briefs.detail.version').replace(
          '{n}',
          String(brief.current_version?.version_no ?? 1),
        )}
        actions={
          <Link href={`/app/brands/${brandId}/briefs`} className="oma-text-link">
            {t('briefs.back')}
          </Link>
        }
      />
      <div className="oma-plan-toolbar">
        <Tag color={BRIEF_STATUS_TONE[brief.status]} data-testid="brief-status">
          {t(`briefs.status.${brief.status}`)}
        </Tag>
        {brief.origin === 'strategy' ? <Tag>{t('briefs.origin.strategy')}</Tag> : null}
        {!brief.readiness.ready && editable ? (
          <span className="oma-badge oma-badge-warning">
            {t('briefs.readiness.missing')}:{' '}
            {brief.readiness.missing.map((m) => t(`briefs.readiness.${m}`)).join('، ')}
          </span>
        ) : null}
      </div>

      <div className="oma-brief-layout">
        <section className="oma-panel oma-sectioned-form" data-testid="brief-editor">
          <label>
            {t('briefs.field.title')}
            <Input value={title} disabled={!editable} onChange={(e) => setTitle(e.target.value)} />
          </label>
          {PAIRS.map((pair) => (
            <div key={pair.en} className="oma-form-grid">
              <label>
                {t(pair.label)} (EN)
                <TextArea
                  autoSize
                  dir="ltr"
                  value={content[pair.en]}
                  disabled={!editable}
                  onChange={(e) => setField(pair.en, e.target.value)}
                />
              </label>
              <label>
                {t(pair.label)} (AR)
                <TextArea
                  autoSize
                  dir="rtl"
                  value={content[pair.ar]}
                  disabled={!editable}
                  onChange={(e) => setField(pair.ar, e.target.value)}
                />
              </label>
            </div>
          ))}
          <label>
            {t('briefs.field.channels')}
            <Input
              value={content.channels.join(', ')}
              disabled={!editable}
              onChange={(e) =>
                setContent({
                  ...content,
                  channels: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>

          <h3>{t('briefs.field.deliverables')}</h3>
          {content.deliverables.map((d, i) => {
            const update = (patch: Partial<typeof d>) => {
              const next = [...content.deliverables];
              next[i] = { ...d, ...patch };
              setContent({ ...content, deliverables: next });
            };
            return (
              <div
                key={`${d.key}-${i}`}
                className="oma-brief-deliverable"
                data-testid="brief-deliverable"
              >
                <Input
                  aria-label={t('briefs.deliverable.titleEn')}
                  placeholder={t('briefs.deliverable.titleEn')}
                  value={d.title_en}
                  disabled={!editable}
                  onChange={(e) => update({ title_en: e.target.value })}
                />
                <Input
                  dir="rtl"
                  aria-label={t('briefs.deliverable.titleAr')}
                  placeholder={t('briefs.deliverable.titleAr')}
                  value={d.title_ar}
                  disabled={!editable}
                  onChange={(e) => update({ title_ar: e.target.value })}
                />
                <Input
                  aria-label={t('briefs.deliverable.format')}
                  placeholder={t('briefs.deliverable.format')}
                  value={d.format}
                  disabled={!editable}
                  onChange={(e) => update({ format: e.target.value })}
                />
                <Input
                  aria-label={t('briefs.deliverable.channel')}
                  placeholder={t('briefs.deliverable.channel')}
                  value={d.channel}
                  disabled={!editable}
                  onChange={(e) => update({ channel: e.target.value })}
                />
                {editable ? (
                  <Button
                    type="text"
                    onClick={() =>
                      setContent({
                        ...content,
                        deliverables: content.deliverables.filter((_, j) => j !== i),
                      })
                    }
                  >
                    {t('strategy.plan.remove')}
                  </Button>
                ) : null}
              </div>
            );
          })}
          {editable ? (
            <div className="oma-plan-toolbar">
              <Button
                onClick={() => {
                  const used = new Set(content.deliverables.map((d) => d.key));
                  let n = content.deliverables.length;
                  while (used.has(newDeliverable(n).key)) n += 1;
                  setContent({
                    ...content,
                    deliverables: [...content.deliverables, newDeliverable(n)],
                  });
                }}
              >
                {t('briefs.deliverable.add')}
              </Button>
              <Button
                type="primary"
                disabled={busy}
                data-testid="brief-save"
                onClick={() =>
                  void run(
                    () =>
                      updateBrief(brandId, brief.id, {
                        row_version: brief.row_version,
                        title,
                        content,
                      }),
                    t('strategy.saved'),
                  )
                }
              >
                {t('briefs.save')}
              </Button>
            </div>
          ) : (
            <p className="oma-muted">{t('briefs.locked')}</p>
          )}
        </section>

        <aside className="oma-panel oma-sectioned-form" aria-label={t('briefs.review.title')}>
          <h3>{t('briefs.review.title')}</h3>
          {actions.length ? (
            <>
              <TextArea
                autoSize
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder={t('briefs.review.notePlaceholder')}
                aria-label={t('briefs.review.notePlaceholder')}
              />
              <div className="oma-plan-toolbar">
                {actions.map((action) => (
                  <Button
                    key={action}
                    type={
                      action === 'approve' || action === 'submit' || action === 'convert'
                        ? 'primary'
                        : 'default'
                    }
                    danger={action === 'cancel'}
                    disabled={busy}
                    onClick={() => void onAction(action)}
                    data-testid={`brief-action-${action}`}
                  >
                    {t(`briefs.action.${action}`)}
                  </Button>
                ))}
              </div>
              <p className="oma-muted">{t('briefs.review.humanOnly')}</p>
            </>
          ) : null}
          {status ? (
            <p
              className="oma-save-status"
              data-state={status.kind}
              role={status.kind === 'error' ? 'alert' : 'status'}
            >
              {status.text}
            </p>
          ) : null}

          <h3>{t('briefs.timeline')}</h3>
          <ol className="oma-brief-timeline" data-testid="brief-timeline">
            {brief.decisions.map((d) => (
              <li key={d.id}>
                <strong>{t(`briefs.decision.${d.kind}`)}</strong>{' '}
                <time dateTime={d.created_at} suppressHydrationWarning className="oma-muted">
                  {formatBrandDateTime(d.created_at, locale)}
                </time>
                {d.self_approval ? (
                  <Tag color="gold">{t('briefs.decision.selfApproval')}</Tag>
                ) : null}
                {d.comment ? <p dir="auto">{d.comment}</p> : null}
              </li>
            ))}
          </ol>

          {brief.tasks.length ? (
            <>
              <h3>{t('briefs.tasks')}</h3>
              <ul>
                {brief.tasks.map((task) => (
                  <li key={task.id}>
                    {locale === 'ar' ? task.title_ar : task.title_en} · {task.status}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h3>{t('briefs.comments')}</h3>
          <ul className="oma-brief-timeline">
            {brief.comments.map((c) => (
              <li key={c.id}>
                <p dir="auto">{c.body}</p>
                <time dateTime={c.created_at} suppressHydrationWarning className="oma-muted">
                  {formatBrandDateTime(c.created_at, locale)}
                </time>
              </li>
            ))}
          </ul>
          <TextArea
            autoSize
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            aria-label={t('briefs.comment.placeholder')}
            placeholder={t('briefs.comment.placeholder')}
          />
          <Button
            disabled={busy || !comment.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await commentOnBrief(brandId, brief.id, comment.trim());
                setComment('');
                const res = await getBrief(brandId, brief.id);
                hydrate(res.data);
              } catch (err) {
                setStatus({ kind: 'error', text: getApiError(err).message });
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('briefs.comment.submit')}
          </Button>
        </aside>
      </div>
    </BrandWorkspaceShell>
  );
}
