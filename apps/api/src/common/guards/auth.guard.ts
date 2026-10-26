import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DomainError, hashSessionToken } from '@oma/domain';
import { getPrisma } from '@oma/db';
import type { Request } from 'express';
import { applyBrandScope, resolveBrandAccess } from '../../brand/brand-access';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'oma_session';
    const token = req.cookies?.[cookieName];
    if (!token)
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    const prisma = getPrisma();
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      session.user.status !== 'ACTIVE'
    ) {
      throw new DomainError('UNAUTHENTICATED', 'Session invalid', 401, 'errors.unauthenticated');
    }
    // Throttle the lastSeenAt write: at most once per minute per session (was every request).
    if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
      await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    }
    (req as Request & { sessionExpiresAt?: Date }).sessionExpiresAt = session.expiresAt;
    req.oma = {
      ...(req.oma ?? { correlationId: '', requestId: '', capabilities: [] }),
      userId: session.userId,
      tenantId: session.activeTenantId ?? undefined,
      capabilities: [],
    };
    (req as Request & { sessionId?: string }).sessionId = session.id;
    if (session.activeTenantId) {
      // Per-brand access: non-admins only ever see the brands they are members of.
      const access = await resolveBrandAccess(session.activeTenantId, session.userId);
      req.brandAccess = access;
      applyBrandScope(access);
    }
    return true;
  }
}
