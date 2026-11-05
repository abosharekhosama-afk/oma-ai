import { api } from './api';

export type ListeningRule = {
  id: string;
  name: string;
  workspaceId: string;
  brandId: string | null;
  keywords: string[];
  hashtags: string[];
  platforms: string[];
  isLive: boolean;
  contextJson?: string | null;
  lastPollAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListeningHit = {
  id: string;
  ruleId: string | null;
  platform: string;
  externalPostId: string;
  authorName: string | null;
  authorHandle: string | null;
  authorAvatar: string | null;
  content: string;
  url: string | null;
  mediaUrls: string[];
  sentiment: string | null;
  isHighPriority: boolean;
  isHidden: boolean;
  isExcluded: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  sentimentLocked?: boolean;
  matchedKeywords: string[];
  capturedAt: string;
};

export type ListeningStats = {
  from: string;
  to: string;
  mentions: number;
  mentionsTrendPct: number | null;
  engagement: number;
  engagementTrendPct: number | null;
  sentiment: { positive: number; neutral: number; negative: number; total: number };
  volume: Array<{
    key: string;
    label: string;
    positive: number;
    neutral: number;
    negative: number;
    total: number;
  }>;
  lastPollAt: string | null;
  nextPollAt: string;
};

export function listListeningRules(brandId?: string | null) {
  const q = brandId ? `?brandId=${encodeURIComponent(brandId)}` : '';
  return api<{ items: ListeningRule[] }>(`/api/v1/listening/rules${q}`);
}

export function createListeningRule(body: {
  name: string;
  keywords?: string[];
  hashtags?: string[];
  platforms?: string[];
  isLive?: boolean;
  brandId?: string | null;
}) {
  return api<{ id: string }>('/api/v1/listening/rules', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateListeningRule(
  id: string,
  body: Partial<{
    name: string;
    keywords: string[];
    hashtags: string[];
    platforms: string[];
    isLive: boolean;
    contextJson: string | null;
  }>,
) {
  return api(`/api/v1/listening/rules/${id}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getListeningStats(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const q = qs.toString();
  return api<ListeningStats>(`/api/v1/listening/stats${q ? `?${q}` : ''}`);
}

export function syncListening(body: { ruleId?: string; brandId?: string | null } = {}) {
  return api<{ queued: number; rules: number }>('/api/v1/listening/sync', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listListeningHits(params: Record<string, string | number | boolean | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || v === false) continue;
    qs.set(k, String(v));
  }
  const q = qs.toString();
  return api<{ page: number; limit: number; total: number; items: ListeningHit[] }>(
    `/api/v1/listening/hits${q ? `?${q}` : ''}`,
  );
}

export function patchListeningHit(
  id: string,
  body: {
    sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    isHidden?: boolean;
    isExcluded?: boolean;
  },
) {
  return api<ListeningHit>(`/api/v1/listening/hits/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
