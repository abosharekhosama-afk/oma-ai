import { DomainError, hashSessionToken, type SystemRole } from '@oma/domain';
import { getPrisma } from '@oma/db';
import type { Request } from 'express';

export type ResolvedSession = {
  sessionId: string;
  userId: string;
  systemRole: SystemRole;
  activeTenantId: string | null;
};

/** Validates the session cookie and returns core identity fields (no tenant membership checks). */
export async function resolveSessionFromRequest(req: Request): Promise<ResolvedSession> {
  const cookieName = process.env.SESSION_COOKIE_NAME ?? 'oma_session';
  const token = req.cookies?.[cookieName];
  if (!token) {
    throw new DomainError(
      'UNAUTHENTICATED',
      'Authentication required',
      401,
      'errors.unauthenticated',
    );
  }
  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { select: { id: true, status: true, systemRole: true } } },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.user.status !== 'ACTIVE'
  ) {
    throw new DomainError('UNAUTHENTICATED', 'Session invalid', 401, 'errors.unauthenticated');
  }
  return {
    sessionId: session.id,
    userId: session.userId,
    systemRole: session.user.systemRole as SystemRole,
    activeTenantId: session.activeTenantId,
  };
}

export function mergeSessionIntoOmaContext(
  req: Request,
  session: ResolvedSession,
  fields?: Partial<{ sessionId: boolean }>,
): void {
  req.oma = {
    ...(req.oma ?? { correlationId: '', requestId: '', capabilities: [] }),
    userId: session.userId,
    tenantId: session.activeTenantId ?? undefined,
    systemRole: session.systemRole,
    capabilities: req.oma?.capabilities ?? [],
  };
  if (fields?.sessionId !== false) {
    (req as Request & { sessionId?: string }).sessionId = session.sessionId;
  }
}
