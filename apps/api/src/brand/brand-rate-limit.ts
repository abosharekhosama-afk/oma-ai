/** Optional brand-specific rate limit hooks (website connect tightening). */

const websiteConnectHits = new Map<string, { count: number; resetAt: number }>();

export function checkWebsiteConnectRateLimit(tenantId: string, userId: string): boolean {
  const key = `${tenantId}:${userId}`;
  const now = Date.now();
  const windowMs = 60_000;
  const max = 10;
  const entry = websiteConnectHits.get(key);
  if (!entry || entry.resetAt < now) {
    websiteConnectHits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}
