import { ulid } from 'ulid';

export function createCorrelationId(existing?: string | null): string {
  if (existing && existing.trim().length > 0) return existing.trim();
  return ulid();
}
