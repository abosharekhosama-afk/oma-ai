import { Injectable } from '@nestjs/common';
import { getPrisma } from '@oma/db';
import { DomainError, hashSessionToken, issueSessionToken, newId } from '@oma/domain';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SessionService {
  constructor(private readonly audit: AuditService) {}

  async createSession(input: { userId: string; ip?: string; userAgent?: string }) {
    const { token, tokenHash } = issueSessionToken();
    const ttl = Number(process.env.SESSION_TTL_SECONDS ?? 604800);
    const session = await getPrisma().session.create({
      data: {
        id: newId(),
        userId: input.userId,
        tokenHash,
        expiresAt: new Date(Date.now() + ttl * 1000),
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
    await this.audit.write({
      actorUserId: input.userId,
      action: 'user.login',
      targetType: 'Session',
      targetId: session.id,
    });
    return { session, token };
  }

  async revokeSession(sessionId: string, userId: string) {
    await getPrisma().session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.write({
      actorUserId: userId,
      action: 'user.logout',
      targetType: 'Session',
      targetId: sessionId,
    });
  }

  async resolveFromToken(token: string) {
    const session = await getPrisma().session.findUnique({
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
    return session;
  }
}
