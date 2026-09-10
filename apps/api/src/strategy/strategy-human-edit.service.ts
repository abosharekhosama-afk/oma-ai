import { Injectable } from '@nestjs/common';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

/** Append-only draft field edit aid (Feature 003). */
@Injectable()
export class StrategyHumanEditService {
  async append(input: {
    tenantId: string;
    brandId: string;
    strategyVersionId: string;
    actorUserId: string;
    fieldPath: string;
    beforeRef?: string | null;
    afterRef?: string | null;
    correlationId?: string;
  }) {
    return getPrisma().strategyHumanEdit.create({
      data: {
        id: newId(),
        tenantId: input.tenantId,
        brandId: input.brandId,
        strategyVersionId: input.strategyVersionId,
        actorUserId: input.actorUserId,
        fieldPath: input.fieldPath,
        beforeRef: input.beforeRef ?? null,
        afterRef: input.afterRef ?? null,
        correlationId: input.correlationId,
      },
    });
  }
}
