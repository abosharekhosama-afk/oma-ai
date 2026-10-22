import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DomainError } from '@oma/domain';

const hits = new Map<string, { count: number; reset: number }>();

/** Normalize path so /members and /memberships share one bucket (read endpoints). */
function normalizePath(path: string): string {
  if (!path) return path;
  return path
    .replace(/\/tenants\/current\/memberships\/?$/, '/tenants/current/members')
    .replace(/\/tenants\/current\/members\/?$/, '/tenants/current/members');
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Default raised from 120 → 300 for SPA shells that mount multiple org surfaces.
    const limit = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 300);
    // 0 or negative disables the guard (used by deterministic e2e/cert suites).
    if (!Number.isFinite(limit) || limit <= 0) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{
      ip?: string;
      path: string;
      method?: string;
    }>();
    const pathKey = normalizePath(req.path);
    const key = `${req.ip ?? 'unknown'}:${req.method ?? 'GET'}:${pathKey}`;
    const now = Date.now();
    const windowMs = 60_000;
    const cur = hits.get(key);
    if (!cur || cur.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return true;
    }
    cur.count += 1;
    if (cur.count > limit) {
      throw new DomainError('RATE_LIMITED', 'Too many requests', 429, 'errors.rate_limited');
    }
    return true;
  }
}
