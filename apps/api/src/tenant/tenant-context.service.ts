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
    const membership = await getPrisma().membership.findFirst({
      where: tenantWhere(activeTenantId, { userId, status: 'ACTIVE' }),
      include: { grants: { where: { revokedAt: null } }, tenant: true },
    });
    if (!membership) {
      throw new DomainError(
        'PERMISSION_DENIED',
        'Not an active member of tenant',
        403,
        'errors.permission_denied',
      );
    }
    return {
      tenantId: membership.tenantId,
      membershipId: membership.id,
      capabilities: membership.grants.map((g) => g.capabilityCode),
      tenant: membership.tenant,
    };
  }
}

export const tenantContextService = new TenantContextService();
