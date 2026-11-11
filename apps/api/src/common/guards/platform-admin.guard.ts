import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DomainError, isSuperAdmin } from '@oma/domain';
import type { Request } from 'express';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const role = req.oma?.systemRole;
    if (!req.oma?.userId) {
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    }
    if (!isSuperAdmin(role)) {
      throw new DomainError(
        'PERMISSION_DENIED',
        'Super admin role required',
        403,
        'errors.permission_denied',
      );
    }
    return true;
  }
}
