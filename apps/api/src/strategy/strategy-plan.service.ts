import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  allocateBudget,
  canPatchVersionContent,
  newId,
  organicPlanInputSchema,
  organicPlanIssues,
  paidPlanInputSchema,
  paidPlanIssues,
  paidTargetingSchema,
  strategyResearchModeFromEnv,
  experimentVariantSchema,
  type OrganicPlanInput,
  type PaidPlanInput,
  type PlanIssue,
} from '@oma/domain';
import { z } from 'zod';
import type { AuditService } from '../audit/audit.service';

type Tx = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0];
type Db = ReturnType<typeof getPrisma> | Tx;

type PlanRowMeta = { aiRunId?: string | null };

function parseJsonSafe<T>(raw: string | null | undefined, schema: z.ZodType<T>, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

function zodIssues(error: z.ZodError): PlanIssue[] {
  return error.issues.map((i) => ({
    path: i.path.join('.'),
    code: 'SCHEMA',
    message: i.message,
  }));
}

function invalid(issues: PlanIssue[]): DomainError {
  return new DomainError(
    'VALIDATION_FAILED',
    'Strategy plan is invalid',
    400,
    'errors.strategy_plan_invalid',
    issues,
  );
}

/** Parse + cross-validate organic input. Throws VALIDATION_FAILED with per-path issues. */
export function parseOrganicPlan(input: unknown): OrganicPlanInput {
  const parsed = organicPlanInputSchema.safeParse(input ?? {});
  if (!parsed.success) throw invalid(zodIssues(parsed.error));
  const issues = organicPlanIssues(parsed.data);
  if (issues.length) throw invalid(issues);
  return parsed.data;
}

/** Parse + cross-validate paid input. Throws VALIDATION_FAILED with per-path issues. */
export function parsePaidPlan(input: unknown): PaidPlanInput {
  const parsed = paidPlanInputSchema.safeParse(input ?? {});
  if (!parsed.success) throw invalid(zodIssues(parsed.error));
  const issues = paidPlanIssues(parsed.data);
  if (issues.length) throw invalid(issues);
  return parsed.data;
}

/** Replace the organic children of a version (caller owns the transaction + guards). */
export async function writeOrganicPlan(
  tx: Tx,
  scope: { tenantId: string; brandId: string; versionId: string },
  plan: OrganicPlanInput,
  meta: PlanRowMeta = {},
) {
  const base = {
    tenantId: scope.tenantId,
    brandId: scope.brandId,
    strategyVersionId: scope.versionId,
  };
  await tx.strategyContentPillar.deleteMany({ where: { strategyVersionId: scope.versionId } });
  await tx.strategySeoKeyword.deleteMany({ where: { strategyVersionId: scope.versionId } });
  await tx.strategyContentGap.deleteMany({ where: { strategyVersionId: scope.versionId } });
  if (plan.pillars.length) {
    await tx.strategyContentPillar.createMany({
      data: plan.pillars.map((p, i) => ({
        ...base,
        id: newId(),
        key: p.key,
        nameEn: p.name_en,
        nameAr: p.name_ar,
        description: p.description ?? null,
        funnelStage: p.funnel_stage ?? null,
        shareTargetPct: p.share_target_pct ?? null,
        infoClass: p.info_class,
        source: p.source,
        evidenceRefs: p.evidence_refs,
        aiRunId: meta.aiRunId ?? null,
        sortOrder: i,
      })),
    });
  }
  if (plan.seo_keywords.length) {
    await tx.strategySeoKeyword.createMany({
      data: plan.seo_keywords.map((k, i) => ({
        ...base,
        id: newId(),
        keyword: k.keyword,
        locale: k.locale,
        intent: k.intent,
        pillarKey: k.pillar_key ?? null,
        priority: k.priority,
        monthlyVolume: k.monthly_volume ?? null,
        difficulty: k.difficulty ?? null,
        metricSource: k.metric_source ?? null,
        infoClass: k.info_class,
        source: k.source,
        evidenceRefs: k.evidence_refs,
        aiRunId: meta.aiRunId ?? null,
        sortOrder: i,
      })),
    });
  }
  if (plan.content_gaps.length) {
    await tx.strategyContentGap.createMany({
      data: plan.content_gaps.map((g, i) => ({
        ...base,
        id: newId(),
        kind: g.kind,
        topic: g.topic,
        description: g.description ?? null,
        pillarKey: g.pillar_key ?? null,
        priority: g.priority,
        infoClass: g.info_class,
        source: g.source,
        evidenceRefs: g.evidence_refs,
        aiRunId: meta.aiRunId ?? null,
        sortOrder: i,
      })),
    });
  }
}

/** Replace the paid children of a version (caller owns the transaction + guards). */
export async function writePaidPlan(
  tx: Tx,
  scope: { tenantId: string; brandId: string; versionId: string },
  plan: PaidPlanInput,
  meta: PlanRowMeta = {},
) {
  const base = {
    tenantId: scope.tenantId,
    brandId: scope.brandId,
    strategyVersionId: scope.versionId,
  };
  await tx.strategyPaidAllocation.deleteMany({ where: { strategyVersionId: scope.versionId } });
  await tx.strategyPaidAudience.deleteMany({ where: { strategyVersionId: scope.versionId } });
  await tx.strategyExperiment.deleteMany({ where: { strategyVersionId: scope.versionId } });
  if (plan.allocations.length) {
    await tx.strategyPaidAllocation.createMany({
      data: plan.allocations.map((a, i) => ({
        ...base,
        id: newId(),
        platform: a.platform,
        objective: a.objective,
        sharePct: a.share_pct,
        funnelStage: a.funnel_stage ?? null,
        rationale: a.rationale ?? null,
        infoClass: a.info_class,
        source: a.source,
        evidenceRefs: a.evidence_refs,
        aiRunId: meta.aiRunId ?? null,
        sortOrder: i,
      })),
    });
  }
  if (plan.audiences.length) {
    await tx.strategyPaidAudience.createMany({
      data: plan.audiences.map((a, i) => ({
        ...base,
        id: newId(),
        key: a.key,
        name: a.name,
        description: a.description ?? null,
        platform: a.platform ?? null,
        funnelStage: a.funnel_stage ?? null,
        targetingJson: JSON.stringify(a.targeting),
        infoClass: a.info_class,
        source: a.source,
        evidenceRefs: a.evidence_refs,
        aiRunId: meta.aiRunId ?? null,
        sortOrder: i,
      })),
    });
  }
  if (plan.experiments.length) {
    await tx.strategyExperiment.createMany({
      data: plan.experiments.map((e, i) => ({
        ...base,
        id: newId(),
        name: e.name,
        hypothesis: e.hypothesis,
        variable: e.variable,
        platform: e.platform ?? null,
        audienceKey: e.audience_key ?? null,
        variantsJson: JSON.stringify(e.variants),
        primaryMetric: e.primary_metric,
        minSampleSize: e.min_sample_size ?? null,
        durationDays: e.duration_days ?? null,
        status: e.status,
        infoClass: e.info_class,
        source: e.source,
        evidenceRefs: e.evidence_refs,
        aiRunId: meta.aiRunId ?? null,
        sortOrder: i,
      })),
    });
  }
}

/** Read the v2 plan of a version as API input shapes (used by copy + AI context). */
export async function readStrategyPlan(
  db: Db,
  versionId: string,
): Promise<{ organic: OrganicPlanInput; paid: PaidPlanInput; aiRunIds: string[] }> {
  const where = { strategyVersionId: versionId };
  const orderBy = { sortOrder: 'asc' as const };
  const [pillars, keywords, gaps, allocations, audiences, experiments] = await Promise.all([
    db.strategyContentPillar.findMany({ where, orderBy }),
    db.strategySeoKeyword.findMany({ where, orderBy }),
    db.strategyContentGap.findMany({ where, orderBy }),
    db.strategyPaidAllocation.findMany({ where, orderBy }),
    db.strategyPaidAudience.findMany({ where, orderBy }),
    db.strategyExperiment.findMany({ where, orderBy }),
  ]);
  const aiRunIds = [
    ...new Set(
      [...pillars, ...keywords, ...gaps, ...allocations, ...audiences, ...experiments]
        .map((r) => r.aiRunId)
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  return {
    aiRunIds,
    organic: {
      pillars: pillars.map((p) => ({
        key: p.key,
        name_en: p.nameEn,
        name_ar: p.nameAr,
        description: p.description,
        funnel_stage: p.funnelStage,
        share_target_pct: p.shareTargetPct,
        info_class: p.infoClass,
        source: p.source,
        evidence_refs: p.evidenceRefs,
      })),
      seo_keywords: keywords.map((k) => ({
        keyword: k.keyword,
        locale: k.locale,
        intent: k.intent,
        pillar_key: k.pillarKey,
        priority: k.priority,
        monthly_volume: k.monthlyVolume,
        difficulty: k.difficulty,
        metric_source: k.metricSource,
        info_class: k.infoClass,
        source: k.source,
        evidence_refs: k.evidenceRefs,
      })),
      content_gaps: gaps.map((g) => ({
        kind: g.kind,
        topic: g.topic,
        description: g.description,
        pillar_key: g.pillarKey,
        priority: g.priority,
        info_class: g.infoClass,
        source: g.source,
        evidence_refs: g.evidenceRefs,
      })),
    },
    paid: {
      allocations: allocations.map((a) => ({
        platform: a.platform,
        objective: a.objective,
        share_pct: a.sharePct,
        funnel_stage: a.funnelStage,
        rationale: a.rationale,
        info_class: a.infoClass,
        source: a.source,
        evidence_refs: a.evidenceRefs,
      })),
      audiences: audiences.map((a) => ({
        key: a.key,
        name: a.name,
        description: a.description,
        platform: a.platform,
        funnel_stage: a.funnelStage,
        targeting: parseJsonSafe(a.targetingJson, paidTargetingSchema, {
          locations: [],
          languages: [],
          genders: [],
          interests: [],
          behaviors: [],
          exclusions: [],
        }),
        info_class: a.infoClass,
        source: a.source,
        evidence_refs: a.evidenceRefs,
      })),
      experiments: experiments.map((e) => ({
        name: e.name,
        hypothesis: e.hypothesis,
        variable: e.variable,
        platform: e.platform,
        audience_key: e.audienceKey,
        variants: parseJsonSafe(e.variantsJson, z.array(experimentVariantSchema), []),
        primary_metric: e.primaryMetric,
        min_sample_size: e.minSampleSize,
        duration_days: e.durationDays,
        status: e.status,
        info_class: e.infoClass,
        source: e.source,
        evidence_refs: e.evidenceRefs,
      })),
    },
  };
}

/** Copy v2 plan rows from one version to another (revise / clone / from-approved). */
export async function copyStrategyPlan(
  tx: Tx,
  scope: { tenantId: string; brandId: string },
  sourceVersionId: string,
  targetVersionId: string,
) {
  const plan = await readStrategyPlan(tx, sourceVersionId);
  const target = { ...scope, versionId: targetVersionId };
  await writeOrganicPlan(tx, target, plan.organic);
  await writePaidPlan(tx, target, plan.paid);
}

/** Which research adapter feeds keyword metrics (DEC-021). Never claims measured data. */
function researchSummary() {
  return { mode: strategyResearchModeFromEnv(process.env.STRATEGY_RESEARCH_MODE), measured: false };
}

@Injectable()
export class StrategyPlanService {
  constructor(private readonly audit: AuditService) {}

  private async requireVersion(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
  ) {
    const version = await getPrisma().strategyVersion.findFirst({
      where: tenantWhere(tenantId, { id: versionId, brandId, strategyId }),
    });
    if (!version) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    return version;
  }

  async getPlan(tenantId: string, brandId: string, strategyId: string, versionId: string) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    const [plan, paidTrack] = await Promise.all([
      readStrategyPlan(getPrisma(), versionId),
      getPrisma().strategyPaidTrack.findUnique({
        where: { strategyVersionId: versionId },
        select: { budgetAmount: true, budgetCurrency: true },
      }),
    ]);
    const budget = paidTrack?.budgetAmount ? Number(paidTrack.budgetAmount) : null;
    const amounts =
      budget != null
        ? allocateBudget(
            budget,
            plan.paid.allocations.map((a) => a.share_pct),
          )
        : null;
    const allocationTotal = plan.paid.allocations.reduce((s, a) => s + a.share_pct, 0);
    return {
      data: {
        strategy_version_id: version.id,
        status: version.status,
        row_version: version.rowVersion,
        editable: canPatchVersionContent(version.status as never),
        organic_enabled: version.organicEnabled,
        paid_enabled: version.paidEnabled,
        organic: plan.organic,
        paid: {
          ...plan.paid,
          budget_amount: budget != null ? budget.toFixed(2) : null,
          budget_currency: paidTrack?.budgetCurrency ?? null,
          allocations: plan.paid.allocations.map((a, i) => ({
            ...a,
            amount: amounts ? amounts[i]!.toFixed(2) : null,
          })),
          allocation_total_pct: allocationTotal,
        },
        ai_run_ids: plan.aiRunIds,
        research: researchSummary(),
      },
    };
  }

  private async guardedWrite(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    rowVersion: unknown,
    track: 'organic' | 'paid',
    write: (tx: Tx) => Promise<void>,
    correlationId?: string,
  ) {
    if (typeof rowVersion !== 'number' || !Number.isInteger(rowVersion)) {
      throw invalid([{ path: 'row_version', code: 'SCHEMA', message: 'row_version is required' }]);
    }
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    if (!canPatchVersionContent(version.status as never)) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Version is immutable; revise to edit',
        409,
        'errors.conflict_state',
        [{ code: 'MUST_REVISE' }],
      );
    }
    if (track === 'organic' && !version.organicEnabled) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Organic track is disabled for this version',
        409,
        'errors.strategy_track_disabled',
        [{ code: 'ORGANIC_TRACK_DISABLED' }],
      );
    }
    if (track === 'paid' && !version.paidEnabled) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Paid track is disabled for this version',
        409,
        'errors.strategy_track_disabled',
        [{ code: 'PAID_TRACK_DISABLED' }],
      );
    }
    await getPrisma().$transaction(async (tx) => {
      const bumped = await tx.strategyVersion.updateMany({
        where: { id: versionId, tenantId, rowVersion, status: version.status },
        data: { rowVersion: { increment: 1 } },
      });
      if (bumped.count !== 1) {
        throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
      }
      await write(tx);
      await tx.strategyHumanEdit.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: versionId,
          actorUserId,
          fieldPath: `plan.${track}`,
          beforeRef: String(rowVersion),
          afterRef: String(rowVersion + 1),
          correlationId: correlationId ?? null,
        },
      });
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: `strategy.plan.${track}_replaced`,
      targetType: 'StrategyVersion',
      targetId: versionId,
      correlationId,
    });
    return this.getPlan(tenantId, brandId, strategyId, versionId);
  }

  async putOrganic(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    body: Record<string, unknown>,
    correlationId?: string,
  ) {
    const { row_version: rowVersion, ...rest } = body ?? {};
    const plan = parseOrganicPlan(rest);
    return this.guardedWrite(
      tenantId,
      actorUserId,
      brandId,
      strategyId,
      versionId,
      rowVersion,
      'organic',
      (tx) => writeOrganicPlan(tx, { tenantId, brandId, versionId }, plan),
      correlationId,
    );
  }

  async putPaid(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    body: Record<string, unknown>,
    correlationId?: string,
  ) {
    const { row_version: rowVersion, ...rest } = body ?? {};
    const plan = parsePaidPlan(rest);
    return this.guardedWrite(
      tenantId,
      actorUserId,
      brandId,
      strategyId,
      versionId,
      rowVersion,
      'paid',
      (tx) => writePaidPlan(tx, { tenantId, brandId, versionId }, plan),
      correlationId,
    );
  }
}
