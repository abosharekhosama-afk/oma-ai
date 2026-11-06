import type { ListeningHit } from '../../../../lib/listening-api';

export type ListeningView = 'brand' | 'topic' | 'competitors' | 'alerts';

export function platformLabel(p: string) {
  const map: Record<string, string> = {
    META_FB: 'Facebook',
    META_IG: 'Instagram',
    TIKTOK: 'TikTok',
    LINKEDIN: 'LinkedIn',
  };
  return map[p] ?? p;
}

export function platformShort(p: string) {
  const map: Record<string, string> = {
    META_FB: 'FB',
    META_IG: 'IG',
    TIKTOK: 'TT',
    LINKEDIN: 'IN',
  };
  return map[p] ?? p.slice(0, 2);
}

export function hitEngagement(hit: ListeningHit) {
  const likes = hit.likeCount ?? 0;
  const comments = hit.commentCount ?? 0;
  const shares = hit.shareCount ?? 0;
  return { likes, comments, shares, total: likes + comments + shares };
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2).replace(/\.00$/, '')}K`;
  return String(n);
}

export function relativeDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function highlightKeywords(text: string, keywords: string[]) {
  if (!keywords.length) return [{ text, highlight: false }];
  const lowered = keywords.map((k) => k.toLowerCase());
  const parts: { text: string; highlight: boolean }[] = [];
  let rest = text;
  while (rest.length > 0) {
    let found: { index: number; len: number; kw: string } | null = null;
    for (const kw of lowered) {
      const idx = rest.toLowerCase().indexOf(kw);
      if (idx >= 0 && (found === null || idx < found.index)) {
        found = { index: idx, len: kw.length, kw: rest.slice(idx, idx + kw.length) };
      }
    }
    if (!found) {
      parts.push({ text: rest, highlight: false });
      break;
    }
    if (found.index > 0) parts.push({ text: rest.slice(0, found.index), highlight: false });
    parts.push({ text: found.kw, highlight: true });
    rest = rest.slice(found.index + found.len);
  }
  return parts;
}

export type DaySentiment = {
  key: string;
  label: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
};

function dayBucket(d: Date, hits: ListeningHit[]): DaySentiment {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const next = new Date(start);
  next.setDate(next.getDate() + 1);
  const key = start.toISOString().slice(0, 10);
  const label = start.toLocaleDateString(undefined, { weekday: 'short' });
  const dayHits = hits.filter((h) => {
    const t = new Date(h.capturedAt).getTime();
    return t >= start.getTime() && t < next.getTime();
  });
  const positive = dayHits.filter((h) => h.sentiment === 'POSITIVE').length;
  const neutral = dayHits.filter((h) => h.sentiment === 'NEUTRAL').length;
  const negative = dayHits.filter((h) => h.sentiment === 'NEGATIVE').length;
  return { key, label, positive, neutral, negative, total: dayHits.length };
}

export function volumeByDay(hits: ListeningHit[], days = 7): DaySentiment[] {
  const out: DaySentiment[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(dayBucket(d, hits));
  }
  return out;
}

export function volumeByDateRange(hits: ListeningHit[], start: Date, end: Date): DaySentiment[] {
  const out: DaySentiment[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (cur.getTime() <= endDay.getTime()) {
    out.push(dayBucket(cur, hits));
    cur.setDate(cur.getDate() + 1);
  }
  return out.length ? out : volumeByDay(hits, 7);
}

export function hitInDateRange(hit: ListeningHit, start: Date, end: Date) {
  const t = new Date(hit.capturedAt).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export function hitThumbnail(hit: ListeningHit) {
  if (hit.mediaUrls?.[0]) return hit.mediaUrls[0];
  if (hit.authorAvatar) return hit.authorAvatar;
  return `https://picsum.photos/seed/${encodeURIComponent(hit.id)}/144/144`;
}

export function isNewHit(hit: ListeningHit) {
  return Date.now() - new Date(hit.capturedAt).getTime() < 48 * 3600_000;
}

export function sentimentTotals(hits: ListeningHit[]) {
  const positive = hits.filter((h) => h.sentiment === 'POSITIVE').length;
  const neutral = hits.filter((h) => h.sentiment === 'NEUTRAL').length;
  const negative = hits.filter((h) => h.sentiment === 'NEGATIVE').length;
  const total = positive + neutral + negative || 1;
  return { positive, neutral, negative, total };
}

export function totalEngagement(hits: ListeningHit[]) {
  return hits.reduce((sum, h) => {
    const e = hitEngagement(h);
    return sum + e.likes + e.comments;
  }, 0);
}

export function exportHitsCsv(hits: ListeningHit[], filename = 'listening-mentions.csv') {
  const header = ['platform', 'author', 'handle', 'sentiment', 'content', 'capturedAt', 'url'];
  const rows = hits.map((h) =>
    [
      h.platform,
      h.authorName ?? '',
      h.authorHandle ?? '',
      h.sentiment ?? '',
      `"${h.content.replace(/"/g, '""')}"`,
      h.capturedAt,
      h.url ?? '',
    ].join(','),
  );
  const blob = new Blob([[header.join(','), ...rows].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
