/**
 * Local user-acceptance seed for Feature 002 (Brand Website Intelligence).
 *
 * Dedicated to REVIEW only: refuses production hosts and non-acceptance DBs.
 * Creates three review accounts + demo agency data through real Prisma tables.
 * Idempotent by stable emails / tenant slug / brand names.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { PrismaClient, type Prisma } from '@prisma/client';
import { SYSTEM_PROFILES, hashPassword, newId } from '@oma/domain';

for (let dir = process.cwd(), depth = 0; depth < 5; depth += 1, dir = path.dirname(dir)) {
  const candidate = path.join(dir, '.env');
  if (existsSync(candidate)) {
    loadDotenv({ path: candidate });
    break;
  }
}

const prisma = new PrismaClient();

export const DEMO_FIXTURE_NOTE = 'Demo data — Live website connector is not configured';
const TENANT_SLUG = 'oma-review-demo';
const TENANT_NAME = 'OMA Demo Agency';

const OWNER = {
  email: 'review-owner-002@oma.local',
  password: 'ReviewOwner_002_ChangeMe!',
  name: 'Review Owner 002',
};
const NEW_USER = {
  email: 'review-new-002@oma.local',
  password: 'ReviewNew_002_ChangeMe!',
  name: 'Review New User 002',
};
const RESTRICTED = {
  email: 'review-reader-002@oma.local',
  password: 'ReviewReader_002_ChangeMe!',
  name: 'Review Reader 002',
};

const SEEDABLE_ENVS = new Set(['development', 'test']);
const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'db']);

function assertReviewSafe() {
  const env = process.env.OMA_ENV ?? process.env.NODE_ENV;
  if (!env || !SEEDABLE_ENVS.has(env)) {
    throw new Error(
      `review seed requires NODE_ENV or OMA_ENV development|test (got: ${env ?? 'unset'})`,
    );
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('review seed requires DATABASE_URL');
  let host: string;
  let dbName: string;
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    dbName = parsed.pathname.replace(/^\//, '').split('?')[0] ?? '';
  } catch {
    throw new Error('review seed could not parse DATABASE_URL');
  }
  if (!LOCAL_DB_HOSTS.has(host)) {
    throw new Error(`review seed refused against non-local host (${host})`);
  }
  if (!/oma_ai_acceptance/i.test(dbName) && process.env.OMA_REVIEW_ALLOW_ANY_LOCAL_DB !== '1') {
    throw new Error(
      `review seed requires database oma_ai_acceptance (got: ${dbName}). Set OMA_REVIEW_ALLOW_ANY_LOCAL_DB=1 only for explicit local override.`,
    );
  }
  if (/oma_ai_e2e|prod|production/i.test(dbName)) {
    throw new Error(`review seed refused against ${dbName}`);
  }
}

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

async function ensureUser(input: { email: string; password: string; name: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: await hashPassword(input.password),
        name: input.name,
        status: 'ACTIVE',
      },
    });
    return existing;
  }
  return prisma.user.create({
    data: {
      id: newId(),
      email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      status: 'ACTIVE',
    },
  });
}

async function ensureTenant() {
  const existing = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG } });
  if (existing) return existing;
  return prisma.tenant.create({
    data: { id: newId(), slug: TENANT_SLUG, name: TENANT_NAME, status: 'ACTIVE' },
  });
}

async function ensureMembership(
  tenantId: string,
  userId: string,
  profile: 'COMPANY_OWNER' | 'CUSTOM',
  caps: string[],
) {
  let membership = await prisma.membership.findFirst({
    where: { tenantId, userId, status: 'ACTIVE' },
  });
  if (!membership) {
    membership = await prisma.membership.create({
      data: {
        id: newId(),
        tenantId,
        userId,
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    });
  }
  const held = await prisma.capabilityGrant.findMany({
    where: { membershipId: membership.id, revokedAt: null },
    select: { capabilityCode: true },
  });
  const heldCodes = new Set(held.map((g) => g.capabilityCode));
  const missing = caps.filter((c) => !heldCodes.has(c));
  if (missing.length) {
    await prisma.capabilityGrant.createMany({
      data: missing.map((capabilityCode) => ({
        id: newId(),
        membershipId: membership.id,
        tenantId,
        capabilityCode,
        sourceProfileCode: profile,
        grantedBy: userId,
      })),
    });
  }
  return membership;
}

type PageSpec = {
  path: string;
  title: string;
  classification: Prisma.DiscoveredPageCreateManyInput['classification'];
  fetchStatus: NonNullable<Prisma.DiscoveredPageCreateManyInput['fetchStatus']>;
  httpStatus?: number;
  failureReason?: string;
};

type ClaimSpec = {
  field: string;
  tier: 'REQUIRED_FOR_APPROVAL' | 'DISCOVER_WHEN_AVAILABLE';
  value: string;
  path: string;
  excerpt: string;
  confidence: number;
};

type BrandSpec = {
  name: string;
  host?: string;
  approve?: boolean;
  needsReviewAi?: boolean;
  scan?: {
    status: 'SUCCEEDED' | 'PARTIAL';
    pages: PageSpec[];
    products: Array<{
      kind: 'PRODUCT' | 'SERVICE';
      name: string;
      category: string;
      price?: string;
    }>;
    claims: ClaimSpec[];
    unknownRequiredFields: string[];
  };
};

const BRANDS: BrandSpec[] = [
  { name: 'Northwind Services (Demo)' },
  {
    name: 'Acme Retail (Demo)',
    host: 'acme-retail.example',
    approve: true,
    scan: {
      status: 'SUCCEEDED',
      pages: [
        {
          path: '/',
          title: 'Acme Retail — Home',
          classification: 'HOME',
          fetchStatus: 'FETCHED',
          httpStatus: 200,
        },
        {
          path: '/about',
          title: 'About Acme Retail',
          classification: 'ABOUT',
          fetchStatus: 'FETCHED',
          httpStatus: 200,
        },
        {
          path: '/products/desk-lamp',
          title: 'Studio Desk Lamp',
          classification: 'PRODUCT',
          fetchStatus: 'FETCHED',
          httpStatus: 200,
        },
        {
          path: '/contact',
          title: 'Contact Acme Retail',
          classification: 'CONTACT',
          fetchStatus: 'FETCHED',
          httpStatus: 200,
        },
      ],
      products: [
        { kind: 'PRODUCT', name: 'Studio Desk Lamp', category: 'Lighting', price: '149.00' },
        { kind: 'SERVICE', name: 'Workspace Fit-out Consultation', category: 'Advisory' },
      ],
      claims: [
        {
          field: 'brand.name',
          tier: 'REQUIRED_FOR_APPROVAL',
          value: 'Acme Retail',
          path: '/',
          excerpt: 'Acme Retail — workspace furniture and lighting for commercial interiors.',
          confidence: 0.9,
        },
        {
          field: 'brand.description',
          tier: 'REQUIRED_FOR_APPROVAL',
          value: 'Workspace furniture and lighting supplier for commercial interiors.',
          path: '/about',
          excerpt:
            'Acme Retail designs and supplies workspace furniture and lighting for commercial interiors across the region.',
          confidence: 0.8,
        },
        {
          field: 'brand.contact.email',
          tier: 'DISCOVER_WHEN_AVAILABLE',
          value: 'hello@example.invalid',
          path: '/contact',
          excerpt: 'Reach the Acme Retail team at hello@example.invalid for wholesale enquiries.',
          confidence: 0.95,
        },
      ],
      unknownRequiredFields: ['brand.tone_of_voice'],
    },
  },
  {
    name: 'Globex Group (Demo)',
    host: 'globex-group.example',
    needsReviewAi: true,
    scan: {
      status: 'PARTIAL',
      pages: [
        {
          path: '/',
          title: 'Globex Group',
          classification: 'HOME',
          fetchStatus: 'FETCHED',
          httpStatus: 200,
        },
        {
          path: '/services',
          title: 'Globex Services',
          classification: 'SERVICE',
          fetchStatus: 'FETCHED',
          httpStatus: 200,
        },
        {
          path: '/investors',
          title: '',
          classification: 'UNKNOWN',
          fetchStatus: 'FAILED',
          httpStatus: 503,
          failureReason: 'upstream_unavailable',
        },
        {
          path: '/private',
          title: '',
          classification: 'UNKNOWN',
          fetchStatus: 'SKIPPED_ROBOTS',
          failureReason: 'disallowed_by_robots',
        },
      ],
      products: [
        { kind: 'SERVICE', name: 'Industrial Automation Retrofit', category: 'Engineering' },
      ],
      claims: [
        {
          field: 'brand.name',
          tier: 'REQUIRED_FOR_APPROVAL',
          value: 'Globex Group',
          path: '/',
          excerpt: 'Globex Group — industrial automation and plant engineering services.',
          confidence: 0.9,
        },
        {
          field: 'brand.description',
          tier: 'REQUIRED_FOR_APPROVAL',
          value: 'Industrial automation and plant engineering services provider.',
          path: '/services',
          excerpt:
            'Globex Group delivers automation retrofits and plant engineering programmes for industrial operators.',
          confidence: 0.8,
        },
      ],
      unknownRequiredFields: ['brand.tone_of_voice', 'brand.contact.email'],
    },
  },
];

async function seedBrand(tenantId: string, actorUserId: string, spec: BrandSpec) {
  const existing = await prisma.brandWorkspace.findFirst({
    where: { tenantId, name: spec.name },
  });
  if (existing) {
    // Ensure approved / AI states on re-run when brand already exists.
    await finalizeBrandStates(tenantId, actorUserId, existing.id, spec);
    return { brand: existing, created: false };
  }

  const brandId = newId();
  const brand = await prisma.brandWorkspace.create({
    data: {
      id: brandId,
      tenantId,
      name: spec.name,
      status: spec.host ? 'ACTIVE' : 'DRAFT',
    },
  });

  if (!spec.host || !spec.scan) return { brand, created: true };

  const websiteSourceId = newId();
  const origin = `https://${spec.host}`;
  await prisma.websiteSource.create({
    data: {
      id: websiteSourceId,
      tenantId,
      brandId,
      normalizedUrl: `${origin}/`,
      host: spec.host,
      attestationAcceptedAt: new Date(),
      attestedByUserId: actorUserId,
      validationStatus: 'VALID',
      notes: DEMO_FIXTURE_NOTE,
    },
  });
  await prisma.brandWorkspace.update({
    where: { id: brandId },
    data: { primaryWebsiteSourceId: websiteSourceId },
  });

  const jobRunId = newId();
  const scanId = newId();
  await prisma.jobRun.create({
    data: {
      id: jobRunId,
      tenantId,
      queue: 'ingestion',
      jobType: 'brand.scan',
      status: 'SUCCEEDED',
      payloadJson: JSON.stringify({ brandId, scanAttemptId: scanId, demo: true }),
      actorUserId,
      startedAt: new Date(Date.now() - 120_000),
      finishedAt: new Date(Date.now() - 60_000),
    },
  });

  const fetched = spec.scan.pages.filter((p) => p.fetchStatus === 'FETCHED');
  const failed = spec.scan.pages.filter((p) => p.fetchStatus === 'FAILED');
  const skipped = spec.scan.pages.filter((p) => p.fetchStatus.startsWith('SKIPPED'));

  await prisma.scanAttempt.create({
    data: {
      id: scanId,
      tenantId,
      brandId,
      websiteSourceId,
      status: spec.scan.status,
      trigger: 'START',
      connectorMode: 'FIXTURE',
      jobRunId,
      idempotencyKey: `review-seed:${brandId}:start`,
      actorUserId,
      progressPercent: 100,
      pagesFetched: fetched.length,
      pagesFailed: failed.length,
      pagesSkipped: skipped.length,
      coverageJson: JSON.stringify({
        discovered: spec.scan.pages.length,
        fetched: fetched.length,
        failed: failed.length,
        skipped: skipped.length,
        required_missing: spec.scan.unknownRequiredFields,
        unknown_fields: spec.scan.unknownRequiredFields,
        failed_pages: failed.map((p) => ({
          url: `${origin}${p.path}`,
          reason: p.failureReason ?? 'failed',
        })),
        skipped_pages: skipped.map((p) => ({
          url: `${origin}${p.path}`,
          reason: p.failureReason ?? 'skipped',
        })),
        source: 'demo-fixture',
        label: DEMO_FIXTURE_NOTE,
      }),
      aiAvailability: 'NOT_CONFIGURED',
      startedAt: new Date(Date.now() - 120_000),
      finishedAt: new Date(Date.now() - 60_000),
    },
  });

  const pageIds = new Map<string, string>();
  for (const page of spec.scan.pages) {
    const id = newId();
    pageIds.set(page.path, id);
    const canonicalUrl = `${origin}${page.path}`;
    await prisma.discoveredPage.create({
      data: {
        id,
        tenantId,
        brandId,
        scanAttemptId: scanId,
        url: canonicalUrl,
        canonicalUrl,
        canonicalHash: hash(canonicalUrl),
        title: page.title || null,
        httpStatus: page.httpStatus ?? null,
        contentType: page.fetchStatus === 'FETCHED' ? 'text/html' : null,
        classification: page.classification,
        fetchStatus: page.fetchStatus,
        failureReason: page.failureReason ?? null,
        localeHint: 'en',
      },
    });
  }

  for (const product of spec.scan.products) {
    await prisma.discoveredProductService.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        scanAttemptId: scanId,
        kind: product.kind,
        name: product.name,
        description: `${product.name} — ${DEMO_FIXTURE_NOTE}`,
        category: product.category,
        priceAmount: product.price ?? null,
        priceCurrency: product.price ? 'AED' : null,
        availability: product.price ? 'in_stock' : null,
        sourcePageId: pageIds.get('/') ?? null,
        dedupeKey: hash(`${product.kind}:${product.name}`),
      },
    });
  }

  const evidenceByField = new Map<string, string>();
  const observableClaims = spec.scan.claims.filter((c) => {
    const page = spec.scan?.pages.find((p) => p.path === c.path);
    return page?.fetchStatus === 'FETCHED';
  });
  for (const claim of observableClaims) {
    const pageId = pageIds.get(claim.path);
    if (!pageId) continue;
    const id = newId();
    evidenceByField.set(claim.field, id);
    await prisma.evidenceExcerpt.create({
      data: {
        id,
        tenantId,
        brandId,
        scanAttemptId: scanId,
        sourceUrl: `${origin}${claim.path}`,
        canonicalUrl: `${origin}${claim.path}`,
        pageTitle: spec.scan.pages.find((p) => p.path === claim.path)?.title ?? null,
        excerptText: claim.excerpt,
        contentHash: hash(claim.excerpt),
        extractionMethod: 'HEURISTIC',
        discoveredPageId: pageId,
      },
    });
  }

  const profileVersionId = newId();
  const profileStatus = spec.approve ? 'APPROVED' : 'NEEDS_REVIEW';
  await prisma.profileVersion.create({
    data: {
      id: profileVersionId,
      tenantId,
      brandId,
      scanAttemptId: scanId,
      status: profileStatus,
      aiAvailability: 'NOT_CONFIGURED',
      coverageSnapshotJson: JSON.stringify({
        fetched: fetched.length,
        failed: failed.length,
        skipped: skipped.length,
        partial: spec.scan.status === 'PARTIAL',
        required_missing: spec.scan.unknownRequiredFields,
        unknown_fields: spec.scan.unknownRequiredFields,
        label: DEMO_FIXTURE_NOTE,
      }),
      sectionsJson: JSON.stringify({
        overview: { source: 'demo-fixture', note: DEMO_FIXTURE_NOTE },
        catalog: { productCount: spec.scan.products.length },
      }),
      approvedAt: spec.approve ? new Date() : null,
      approvedByUserId: spec.approve ? actorUserId : null,
      incompletenessAcknowledged: spec.scan.status === 'PARTIAL',
    },
  });

  for (const claim of observableClaims) {
    const evidenceId = evidenceByField.get(claim.field);
    if (!evidenceId) continue;
    await prisma.extractedObservation.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        scanAttemptId: scanId,
        fieldKey: claim.field,
        discoveryTier: claim.tier,
        valueJson: JSON.stringify(claim.value),
        isUnknown: false,
        infoState: 'OBSERVED',
        confidence: claim.confidence,
        evidenceId,
        profileVersionId,
      },
    });
    await prisma.insightClaim.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        profileVersionId,
        fieldKey: claim.field,
        infoState: 'OBSERVED',
        reviewStatus: 'PENDING',
        textValue: claim.value,
        valueJson: JSON.stringify(claim.value),
        evidenceId,
        discoveryTier: claim.tier,
        createdBy: 'SYSTEM',
      },
    });
  }

  for (const fieldKey of spec.scan.unknownRequiredFields) {
    await prisma.extractedObservation.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        scanAttemptId: scanId,
        fieldKey,
        discoveryTier: 'REQUIRED_FOR_APPROVAL',
        valueJson: null,
        isUnknown: true,
        infoState: 'OBSERVED',
        confidence: null,
        evidenceId: null,
        profileVersionId,
      },
    });
  }

  if (spec.needsReviewAi) {
    await prisma.insightClaim.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        profileVersionId,
        fieldKey: 'brand.tone_of_voice',
        infoState: 'AI_INFERRED',
        reviewStatus: 'PENDING',
        textValue: 'Professional, clear, and commercially restrained (demo inference).',
        valueJson: JSON.stringify('Professional, clear, and commercially restrained'),
        discoveryTier: 'REQUIRED_FOR_APPROVAL',
        createdBy: 'AI',
      },
    });
  }

  if (spec.approve) {
    await prisma.approvalRecord.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        profileVersionId,
        actorUserId,
        acknowledgedIncomplete: false,
        coverageSnapshotJson: JSON.stringify({ label: DEMO_FIXTURE_NOTE }),
      },
    });
    await prisma.brandWorkspace.update({
      where: { id: brandId },
      data: { currentApprovedProfileVersionId: profileVersionId },
    });
    await prisma.reviewDecision.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        profileVersionId,
        actorUserId,
        action: 'APPROVE_VERSION',
      },
    });
    await prisma.notification.create({
      data: {
        id: newId(),
        tenantId,
        recipientUserId: actorUserId,
        type: 'brand.profile.approved',
        objectType: 'ProfileVersion',
        objectId: profileVersionId,
        deepLinkPath: `/app/brands/${brandId}/profiles/${profileVersionId}`,
        dedupeKey: `review-seed:approved:${profileVersionId}`,
      },
    });
  } else if (spec.scan) {
    await prisma.notification.create({
      data: {
        id: newId(),
        tenantId,
        recipientUserId: actorUserId,
        type: 'brand.profile.needs_review',
        objectType: 'ProfileVersion',
        objectId: profileVersionId,
        deepLinkPath: `/app/brands/${brandId}/profiles/${profileVersionId}`,
        dedupeKey: `review-seed:review:${profileVersionId}`,
      },
    });
  }

  return { brand, created: true };
}

async function finalizeBrandStates(
  tenantId: string,
  actorUserId: string,
  brandId: string,
  spec: BrandSpec,
) {
  if (!spec.needsReviewAi) return;
  const version = await prisma.profileVersion.findFirst({
    where: { tenantId, brandId },
    orderBy: { createdAt: 'desc' },
  });
  if (!version) return;
  const ai = await prisma.insightClaim.findFirst({
    where: { profileVersionId: version.id, infoState: 'AI_INFERRED' },
  });
  if (!ai) {
    await prisma.insightClaim.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        profileVersionId: version.id,
        fieldKey: 'brand.tone_of_voice',
        infoState: 'AI_INFERRED',
        reviewStatus: 'PENDING',
        textValue: 'Professional, clear, and commercially restrained (demo inference).',
        discoveryTier: 'REQUIRED_FOR_APPROVAL',
        createdBy: 'AI',
      },
    });
  }
  void actorUserId;
}

function writeCredentials(root: string, servedSha: string) {
  const dir = path.join(root, '.review');
  mkdirSync(dir, { recursive: true });
  const payload = {
    feature: '002-brand-website-intelligence',
    served_sha: servedSha,
    database: 'oma_ai_acceptance',
    web: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000',
    accounts: {
      owner: OWNER,
      new_user: NEW_USER,
      restricted: RESTRICTED,
    },
    notes: [
      DEMO_FIXTURE_NOTE,
      'New user has zero memberships — use for Company Onboarding.',
      'Restricted user has brand.read only on OMA Demo Agency.',
    ],
  };
  writeFileSync(path.join(dir, '002-credentials.json'), JSON.stringify(payload, null, 2) + '\n');
  writeFileSync(
    path.join(dir, '002-credentials.txt'),
    [
      'OMA AI Feature 002 — local review accounts',
      `Served SHA: ${servedSha}`,
      `Web: ${payload.web}`,
      '',
      'Owner (populated):',
      `  email: ${OWNER.email}`,
      `  password: ${OWNER.password}`,
      '',
      'New user (onboarding):',
      `  email: ${NEW_USER.email}`,
      `  password: ${NEW_USER.password}`,
      '',
      'Restricted (brand.read only):',
      `  email: ${RESTRICTED.email}`,
      `  password: ${RESTRICTED.password}`,
      '',
      DEMO_FIXTURE_NOTE,
      '',
    ].join('\n'),
  );
}

async function main() {
  assertReviewSafe();
  const root = process.cwd().includes('packages/db')
    ? path.resolve(process.cwd(), '../..')
    : process.cwd();
  const servedSha = (process.env.OMA_REVIEW_SERVED_SHA ?? 'local').trim();

  const tenant = await ensureTenant();
  const owner = await ensureUser(OWNER);
  const newUser = await ensureUser(NEW_USER);
  const restricted = await ensureUser(RESTRICTED);

  await ensureMembership(tenant.id, owner.id, 'COMPANY_OWNER', SYSTEM_PROFILES.COMPANY_OWNER ?? []);
  // New user: intentionally no memberships (reset after any prior review create).
  const newMemberships = await prisma.membership.findMany({
    where: { userId: newUser.id },
    select: { id: true, tenantId: true },
  });
  if (newMemberships.length) {
    const mids = newMemberships.map((m) => m.id);
    await prisma.capabilityGrant.deleteMany({ where: { membershipId: { in: mids } } });
    await prisma.invitation.deleteMany({ where: { membershipId: { in: mids } } });
    await prisma.membership.deleteMany({ where: { id: { in: mids } } });
    await prisma.session.updateMany({
      where: { userId: newUser.id },
      data: { activeTenantId: null },
    });
    // Soft-isolate ephemeral companies the new user created during prep.
    for (const m of newMemberships) {
      if (m.tenantId === tenant.id) continue;
      await prisma.tenant.updateMany({
        where: { id: m.tenantId, slug: { not: TENANT_SLUG } },
        data: { status: 'SUSPENDED' },
      });
    }
  }
  await ensureMembership(tenant.id, restricted.id, 'CUSTOM', ['brand.read', 'notification.read']);

  const results: string[] = [];
  for (const spec of BRANDS) {
    const { brand, created } = await seedBrand(tenant.id, owner.id, spec);
    results.push(`${created ? 'created' : 'exists '}  ${brand.name}`);
  }

  writeCredentials(root, servedSha);

  console.log(`Review tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Owner:         ${OWNER.email}`);
  console.log(`New user:      ${NEW_USER.email} (zero memberships)`);
  console.log(`Restricted:    ${RESTRICTED.email} (brand.read)`);
  for (const line of results) console.log(`  ${line}`);
  console.log(`Credentials:   ${path.join(root, '.review/002-credentials.txt')}`);
  console.log(DEMO_FIXTURE_NOTE);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
