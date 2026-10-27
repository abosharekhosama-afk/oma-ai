import { getPrisma } from '@oma/db';
import { newId, notificationAllowed } from '@oma/domain';

export async function materializeNotification(input: {
  tenantId: string;
  recipientUserId: string;
  type: string;
  deepLinkPath: string;
  dedupeKey: string;
  sourceOutboxEventId?: string;
}) {
  const user = await getPrisma().user.findUnique({
    where: { id: input.recipientUserId },
    select: { preferencesJson: true },
  });
  if (!notificationAllowed(user?.preferencesJson, input.type)) return null;
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
