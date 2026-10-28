import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DomainError } from '@oma/domain';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';

type WindowEntry = { count: number; reset: number };
type RateLimitRequest = {
  ip?: string;
  path: string;
  baseUrl?: string;
  method?: string;
  route?: { path?: string | string[] };
  body?: { email?: unknown };
};

const MAX_MEMORY_BUCKETS = 50_000;
const PRUNE_EVERY = 256;
const memoryHits = new Map<string, WindowEntry>();
let requestCount = 0;
let rateLimitRedis: Redis | null = null;
let redisRetryAfter = 0;
let fallbackWarningLogged = false;
const REDIS_WINDOW_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
  return { count, redis.call('PTTL', KEYS[1]) }
`;

/** Collapse known and generic identifier path parts to prevent arbitrary URL bucket growth. */
function normalizePath(path: string): string {
  if (!path) return '/';
  return path
    .replace(/\/tenants\/current\/memberships\/?$/, '/tenants/current/members')
    .replace(/\/tenants\/current\/members\/?$/, '/tenants/current/members')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id')
    .replace(/\/[0-9]{2,}(?=\/|$)/g, '/:id');
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL || process.env.RATE_LIMIT_STORAGE === 'memory') return null;
  if (!rateLimitRedis) {
    rateLimitRedis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 1_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    rateLimitRedis.on('error', () => undefined);
  }
  return rateLimitRedis;
}

function pruneMemory(now: number) {
  for (const [key, entry] of memoryHits) {
    if (entry.reset <= now) memoryHits.delete(key);
  }
  while (memoryHits.size > MAX_MEMORY_BUCKETS) {
    const oldest = memoryHits.keys().next().value as string | undefined;
    if (!oldest) break;
    memoryHits.delete(oldest);
  }
}

function memoryHit(key: string, limit: number, windowMs: number, now: number): number {
  requestCount += 1;
  if (requestCount % PRUNE_EVERY === 0 || memoryHits.size >= MAX_MEMORY_BUCKETS) pruneMemory(now);
  const entry = memoryHits.get(key);
  if (!entry || entry.reset <= now) {
    if (memoryHits.size >= MAX_MEMORY_BUCKETS) {
      const oldest = memoryHits.keys().next().value as string | undefined;
      if (oldest) memoryHits.delete(oldest);
    }
    memoryHits.set(key, { count: 1, reset: now + windowMs });
    return windowMs;
  }
  entry.count += 1;
  return Math.max(1, entry.reset - now);
}

async function distributedHit(
  key: string,
  windowMs: number,
  now: number,
): Promise<{ count: number; retryMs: number } | null> {
  const redis = getRedis();
  if (!redis || now < redisRetryAfter) return null;
  try {
    if (redis.status === 'wait') await redis.connect();
    const result = (await redis.eval(
      REDIS_WINDOW_SCRIPT,
      1,
      `oma:rate-limit:${digest(key)}`,
      String(windowMs),
    )) as [number | string, number | string];
    return { count: Number(result[0]), retryMs: Math.max(1, Number(result[1])) };
  } catch {
    redisRetryAfter = now + 30_000;
    if (!fallbackWarningLogged) {
      fallbackWarningLogged = true;
      console.warn('Rate limiter using bounded process-memory fallback; Redis is unavailable.');
    }
    return null;
  }
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rawLimit = process.env.RATE_LIMIT_PER_MINUTE;
    const configuredLimit = rawLimit === undefined ? 300 : Number(rawLimit);
    // Explicit zero remains available for deterministic test/e2e suites only.
    if (configuredLimit === 0 && process.env.NODE_ENV === 'test') return true;
    const globalLimit =
      Number.isFinite(configuredLimit) && configuredLimit > 0 ? Math.floor(configuredLimit) : 300;

    const req = context.switchToHttp().getRequest<RateLimitRequest>();
    const res = context
      .switchToHttp()
      .getResponse<{ setHeader?: (name: string, value: string) => void }>();
    const routePath = Array.isArray(req.route?.path) ? req.route?.path[0] : req.route?.path;
    const path = normalizePath(routePath ? `${req.baseUrl ?? ''}${routePath}` : req.path);
    const method = (req.method ?? 'GET').toUpperCase();
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    const budgets: Array<{ key: string; limit: number; windowMs: number }> = [
      { key: `global:${ip}:${method}:${path}`, limit: globalLimit, windowMs: 60_000 },
    ];

    if (method === 'POST' && path.endsWith('/auth/login')) {
      budgets.push({ key: `auth-login-ip:${ip}`, limit: 10, windowMs: 60_000 });
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (email && email.length <= 320) {
        budgets.push({ key: `auth-login-email:${digest(email)}`, limit: 5, windowMs: 15 * 60_000 });
      }
    } else if (method === 'POST' && path.endsWith('/auth/register')) {
      budgets.push({ key: `auth-register-ip:${ip}`, limit: 5, windowMs: 60_000 });
    } else if (method === 'POST' && path.endsWith('/auth/recovery/request')) {
      budgets.push({ key: `recovery-request-ip:${ip}`, limit: 5, windowMs: 60_000 });
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (email && email.length <= 320) {
        budgets.push({
          key: `recovery-request-email:${digest(email)}`,
          limit: 3,
          windowMs: 60 * 60_000,
        });
      }
    } else if (method === 'POST' && path.endsWith('/auth/recovery/confirm')) {
      budgets.push({ key: `recovery-confirm-ip:${ip}`, limit: 10, windowMs: 60_000 });
    }

    for (const budget of budgets) {
      const distributed = await distributedHit(budget.key, budget.windowMs, now);
      const retryMs = distributed
        ? distributed.retryMs
        : memoryHit(budget.key, budget.limit, budget.windowMs, now);
      const count = distributed?.count;
      if ((count ?? memoryHits.get(budget.key)?.count ?? 0) > budget.limit) {
        res?.setHeader?.('Retry-After', String(Math.max(1, Math.ceil(retryMs / 1000))));
        throw new DomainError('RATE_LIMITED', 'Too many requests', 429, 'errors.rate_limited');
      }
    }
    return true;
  }
}
