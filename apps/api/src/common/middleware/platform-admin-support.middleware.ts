import { Injectable, NestMiddleware } from '@nestjs/common';
import { DomainError, isSuperAdmin } from '@oma/domain';
import type { NextFunction, Request, Response } from 'express';
import { isSupportOperator } from '../../platform/support-auth';
import { mergeSessionIntoOmaContext, resolveSessionFromRequest } from '../auth/session-context';

/**
 * Defense-in-depth for platform operator APIs. Controllers still apply AuthGuard + role guards.
 * Does not require an active tenant — operators act across tenants.
 */
@Injectable()
export class PlatformAdminSupportMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const path = req.path ?? req.url?.split('?')[0] ?? '';
    const isAdmin = path.startsWith('/api/v1/admin');
    const isSupport = path.startsWith('/api/v1/support');
    if (!isAdmin && !isSupport) {
      next();
      return;
    }
    try {
      const session = await resolveSessionFromRequest(req);
      mergeSessionIntoOmaContext(req, session);
      if (isAdmin && !isSuperAdmin(session.systemRole)) {
        throw new DomainError(
          'PERMISSION_DENIED',
          'Super admin role required',
          403,
          'errors.permission_denied',
        );
      }
      if (isSupport && !(await isSupportOperator(session.userId, session.systemRole))) {
        throw new DomainError(
          'PERMISSION_DENIED',
          'Support or super admin role required',
          403,
          'errors.permission_denied',
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  }
}
