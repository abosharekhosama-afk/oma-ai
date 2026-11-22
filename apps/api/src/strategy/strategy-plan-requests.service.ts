import { ForbiddenException, Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  buildPlanWorkRequestDrafts,
  briefReadiness,
  catalogOfferingsFromProfileSections,
  newId,
  buildPlanRequestImpactReport,
  comparableFromStored,
  catalogOfferingsFromDiscoveryRows,
  type CatalogOffering,
  type CatalogOfferingsSource,
  type PlanWorkRequestDraft,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';
import { OpsService } from '../content/ops.service';
import { parseOptionalDate } from '../content/content.service';
import { enrichCatalogOfferingsWithApprovedMedia } from '../catalog/catalog.service';
import {
  createStrategyPlanContentDraft,
  refreshStrategyPlanContentFromDraft,
} from '../content/plan-content-handoff.service';
import { readStrategyPlan } from './strategy-plan.service';

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
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
      select: { currentApprovedProfileVersionId: true },
    });
    const approvedProfileId = brand?.currentApprovedProfileVersionId;
    const approvedProfile = approvedProfileId
      ? await getPrisma().profileVersion.findFirst({
          where: tenantWhere(tenantId, {
            id: approvedProfileId,
            brandId,
            status: 'APPROVED',
          }),
          select: { id: true },
        })
      : null;
    if (!approvedProfile) {
      throw new ForbiddenException({
        code: 'BRAND_PROFILE_NOT_APPROVED',
        message: 'لا يمكن بناء طلبات الخطة قبل اعتماد ملف العلامة التجارية بحالة APPROVED.',
        brand_id: brandId,
        required_status: 'APPROVED',
      });
    }
    if (version.linkedApprovedProfileVersionId) {
      const linked = await getPrisma().profileVersion.findFirst({
        where: tenantWhere(tenantId, {
          id: version.linkedApprovedProfileVersionId,
          brandId,
          status: 'APPROVED',
        }),
        select: { id: true },
      });
      if (!linked) {
        throw new ForbiddenException({
          code: 'LINKED_PROFILE_NOT_APPROVED',
          message: 'الاستراتيجية تشير إلى ملف علامة تجارية غير معتمد.',
          profile_version_id: version.linkedApprovedProfileVersionId,
          required_status: 'APPROVED',
        });
      }
    }
    return version;
  }

  private async loadCatalogOfferings(
    tenantId: string,
    brandId: string,
    version: Awaited<ReturnType<typeof this.loadApprovedVersion>>,
    options?: { auditFallback?: boolean; actorUserId?: string; correlationId?: string },
  ): Promise<{ offerings: CatalogOffering[]; catalog_source: CatalogOfferingsSource }> {
    const tryProfile = async (profileVersionId: string | null | undefined) => {
      if (!profileVersionId) return { offerings: [] as CatalogOffering[], profile: null };
      const profile = await getPrisma().profileVersion.findFirst({
        where: tenantWhere(tenantId, { id: profileVersionId, brandId, status: 'APPROVED' }),
      });
      if (!profile?.sectionsJson) return { offerings: [], profile };
      const sections = parseJson<Record<string, unknown>>(profile.sectionsJson, {});
      const offerings = catalogOfferingsFromProfileSections(sections);
      return { offerings, profile };
    };

    const finish = async (
      offerings: CatalogOffering[],
      source: CatalogOfferingsSource,
      scanId?: string | null,
    ) => {
      const enriched = await enrichCatalogOfferingsWithApprovedMedia(tenantId, offerings);
      if (
        source === 'discovery_fallback' &&
        options?.auditFallback &&
        options.actorUserId &&
        enriched.length > 0
      ) {
        await this.audit.write({
          actorUserId: options.actorUserId,
          tenantId,
          action: 'strategy.plan.catalog_discovery_fallback',
          targetType: 'StrategyVersion',
          targetId: version.id,
          afterRef: scanId ?? undefined,
          correlationId: options.correlationId,
        });
      }
      return { offerings: enriched, catalog_source: enriched.length > 0 ? source : 'none' };
    };

    const linkedResult = await tryProfile(version.linkedApprovedProfileVersionId);
    if (linkedResult.offerings.length > 0) {
      return finish(linkedResult.offerings, 'profile_sections');
    }

    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    const approvedResult = await tryProfile(brand?.currentApprovedProfileVersionId ?? null);
    if (approvedResult.offerings.length > 0) {
      return finish(approvedResult.offerings, 'profile_sections');
    }

    const profileForScan = linkedResult.profile ?? approvedResult.profile ?? null;
    const scan = profileForScan?.scanAttemptId
      ? await getPrisma().scanAttempt.findFirst({
          where: tenantWhere(tenantId, {
            id: profileForScan.scanAttemptId,
            brandId,
            status: { in: ['SUCCEEDED', 'PARTIAL'] },
          }),
        })
      : await getPrisma().scanAttempt.findFirst({
          where: tenantWhere(tenantId, {
            brandId,
            status: { in: ['SUCCEEDED', 'PARTIAL'] },
          }),
          orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
        });

    if (!scan) {
      return { offerings: [], catalog_source: 'none' };
    }

    const rows = await getPrisma().discoveredProductService.findMany({
      where: tenantWhere(tenantId, { scanAttemptId: scan.id, brandId }),
    });
    const fromDiscovery = catalogOfferingsFromDiscoveryRows(rows);
    return finish(fromDiscovery, 'discovery_fallback', scan.id);
  }

  private async buildDrafts(
    version: Awaited<ReturnType<typeof this.loadApprovedVersion>>,
    catalogOfferings: CatalogOffering[],
  ) {
    const organic = version.organicTrack;
    const paid = version.paidTrack;
    const plan =
      version.paidEnabled || version.organicEnabled
        ? await readStrategyPlan(getPrisma(), version.id)
        : null;
    const paidPlan = version.paidEnabled ? (plan?.paid ?? null) : null;
    const organicPlan = version.organicEnabled ? (plan?.organic ?? null) : null;
    const paidBudgetRaw = paid?.budgetAmount != null ? Number(paid.budgetAmount) : null;
    const paidBudgetAmount =
      paidBudgetRaw != null && Number.isFinite(paidBudgetRaw) ? paidBudgetRaw : null;
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
      catalogOfferings,
      organicPlan,
      paidPlan,
      paidBudgetAmount: Number.isFinite(paidBudgetAmount) ? paidBudgetAmount : null,
    });
  }

  async previewPlanToRequests(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
  ) {
    const version = await this.loadApprovedVersion(tenantId, brandId, strategyId, versionId);
    const { offerings: catalogOfferings, catalog_source } = await this.loadCatalogOfferings(
      tenantId,
      brandId,
      version,
    );
    const drafts = await this.buildDrafts(version, catalogOfferings);
    const existing = await getPrisma().workRequest.findMany({
      where: { tenantId, strategyVersionId: versionId },
      select: { planSourceKey: true },
    });
    const existingKeys = new Set(
      existing.map((row) => row.planSourceKey).filter(Boolean) as string[],
    );
    const catalogAnchored = drafts.filter((draft) => draft.plan_source_key.includes(':catalog:'));
    return {
      data: {
        strategy_version_id: versionId,
        strategy_id: strategyId,
        catalog_offerings_count: catalogOfferings.length,
        catalog_source,
        catalog_request_count: catalogAnchored.length,
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

  private async resolveCommitDefaults(
    tenantId: string,
    brandId: string,
    defaults?: {
      assignee_user_id?: string | null;
      due_at?: string | null;
      campaign_id?: string | null;
    },
  ) {
    if (!defaults) return {};
    let campaignId: string | null | undefined;
    if (defaults.campaign_id) {
      const campaign = await getPrisma().campaign.findFirst({
        where: { id: defaults.campaign_id, tenantId, brandId },
      });
      if (!campaign) {
        throw new DomainError('NOT_FOUND', 'Campaign not found', 404, 'errors.not_found');
      }
      campaignId = campaign.id;
    } else if (defaults.campaign_id === null) {
      campaignId = null;
    }
    const dueAt =
      defaults.due_at !== undefined
        ? parseOptionalDate(defaults.due_at as string | null, 'dueAt')
        : undefined;
    return {
      assigneeUserId:
        defaults.assignee_user_id !== undefined ? defaults.assignee_user_id : undefined,
      dueAt,
      campaignId,
    };
  }

  private createDataFromDraft(
    draft: PlanWorkRequestDraft,
    ctx: {
      tenantId: string;
      brandId: string;
      strategyId: string;
      versionId: string;
      actorUserId: string;
    },
    defaults: Awaited<ReturnType<StrategyPlanRequestsService['resolveCommitDefaults']>>,
  ) {
    const readiness = briefReadiness({
      objective: draft.brief.objective.en,
      audience: draft.brief.audience.en,
      keyMessage: draft.brief.keyMessage.en,
    });
    const assigneeUserId = defaults.assigneeUserId ?? null;
    const status = assigneeUserId ? 'ASSIGNED' : 'OPEN';
    return {
      id: newId(),
      tenantId: ctx.tenantId,
      brandId: ctx.brandId,
      strategyId: ctx.strategyId,
      strategyVersionId: ctx.versionId,
      planSourceKey: draft.plan_source_key,
      titleEn: draft.title.en,
      titleAr: draft.title.ar,
      descriptionEn: draft.description.en,
      descriptionAr: draft.description.ar,
      type: 'CONTENT' as const,
      priority: 'MEDIUM' as const,
      status: status as 'OPEN' | 'ASSIGNED',
      requesterUserId: ctx.actorUserId,
      assigneeUserId,
      dueAt: defaults.dueAt ?? null,
      campaignId: defaults.campaignId ?? null,
      channels: draft.channels,
      formats: draft.formats,
      briefObjectiveEn: draft.brief.objective.en,
      briefObjectiveAr: draft.brief.objective.ar,
      briefAudienceEn: draft.brief.audience.en,
      briefAudienceAr: draft.brief.audience.ar,
      briefKeyMessageEn: draft.brief.keyMessage.en,
      briefKeyMessageAr: draft.brief.keyMessage.ar,
      briefReadyAt: readiness.ready ? new Date() : null,
    };
  }

  async commitPlanToRequests(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: {
      plan_source_keys?: string[];
      defaults?: {
        assignee_user_id?: string | null;
        due_at?: string | null;
        campaign_id?: string | null;
      };
    },
    correlationId?: string,
  ) {
    const version = await this.loadApprovedVersion(tenantId, brandId, strategyId, versionId);
    const { offerings: catalogOfferings, catalog_source } = await this.loadCatalogOfferings(
      tenantId,
      brandId,
      version,
      { auditFallback: true, actorUserId, correlationId },
    );
    const drafts = await this.buildDrafts(version, catalogOfferings);
    const defaults = await this.resolveCommitDefaults(tenantId, brandId, input.defaults);
    const selected =
      input.plan_source_keys && input.plan_source_keys.length > 0
        ? drafts.filter((d) => input.plan_source_keys!.includes(d.plan_source_key))
        : drafts;

    const created: string[] = [];
    const createdContent: string[] = [];
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
      const row = await getPrisma().workRequest.create({
        data: this.createDataFromDraft(
          draft,
          { tenantId, brandId, strategyId, versionId, actorUserId },
          defaults,
        ),
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
      const content = await createStrategyPlanContentDraft(
        this.audit,
        {
          tenantId,
          brandId,
          actorUserId,
          requestId: row.id,
          strategyId,
          strategyVersionId: versionId,
          correlationId,
        },
        draft,
        { campaignId: defaults.campaignId, dueAt: defaults.dueAt ?? null },
      );
      if (content?.created) createdContent.push(content.contentId);
    }

    return {
      data: {
        created_request_ids: created,
        created_content_ids: createdContent,
        skipped_plan_source_keys: skipped,
        strategy_version_id: versionId,
        catalog_source,
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

  async planRequestImpact(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
  ) {
    const version = await this.loadApprovedVersion(tenantId, brandId, strategyId, versionId);
    const { offerings: catalogOfferings } = await this.loadCatalogOfferings(
      tenantId,
      brandId,
      version,
    );
    const drafts = await this.buildDrafts(version, catalogOfferings);
    const prior = await getPrisma().workRequest.findMany({
      where: {
        tenantId,
        brandId,
        strategyId,
        planSourceKey: { not: null },
        strategyVersionId: { not: versionId },
      },
      include: { tasks: { select: { id: true, status: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const report = buildPlanRequestImpactReport({
      drafts,
      prior_requests: prior.map((row) => ({
        id: row.id,
        strategy_version_id: row.strategyVersionId ?? versionId,
        plan_source_key: row.planSourceKey ?? '',
        comparable: comparableFromStored({
          planSourceKey: row.planSourceKey ?? '',
          titleEn: row.titleEn,
          titleAr: row.titleAr,
          descriptionEn: row.descriptionEn,
          descriptionAr: row.descriptionAr,
          channels: row.channels,
          formats: row.formats,
          briefObjectiveEn: row.briefObjectiveEn,
          briefAudienceEn: row.briefAudienceEn,
          briefKeyMessageEn: row.briefKeyMessageEn,
        }),
        has_open_task: row.tasks.some((t) => !['DONE', 'CANCELLED'].includes(String(t.status))),
      })),
    });
    const actionable = report.filter((r) => r.status === 'drifted' || r.status === 'orphaned');
    return {
      data: {
        strategy_version_id: versionId,
        impact: report,
        needs_decision: actionable.length > 0,
        drifted_count: report.filter((r) => r.status === 'drifted').length,
        orphaned_count: report.filter((r) => r.status === 'orphaned').length,
      },
    };
  }

  async syncPlanRequestsFromVersion(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: { request_ids: string[] },
    correlationId?: string,
  ) {
    if (!input.request_ids?.length) {
      throw new DomainError('VALIDATION_FAILED', 'request_ids required', 400, 'errors.validation');
    }
    const version = await this.loadApprovedVersion(tenantId, brandId, strategyId, versionId);
    const { offerings: catalogOfferings } = await this.loadCatalogOfferings(
      tenantId,
      brandId,
      version,
    );
    const drafts = await this.buildDrafts(version, catalogOfferings);
    const draftByKey = new Map(drafts.map((d) => [d.plan_source_key, d]));
    const impact = await this.planRequestImpact(tenantId, brandId, strategyId, versionId);
    const driftedIds = new Set(
      impact.data.impact.filter((r) => r.status === 'drifted').map((r) => r.request_id),
    );
    const updated: string[] = [];
    const skipped: Array<{ request_id: string; reason: string }> = [];
    for (const requestId of input.request_ids) {
      if (!driftedIds.has(requestId)) {
        skipped.push({ request_id: requestId, reason: 'not_drifted' });
        continue;
      }
      const request = await getPrisma().workRequest.findFirst({
        where: tenantWhere(tenantId, { id: requestId, brandId, strategyId }),
      });
      if (!request?.planSourceKey) {
        skipped.push({ request_id: requestId, reason: 'not_found' });
        continue;
      }
      const draft = draftByKey.get(request.planSourceKey);
      if (!draft) {
        skipped.push({ request_id: requestId, reason: 'orphaned' });
        continue;
      }
      const readiness = briefReadiness({
        objective: draft.brief.objective.en,
        audience: draft.brief.audience.en,
        keyMessage: draft.brief.keyMessage.en,
      });
      await getPrisma().workRequest.update({
        where: { id: requestId },
        data: {
          titleEn: draft.title.en,
          titleAr: draft.title.ar,
          descriptionEn: draft.description.en,
          descriptionAr: draft.description.ar,
          channels: draft.channels,
          formats: draft.formats,
          briefObjectiveEn: draft.brief.objective.en,
          briefObjectiveAr: draft.brief.objective.ar,
          briefAudienceEn: draft.brief.audience.en,
          briefAudienceAr: draft.brief.audience.ar,
          briefKeyMessageEn: draft.brief.keyMessage.en,
          briefKeyMessageAr: draft.brief.keyMessage.ar,
          briefReadyAt: readiness.ready ? new Date() : null,
          strategyVersionId: versionId,
        },
      });
      updated.push(requestId);
      await this.audit.write({
        actorUserId,
        tenantId,
        action: 'request.synced_from_strategy',
        targetType: 'WorkRequest',
        targetId: requestId,
        afterRef: `${strategyId}:${versionId}:${request.planSourceKey}`,
        correlationId,
      });
      if (request.contentId) {
        await refreshStrategyPlanContentFromDraft(
          this.audit,
          {
            tenantId,
            brandId,
            actorUserId,
            requestId,
            strategyId,
            strategyVersionId: versionId,
            correlationId,
          },
          draft,
          request.contentId,
        );
      } else {
        await createStrategyPlanContentDraft(
          this.audit,
          {
            tenantId,
            brandId,
            actorUserId,
            requestId,
            strategyId,
            strategyVersionId: versionId,
            correlationId,
          },
          draft,
          { campaignId: request.campaignId, dueAt: request.dueAt },
        );
      }
    }
    return {
      data: {
        updated_request_ids: updated,
        skipped,
        strategy_version_id: versionId,
      },
    };
  }
}
