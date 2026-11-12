import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError, infoStateAfterAccept, newId } from '@oma/domain';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class InsightService {
  constructor(private readonly audit: AuditService) {}

  async accept(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    insightId: string,
    input: { row_version: number },
    correlationId?: string,
  ) {
    return this.decide(tenantId, actorUserId, brandId, insightId, 'ACCEPTED', input, correlationId);
  }

  async reject(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    insightId: string,
    input: { row_version: number },
    correlationId?: string,
  ) {
    return this.decide(tenantId, actorUserId, brandId, insightId, 'REJECTED', input, correlationId);
  }

  async bulkAccept(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    profileVersionId: string,
    input: { insights: { id: string; row_version: number }[] },
    correlationId?: string,
  ) {
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const item of input.insights) {
      try {
        const insight = await getPrisma().insightClaim.findFirst({
          where: tenantWhere(tenantId, {
            id: item.id,
            brandId,
            profileVersionId,
          }),
        });
        if (!insight) {
          results.push({ id: item.id, ok: false, error: 'NOT_FOUND' });
          continue;
        }
        if (insight.rowVersion !== item.row_version) {
          results.push({ id: item.id, ok: false, error: 'CONFLICT_VERSION' });
          continue;
        }
        await this.decide(
          tenantId,
          actorUserId,
          brandId,
          item.id,
          'ACCEPTED',
          { row_version: item.row_version },
          correlationId,
        );
        results.push({ id: item.id, ok: true });
      } catch {
        results.push({ id: item.id, ok: false, error: 'FAILED' });
      }
    }
    return {
      data: {
        accepted: results.filter((r) => r.ok).length,
        results,
      },
    };
  }

  private async decide(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    insightId: string,
    decision: 'ACCEPTED' | 'REJECTED',
    input: { row_version: number },
    correlationId?: string,
  ) {
    const insight = await getPrisma().insightClaim.findFirst({
      where: tenantWhere(tenantId, { id: insightId, brandId }),
    });
    if (!insight) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (insight.rowVersion !== input.row_version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }

    const infoState =
      decision === 'ACCEPTED'
        ? infoStateAfterAccept(insight.infoState as never)
        : insight.infoState;

    await getPrisma().$transaction(async (tx) => {
      await tx.insightClaim.update({
        where: { id: insightId },
        data: {
          reviewStatus: decision,
          infoState: infoState as never,
          rowVersion: { increment: 1 },
        },
      });
      await tx.reviewDecision.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          profileVersionId: insight.profileVersionId,
          insightId,
          actorUserId,
          action: decision === 'ACCEPTED' ? 'ACCEPT' : 'REJECT_INSIGHT',
          correlationId,
        },
      });
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: decision === 'ACCEPTED' ? 'brand.insight.accepted' : 'brand.insight.rejected',
      targetType: 'InsightClaim',
      targetId: insightId,
      correlationId,
    });

    return {
      data: {
        id: insightId,
        review_status: decision,
        info_state: infoState,
        row_version: insight.rowVersion + 1,
      },
    };
  }
}
