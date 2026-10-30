import { resolveContentWorkflow, type ApprovalPolicy } from '@oma/demo';
import type { ContentRow } from './demo/stage3-campaigns';
import type { ScheduleRow } from './demo/stage6-schedule';
import type { ContentRowExtra } from './content-api';

export type ScheduleRowExtras = {
  publishState?: string;
  publishError?: string | null;
  workerPickedAt?: string | null;
  publishSkipReason?: string | null;
  nextPublishAt?: string | null;
  publishedAt?: string | null;
  externalPostUrl?: string | null;
  campaignTitle?: { en: string; ar: string } | null;
};

export function contentToScheduleRow(
  item: ContentRow,
  policy: ApprovalPolicy,
  opts?: { timezone?: string; campaignTitle?: { en: string; ar: string } | null },
): ScheduleRow & ScheduleRowExtras {
  const publishing = item as ContentRowExtra;
  const workflow = resolveContentWorkflow(item, policy);
  const plannedAt = workflow.plannedAt || item.scheduledAt || '';
  const externalPublishingConnected = Boolean(publishing.socialPageId);
  let state: ScheduleRow['state'] = 'PLANNED';
  if (item.status === 'PUBLISHED_DEMO' || publishing.publishState === 'PUBLISHED')
    state = 'PUBLISHED_SAMPLE';
  else if (workflow.scheduleState === 'SCHEDULED') state = 'SCHEDULED_PREVIEW';
  else if (workflow.scheduleBlocked) state = 'BLOCKED';
  else if (workflow.approvalState === 'APPROVED') state = 'READY';

  const tz =
    (publishing.timezone && publishing.timezone.trim()) ||
    (opts?.timezone && opts.timezone.trim()) ||
    'Asia/Dubai';

  return {
    id: item.id,
    contentId: item.id,
    brandId: item.brandId,
    campaignId: item.campaignId || null,
    deliverableId: item.deliverableId,
    title: item.title,
    channels: item.channel ? [item.channel] : [],
    plannedAt,
    timezone: tz,
    caption: item.caption ?? { en: '', ar: '' },
    owner: item.assignee || '',
    track: item.track,
    readiness: [
      {
        check: { en: 'Caption ready', ar: 'التعليق جاهز' },
        ok: Boolean(item.caption?.en || item.caption?.ar),
        kind: 'content',
      },
      {
        check: { en: 'Approved for schedule', ar: 'معتمد للجدولة' },
        ok: !workflow.scheduleBlocked,
        kind: 'approval',
      },
      {
        check: { en: 'Channel selected', ar: 'تم اختيار القناة' },
        ok: Boolean(item.channel),
        kind: 'channel',
      },
      {
        check: { en: 'Publishing account connected', ar: 'حساب النشر متصل' },
        ok: externalPublishingConnected,
        kind: 'integration',
      },
    ],
    state,
    blockingReason: workflow.scheduleBlocked
      ? {
          en: 'Scheduling is blocked until content is fully approved',
          ar: 'الجدولة محظورة حتى اعتماد المنشور بالكامل',
        }
      : null,
    externalPublishingConnected,
    publishState: publishing.publishState ?? 'NONE',
    publishError: publishing.publishError ?? null,
    workerPickedAt: publishing.workerPickedAt ?? null,
    publishSkipReason: publishing.publishSkipReason ?? null,
    nextPublishAt: publishing.nextPublishAt ?? null,
    publishedAt: publishing.publishedAt ?? null,
    externalPostUrl: publishing.externalPostUrl ?? null,
    campaignTitle: opts?.campaignTitle ?? null,
  };
}
