'use client';

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
  return <span className={`oma-chip oma-chip-${resolved}`}>{text}</span>;
}
