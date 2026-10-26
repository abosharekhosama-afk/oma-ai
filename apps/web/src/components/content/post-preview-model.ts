/**
 * Pure model for Planable-style network previews: which network mock to render,
 * which layout (feed card vs. full-screen vertical) and the media aspect ratio.
 * Kept framework-free so it is unit-testable.
 */
export type PreviewNetwork = 'instagram' | 'facebook' | 'linkedin' | 'x' | 'tiktok' | 'generic';
export type PreviewContentType = 'REEL' | 'CAROUSEL' | 'STATIC' | 'STORY' | 'POST';
export type PreviewLayout = 'feed' | 'vertical';

export function resolveNetwork(channel: string | null | undefined): PreviewNetwork {
  const c = (channel || '').toLowerCase();
  if (c.includes('instagram') || c === 'ig') return 'instagram';
  if (c.includes('facebook') || c.includes('meta') || c === 'fb') return 'facebook';
  if (c.includes('linkedin') || c === 'li') return 'linkedin';
  if (c.includes('tiktok') || c === 'tt') return 'tiktok';
  if (c.includes('twitter') || c === 'x' || /(^|\W)x(\W|$)/.test(c)) return 'x';
  return 'generic';
}

/** Story / reel / TikTok posts render as a full-screen 9:16 frame. */
export function resolveLayout(network: PreviewNetwork, type: PreviewContentType): PreviewLayout {
  if (network === 'tiktok') return 'vertical';
  if ((network === 'instagram' || network === 'facebook') && (type === 'STORY' || type === 'REEL'))
    return 'vertical';
  return 'feed';
}

/** CSS `aspect-ratio` value for the post media. */
export function aspectRatioFor(network: PreviewNetwork, type: PreviewContentType): string {
  if (resolveLayout(network, type) === 'vertical') return '9 / 16';
  switch (network) {
    case 'instagram':
      return type === 'STATIC' ? '1 / 1' : '4 / 5';
    case 'facebook':
    case 'linkedin':
      return type === 'REEL' ? '16 / 9' : '1.91 / 1';
    case 'x':
      return '16 / 9';
    default:
      return '4 / 3';
  }
}

/** Characters shown before "see more" per network (approximate real truncation). */
export const CAPTION_LIMIT: Record<PreviewNetwork, number> = {
  instagram: 125,
  facebook: 240,
  linkedin: 210,
  x: 280,
  tiktok: 90,
  generic: 240,
};

export function splitCaption(text: string, limit: number): { visible: string; truncated: boolean } {
  const clean = (text || '').trim();
  if (clean.length <= limit) return { visible: clean, truncated: false };
  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return {
    visible: (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd(),
    truncated: true,
  };
}

/** Splits text into plain and hashtag/mention segments (Unicode-aware, Arabic safe). */
export function tokenizeCaption(text: string): Array<{ text: string; tag: boolean }> {
  const out: Array<{ text: string; tag: boolean }> = [];
  const re = /([#@][\p{L}\p{N}_]+)/gu;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), tag: false });
    out.push({ text: m[0], tag: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), tag: false });
  return out;
}

export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => Array.from(p)[0])
      .join('')
      .toUpperCase() || '·'
  );
}

/** Bundled sample poster art is not real post media: render the neutral placeholder instead. */
export function isPlaceholderAsset(url: string | null | undefined): boolean {
  return !url || /\/demo\/(poster-|video-poster|stage5-)/.test(url);
}
