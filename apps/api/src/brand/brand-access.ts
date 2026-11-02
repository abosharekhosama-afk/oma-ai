import { currentBrandScope, getPrisma, withoutBrandScope } from '@oma/db';
import type { BrandMemberRole } from '@oma/domain';

/** `all` = every brand in the tenant (not limited by BrandMember rows). */
export type BrandAccess = { all: true } | { all: false; roles: Map<string, BrandMemberRole> };

/**
 * Resolve which brands a user may see in the active tenant.
 *
 * - `tenant.manage` → all brands
 * - Explicit BrandMember rows → only those brands
 * - No BrandMember rows → workspace-wide access (capability gates still apply)
 *
 * Invited members typically have zero BrandMember rows until assigned; they must
 * still see workspace brands when they hold `brand.read`.
 */
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
    if (rows.length === 0) {
      // No brand-level ACL → treat as workspace-wide (Planable-style default).
      return { all: true } as const;
    }
    return { all: false, roles: new Map(rows.map((r) => [r.brandId, r.role])) } as const;
  });
}

/** Apply the access to the current request's brand scope (see @oma/db brand-scope). */
export function applyBrandScope(access: BrandAccess) {
  const scope = currentBrandScope();
  if (!scope) return;
  scope.allowed = access.all ? null : [...access.roles.keys()];
}
