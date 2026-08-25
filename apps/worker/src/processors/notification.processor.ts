import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

export async function materializeNotification(input: {
  tenantId: string;
  recipientUserId: string;
  type: string;
  deepLinkPath: string;
  dedupeKey: string;
  sourceOutboxEventId?: string;
}) {
  return getPrisma().notification.upsert({
    where: { tenantId_dedupeKey: { tenantId: input.tenantId, dedupeKey: input.dedupeKey } },
    create: {
      id: newId(),
      tenantId: input.tenantId,
      recipientUserId: input.recipientUserId,
      type: input.type,
      deepLinkPath: input.deepLinkPath,
      dedupeKey: input.dedupeKey,
      sourceOutboxEventId: input.sourceOutboxEventId,
    },
    update: {},
  });
}
