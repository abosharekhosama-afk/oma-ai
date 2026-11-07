import { timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DomainError } from '@oma/domain';
import type { Request } from 'express';

function safeTokensEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    const cookieName = process.env.CSRF_COOKIE_NAME ?? 'oma_csrf';
    const cookie = req.cookies?.[cookieName];
    const header = req.header('x-csrf-token');
    if (
      typeof cookie !== 'string' ||
      typeof header !== 'string' ||
      !safeTokensEqual(cookie, header)
    ) {
      throw new DomainError('PERMISSION_DENIED', 'CSRF validation failed', 403, 'errors.csrf');
    }
    return true;
  }
}
