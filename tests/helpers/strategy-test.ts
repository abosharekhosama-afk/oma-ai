import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { authHeaders, createBrand, seedBrandTenant, type BrandSeed } from './brand-test';

export { authHeaders, createBrand, seedBrandTenant };
export type { BrandSeed };

export async function createStrategy(
  seed: BrandSeed,
  brandId: string,
  body?: {
    name?: string;
    linked_approved_profile_version_id?: string | null;
    draft_profile_version_id?: string | null;
    organic_enabled?: boolean;
    paid_enabled?: boolean;
  },
) {
  const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/strategies`, {
    method: 'POST',
    headers: authHeaders(seed),
    body: JSON.stringify({
      name: body?.name ?? `Strategy ${newId().slice(-6)}`,
      ...body,
    }),
  });
  return { res, body: await res.json() };
}

export async function getStrategy(seed: BrandSeed, brandId: string, strategyId: string) {
  const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}`, {
    headers: { cookie: authHeaders(seed).cookie },
  });
  return { res, body: await res.json() };
}

export async function getStrategyVersion(
  seed: BrandSeed,
  brandId: string,
  strategyId: string,
  versionId: string,
) {
  const res = await fetch(
    `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}`,
    { headers: { cookie: authHeaders(seed).cookie } },
  );
  return { res, body: await res.json() };
}

export async function patchFoundation(
  seed: BrandSeed,
  brandId: string,
  strategyId: string,
  versionId: string,
  rowVersion: number,
  foundation: Record<string, unknown>,
) {
  const res = await fetch(
    `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}`,
    {
      method: 'PATCH',
      headers: authHeaders(seed),
      body: JSON.stringify({ row_version: rowVersion, foundation }),
    },
  );
  return { res, body: await res.json() };
}

export async function linkApprovedProfile(
  seed: BrandSeed,
  brandId: string,
  strategyId: string,
  versionId: string,
  profileVersionId: string,
  rowVersion: number,
  role: 'approved' | 'draft_aid' = 'approved',
) {
  const res = await fetch(
    `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/link-profile`,
    {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({
        profile_version_id: profileVersionId,
        role,
        row_version: rowVersion,
      }),
    },
  );
  return { res, body: await res.json() };
}

export async function submitStrategy(
  seed: BrandSeed,
  brandId: string,
  strategyId: string,
  versionId: string,
  rowVersion: number,
) {
  const res = await fetch(
    `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/submit`,
    {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ row_version: rowVersion, unknowns_acknowledged: true }),
    },
  );
  return { res, body: await res.json() };
}

export async function approveStrategy(
  seed: BrandSeed,
  brandId: string,
  strategyId: string,
  versionId: string,
  rowVersion: number,
  comment = 'Package approved',
) {
  const res = await fetch(
    `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/approve`,
    {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({
        row_version: rowVersion,
        unknowns_acknowledged: true,
        comment,
      }),
    },
  );
  return { res, body: await res.json() };
}

export async function setCurrentStrategy(
  seed: BrandSeed,
  brandId: string,
  strategyId: string | null,
  brandVersion: number,
) {
  const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/current-strategy`, {
    method: 'POST',
    headers: authHeaders(seed),
    body: JSON.stringify({ strategy_id: strategyId, brand_version: brandVersion }),
  });
  return { res, body: await res.json() };
}

/** Insert an APPROVED ProfileVersion without Feature 002 scan (strategy tests only). */
export async function seedApprovedProfileVersion(tenantId: string, brandId: string) {
  const prisma = getPrisma();
  const id = newId();
  await prisma.profileVersion.create({
    data: {
      id,
      tenantId,
      brandId,
      status: 'APPROVED',
      sectionsJson: JSON.stringify({ overview: { name: 'Acme' } }),
      approvedAt: new Date(),
      incompletenessAcknowledged: true,
    },
  });
  await prisma.brandWorkspace.update({
    where: { id: brandId },
    data: { currentApprovedProfileVersionId: id },
  });
  return id;
}

export async function seedReviewReadyStrategy(seed: BrandSeed, brandId: string) {
  const profileId = await seedApprovedProfileVersion(seed.tenantId, brandId);
  const { body: created } = await createStrategy(seed, brandId, {
    name: 'Acme Q3 Strategy',
    linked_approved_profile_version_id: profileId,
    organic_enabled: true,
    paid_enabled: false,
  });
  const strategyId = created.data.id as string;
  const versionId = created.data.latest_version.id as string;
  let rowVersion = created.data.latest_version.row_version as number;

  const patched = await patchFoundation(seed, brandId, strategyId, versionId, rowVersion, {
    goals: [{ value: 'Grow organic reach', infoClass: 'USER_AUTHORED' }],
    positioning: { value: 'Trusted local partner', infoClass: 'USER_AUTHORED' },
    keyMessages: [{ value: 'Quality first', infoClass: 'USER_AUTHORED' }],
  });
  rowVersion = patched.body.data.row_version;

  await fetch(
    `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/tracks/enablement`,
    {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({
        row_version: rowVersion,
        organic_enabled: true,
        paid_enabled: false,
        paid_disabled_rationale: 'Paid deferred this quarter — planning later',
      }),
    },
  );
  const afterEnable = await getStrategyVersion(seed, brandId, strategyId, versionId);
  rowVersion = afterEnable.body.data.row_version;

  return { strategyId, versionId, profileId, rowVersion };
}
