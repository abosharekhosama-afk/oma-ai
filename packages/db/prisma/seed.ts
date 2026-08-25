import { PrismaClient } from '@prisma/client';
import { SYSTEM_PROFILES, newId } from '@oma/domain';

const prisma = new PrismaClient();

async function main() {
  for (const [code, capabilityCodes] of Object.entries(SYSTEM_PROFILES)) {
    const existing = await prisma.capabilityProfile.findFirst({ where: { code, tenantId: null } });
    if (existing) {
      await prisma.capabilityProfile.update({
        where: { id: existing.id },
        data: { capabilityCodes, nameKey: `profiles.${code}`, isSystem: true },
      });
    } else {
      await prisma.capabilityProfile.create({
        data: {
          id: newId(),
          code,
          nameKey: `profiles.${code}`,
          capabilityCodes,
          isSystem: true,
        },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
