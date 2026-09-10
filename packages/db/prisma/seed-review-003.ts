/**
 * Local owner-preview seed for Feature 003 (Strategy Organic & Paid Plans).
 *
 * Dedicated to REVIEW only: refuses production hosts and non-acceptance DBs.
 * Creates one owner account + dedicated tenant with strategy state coverage.
 * Idempotent by stable emails / tenant slug / brand & strategy names.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { PrismaClient, type StrategyVersionStatus } from '@prisma/client';
import { SYSTEM_PROFILES, hashPassword, newId } from '@oma/domain';

for (let dir = process.cwd(), depth = 0; depth < 5; depth += 1, dir = path.dirname(dir)) {
  const candidate = path.join(dir, '.env');
  if (existsSync(candidate)) {
    loadDotenv({ path: candidate });
    break;
  }
}

const prisma = new PrismaClient();

const DEMO_NOTE = 'Demo data — Feature 003 owner preview (no live crawl / no live ads)';
const TENANT_SLUG = 'oma-review-003';
const TENANT_NAME = 'OMA Review 003 Agency';
const BRAND_NAME = 'Horizon Brand (Review 003)';

const OWNER = {
  email: 'review-owner-003@oma.local',
  password: 'ReviewOwner_003_ChangeMe!',
  name: 'Review Owner 003',
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

function foundationJson(positioning: string) {
  return JSON.stringify({
    goals: [{ value: 'Grow qualified demand in key markets', infoClass: 'USER_AUTHORED' }],
    positioning: { value: positioning, infoClass: 'USER_AUTHORED' },
    keyMessages: [{ value: 'Trusted planning, measurable outcomes', infoClass: 'USER_AUTHORED' }],
    constraints: [{ value: 'No live ad spend in 003', infoClass: 'USER_AUTHORED' }],
    marketLocale: { value: 'en-AE', infoClass: 'USER_AUTHORED' },
    notesInternal: DEMO_NOTE,
  });
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

async function ensureBrandWithApprovedProfile(tenantId: string, actorUserId: string) {
  let brand = await prisma.brandWorkspace.findFirst({
    where: { tenantId, name: BRAND_NAME },
  });
  if (!brand) {
    brand = await prisma.brandWorkspace.create({
      data: {
        id: newId(),
        tenantId,
        name: BRAND_NAME,
        status: 'ACTIVE',
      },
    });
  }

  let profile = brand.currentApprovedProfileVersionId
    ? await prisma.profileVersion.findFirst({
        where: {
          id: brand.currentApprovedProfileVersionId,
          tenantId,
          brandId: brand.id,
          status: 'APPROVED',
        },
      })
    : null;

  if (!profile) {
    profile = await prisma.profileVersion.findFirst({
      where: { tenantId, brandId: brand.id, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!profile) {
    const profileVersionId = newId();
    profile = await prisma.profileVersion.create({
      data: {
        id: profileVersionId,
        tenantId,
        brandId: brand.id,
        status: 'APPROVED',
        aiAvailability: 'NOT_CONFIGURED',
        coverageSnapshotJson: JSON.stringify({ label: DEMO_NOTE, source: 'review-003-seed' }),
        sectionsJson: JSON.stringify({
          overview: { name: BRAND_NAME, note: DEMO_NOTE },
        }),
        approvedAt: new Date(),
        approvedByUserId: actorUserId,
        incompletenessAcknowledged: true,
      },
    });
    await prisma.approvalRecord.create({
      data: {
        id: newId(),
        tenantId,
        brandId: brand.id,
        profileVersionId,
        actorUserId,
        acknowledgedIncomplete: true,
        coverageSnapshotJson: JSON.stringify({ label: DEMO_NOTE }),
      },
    });
  }

  if (brand.currentApprovedProfileVersionId !== profile.id) {
    brand = await prisma.brandWorkspace.update({
      where: { id: brand.id },
      data: { currentApprovedProfileVersionId: profile.id, status: 'ACTIVE' },
    });
  }

  return { brand, profileVersionId: profile.id };
}

type TrackSpec = {
  organicEnabled: boolean;
  paidEnabled: boolean;
  organicDisabledRationale?: string | null;
  paidDisabledRationale?: string | null;
  organic?: {
    frequency?: string;
    messageCta?: string;
    pillars?: unknown;
    channels?: unknown;
  };
  paid?: {
    offerAngle?: string;
    budgetAmount?: string;
    budgetCurrency?: string;
    landingDestination?: string;
  };
};

type StrategySeedSpec = {
  name: string;
  status: StrategyVersionStatus;
  linkProfile: boolean;
  tracks: TrackSpec;
  setCurrent?: boolean;
  withEvidence?: boolean;
  /** When set, create a prior SUPERSEDED approved version for compare screenshots. */
  priorSupersededApproved?: boolean;
  reviewComment?: string;
};

const STRATEGY_SPECS: StrategySeedSpec[] = [
  {
    name: 'Draft — Missing Profile',
    status: 'DRAFT',
    linkProfile: false,
    tracks: {
      organicEnabled: true,
      paidEnabled: false,
      paidDisabledRationale: 'Paid not planned for this draft',
    },
  },
  {
    name: 'In Review — Combined',
    status: 'IN_REVIEW',
    linkProfile: true,
    tracks: {
      organicEnabled: true,
      paidEnabled: true,
      organic: {
        frequency: '3x / week',
        messageCta: 'Explore the planning workspace',
        pillars: [{ value: 'Thought leadership', infoClass: 'USER_AUTHORED' }],
        channels: [{ value: 'LinkedIn', infoClass: 'USER_AUTHORED' }],
      },
      paid: {
        offerAngle: 'Demo request — planning only',
        budgetAmount: '5000.00',
        budgetCurrency: 'AED',
        landingDestination: 'https://example.invalid/demo',
      },
    },
    withEvidence: true,
  },
  {
    name: 'Changes Requested — Combined',
    status: 'CHANGES_REQUESTED',
    linkProfile: true,
    tracks: {
      organicEnabled: true,
      paidEnabled: true,
      paid: {
        offerAngle: 'Retargeting angle (planning)',
        budgetAmount: '2500.00',
        budgetCurrency: 'AED',
      },
    },
    reviewComment: 'Please clarify funnel stages before re-submit.',
  },
  {
    name: 'Rejected — Combined',
    status: 'REJECTED',
    linkProfile: true,
    tracks: {
      organicEnabled: true,
      paidEnabled: true,
      paid: {
        offerAngle: 'Rejected package sample',
        budgetAmount: '1000.00',
        budgetCurrency: 'AED',
      },
    },
    reviewComment: 'Package does not match brand constraints.',
  },
  {
    name: 'Approved — Organic Only',
    status: 'APPROVED',
    linkProfile: true,
    tracks: {
      organicEnabled: true,
      paidEnabled: false,
      paidDisabledRationale: 'Organic-only package for this brand cycle',
      organic: {
        frequency: '2x / week',
        messageCta: 'Follow for organic updates',
        pillars: [{ value: 'Product education', infoClass: 'USER_AUTHORED' }],
        channels: [{ value: 'Instagram', infoClass: 'USER_AUTHORED' }],
      },
    },
  },
  {
    name: 'Approved — Paid Only',
    status: 'APPROVED',
    linkProfile: true,
    tracks: {
      organicEnabled: false,
      paidEnabled: true,
      organicDisabledRationale: 'Paid-only planning cycle — organic deferred',
      paid: {
        offerAngle: 'Always-on awareness (planning)',
        budgetAmount: '12000.00',
        budgetCurrency: 'AED',
        landingDestination: 'https://example.invalid/paid',
      },
    },
  },
  {
    name: 'Approved — Combined Current',
    status: 'APPROVED',
    linkProfile: true,
    setCurrent: true,
    priorSupersededApproved: true,
    withEvidence: true,
    tracks: {
      organicEnabled: true,
      paidEnabled: true,
      organic: {
        frequency: '4x / week',
        messageCta: 'See the combined plan',
        pillars: [
          { value: 'Brand story', infoClass: 'USER_AUTHORED' },
          { value: 'Demand capture', infoClass: 'USER_AUTHORED' },
        ],
        channels: [
          { value: 'LinkedIn', infoClass: 'USER_AUTHORED' },
          { value: 'YouTube', infoClass: 'USER_AUTHORED' },
        ],
      },
      paid: {
        offerAngle: 'Combined funnel — planning budget only',
        budgetAmount: '18000.00',
        budgetCurrency: 'AED',
        landingDestination: 'https://example.invalid/combined',
      },
    },
  },
];

async function ensureTracks(
  tenantId: string,
  brandId: string,
  versionId: string,
  tracks: TrackSpec,
) {
  const organicExisting = await prisma.strategyOrganicTrack.findUnique({
    where: { strategyVersionId: versionId },
  });
  const organicData = {
    pillarsJson: tracks.organic?.pillars ? JSON.stringify(tracks.organic.pillars) : null,
    channelsJson: tracks.organic?.channels ? JSON.stringify(tracks.organic.channels) : null,
    formatsJson: JSON.stringify([{ value: 'Short video', infoClass: 'USER_AUTHORED' }]),
    frequency: tracks.organic?.frequency ?? null,
    communityGoals: tracks.organicEnabled ? 'Grow engaged community' : null,
    growthGoals: tracks.organicEnabled ? 'Increase organic reach' : null,
    messageCta: tracks.organic?.messageCta ?? null,
    funnelStagesJson: JSON.stringify(['Awareness', 'Consideration']),
    kpisJson: JSON.stringify([{ name: 'Engagement rate', target: '4%' }]),
    ownerRoleLabelsJson: JSON.stringify(['Content lead']),
    dependenciesJson: JSON.stringify([{ value: DEMO_NOTE, infoClass: 'ASSUMPTION' }]),
  };
  if (organicExisting) {
    await prisma.strategyOrganicTrack.update({
      where: { id: organicExisting.id },
      data: organicData,
    });
  } else {
    await prisma.strategyOrganicTrack.create({
      data: { id: newId(), tenantId, brandId, strategyVersionId: versionId, ...organicData },
    });
  }

  const paidExisting = await prisma.strategyPaidTrack.findUnique({
    where: { strategyVersionId: versionId },
  });
  const paidData = {
    campaignObjectivesJson: JSON.stringify([
      { value: 'Planning awareness', infoClass: 'USER_AUTHORED' },
    ]),
    funnelStagesJson: JSON.stringify(['Awareness', 'Conversion']),
    audiencesJson: JSON.stringify([{ name: 'Category buyers', infoClass: 'ASSUMPTION' }]),
    offerAngle: tracks.paid?.offerAngle ?? null,
    formatsJson: JSON.stringify([{ value: 'Static + video', infoClass: 'USER_AUTHORED' }]),
    placementsJson: JSON.stringify([{ value: 'Feed', infoClass: 'USER_AUTHORED' }]),
    budgetAmount: tracks.paid?.budgetAmount ?? null,
    budgetCurrency: tracks.paid?.budgetCurrency ?? null,
    allocationJson: JSON.stringify({ awareness: 0.6, conversion: 0.4 }),
    expectedKpisJson: JSON.stringify([{ name: 'CTR', note: 'Non-guarantee planning KPI' }]),
    landingDestination: tracks.paid?.landingDestination ?? null,
    approvalNotes: tracks.paidEnabled ? 'Planning-only budget — not live spend' : null,
  };
  if (paidExisting) {
    await prisma.strategyPaidTrack.update({
      where: { id: paidExisting.id },
      data: paidData,
    });
  } else {
    await prisma.strategyPaidTrack.create({
      data: { id: newId(), tenantId, brandId, strategyVersionId: versionId, ...paidData },
    });
  }
}

async function ensureEvidenceLink(
  tenantId: string,
  brandId: string,
  versionId: string,
  actorUserId: string,
) {
  const existing = await prisma.strategyEvidenceLink.findFirst({
    where: { strategyVersionId: versionId, label: 'Linked brand claim (demo)' },
  });
  if (existing) return existing;
  return prisma.strategyEvidenceLink.create({
    data: {
      id: newId(),
      tenantId,
      brandId,
      strategyVersionId: versionId,
      evidenceExcerptId: null,
      profileFieldKey: 'brand.description',
      label: 'Linked brand claim (demo)',
      createdByUserId: actorUserId,
    },
  });
}

async function applyVersionLifecycle(
  versionId: string,
  status: StrategyVersionStatus,
  actorUserId: string,
  profileVersionId: string | null,
  tracks: TrackSpec,
  reviewComment?: string,
) {
  const now = new Date();
  const base = {
    status,
    unknownsAcknowledged: status !== 'DRAFT',
    organicEnabled: tracks.organicEnabled,
    paidEnabled: tracks.paidEnabled,
    organicDisabledRationale: tracks.organicDisabledRationale ?? null,
    paidDisabledRationale: tracks.paidDisabledRationale ?? null,
    linkedApprovedProfileVersionId: profileVersionId,
    submittedAt: null as Date | null,
    submittedByUserId: null as string | null,
    approvedAt: null as Date | null,
    approvedByUserId: null as string | null,
    rejectedAt: null as Date | null,
    rejectedByUserId: null as string | null,
  };

  if (
    status === 'IN_REVIEW' ||
    status === 'CHANGES_REQUESTED' ||
    status === 'APPROVED' ||
    status === 'REJECTED' ||
    status === 'SUPERSEDED'
  ) {
    base.submittedAt = now;
    base.submittedByUserId = actorUserId;
  }
  if (status === 'APPROVED' || status === 'SUPERSEDED') {
    base.approvedAt = now;
    base.approvedByUserId = actorUserId;
  }
  if (status === 'REJECTED') {
    base.rejectedAt = now;
    base.rejectedByUserId = actorUserId;
  }

  await prisma.strategyVersion.update({ where: { id: versionId }, data: base });

  const version = await prisma.strategyVersion.findUniqueOrThrow({ where: { id: versionId } });

  if (
    status === 'IN_REVIEW' ||
    status === 'CHANGES_REQUESTED' ||
    status === 'APPROVED' ||
    status === 'REJECTED'
  ) {
    const submitExisting = await prisma.strategyReviewDecision.findFirst({
      where: { strategyVersionId: versionId, action: 'SUBMIT' },
    });
    if (!submitExisting) {
      await prisma.strategyReviewDecision.create({
        data: {
          id: newId(),
          tenantId: version.tenantId,
          brandId: version.brandId,
          strategyVersionId: versionId,
          actorUserId,
          action: 'SUBMIT',
          capabilityCode: 'strategy.submit',
          comment: 'Seed submit',
        },
      });
    }
  }

  if (status === 'CHANGES_REQUESTED') {
    const existing = await prisma.strategyReviewDecision.findFirst({
      where: { strategyVersionId: versionId, action: 'REQUEST_CHANGES' },
    });
    if (!existing) {
      await prisma.strategyReviewDecision.create({
        data: {
          id: newId(),
          tenantId: version.tenantId,
          brandId: version.brandId,
          strategyVersionId: versionId,
          actorUserId,
          action: 'REQUEST_CHANGES',
          capabilityCode: 'strategy.approve',
          comment: reviewComment ?? 'Changes requested (seed)',
        },
      });
    }
  }

  if (status === 'REJECTED') {
    const existing = await prisma.strategyReviewDecision.findFirst({
      where: { strategyVersionId: versionId, action: 'REJECT' },
    });
    if (!existing) {
      await prisma.strategyReviewDecision.create({
        data: {
          id: newId(),
          tenantId: version.tenantId,
          brandId: version.brandId,
          strategyVersionId: versionId,
          actorUserId,
          action: 'REJECT',
          capabilityCode: 'strategy.approve',
          comment: reviewComment ?? 'Rejected (seed)',
        },
      });
    }
  }

  if (status === 'APPROVED' || status === 'SUPERSEDED') {
    const existingApproval = await prisma.strategyApprovalRecord.findUnique({
      where: { strategyVersionId: versionId },
    });
    if (!existingApproval && profileVersionId) {
      await prisma.strategyApprovalRecord.create({
        data: {
          id: newId(),
          tenantId: version.tenantId,
          brandId: version.brandId,
          strategyVersionId: versionId,
          actorUserId,
          capabilityCode: 'strategy.approve',
          linkedApprovedProfileVersionId: profileVersionId,
          organicEnabled: tracks.organicEnabled,
          paidEnabled: tracks.paidEnabled,
          comment: 'Approved package (seed)',
          unknownsAcknowledged: true,
        },
      });
    }
    const approveDecision = await prisma.strategyReviewDecision.findFirst({
      where: { strategyVersionId: versionId, action: 'APPROVE_PACKAGE' },
    });
    if (!approveDecision) {
      await prisma.strategyReviewDecision.create({
        data: {
          id: newId(),
          tenantId: version.tenantId,
          brandId: version.brandId,
          strategyVersionId: versionId,
          actorUserId,
          action: 'APPROVE_PACKAGE',
          capabilityCode: 'strategy.approve',
          comment: 'Approve package (seed)',
        },
      });
    }
  }
}

async function seedStrategy(
  tenantId: string,
  brandId: string,
  actorUserId: string,
  approvedProfileVersionId: string,
  spec: StrategySeedSpec,
) {
  let strategy = await prisma.strategy.findFirst({
    where: { tenantId, brandId, name: spec.name },
  });
  const created = !strategy;
  if (!strategy) {
    strategy = await prisma.strategy.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        name: spec.name,
        createdByUserId: actorUserId,
        status: 'ACTIVE',
      },
    });
  }

  const profileId = spec.linkProfile ? approvedProfileVersionId : null;
  let versions = await prisma.strategyVersion.findMany({
    where: { strategyId: strategy.id },
    orderBy: { versionNumber: 'asc' },
  });

  if (spec.priorSupersededApproved) {
    let v1 = versions.find((v) => v.versionNumber === 1);
    if (!v1) {
      const id = newId();
      v1 = await prisma.strategyVersion.create({
        data: {
          id,
          tenantId,
          brandId,
          strategyId: strategy.id,
          versionNumber: 1,
          status: 'SUPERSEDED',
          foundationJson: foundationJson(`${spec.name} v1`),
          linkedApprovedProfileVersionId: profileId,
          organicEnabled: true,
          paidEnabled: false,
          paidDisabledRationale: 'v1 organic-only before revise',
          unknownsAcknowledged: true,
          submittedAt: new Date(),
          submittedByUserId: actorUserId,
          approvedAt: new Date(),
          approvedByUserId: actorUserId,
        },
      });
      await ensureTracks(tenantId, brandId, v1.id, {
        organicEnabled: true,
        paidEnabled: false,
        paidDisabledRationale: 'v1 organic-only before revise',
        organic: { frequency: '2x / week', messageCta: 'v1 CTA' },
      });
      await applyVersionLifecycle(v1.id, 'SUPERSEDED', actorUserId, profileId, {
        organicEnabled: true,
        paidEnabled: false,
        paidDisabledRationale: 'v1 organic-only before revise',
      });
    } else {
      await applyVersionLifecycle(v1.id, 'SUPERSEDED', actorUserId, profileId, {
        organicEnabled: true,
        paidEnabled: false,
        paidDisabledRationale: 'v1 organic-only before revise',
      });
      await ensureTracks(tenantId, brandId, v1.id, {
        organicEnabled: true,
        paidEnabled: false,
        paidDisabledRationale: 'v1 organic-only before revise',
        organic: { frequency: '2x / week', messageCta: 'v1 CTA' },
      });
    }

    let v2 = versions.find((v) => v.versionNumber === 2);
    if (!v2) {
      const id = newId();
      v2 = await prisma.strategyVersion.create({
        data: {
          id,
          tenantId,
          brandId,
          strategyId: strategy.id,
          versionNumber: 2,
          status: spec.status,
          foundationJson: foundationJson(`${spec.name} v2`),
          linkedApprovedProfileVersionId: profileId,
          organicEnabled: spec.tracks.organicEnabled,
          paidEnabled: spec.tracks.paidEnabled,
          organicDisabledRationale: spec.tracks.organicDisabledRationale ?? null,
          paidDisabledRationale: spec.tracks.paidDisabledRationale ?? null,
          unknownsAcknowledged: true,
          supersedesVersionId: v1.id,
        },
      });
    }
    await prisma.strategyVersion.update({
      where: { id: v2.id },
      data: {
        foundationJson: foundationJson(`${spec.name} v2`),
        supersedesVersionId: v1.id,
      },
    });
    await ensureTracks(tenantId, brandId, v2.id, spec.tracks);
    await applyVersionLifecycle(
      v2.id,
      spec.status,
      actorUserId,
      profileId,
      spec.tracks,
      spec.reviewComment,
    );
    if (spec.withEvidence) await ensureEvidenceLink(tenantId, brandId, v2.id, actorUserId);

    // Light related rows on latest for UI richness
    const kpi = await prisma.strategyKpi.findFirst({ where: { strategyVersionId: v2.id } });
    if (!kpi) {
      await prisma.strategyKpi.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: v2.id,
          name: 'Qualified leads',
          targetValue: '120',
          unit: 'count',
          appliesTo: 'STRATEGY',
          infoClass: 'USER_AUTHORED',
        },
      });
    }
    const audience = await prisma.strategyAudience.findFirst({
      where: { strategyVersionId: v2.id },
    });
    if (!audience) {
      await prisma.strategyAudience.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: v2.id,
          name: 'Category decision makers',
          description: 'Demo audience for owner preview',
          infoClass: 'ASSUMPTION',
          sortOrder: 0,
        },
      });
    }

    versions = await prisma.strategyVersion.findMany({
      where: { strategyId: strategy.id },
      orderBy: { versionNumber: 'asc' },
    });
    return {
      strategy,
      created,
      latestVersion: versions[versions.length - 1]!,
      compareLeftVersionId: versions.find((v) => v.versionNumber === 1)?.id ?? null,
      compareRightVersionId: versions.find((v) => v.versionNumber === 2)?.id ?? null,
    };
  }

  let latest = versions[versions.length - 1];
  if (!latest) {
    const id = newId();
    latest = await prisma.strategyVersion.create({
      data: {
        id,
        tenantId,
        brandId,
        strategyId: strategy.id,
        versionNumber: 1,
        status: spec.status,
        foundationJson: foundationJson(spec.name),
        linkedApprovedProfileVersionId: profileId,
        organicEnabled: spec.tracks.organicEnabled,
        paidEnabled: spec.tracks.paidEnabled,
        organicDisabledRationale: spec.tracks.organicDisabledRationale ?? null,
        paidDisabledRationale: spec.tracks.paidDisabledRationale ?? null,
      },
    });
  } else {
    await prisma.strategyVersion.update({
      where: { id: latest.id },
      data: { foundationJson: foundationJson(spec.name) },
    });
  }

  await ensureTracks(tenantId, brandId, latest.id, spec.tracks);
  await applyVersionLifecycle(
    latest.id,
    spec.status,
    actorUserId,
    profileId,
    spec.tracks,
    spec.reviewComment,
  );
  if (spec.withEvidence) await ensureEvidenceLink(tenantId, brandId, latest.id, actorUserId);

  return {
    strategy,
    created,
    latestVersion: latest,
    compareLeftVersionId: null as string | null,
    compareRightVersionId: null as string | null,
  };
}

function writeCredentials(
  root: string,
  servedSha: string,
  payload: {
    brandId: string;
    profileVersionId: string;
    strategies: Record<string, { id: string; latestVersionId: string; status: string }>;
    screenshotStrategyId: string;
    compareLeftVersionId: string | null;
    compareRightVersionId: string | null;
    currentStrategyId: string | null;
  },
) {
  const dir = path.join(root, '.review');
  mkdirSync(dir, { recursive: true });
  const body = {
    feature: '003-strategy-organic-paid-plans',
    served_sha: servedSha,
    database: 'oma_ai_acceptance',
    web: process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000',
    accounts: { owner: OWNER },
    brand: {
      id: payload.brandId,
      name: BRAND_NAME,
      profile_version_id: payload.profileVersionId,
      current_strategy_id: payload.currentStrategyId,
    },
    strategies: payload.strategies,
    screenshots: {
      strategy_id: payload.screenshotStrategyId,
      compare_left_version_id: payload.compareLeftVersionId,
      compare_right_version_id: payload.compareRightVersionId,
    },
    notes: [
      DEMO_NOTE,
      'USER_ACCEPTANCE remains PENDING — this seed supports OWNER_PREVIEW_003 only.',
      'Owner has all strategy.* and brand.* capabilities.',
    ],
  };
  writeFileSync(path.join(dir, '003-credentials.json'), JSON.stringify(body, null, 2) + '\n');

  const strategyLines = Object.entries(payload.strategies).flatMap(([key, s]) => [
    `  ${key}:`,
    `    id: ${s.id}`,
    `    latestVersionId: ${s.latestVersionId}`,
    `    status: ${s.status}`,
  ]);

  writeFileSync(
    path.join(dir, '003-credentials.txt'),
    [
      'OMA AI Feature 003 — local owner preview accounts',
      `Served SHA: ${servedSha}`,
      `Web: ${body.web}`,
      '',
      'Owner:',
      `  email: ${OWNER.email}`,
      `  password: ${OWNER.password}`,
      '',
      `Tenant: ${TENANT_NAME} (${TENANT_SLUG})`,
      `Brand: ${BRAND_NAME}`,
      `  brandId: ${payload.brandId}`,
      `  profileVersionId: ${payload.profileVersionId}`,
      `  currentStrategyId: ${payload.currentStrategyId ?? '(none)'}`,
      '',
      'Strategies:',
      ...strategyLines,
      '',
      'Screenshots:',
      `  strategyId: ${payload.screenshotStrategyId}`,
      `  compareLeftVersionId: ${payload.compareLeftVersionId ?? ''}`,
      `  compareRightVersionId: ${payload.compareRightVersionId ?? ''}`,
      '',
      DEMO_NOTE,
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
  await ensureMembership(tenant.id, owner.id, 'COMPANY_OWNER', SYSTEM_PROFILES.COMPANY_OWNER ?? []);

  const { brand, profileVersionId } = await ensureBrandWithApprovedProfile(tenant.id, owner.id);

  const strategies: Record<string, { id: string; latestVersionId: string; status: string }> = {};
  let screenshotStrategyId = '';
  let compareLeftVersionId: string | null = null;
  let compareRightVersionId: string | null = null;
  let currentStrategyId: string | null = null;
  const results: string[] = [];

  for (const spec of STRATEGY_SPECS) {
    const result = await seedStrategy(tenant.id, brand.id, owner.id, profileVersionId, spec);
    const key = spec.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    strategies[key] = {
      id: result.strategy.id,
      latestVersionId: result.latestVersion.id,
      status: spec.status,
    };
    if (spec.setCurrent) {
      currentStrategyId = result.strategy.id;
      screenshotStrategyId = result.strategy.id;
      compareLeftVersionId = result.compareLeftVersionId;
      compareRightVersionId = result.compareRightVersionId;
    }
    results.push(`${result.created ? 'created' : 'exists '}  ${spec.name} (${spec.status})`);
  }

  if (currentStrategyId) {
    await prisma.brandWorkspace.update({
      where: { id: brand.id },
      data: { currentApprovedStrategyId: currentStrategyId },
    });
  }

  if (!screenshotStrategyId) {
    screenshotStrategyId = Object.values(strategies)[0]?.id ?? '';
  }

  writeCredentials(root, servedSha, {
    brandId: brand.id,
    profileVersionId,
    strategies,
    screenshotStrategyId,
    compareLeftVersionId,
    compareRightVersionId,
    currentStrategyId,
  });

  console.log(`Review tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Owner:         ${OWNER.email}`);
  console.log(`Brand:         ${BRAND_NAME} (${brand.id})`);
  console.log(`Profile:       ${profileVersionId} (APPROVED)`);
  console.log(`Current strat: ${currentStrategyId ?? '(none)'}`);
  for (const line of results) console.log(`  ${line}`);
  console.log(`Credentials:   ${path.join(root, '.review/003-credentials.txt')}`);
  console.log(DEMO_NOTE);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
