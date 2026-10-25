'use client';
import { useT } from '../../lib/use-locale';

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

/** Localized label for a raw status enum (never shows ACTIVE / NEEDS_REVIEW to users). */
export function statusLabel(t: (k: string) => string, status?: string | null): string {
  if (!status) return '—';
  const key = `status.enum.${String(status).toUpperCase()}`;
  const v = t(key);
  if (v && v !== key) return v;
  const words = String(status).replace(/[_.-]+/g, ' ').toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
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
  const t = useT();
  const resolved = tone ?? statusTone(status);
  const text = label ?? statusLabel(t, status);
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
