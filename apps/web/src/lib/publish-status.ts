import { humanizePublishError } from './publish-errors';

export type PublishTimelineStep = {
  key: 'scheduled' | 'queued' | 'picked' | 'published' | 'failed' | 'retrying' | 'skipped';
  done: boolean;
  current: boolean;
  at?: string | null;
  detail?: string | null;
};

export type PublishStatusView = {
  stateLabelKey: string;
  steps: PublishTimelineStep[];
  errorHuman?: string | null;
  externalUrl?: string | null;
};

type Source = {
  scheduleState?: string;
  scheduledAt?: string | null;
  plannedAt?: string | null;
  publishState?: string | null;
  publishError?: string | null;
  workerPickedAt?: string | null;
  publishSkipReason?: string | null;
  nextPublishAt?: string | null;
  publishedAt?: string | null;
  externalPostUrl?: string | null;
  socialPageId?: string | null;
};

export function buildPublishStatusView(
  item: Source,
  locale: 'en' | 'ar',
): PublishStatusView | null {
  const scheduled = item.scheduleState === 'SCHEDULED';
  const rawState = (item.publishState || 'NONE').toUpperCase();
  const state =
    rawState === 'ALL_SUCCEEDED'
      ? 'PUBLISHED'
      : rawState === 'IN_PROGRESS'
        ? 'QUEUED'
        : rawState;
  if (
    !scheduled &&
    state !== 'PUBLISHED' &&
    state !== 'FAILED' &&
    rawState !== 'PARTIAL'
  ) {
    return null;
  }
  const when = item.scheduledAt || item.plannedAt || null;
  const humanErr = item.publishError
    ? humanizePublishError(item.publishError, locale)
    : item.publishSkipReason
      ? humanizePublishError(item.publishSkipReason, locale)
      : null;

  const steps: PublishTimelineStep[] = [
    {
      key: 'scheduled',
      done:
        scheduled ||
        state === 'PUBLISHED' ||
        state === 'FAILED' ||
        state === 'QUEUED' ||
        state === 'PUBLISHING',
      current: scheduled && state === 'NONE' && !item.publishSkipReason,
      at: when,
    },
    {
      key: 'queued',
      done: ['QUEUED', 'PUBLISHING', 'PUBLISHED', 'FAILED'].includes(state),
      current: state === 'QUEUED' && !item.nextPublishAt,
      at: state === 'QUEUED' ? when : null,
    },
    {
      key: 'picked',
      done:
        Boolean(item.workerPickedAt) ||
        state === 'PUBLISHING' ||
        state === 'PUBLISHED' ||
        state === 'FAILED',
      current: state === 'PUBLISHING',
      at: item.workerPickedAt,
    },
  ];

  if (state === 'QUEUED' && item.nextPublishAt) {
    steps.push({
      key: 'retrying',
      done: false,
      current: true,
      at: item.nextPublishAt,
      detail: humanErr,
    });
  } else if (state === 'PUBLISHED') {
    steps.push({
      key: 'published',
      done: true,
      current: true,
      at: item.publishedAt,
      detail: item.externalPostUrl,
    });
  } else if (state === 'FAILED' || item.publishSkipReason) {
    steps.push({
      key: item.publishSkipReason && state !== 'FAILED' ? 'skipped' : 'failed',
      done: true,
      current: true,
      at: item.workerPickedAt || when,
      detail: humanErr,
    });
  }

  let stateLabelKey = 'demo.schedule.publishState.scheduled';
  if (state === 'PUBLISHED') stateLabelKey = 'demo.schedule.publishState.published';
  else if (rawState === 'PARTIAL') stateLabelKey = 'demo.schedule.publishState.failed';
  else if (state === 'FAILED') stateLabelKey = 'demo.schedule.publishState.failed';
  else if (state === 'PUBLISHING') stateLabelKey = 'demo.schedule.publishState.publishing';
  else if (state === 'QUEUED' && item.nextPublishAt)
    stateLabelKey = 'demo.schedule.publishState.retrying';
  else if (state === 'QUEUED') stateLabelKey = 'demo.schedule.publishState.queued';
  else if (item.publishSkipReason) stateLabelKey = 'demo.schedule.publishState.waitingApproval';
  else if (!item.socialPageId) stateLabelKey = 'demo.schedule.publishState.noAccount';

  return {
    stateLabelKey,
    steps,
    errorHuman: humanErr,
    externalUrl: item.externalPostUrl ?? null,
  };
}

/** Format an ISO timestamp in a given IANA timezone for display. */
export function formatScheduleWhen(
  iso: string | null | undefined,
  timeZone: string,
  locale: string,
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale.startsWith('ar') ? 'ar' : 'en', {
      timeZone: timeZone || 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return iso;
  }
}
