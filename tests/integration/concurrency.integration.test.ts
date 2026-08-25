import { describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

describe('optimistic concurrency', () => {
  it('increments membership version on suspend', async () => {
    const prisma = getPrisma();
    const tenant = await prisma.tenant.create({
      data: {
        id: newId(),
        name: 'C',
        slug: `c-${newId().toLowerCase().slice(-6)}`,
        status: 'ACTIVE',
      },
    });
    const m = await prisma.membership.create({
      data: { id: newId(), tenantId: tenant.id, status: 'INVITED', version: 1 },
    });
    const updated = await prisma.membership.update({
      where: { id: m.id },
      data: { status: 'SUSPENDED', version: { increment: 1 } },
    });
    expect(updated.version).toBe(2);
  });
});
