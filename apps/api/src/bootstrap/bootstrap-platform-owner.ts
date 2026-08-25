import { getPrisma } from '@oma/db';
import { SYSTEM_PROFILES, hashPassword, newId } from '@oma/domain';
import { loadEnv } from '@oma/config';

async function main() {
  const env = loadEnv();
  if (!env.BOOTSTRAP_PLATFORM_OWNER_EMAIL || !env.BOOTSTRAP_PLATFORM_OWNER_PASSWORD) {
    throw new Error('BOOTSTRAP_PLATFORM_OWNER_EMAIL/PASSWORD required');
  }
  const prisma = getPrisma();
  const email = env.BOOTSTRAP_PLATFORM_OWNER_EMAIL.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: newId(),
        email,
        name: 'Platform Owner',
        passwordHash: await hashPassword(env.BOOTSTRAP_PLATFORM_OWNER_PASSWORD),
        status: 'ACTIVE',
      },
    });
  }
  let tenant = await prisma.tenant.findUnique({ where: { slug: 'platform' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { id: newId(), name: 'Platform', slug: 'platform', status: 'ACTIVE' },
    });
  }
  let membership = await prisma.membership.findFirst({
    where: { tenantId: tenant.id, userId: user.id },
  });
  if (!membership) {
    membership = await prisma.membership.create({
      data: {
        id: newId(),
        tenantId: tenant.id,
        userId: user.id,
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    });
  }
  for (const code of SYSTEM_PROFILES.PLATFORM_OWNER ?? []) {
    const exists = await prisma.capabilityGrant.findFirst({
      where: { membershipId: membership.id, capabilityCode: code, revokedAt: null },
    });
    if (!exists) {
      await prisma.capabilityGrant.create({
        data: {
          id: newId(),
          membershipId: membership.id,
          tenantId: tenant.id,
          capabilityCode: code,
          sourceProfileCode: 'PLATFORM_OWNER',
        },
      });
    }
  }
  console.log(
    JSON.stringify({ userId: user.id, tenantId: tenant.id, membershipId: membership.id }),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
