'use client';

import { Tag } from '@oma/ui/controls';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_BY_STATUS: Record<string, Tone> = {
  ACTIVE: 'success',
  DRAFT: 'neutral',
  ARCHIVED: 'neutral',
  QUEUED: 'info',
  RUNNING: 'info',
  CRAWLING: 'info',
  EXTRACTING: 'info',
  ANALYZING: 'info',
  SUCCEEDED: 'success',
  PARTIAL: 'warning',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  APPROVED: 'success',
  NEEDS_REVIEW: 'warning',
  REJECTED: 'danger',
  PENDING: 'warning',
  UPCOMING: 'info',
  NEEDS_ATTENTION: 'danger',
  COMPLETED: 'neutral',
  AWAITING_REVIEW: 'warning',
  CHANGES_REQUESTED: 'warning',
  IN_REVIEW: 'warning',
  SCHEDULED: 'info',
  SCHEDULED_PREVIEW: 'info',
  PLANNED: 'neutral',
  READY: 'success',
  BLOCKED: 'danger',
  PUBLISHED_DEMO: 'success',
  PUBLISHED_SAMPLE: 'success',
  OVERDUE: 'danger',
  NOT_CONNECTED: 'neutral',
  DEFERRED: 'neutral',
  MANUAL: 'info',
};

export function statusTone(status: string | null | undefined): Tone {
  if (!status) return 'neutral';
  return TONE_BY_STATUS[status] ?? 'neutral';
}

export function StatusChip({
  status,
  label,
  tone,
}: {
  status?: string | null;
  label?: string;
  tone?: Tone;
}) {
  const resolved = tone ?? statusTone(status);
  const text = label ?? status ?? '—';
  const color =
    resolved === 'success'
      ? 'success'
      : resolved === 'warning'
        ? 'warning'
        : resolved === 'danger'
          ? 'error'
          : resolved === 'info'
            ? 'processing'
            : 'default';
  return <Tag color={color}>{text}</Tag>;
}
