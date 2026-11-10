import { getPrisma } from '@oma/db';
import {
  DomainError,
  buildBrandContext,
  brandContextCacheKey,
  invalidateBrandContextCache,
  readBrandContextCache,
  writeBrandContextCache,
  type BrandContext,
} from '@oma/domain';

export { invalidateBrandContextCache };

export async function loadBrandContext(
  tenantId: string,
  brandId: string,
  opts?: { maxTokens?: number; bypassCache?: boolean },
): Promise<BrandContext> {
  const brand = await getPrisma().brandWorkspace.findFirst({
    where: { id: brandId, tenantId, deletedAt: null },
    select: {
      id: true,
      tenantId: true,
      name: true,
      currentApprovedProfileVersionId: true,
    },
  });
  if (!brand) {
    throw new DomainError('NOT_FOUND', 'Brand not found', 404, 'errors.not_found');
  }

  let profile = brand.currentApprovedProfileVersionId
    ? await getPrisma().profileVersion.findFirst({
        where: {
          id: brand.currentApprovedProfileVersionId,
          tenantId,
          brandId,
          status: 'APPROVED',
        },
        select: {
          id: true,
          tenantId: true,
          brandId: true,
          status: true,
          sectionsJson: true,
        },
      })
    : null;
  if (!profile) {
    profile = await getPrisma().profileVersion.findFirst({
      where: { tenantId, brandId, status: 'APPROVED' },
      orderBy: { approvedAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        brandId: true,
        status: true,
        sectionsJson: true,
      },
    });
  }

  const cacheKey = brandContextCacheKey(tenantId, brandId, profile?.id ?? null);
  if (!opts?.bypassCache) {
    const cached = readBrandContextCache(cacheKey);
    if (cached) return cached;
  }

  const claims = profile
    ? await getPrisma().insightClaim.findMany({
        where: { tenantId, brandId, profileVersionId: profile.id },
        select: { fieldKey: true, textValue: true, reviewStatus: true },
      })
    : [];

  const context = buildBrandContext({
    tenantId,
    brandId,
    brandName: brand.name,
    profile,
    claims: claims.map((claim) => ({
      fieldKey: claim.fieldKey,
      text: claim.textValue ?? '',
      reviewStatus: claim.reviewStatus,
    })),
    maxTokens: opts?.maxTokens,
  });
  writeBrandContextCache(cacheKey, context);
  return context;
}
