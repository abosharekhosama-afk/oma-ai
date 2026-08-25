export type OutboxStatus = 'PENDING' | 'PUBLISHED' | 'FAILED';

export function nextOutboxStatus(current: OutboxStatus, ok: boolean): OutboxStatus {
  if (current === 'PUBLISHED') return 'PUBLISHED';
  return ok ? 'PUBLISHED' : 'FAILED';
}
