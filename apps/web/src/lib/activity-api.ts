import { api } from './api';

export type ActivityItem = {
  id: string;
  at: string;
  action: string;
  category: 'members' | 'approvals' | 'content' | 'settings' | 'other';
  title: string;
  summary: string;
  actor_name: string;
  actor_email?: string | null;
};

let cache: { at: number; data: { items: ActivityItem[]; next_cursor: string | null } } | null =
  null;
let inflight: Promise<{ items: ActivityItem[]; next_cursor: string | null }> | null = null;
const CACHE_MS = 12_000;

export async function listActivity(params?: {
  limit?: number;
  cursor?: string;
}): Promise<{ items: ActivityItem[]; next_cursor: string | null }> {
  const useCache = !params?.cursor;
  if (useCache && cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (useCache && inflight) return inflight;

  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.cursor) qs.set('cursor', params.cursor);
  const q = qs.toString() ? `?${qs}` : '';

  const run = async () => {
    // Prefer human-readable endpoint
    try {
      const res = await api<{ items: ActivityItem[]; next_cursor: string | null }>(
        `/api/v1/audit-events/activity${q}`,
      );
      const mapped = {
        items: res.items || [],
        next_cursor: res.next_cursor ?? null,
      };
      if (useCache) cache = { at: Date.now(), data: mapped };
      return mapped;
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 429) throw err;
      // Fallback: feed then minimal client map (still hide raw IDs as best-effort)
      const res = await api<{
        items: Array<{
          id: string;
          occurredAt: string;
          action: string;
          actorUserId?: string | null;
          actorType?: string;
          targetType?: string | null;
          afterRef?: string | null;
        }>;
        next_cursor: string | null;
      }>(`/api/v1/audit-events/feed${q}`);
      const mapped = {
        items: (res.items || []).map((e) => ({
          id: e.id,
          at: e.occurredAt,
          action: e.action,
          category: 'other' as const,
          title: e.action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          summary: e.targetType ? `${e.action} · ${e.targetType}` : e.action,
          actor_name: e.actorType === 'SYSTEM' ? 'System' : 'A teammate',
          actor_email: null,
        })),
        next_cursor: res.next_cursor ?? null,
      };
      if (useCache) cache = { at: Date.now(), data: mapped };
      return mapped;
    }
  };

  if (useCache) {
    inflight = run().finally(() => {
      inflight = null;
    });
    return inflight;
  }
  return run();
}
