/**
 * Idempotent membership / brand-access repair (Nov 02 live QA).
 *
 * Prefer the Prisma migration `20261102190000_live_qa_brand_access_repair` which
 * auto-applies on Render. This script is the readable twin for local/ops runs:
 *
 *   DATABASE_URL=... pnpm --filter @oma/db exec tsx prisma/scripts/repair-live-qa-membership-nov02.ts
 *
 * What it does (safe to re-run):
 * - Ensures ACTIVE memberships that can read/create content also have brand.read
 * - Backfills BrandMember rows so collaborators keep seeing newly created brands
 * - Does NOT revoke roles, delete tenants, or wipe data
 *
 * Wipe NOT recommended: production already holds posts, invites, social tokens,
 * WorkDrive links, and publish history. This repair restores visibility instead.
 */
import { createHash } from 'node:crypto';
import { getPrisma } from '../../src';

function idFor(prefix: string, parts: string[]) {
  return `${prefix}_${createHash('md5').update(parts.join(':')).digest('hex')}`;
}

async function main() {
  const prisma = getPrisma();
  const memberships = await prisma.membership.findMany({
    where: { status: 'ACTIVE', userId: { not: null } },
    include: { grants: { where: { revokedAt: null } } },
  });
  let brandReadAdded = 0;
  for (const m of memberships) {
    const codes = new Set(m.grants.map((g) => g.capabilityCode));
    if (codes.has('brand.read')) continue;
    if (!codes.has('content.read') && !codes.has('content.create') && !codes.has('tenant.manage')) {
      continue;
    }
    const source = m.grants.find((g) => g.sourceProfileCode)?.sourceProfileCode ?? 'MEMBER';
    await prisma.capabilityGrant.create({
      data: {
        id: idFor('mig_brand_read', [m.id]),
        membershipId: m.id,
        tenantId: m.tenantId,
        capabilityCode: 'brand.read',
        sourceProfileCode: source,
      },
    });
    brandReadAdded += 1;
  }

  const brands = await prisma.brandWorkspace.findMany({
    where: { deletedAt: null },
    select: { id: true, tenantId: true },
  });
  let brandMembersAdded = 0;
  for (const b of brands) {
    const members = await prisma.membership.findMany({
      where: { tenantId: b.tenantId, status: 'ACTIVE', userId: { not: null } },
      include: { grants: { where: { revokedAt: null } } },
    });
    for (const m of members) {
      const isAdmin = m.grants.some((g) => g.capabilityCode === 'tenant.manage');
      if (isAdmin) continue;
      const uid = m.userId!;
      const existing = await prisma.brandMember.findUnique({
        where: { brandId_userId: { brandId: b.id, userId: uid } },
      });
      if (existing) continue;
      const role = (() => {
        const dr = (m.displayRole ?? '').toLowerCase();
        if (m.membershipKind === 'client') return 'APPROVER' as const;
        if (dr.includes('approv')) return 'APPROVER' as const;
        if (dr === 'viewer' || dr === 'guest') return 'VIEWER' as const;
        if (['owner', 'administrator', 'admin', 'manager'].includes(dr)) return 'MANAGER' as const;
        return 'EDITOR' as const;
      })();
      await prisma.brandMember.create({
        data: {
          id: idFor('bm_qa', [b.id, uid]),
          tenantId: b.tenantId,
          brandId: b.id,
          userId: uid,
          role,
          addedBy: 'script-live-qa-nov02',
        },
      });
      brandMembersAdded += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        brandReadAdded,
        brandMembersAdded,
        wipeRecommended: false,
        note: 'Multi-company memberships are preserved; switch tenants via /app/select-company.',
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
