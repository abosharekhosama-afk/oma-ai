import Redis from 'ioredis';

/**
 * Short-TTL cache for analytics responses.
 *
 * Key = tenant + generation + user + endpoint + normalised params. Every successful write
 * request in a tenant bumps that tenant's generation (see AnalyticsInvalidationInterceptor),
 * so stale entries are simply never read again and expire on their TTL. Tenant id is always
 * part of the key, so one tenant can never read another tenant's entry.
 *
 * Backend: Redis when REDIS_URL is configured (shared across API instances), otherwise —
 * or whenever Redis errors — an in-process LRU map.
 */
export const ANALYTICS_CACHE_TTL_S = 60;
const PREFIX = 'oma:analytics:v1';
const MAX_MEMORY_ENTRIES = 500;

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  incr(key: string): Promise<number>;
}

export class MemoryStore implements CacheStore {
  private map = new Map<string, { v: string; exp: number }>();
  constructor(private now: () => number = Date.now) {}
  async get(key: string) {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.exp <= this.now()) {
      this.map.delete(key);
      return null;
    }
    // LRU touch
    this.map.delete(key);
    this.map.set(key, e);
    return e.v;
  }
  async set(key: string, value: string, ttlSeconds: number) {
    this.map.delete(key);
    this.map.set(key, { v: value, exp: this.now() + ttlSeconds * 1000 });
    while (this.map.size > MAX_MEMORY_ENTRIES) this.map.delete(this.map.keys().next().value!);
  }
  async incr(key: string) {
    const cur = Number((await this.get(key)) ?? 0) + 1;
    await this.set(key, String(cur), 86400);
    return cur;
  }
  get size() {
    return this.map.size;
  }
}

class RedisStore implements CacheStore {
  constructor(private redis: Redis) {}
  async get(key: string) {
    return this.redis.get(key);
  }
  async set(key: string, value: string, ttlSeconds: number) {
    await this.redis.set(key, value, 'EX', ttlSeconds);
  }
  async incr(key: string) {
    const n = await this.redis.incr(key);
    await this.redis.expire(key, 86400);
    return n;
  }
}

/** Stable query-string for a params object (sorted keys, empty values dropped). */
export function normaliseParams(params: Record<string, string | undefined | null>): string {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]).trim())}`)
    .join('&');
}

export class AnalyticsCache {
  private memory: MemoryStore;
  constructor(
    private primary: CacheStore | null,
    now?: () => number,
  ) {
    this.memory = new MemoryStore(now);
  }

  private async run<T>(fn: (s: CacheStore) => Promise<T>): Promise<T> {
    if (this.primary) {
      try {
        return await fn(this.primary);
      } catch {
        // Redis unavailable: degrade to the in-process store rather than failing the request.
      }
    }
    return fn(this.memory);
  }

  private genKey(tenantId: string) {
    return `${PREFIX}:gen:${tenantId}`;
  }

  async key(scope: { tenantId: string; userId: string; name: string; params: string }) {
    const gen = await this.run((s) => s.get(this.genKey(scope.tenantId)));
    return `${PREFIX}:${scope.tenantId}:g${gen ?? 0}:${scope.userId}:${scope.name}:${scope.params}`;
  }

  async wrap<T>(
    scope: { tenantId: string; userId: string; name: string; params: string },
    compute: () => Promise<T>,
    ttlSeconds = ANALYTICS_CACHE_TTL_S,
  ): Promise<T> {
    if (!scope.tenantId || !scope.userId) return compute();
    const key = await this.key(scope);
    const hit = await this.run((s) => s.get(key));
    if (hit !== null) return JSON.parse(hit) as T;
    const value = await compute();
    await this.run((s) => s.set(key, JSON.stringify(value), ttlSeconds));
    return value;
  }

  /** Invalidate everything cached for a tenant (all brands, users and params). */
  async invalidateTenant(tenantId: string) {
    if (!tenantId) return;
    await this.run((s) => s.incr(this.genKey(tenantId)));
    // Keep the fallback in step too, in case Redis drops out between requests.
    if (this.primary) await this.memory.incr(this.genKey(tenantId));
  }
}

function createDefault(): AnalyticsCache {
  const url = process.env.REDIS_URL;
  if (!url || process.env.ANALYTICS_CACHE === 'memory') return new AnalyticsCache(null);
  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  redis.on('error', () => undefined);
  void redis.connect().catch(() => undefined);
  return new AnalyticsCache(new RedisStore(redis));
}

export const analyticsCache = createDefault();
