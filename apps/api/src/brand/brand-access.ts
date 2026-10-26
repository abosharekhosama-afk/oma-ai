import { currentBrandScope, getPrisma, withoutBrandScope } from '@oma/db';
import type { BrandMemberRole } from '@oma/domain';

/** `all` = workspace owner/admin (tenant.manage): every brand, not limited by brand roles. */
export type BrandAccess = { all: true } | { all: false; roles: Map<string, BrandMemberRole> };

export async function resolveBrandAccess(tenantId: string, userId: string): Promise<BrandAccess> {
  return withoutBrandScope(async () => {
    const prisma = getPrisma();
    const admin = await prisma.capabilityGrant.findFirst({
      where: {
        tenantId,
        capabilityCode: 'tenant.manage',
        revokedAt: null,
        membership: { userId, status: 'ACTIVE' },
      },
      select: { id: true },
    });
    if (admin) return { all: true } as const;
    const rows = await prisma.brandMember.findMany({
      where: { tenantId, userId },
      select: { brandId: true, role: true },
    });
    return { all: false, roles: new Map(rows.map((r) => [r.brandId, r.role])) } as const;
  });
}

/** Apply the access to the current request's brand scope (see @oma/db brand-scope). */
export function applyBrandScope(access: BrandAccess) {
  const scope = currentBrandScope();
  if (!scope) return;
  scope.allowed = access.all ? null : [...access.roles.keys()];
}
