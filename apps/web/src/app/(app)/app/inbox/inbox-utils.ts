import type { InboxConversationListItem } from '../../../../lib/inbox-api';

export type InboxPlatform = 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN' | string;

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

/** Brand colors for platform badges (Planable-style channel chips). */
export function platformAccent(platform: string): string {
  const map: Record<string, string> = {
    META_FB: '#1877F2',
    META_IG: '#E4405F',
    TIKTOK: '#111827',
    LINKEDIN: '#0A66C2',
  };
  return map[platform] ?? '#6b7280';
}

export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function isCommentType(type: string) {
  return type === 'POST_COMMENT' || type === 'DARK_COMMENT' || type === 'MENTION';
}

export type InboxPostMeta = {
  postThumbnailUrl?: string;
  postCaption?: string;
  channelName?: string;
  postPermalink?: string;
};

export function parseInboxPostMeta(metadataJson: string | null | undefined): InboxPostMeta {
  if (!metadataJson) return {};
  try {
    const v = JSON.parse(metadataJson) as Record<string, unknown>;
    return {
      postThumbnailUrl: typeof v.postThumbnailUrl === 'string' ? v.postThumbnailUrl : undefined,
      postCaption: typeof v.postCaption === 'string' ? v.postCaption : undefined,
      channelName: typeof v.channelName === 'string' ? v.channelName : undefined,
      postPermalink: typeof v.postPermalink === 'string' ? v.postPermalink : undefined,
    };
  } catch {
    return {};
  }
}

/** Stable demo thumbnail when no platform media is linked yet. */
export function inboxPostThumbnailUrl(conversationId: string, override?: string) {
  if (override) return override;
  return `https://picsum.photos/seed/${encodeURIComponent(conversationId)}/176/176`;
}

export function channelLine(
  item: Pick<InboxConversationListItem, 'platform' | 'subject'>,
  brandName: string,
  meta?: InboxPostMeta,
) {
  if (meta?.channelName) return meta.channelName;
  const page = brandName.trim() || 'Page';
  return `${page} · ${platformLabel(item.platform)}`;
}

export function postCaption(
  item: Pick<InboxConversationListItem, 'subject' | 'lastMessagePreview'>,
  meta?: InboxPostMeta,
) {
  if (meta?.postCaption) return meta.postCaption;
  if (item.subject) return item.subject;
  return item.lastMessagePreview || '';
}

export function sentimentLabel(s: string | null | undefined): string | null {
  if (s === 'POSITIVE') return 'Positive';
  if (s === 'NEGATIVE') return 'Negative';
  if (s === 'NEUTRAL') return 'Neutral';
  return null;
}

const AVATAR_PALETTE = ['#2563eb', '#7c3aed', '#be123c', '#0d9488', '#c2410c', '#4f46e5'];

export function avatarColorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!;
}

export function formatInboxPostDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function filterByStatusTab<T extends { status: string }>(
  items: T[],
  tab: 'OPEN' | 'PENDING' | 'CLOSED',
) {
  if (tab === 'OPEN') return items.filter((it) => it.status === 'OPEN' || it.status === 'UNREAD');
  if (tab === 'PENDING') return items.filter((it) => it.status === 'PENDING');
  return items.filter((it) => it.status === 'CLOSED');
}
