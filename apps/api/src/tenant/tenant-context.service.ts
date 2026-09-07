import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError } from '@oma/domain';

/** Session-only tenant authority — never trust client-supplied tenant IDs. */
@Injectable()
export class TenantContextService {
  async resolveActiveMembership(userId: string, activeTenantId: string | null | undefined) {
    if (!activeTenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    // Duplicate ACTIVE membership rows for one tenant are possible, so the
    // effective capability set must be the union across them.
    const memberships = await getPrisma().membership.findMany({
      where: tenantWhere(activeTenantId, { userId, status: 'ACTIVE' }),
      include: { grants: { where: { revokedAt: null } }, tenant: true },
      orderBy: { createdAt: 'asc' },
    });
    const primary = memberships[0];
    if (!primary) {
      throw new DomainError(
        'PERMISSION_DENIED',
        'Not an active member of tenant',
        403,
        'errors.permission_denied',
      );
    }
    return {
      tenantId: primary.tenantId,
      membershipId: primary.id,
      capabilities: [...new Set(memberships.flatMap((m) => m.grants.map((g) => g.capabilityCode)))],
      tenant: primary.tenant,
    };
  }
}

export const tenantContextService = new TenantContextService();
