import type { PublishInput } from '../social/adapter';

/** Ordered public URLs to send to a network (carousel / multi-photo). */
export function publishMediaUrls(post: PublishInput): string[] {
  const fromList = (post.mediaUrls ?? []).map((u) => u?.trim()).filter((u): u is string => Boolean(u));
  if (fromList.length) return fromList;
  const single = post.mediaUrl?.trim();
  return single ? [single] : [];
}
