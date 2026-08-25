import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DomainError, hashSessionToken } from '@oma/domain';
import { getPrisma } from '@oma/db';
import type { Request } from 'express';

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
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    req.oma = {
      ...(req.oma ?? { correlationId: '', requestId: '', capabilities: [] }),
      userId: session.userId,
      tenantId: session.activeTenantId ?? undefined,
      capabilities: [],
    };
    (req as Request & { sessionId?: string }).sessionId = session.id;
    return true;
  }
}
