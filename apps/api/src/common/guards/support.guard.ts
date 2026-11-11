import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DomainError } from '@oma/domain';
import type { Request } from 'express';
import { isSupportOperator } from '../../platform/support-auth';

@Injectable()
export class SupportGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.oma?.userId) {
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    }
    if (!(await isSupportOperator(req.oma.userId, req.oma.systemRole))) {
      throw new DomainError(
        'PERMISSION_DENIED',
        'Support or super admin role required',
        403,
        'errors.permission_denied',
      );
    }
    return true;
  }
}
