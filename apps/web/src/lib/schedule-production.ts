import { resolveContentWorkflow, type ApprovalPolicy } from '@oma/demo';
import type { ContentRow } from './demo/stage3-campaigns';
import type { ScheduleRow } from './demo/stage6-schedule';

export function contentToScheduleRow(item: ContentRow, policy: ApprovalPolicy): ScheduleRow {
  const publishing = item as ContentRow & {
    socialPageId?: string | null;
    publishState?: string;
    publishError?: string | null;
    externalPostUrl?: string | null;
  };
  const workflow = resolveContentWorkflow(item, policy);
  const plannedAt = workflow.plannedAt || item.scheduledAt || '';
  const externalPublishingConnected = Boolean(publishing.socialPageId);
  let state: ScheduleRow['state'] = 'PLANNED';
  if (item.status === 'PUBLISHED_DEMO') state = 'PUBLISHED_SAMPLE';
  else if (workflow.scheduleState === 'SCHEDULED') state = 'SCHEDULED_PREVIEW';
  else if (workflow.scheduleBlocked) state = 'BLOCKED';
  else if (workflow.approvalState === 'APPROVED') state = 'READY';

  return {
    id: item.id,
    contentId: item.id,
    brandId: item.brandId,
    campaignId: item.campaignId || null,
    deliverableId: item.deliverableId,
    title: item.title,
    channels: item.channel ? [item.channel] : [],
    plannedAt,
    timezone: 'Asia/Dubai',
    caption: item.caption ?? { en: '', ar: '' },
    owner: item.assignee,
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
  };
}
