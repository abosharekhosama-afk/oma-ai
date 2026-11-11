import { getPrisma } from '@oma/db';
import { DomainError, isSupportStaff, type SystemRole } from '@oma/domain';
import type { Request } from 'express';

export async function isSupportOperator(userId: string, systemRole?: SystemRole): Promise<boolean> {
  if (isSupportStaff(systemRole)) return true;
  const grant = await getPrisma().capabilityGrant.findFirst({
    where: {
      capabilityCode: 'platform.support.access',
      revokedAt: null,
      membership: { userId, status: 'ACTIVE' },
    },
    select: { id: true },
  });
  return Boolean(grant);
}

export async function requireSupportOperator(req: Request): Promise<string> {
  const userId = req.oma?.userId;
  if (!userId) {
    throw new DomainError(
      'UNAUTHENTICATED',
      'Authentication required',
      401,
      'errors.unauthenticated',
    );
  }
  if (!(await isSupportOperator(userId, req.oma?.systemRole))) {
    throw new DomainError(
      'PERMISSION_DENIED',
      'Support or super admin role required',
      403,
      'errors.permission_denied',
    );
  }
  return userId;
}
