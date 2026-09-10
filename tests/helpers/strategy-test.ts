import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import {
  authHeaders,
  createBrand,
  grantCapability,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
  type BrandSeed,
} from './brand-test';
import { cookieHeader } from './app';

export { authHeaders, createBrand, grantCapability, seedBrandTenant, seedMemberWithoutBrandCaps };
export type { BrandSeed };

export function memberAuthHeaders(member: { cookies: Record<string, string>; csrf: string }) {
  return {
    'content-type': 'application/json',
    cookie: cookieHeader(member.cookies),
    'x-csrf-token': member.csrf,
  };
}

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

export async function setTrackEnablement(
  seed: BrandSeed,
  brandId: string,
  strategyId: string,
  versionId: string,
  rowVersion: number,
  body: {
    organic_enabled: boolean;
    paid_enabled: boolean;
    organic_disabled_rationale?: string | null;
    paid_disabled_rationale?: string | null;
  },
) {
  const res = await fetch(
    `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/tracks/enablement`,
    {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ row_version: rowVersion, ...body }),
    },
  );
  return { res, body: await res.json() };
}

export async function reviseStrategy(
  seed: BrandSeed,
  brandId: string,
  strategyId: string,
  versionId: string,
) {
  const res = await fetch(
    `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/revise`,
    { method: 'POST', headers: authHeaders(seed), body: '{}' },
  );
  return { res, body: await res.json() };
}

export async function cloneStrategy(
  seed: BrandSeed,
  brandId: string,
  strategyId: string,
  versionId: string,
  name?: string,
) {
  const res = await fetch(
    `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/clone`,
    {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ name: name ?? 'Cloned Strategy' }),
    },
  );
  return { res, body: await res.json() };
}

export async function compareStrategyVersions(
  seed: BrandSeed,
  brandId: string,
  strategyId: string,
  leftId: string,
  rightId: string,
) {
  const res = await fetch(
    `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/compare?leftId=${leftId}&rightId=${rightId}`,
    { headers: { cookie: authHeaders(seed).cookie } },
  );
  return { res, body: await res.json() };
}

/** Organic + paid both enabled, foundation filled, ready to submit. */
export async function seedBothTracksReadyStrategy(seed: BrandSeed, brandId: string) {
  const profileId = await seedApprovedProfileVersion(seed.tenantId, brandId);
  const { body: created } = await createStrategy(seed, brandId, {
    name: 'Dual Track Strategy',
    linked_approved_profile_version_id: profileId,
    organic_enabled: true,
    paid_enabled: true,
  });
  const strategyId = created.data.id as string;
  const versionId = created.data.latest_version.id as string;
  let rowVersion = created.data.latest_version.row_version as number;

  const patched = await patchFoundation(seed, brandId, strategyId, versionId, rowVersion, {
    goals: [{ value: 'Grow reach', infoClass: 'USER_AUTHORED' }],
    positioning: { value: 'Trusted partner', infoClass: 'USER_AUTHORED' },
    keyMessages: [{ value: 'Quality', infoClass: 'USER_AUTHORED' }],
  });
  rowVersion = patched.body.data.row_version;

  const enabled = await setTrackEnablement(seed, brandId, strategyId, versionId, rowVersion, {
    organic_enabled: true,
    paid_enabled: true,
  });
  rowVersion = enabled.body.data.row_version;

  return { strategyId, versionId, profileId, rowVersion };
}

export async function bringToApproved(
  seed: BrandSeed,
  brandId: string,
  strategyId: string,
  versionId: string,
  rowVersion: number,
) {
  const submitted = await submitStrategy(seed, brandId, strategyId, versionId, rowVersion);
  if (![200, 201].includes(submitted.res.status)) {
    throw new Error(`submit failed: ${submitted.res.status} ${JSON.stringify(submitted.body)}`);
  }
  const approved = await approveStrategy(
    seed,
    brandId,
    strategyId,
    versionId,
    submitted.body.data.row_version,
  );
  if (![200, 201].includes(approved.res.status)) {
    throw new Error(`approve failed: ${approved.res.status} ${JSON.stringify(approved.body)}`);
  }
  return {
    submitted,
    approved,
    rowVersion: approved.body.data.row_version as number,
  };
}

/** Minimal scan chain so EvidenceExcerpt FK is satisfiable (strategy tests only). */
export async function seedEvidenceExcerpt(
  tenantId: string,
  brandId: string,
  actorUserId: string,
  excerptText = 'Evidence excerpt for strategy link',
) {
  const prisma = getPrisma();
  const websiteId = newId();
  const jobId = newId();
  const scanId = newId();
  const excerptId = newId();
  await prisma.websiteSource.create({
    data: {
      id: websiteId,
      tenantId,
      brandId,
      normalizedUrl: 'https://acme.test/',
      host: 'acme.test',
      attestationAcceptedAt: new Date(),
      attestedByUserId: actorUserId,
      validationStatus: 'VALID',
    },
  });
  await prisma.jobRun.create({
    data: {
      id: jobId,
      tenantId,
      queue: 'ingestion',
      jobType: 'scan',
      payloadJson: '{}',
      actorUserId,
      idempotencyKey: `strat-ev-${newId()}`,
    },
  });
  await prisma.scanAttempt.create({
    data: {
      id: scanId,
      tenantId,
      brandId,
      websiteSourceId: websiteId,
      jobRunId: jobId,
      idempotencyKey: `strat-scan-${newId()}`,
      actorUserId,
      status: 'SUCCEEDED',
    },
  });
  await prisma.evidenceExcerpt.create({
    data: {
      id: excerptId,
      tenantId,
      brandId,
      scanAttemptId: scanId,
      sourceUrl: 'https://acme.test/about',
      canonicalUrl: 'https://acme.test/about',
      pageTitle: 'About',
      excerptText,
      contentHash: `hash-${excerptId.slice(-8)}`,
      extractionMethod: 'USER',
    },
  });
  return excerptId;
}

export async function createEvidenceLink(
  seed: BrandSeed,
  brandId: string,
  strategyId: string,
  versionId: string,
  body: { evidence_excerpt_id?: string; label?: string },
) {
  const res = await fetch(
    `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/evidence-links`,
    {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify(body),
    },
  );
  return { res, body: await res.json() };
}

export async function openEvidenceLink(
  seed: BrandSeed,
  brandId: string,
  strategyId: string,
  versionId: string,
  linkId: string,
  headers?: Record<string, string>,
) {
  const res = await fetch(
    `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/evidence-links/${linkId}`,
    { headers: headers ?? { cookie: authHeaders(seed).cookie } },
  );
  return { res, body: await res.json() };
}
