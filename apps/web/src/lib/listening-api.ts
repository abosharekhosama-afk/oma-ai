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
  matchedKeywords: string[];
  capturedAt: string;
};

export function listListeningRules() {
  return api<{ items: ListeningRule[] }>('/api/v1/listening/rules');
}

export function createListeningRule(body: {
  name: string;
  keywords?: string[];
  hashtags?: string[];
  platforms?: string[];
  isLive?: boolean;
}) {
  return api<{ id: string }>('/api/v1/listening/rules', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listListeningHits(params: Record<string, string | number | boolean | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== false) qs.set(k, String(v));
  }
  const q = qs.toString();
  return api<{ page: number; limit: number; total: number; items: ListeningHit[] }>(
    `/api/v1/listening/hits${q ? `?${q}` : ''}`,
  );
}
