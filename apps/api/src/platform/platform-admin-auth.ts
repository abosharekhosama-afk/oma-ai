import { getPrisma } from '@oma/db';
import { DomainError, isSuperAdmin } from '@oma/domain';
import type { Request } from 'express';

/** Super Admin system role, with legacy platform.support.access fallback during migration. */
export async function requireSuperAdminOperator(req: Request): Promise<string> {
  const userId = req.oma?.userId;
  if (!userId) {
    throw new DomainError(
      'UNAUTHENTICATED',
      'Authentication required',
      401,
      'errors.unauthenticated',
    );
  }
  if (isSuperAdmin(req.oma?.systemRole)) return userId;

  const grant = await getPrisma().capabilityGrant.findFirst({
    where: {
      capabilityCode: 'platform.support.access',
      revokedAt: null,
      membership: { userId, status: 'ACTIVE' },
    },
    select: { id: true },
  });
  if (!grant) {
    throw new DomainError(
      'PERMISSION_DENIED',
      'Super admin role required',
      403,
      'errors.permission_denied',
    );
  }
  return userId;
}
