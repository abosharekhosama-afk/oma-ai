import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError, buildPlanWorkRequestDrafts, briefReadiness, newId } from '@oma/domain';
import { AuditService } from '../audit/audit.service';
import { OpsService } from '../content/ops.service';

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

@Injectable()
export class StrategyPlanRequestsService {
  constructor(
    private readonly audit: AuditService,
    private readonly ops: OpsService,
  ) {}

  private async loadApprovedVersion(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
  ) {
    const version = await getPrisma().strategyVersion.findFirst({
      where: tenantWhere(tenantId, { id: versionId, brandId, strategyId }),
      include: {
        strategy: true,
        organicTrack: true,
        paidTrack: true,
        audiences: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!version) {
      throw new DomainError('NOT_FOUND', 'Strategy version not found', 404, 'errors.not_found');
    }
    if (version.status !== 'APPROVED') {
      throw new DomainError(
        'CONFLICT_STATE',
        'Strategy package must be approved before converting plan to requests',
        409,
        'errors.strategy_not_approved',
      );
    }
    return version;
  }

  private buildDrafts(version: Awaited<ReturnType<typeof this.loadApprovedVersion>>) {
    const organic = version.organicTrack;
    const paid = version.paidTrack;
    return buildPlanWorkRequestDrafts({
      strategyName: version.strategy.name,
      foundation: parseJson(version.foundationJson, {}),
      organicEnabled: version.organicEnabled,
      paidEnabled: version.paidEnabled,
      organic: organic
        ? {
            pillars: parseJson(organic.pillarsJson, []),
            channels: parseJson(organic.channelsJson, []),
            formats: parseJson(organic.formatsJson, []),
            growth_goals: organic.growthGoals,
            message_cta: organic.messageCta,
          }
        : null,
      paid: paid
        ? {
            campaign_objectives: parseJson(paid.campaignObjectivesJson, []),
            formats: parseJson(paid.formatsJson, []),
            offer_angle: paid.offerAngle,
          }
        : null,
      audiences: version.audiences.map((a) => ({ name: a.name, description: a.description })),
    });
  }

  async previewPlanToRequests(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
  ) {
    const version = await this.loadApprovedVersion(tenantId, brandId, strategyId, versionId);
    const drafts = this.buildDrafts(version);
    const existing = await getPrisma().workRequest.findMany({
      where: { tenantId, strategyVersionId: versionId },
      select: { planSourceKey: true },
    });
    const existingKeys = new Set(
      existing.map((row) => row.planSourceKey).filter(Boolean) as string[],
    );
    return {
      data: {
        strategy_version_id: versionId,
        strategy_id: strategyId,
        preview: drafts.map((draft) => ({
          ...draft,
          already_created: existingKeys.has(draft.plan_source_key),
          brief_ready: briefReadiness({
            objective: draft.brief.objective.en,
            audience: draft.brief.audience.en,
            keyMessage: draft.brief.keyMessage.en,
          }).ready,
        })),
      },
    };
  }

  async commitPlanToRequests(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: { plan_source_keys?: string[] },
    correlationId?: string,
  ) {
    const version = await this.loadApprovedVersion(tenantId, brandId, strategyId, versionId);
    const drafts = this.buildDrafts(version);
    const selected =
      input.plan_source_keys && input.plan_source_keys.length > 0
        ? drafts.filter((d) => input.plan_source_keys!.includes(d.plan_source_key))
        : drafts;

    const created: string[] = [];
    const skipped: string[] = [];

    for (const draft of selected) {
      const existing = await getPrisma().workRequest.findFirst({
        where: {
          tenantId,
          strategyVersionId: versionId,
          planSourceKey: draft.plan_source_key,
        },
      });
      if (existing) {
        skipped.push(draft.plan_source_key);
        continue;
      }
      const readiness = briefReadiness({
        objective: draft.brief.objective.en,
        audience: draft.brief.audience.en,
        keyMessage: draft.brief.keyMessage.en,
      });
      const row = await getPrisma().workRequest.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyId,
          strategyVersionId: versionId,
          planSourceKey: draft.plan_source_key,
          titleEn: draft.title.en,
          titleAr: draft.title.ar,
          descriptionEn: draft.description.en,
          descriptionAr: draft.description.ar,
          type: 'CONTENT',
          priority: 'MEDIUM',
          status: 'OPEN',
          requesterUserId: actorUserId,
          channels: draft.channels,
          formats: draft.formats,
          briefObjectiveEn: draft.brief.objective.en,
          briefObjectiveAr: draft.brief.objective.ar,
          briefAudienceEn: draft.brief.audience.en,
          briefAudienceAr: draft.brief.audience.ar,
          briefKeyMessageEn: draft.brief.keyMessage.en,
          briefKeyMessageAr: draft.brief.keyMessage.ar,
          briefReadyAt: readiness.ready ? new Date() : null,
        },
      });
      created.push(row.id);
      await this.audit.write({
        actorUserId,
        tenantId,
        action: 'request.created_from_strategy',
        targetType: 'WorkRequest',
        targetId: row.id,
        afterRef: `${strategyId}:${versionId}:${draft.plan_source_key}`,
        correlationId,
      });
    }

    return {
      data: {
        created_request_ids: created,
        skipped_plan_source_keys: skipped,
        strategy_version_id: versionId,
      },
    };
  }

  async convertLinkedRequestsToTasks(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    correlationId?: string,
  ) {
    await this.loadApprovedVersion(tenantId, brandId, strategyId, versionId);
    const requests = await getPrisma().workRequest.findMany({
      where: { tenantId, brandId, strategyVersionId: versionId },
      orderBy: { createdAt: 'asc' },
    });
    const created: string[] = [];
    const skipped: Array<{ request_id: string; reason: string }> = [];
    for (const request of requests) {
      const existing = await getPrisma().workTask.findFirst({
        where: { tenantId, requestId: request.id },
      });
      if (existing) {
        skipped.push({ request_id: request.id, reason: 'task_exists' });
        continue;
      }
      try {
        const result = await this.ops.convertRequestToTask(
          tenantId,
          actorUserId,
          request.id,
          correlationId,
        );
        created.push(result.data.id);
      } catch (err) {
        const message = err instanceof DomainError ? err.code : 'convert_failed';
        skipped.push({ request_id: request.id, reason: message });
      }
    }
    return {
      data: {
        created_task_ids: created,
        skipped,
        strategy_version_id: versionId,
      },
    };
  }
}
