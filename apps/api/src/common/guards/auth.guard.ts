import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DomainError, hashSessionToken } from '@oma/domain';
import { getPrisma } from '@oma/db';
import type { Request, Response } from 'express';
import { ensureCsrfCookie, setSessionCookie } from '../../identity/session-cookie';
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
    let activeTenantId = session.activeTenantId;
    if (activeTenantId) {
      const membership = await prisma.membership.findFirst({
        where: { tenantId: activeTenantId, userId: session.userId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!membership) {
        await prisma.session.updateMany({
          where: { userId: session.userId, activeTenantId, revokedAt: null },
          data: { activeTenantId: null },
        });
        activeTenantId = null;
      }
    }
    // Throttle the lastSeenAt write: at most once per minute per session (was every request).
    if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
      await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    }
    const res = context.switchToHttp().getResponse<Response>();
    // Sliding session: once less than half the TTL is left, extend it and refresh the cookie so
    // active users are never logged out mid-work.
    const ttlMs = Number(process.env.SESSION_TTL_SECONDS ?? 604800) * 1000;
    let expiresAt = session.expiresAt;
    if (res && typeof res.cookie === 'function' && expiresAt.getTime() - Date.now() < ttlMs / 2) {
      expiresAt = new Date(Date.now() + ttlMs);
      await prisma.session.update({ where: { id: session.id }, data: { expiresAt } });
      setSessionCookie(res, token);
    }
    // Repair a missing CSRF cookie (older browsers kept the session cookie but dropped this one).
    if (res && typeof res.cookie === 'function') ensureCsrfCookie(req, res);
    (req as Request & { sessionExpiresAt?: Date }).sessionExpiresAt = expiresAt;
    req.oma = {
      ...(req.oma ?? { correlationId: '', requestId: '', capabilities: [] }),
      userId: session.userId,
      tenantId: activeTenantId ?? undefined,
      capabilities: [],
    };
    (req as Request & { sessionId?: string }).sessionId = session.id;
    if (activeTenantId) {
      // Per-brand access: non-admins only ever see the brands they are members of.
      const access = await resolveBrandAccess(activeTenantId, session.userId);
      req.brandAccess = access;
      applyBrandScope(access);
    }
    return true;
  }
}
