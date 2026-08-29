/**
 * Local demo seed for Feature 002 (Brand Website Intelligence).
 *
 * Populates one clearly-labelled demo tenant so a developer can open the product
 * and walk the real journey without a live crawler or AI provider. Every record
 * is written through the same tables the runtime uses; nothing here is a UI stub.
 *
 * Refuses to run outside development/test.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { PrismaClient, type Prisma } from '@prisma/client';
import { SYSTEM_PROFILES, newId } from '@oma/domain';

// `tsx` does not load the workspace .env the way the Prisma CLI does, so the
// documented one-line command would otherwise fail on a fresh checkout.
for (let dir = process.cwd(), depth = 0; depth < 5; depth += 1, dir = path.dirname(dir)) {
  const candidate = path.join(dir, '.env');
  if (existsSync(candidate)) {
    loadDotenv({ path: candidate });
    break;
  }
}

const prisma = new PrismaClient();

const DEMO_TENANT_SLUG = 'oma-demo';
const DEMO_TENANT_NAME = 'OMA Demo Agency';
export const DEMO_FIXTURE_NOTE = 'Demo fixture — no live connector configured';

/**
 * Allowlist rather than denylist: an unset or unexpected environment must not
 * be treated as safe, because this seed writes directly to whichever database
 * DATABASE_URL points at.
 */
const SEEDABLE_ENVS = new Set(['development', 'test']);
const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'db']);

function assertNotProduction() {
  const env = process.env.OMA_ENV ?? process.env.NODE_ENV;
  if (!env || !SEEDABLE_ENVS.has(env)) {
    throw new Error(
      `demo seed requires NODE_ENV or OMA_ENV to be development or test (got: ${env ?? 'unset'})`,
    );
  }
  // Env vars alone cannot prove which database this points at.
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('demo seed requires DATABASE_URL');
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('demo seed could not parse DATABASE_URL');
  }
  if (!LOCAL_DB_HOSTS.has(host)) {
    throw new Error(`demo seed is refused against a non-local database host (${host})`);
  }
}

async function ensureDemoTenant() {
  const existing = await prisma.tenant.findFirst({ where: { slug: DEMO_TENANT_SLUG } });
  if (existing) return existing;
  return prisma.tenant.create({
    data: { id: newId(), slug: DEMO_TENANT_SLUG, name: DEMO_TENANT_NAME },
  });
}

async function ensureOwnerMembership(tenantId: string) {
  const email = (process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL ?? 'platform-owner@example.com')
    .trim()
    .toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(
      `demo seed needs the bootstrap platform owner (${email}). Start the API once so it is created, then re-run.`,
    );
  }

  let membership = await prisma.membership.findFirst({
    where: { tenantId, userId: user.id, status: 'ACTIVE' },
  });
  if (!membership) {
    membership = await prisma.membership.create({
      data: {
        id: newId(),
        tenantId,
        userId: user.id,
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    });
  }

  const wanted = SYSTEM_PROFILES.COMPANY_OWNER ?? [];
  const held = await prisma.capabilityGrant.findMany({
    where: { membershipId: membership.id, revokedAt: null },
    select: { capabilityCode: true },
  });
  const heldCodes = new Set(held.map((g) => g.capabilityCode));
  const missing = wanted.filter((code) => !heldCodes.has(code));
  if (missing.length > 0) {
    await prisma.capabilityGrant.createMany({
      data: missing.map((capabilityCode) => ({
        id: newId(),
        membershipId: membership.id,
        tenantId,
        capabilityCode,
        sourceProfileCode: 'COMPANY_OWNER',
        grantedBy: user.id,
      })),
    });
  }
  return { user, membership };
}

type PageSpec = {
  path: string;
  title: string;
  classification: Prisma.DiscoveredPageCreateManyInput['classification'];
  fetchStatus: NonNullable<Prisma.DiscoveredPageCreateManyInput['fetchStatus']>;
  httpStatus?: number;
  failureReason?: string;
};

/**
 * A claim is always defined together with the page and excerpt it came from,
 * so the seed cannot produce an observed claim without evidence.
 */
type ClaimSpec = {
  field: string;
  tier: 'REQUIRED_FOR_APPROVAL' | 'DISCOVER_WHEN_AVAILABLE';
  value: string;
  path: string;
  excerpt: string;
  /** Mirrors the confidence the real extractor assigns to this field. */
  confidence: number;
};

type BrandSpec = {
  name: string;
  host?: string;
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
    /** Required fields the fixture could not observe; seeded as unknown. */
    unknownRequiredFields: string[];
  };
};

const BRANDS: BrandSpec[] = [
  {
    // No website yet: proves the "connect a website" entry state.
    name: 'Northwind Services (Demo)',
  },
  {
    name: 'Acme Retail (Demo)',
    host: 'acme-retail.example',
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
          path: '/products/office-chair',
          title: 'Ergonomic Office Chair',
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
        { kind: 'PRODUCT', name: 'Ergonomic Office Chair', category: 'Seating', price: '899.00' },
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
    scan: {
      // Partial coverage: proves the incompleteness disclosure before approval.
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
      // The pages that would carry these were failed or robots-skipped.
      unknownRequiredFields: ['brand.tone_of_voice', 'brand.contact.email'],
    },
  },
];

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

async function seedBrand(tenantId: string, actorUserId: string, spec: BrandSpec) {
  const existing = await prisma.brandWorkspace.findFirst({
    where: { tenantId, name: spec.name },
  });
  if (existing) return { brand: existing, created: false };

  const brandId = newId();
  const brand = await prisma.brandWorkspace.create({
    data: {
      id: brandId,
      tenantId,
      name: spec.name,
      status: spec.host ? 'ACTIVE' : 'DRAFT',
    },
  });

  if (!spec.host) return { brand, created: true };

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

  if (!spec.scan) return { brand, created: true };

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
      // Demo scans are fixture output; the UI reads this to say so.
      connectorMode: 'FIXTURE',
      jobRunId,
      idempotencyKey: `demo-seed:${brandId}:start`,
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
        source: 'demo-fixture',
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
        description: `${product.name} — demo fixture record.`,
        category: product.category,
        priceAmount: product.price ?? null,
        priceCurrency: product.price ? 'AED' : null,
        availability: product.price ? 'in_stock' : null,
        sourcePageId: pageIds.get('/') ?? null,
        dedupeKey: hash(`${product.kind}:${product.name}`),
      },
    });
  }

  // Only claims whose source page was actually fetched can be seeded, so the
  // seed can never write an observed claim without evidence.
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
  await prisma.profileVersion.create({
    data: {
      id: profileVersionId,
      tenantId,
      brandId,
      scanAttemptId: scanId,
      status: 'DRAFT',
      aiAvailability: 'NOT_CONFIGURED',
      coverageSnapshotJson: JSON.stringify({
        fetched: fetched.length,
        failed: failed.length,
        skipped: skipped.length,
        partial: spec.scan.status === 'PARTIAL',
      }),
      sectionsJson: JSON.stringify({
        overview: { source: 'demo-fixture' },
        catalog: { productCount: spec.scan.products.length },
      }),
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

  // Unknowns carry no value, no evidence, and no confidence — matching what the
  // real extractor writes when a field could not be observed.
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

  return { brand, created: true };
}

async function main() {
  assertNotProduction();
  const tenant = await ensureDemoTenant();
  const { user } = await ensureOwnerMembership(tenant.id);

  const results: string[] = [];
  for (const spec of BRANDS) {
    const { brand, created } = await seedBrand(tenant.id, user.id, spec);
    results.push(`${created ? 'created' : 'exists '}  ${brand.name}`);
  }

  console.log(`Demo tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Owner:       ${user.email}`);
  for (const line of results) console.log(`  ${line}`);
  console.log('All demo records are fixtures. No live crawl and no AI provider were used.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
