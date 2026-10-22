import { api } from './api';

export type AuditEvent = {
  id: string;
  occurredAt: string;
  actorUserId?: string | null;
  actorType?: string;
  tenantId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  beforeRef?: string | null;
  afterRef?: string | null;
};

export type ActivityItem = {
  id: string;
  at: string;
  action: string;
  category: 'members' | 'approvals' | 'content' | 'settings' | 'other';
  title: string;
  detail?: string;
  actor?: string;
  targetType?: string | null;
  targetId?: string | null;
};

function categorize(action: string): ActivityItem['category'] {
  const a = action.toLowerCase();
  if (a.includes('membership') || a.includes('invite') || a.includes('capability')) return 'members';
  if (a.includes('approv') || a.includes('review')) return 'approvals';
  if (a.includes('content') || a.includes('post') || a.includes('campaign') || a.includes('publish'))
    return 'content';
  if (a.includes('setting') || a.includes('preference') || a.includes('tenant')) return 'settings';
  return 'other';
}

function humanize(action: string): string {
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapAuditToActivity(e: AuditEvent): ActivityItem {
  return {
    id: e.id,
    at: e.occurredAt,
    action: e.action,
    category: categorize(e.action),
    title: humanize(e.action),
    detail: [e.targetType, e.targetId, e.afterRef].filter(Boolean).join(' · ') || undefined,
    actor: e.actorUserId || e.actorType || undefined,
    targetType: e.targetType,
    targetId: e.targetId,
  };
}

let cache: { at: number; data: { items: ActivityItem[]; next_cursor: string | null } } | null =
  null;
let inflight: Promise<{ items: ActivityItem[]; next_cursor: string | null }> | null = null;
const CACHE_MS = 10_000;

export async function listActivity(params?: {
  limit?: number;
  cursor?: string;
}): Promise<{ items: ActivityItem[]; next_cursor: string | null }> {
  // Only cache the first page without cursor
  const useCache = !params?.cursor;
  if (useCache && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }
  if (useCache && inflight) return inflight;

  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.cursor) qs.set('cursor', params.cursor);
  const q = qs.toString() ? `?${qs}` : '';

  const run = async () => {
    let res: { items: AuditEvent[]; next_cursor: string | null };
    try {
      res = await api(`/api/v1/audit-events/feed${q}`);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 429) throw err;
      // Only fall back when feed is missing / forbidden — not on rate limit
      if (status === 403 || status === 404) {
        res = await api(`/api/v1/audit-events${q}`);
      } else {
        throw err;
      }
    }
    const mapped = {
      items: (res.items || []).map(mapAuditToActivity),
      next_cursor: res.next_cursor ?? null,
    };
    if (useCache) cache = { at: Date.now(), data: mapped };
    return mapped;
  };

  if (useCache) {
    inflight = run().finally(() => {
      inflight = null;
    });
    return inflight;
  }
  return run();
}
