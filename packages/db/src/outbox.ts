import type { Prisma, PrismaClient } from '@prisma/client';
import { newId } from '@oma/domain';

export async function writeOutbox(
  tx: Prisma.TransactionClient | PrismaClient,
  input: { tenantId?: string | null; eventType: string; payload: unknown },
) {
  return tx.outboxEvent.create({
    data: {
      id: newId(),
      tenantId: input.tenantId ?? null,
      eventType: input.eventType,
      payloadJson: JSON.stringify(input.payload),
      status: 'PENDING',
    },
  });
}
