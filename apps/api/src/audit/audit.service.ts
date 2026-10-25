import { Injectable } from '@nestjs/common';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { notifyFromAudit } from '../notifications/notify';

@Injectable()
export class AuditService {
  async write(input: {
    actorUserId?: string | null;
    actorType?: string;
    tenantId?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    beforeRef?: string;
    afterRef?: string;
    correlationId?: string;
    requestId?: string;
    ip?: string;
  }) {
    const row = await getPrisma().auditEvent.create({
      data: {
        id: newId(),
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType ?? 'USER',
        tenantId: input.tenantId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        beforeRef: input.beforeRef,
        afterRef: input.afterRef,
        correlationId: input.correlationId,
        requestId: input.requestId,
        ip: input.ip,
      },
    });
    // Fan out in-app notifications for review/approval/comment actions (best-effort).
    await notifyFromAudit(input);
    return row;
  }
}
