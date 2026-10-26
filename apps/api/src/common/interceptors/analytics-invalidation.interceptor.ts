import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, concatMap, from, map } from 'rxjs';
import { analyticsCache } from '../../analytics/analytics-cache';

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Writes that cannot change analytics numbers (sessions, notifications, prefs of the UI). */
const IGNORE = /^\/api\/v1\/(auth|notifications|health)(\/|$)/;

/**
 * Any successful write in a tenant (content, approvals, comments, tasks, deliverables, …)
 * bumps that tenant's analytics cache generation. Coarse but always correct.
 */
@Injectable()
export class AnalyticsInvalidationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!WRITE.has(req.method) || IGNORE.test(req.path)) return next.handle();
    // Awaited before the response is sent, so a read right after a write never sees stale data.
    return next.handle().pipe(
      concatMap((body) => {
        const tenantId = req.oma?.tenantId;
        if (!tenantId) return from([body]);
        return from(analyticsCache.invalidateTenant(tenantId).catch(() => undefined)).pipe(
          map(() => body),
        );
      }),
    );
  }
}
