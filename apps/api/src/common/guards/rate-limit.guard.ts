import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DomainError } from '@oma/domain';

const hits = new Map<string, { count: number; reset: number }>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const limit = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120);
    // 0 or negative disables the guard (used by deterministic e2e/cert suites).
    if (!Number.isFinite(limit) || limit <= 0) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ ip?: string; path: string }>();
    const key = `${req.ip ?? 'unknown'}:${req.path}`;
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
