import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  allocateBudget,
  canPatchVersionContent,
  newId,
  pillarKeyFromLabel,
  postsPerWeekFromText,
  STRATEGY_PLAN_LIMITS,
  organicPlanInputSchema,
  mergeSeoProposalsIntoOrganicPlan,
  organicPlanIssues,
  pickSeoProposalsById,
  paidPlanInputSchema,
  paidPlanIssues,
  paidTargetingSchema,
  strategyResearchModeFromEnv,
  experimentVariantSchema,
  aiProposeHonestyMessage,
  deterministicStrategyPlanProposal,
  isAiAnalysisAvailable,
  mustRefuseAiPropose,
  strategyAiMode,
  strategyPlanProposalJsonSchema,
  validateStrategyPlanProposal,
  type StrategyPlanProposalInputs,
  type StrategyPlanTracks,
  type OrganicPlanInput,
  type PaidPlanInput,
  type PlanIssue,
  type SeoStrategyProposalPackage,
  visibleSeoRows,
} from '@oma/domain';
import { z } from 'zod';
import { buildStrategyPlanPrompt } from '@oma/ai';
import type { AuditService } from '../audit/audit.service';
import { loadBrandContext } from '../ai/brand-context.service';
import { runStructuredGeneration } from '../ai/structured-run';

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
  if (plan.cadence !== undefined) {
    await tx.strategyChannelCadence.deleteMany({ where: { strategyVersionId: scope.versionId } });
    if (plan.cadence.length) {
      await tx.strategyChannelCadence.createMany({
        data: plan.cadence.map((c, i) => ({
          ...base,
          id: newId(),
          channel: c.channel,
          postsPerWeek: c.posts_per_week,
          formats: c.formats,
          infoClass: c.info_class,
          source: c.source,
          sortOrder: i,
        })),
      });
    }
  }
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
        gscImpressions: k.gsc_impressions ?? null,
        gscClicks: k.gsc_clicks ?? null,
        gscPosition: k.gsc_position ?? null,
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
  if (plan.flights !== undefined) {
    await tx.strategyPaidFlight.deleteMany({ where: { strategyVersionId: scope.versionId } });
    if (plan.flights.length) {
      await tx.strategyPaidFlight.createMany({
        data: plan.flights.map((f, i) => ({
          ...base,
          id: newId(),
          key: f.key,
          name: f.name,
          platform: f.platform,
          objective: f.objective ?? null,
          audienceKey: f.audience_key ?? null,
          startDate: new Date(`${f.start_date}T00:00:00Z`),
          endDate: new Date(`${f.end_date}T00:00:00Z`),
          budgetAmount: f.budget_amount ?? null,
          currency: f.currency ?? null,
          notes: f.notes ?? null,
          sortOrder: i,
        })),
      });
    }
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

/**
 * Map the legacy foundation AI's organic lists onto the v2 plan (DEC-029 4.1).
 * Only fills empty tables; rows are labelled AI_PROPOSAL / AI_ESTIMATE.
 */
export async function applyFoundationOrganicToPlan(
  tx: Tx,
  input: {
    tenantId: string;
    brandId: string;
    versionId: string;
    runId: string;
    pillars: string[];
    channels: string[];
    formats: string[];
    frequency: string | null;
  },
) {
  const base = {
    tenantId: input.tenantId,
    brandId: input.brandId,
    strategyVersionId: input.versionId,
  };
  const where = { strategyVersionId: input.versionId };
  const [pillarCount, cadenceCount] = await Promise.all([
    tx.strategyContentPillar.count({ where }),
    tx.strategyChannelCadence.count({ where }),
  ]);
  const pillars = input.pillars.map((p) => p.trim()).filter(Boolean);
  if (pillarCount === 0 && pillars.length) {
    const taken = new Set<string>();
    await tx.strategyContentPillar.createMany({
      data: pillars.slice(0, STRATEGY_PLAN_LIMITS.pillars).map((label, i) => ({
        ...base,
        id: newId(),
        key: pillarKeyFromLabel(label, i, taken),
        nameEn: label.slice(0, 120),
        nameAr: label.slice(0, 120),
        infoClass: 'AI_PROPOSAL' as const,
        source: 'AI_ESTIMATE' as const,
        aiRunId: input.runId,
        sortOrder: i,
      })),
    });
  }
  const seen = new Set<string>();
  const channels = input.channels
    .map((c) => c.trim().slice(0, 40))
    .filter((c) => c && !seen.has(c.toLowerCase()) && seen.add(c.toLowerCase()));
  if (cadenceCount === 0 && channels.length) {
    const perWeek = postsPerWeekFromText(input.frequency);
    const formats = input.formats
      .map((f) => f.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 8);
    await tx.strategyChannelCadence.createMany({
      data: channels.slice(0, STRATEGY_PLAN_LIMITS.cadence).map((channel, i) => ({
        ...base,
        id: newId(),
        channel,
        postsPerWeek: perWeek ?? 3,
        formats,
        infoClass: perWeek == null ? ('ASSUMPTION' as const) : ('AI_PROPOSAL' as const),
        source: 'AI_ESTIMATE' as const,
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
  const [cadence, pillars, keywordRows, gapRows, allocations, audiences, experiments, flights] =
    await Promise.all([
      db.strategyChannelCadence.findMany({ where, orderBy }),
      db.strategyContentPillar.findMany({ where, orderBy }),
      db.strategySeoKeyword.findMany({ where, orderBy }),
      db.strategyContentGap.findMany({ where, orderBy }),
      db.strategyPaidAllocation.findMany({ where, orderBy }),
      db.strategyPaidAudience.findMany({ where, orderBy }),
      db.strategyExperiment.findMany({ where, orderBy }),
      db.strategyPaidFlight.findMany({ where, orderBy }),
    ]);
  // Sample (FIXTURE) SEO rows stay in the DB but never reach a real environment's views.
  const keywords = visibleSeoRows(keywordRows);
  const gaps = visibleSeoRows(gapRows);
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
      cadence: cadence.map((c) => ({
        channel: c.channel,
        posts_per_week: c.postsPerWeek,
        formats: c.formats,
        info_class: c.infoClass,
        source: c.source,
      })),
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
        gsc_impressions: k.gscImpressions,
        gsc_clicks: k.gscClicks,
        gsc_position: k.gscPosition,
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
      flights: flights.map((f) => ({
        key: f.key,
        name: f.name,
        platform: f.platform,
        objective: f.objective,
        audience_key: f.audienceKey,
        start_date: f.startDate.toISOString().slice(0, 10),
        end_date: f.endDate.toISOString().slice(0, 10),
        budget_amount: f.budgetAmount != null ? Number(f.budgetAmount) : null,
        currency: f.currency,
        notes: f.notes,
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
const PLAN_PROPOSAL_KIND = 'strategy_plan_proposal';

type PlanTrackName = 'organic' | 'paid';

function parseTracksRequest(raw: unknown): PlanTrackName[] | null {
  if (raw == null) return null;
  const parsed = z
    .array(z.enum(['organic', 'paid']))
    .min(1)
    .max(2)
    .safeParse(raw);
  if (!parsed.success) {
    throw invalid([
      { path: 'tracks', code: 'SCHEMA', message: 'tracks must be organic and/or paid' },
    ]);
  }
  return [...new Set(parsed.data)];
}

function proposalPayload(inputs: StrategyPlanProposalInputs) {
  return { organic: inputs.organic, paid: inputs.paid };
}

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
    tracks: Array<'organic' | 'paid'>,
    write: (tx: Tx) => Promise<void>,
    correlationId?: string,
    auditAction?: string,
    auditAfterRef?: string,
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
    if (tracks.includes('organic') && !version.organicEnabled) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Organic track is disabled for this version',
        409,
        'errors.strategy_track_disabled',
        [{ code: 'ORGANIC_TRACK_DISABLED' }],
      );
    }
    if (tracks.includes('paid') && !version.paidEnabled) {
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
      for (const track of tracks) {
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
      }
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: auditAction ?? `strategy.plan.${tracks[0]}_replaced`,
      targetType: 'StrategyVersion',
      targetId: versionId,
      correlationId,
      ...(auditAfterRef ? { afterRef: auditAfterRef } : {}),
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
      ['organic'],
      (tx) => writeOrganicPlan(tx, { tenantId, brandId, versionId }, plan),
      correlationId,
    );
  }

  async mergeSeoIntoOrganic(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    proposalPackage: SeoStrategyProposalPackage,
    body: { row_version: number; proposal_ids: string[] },
    correlationId?: string,
  ) {
    const ids = Array.isArray(body.proposal_ids) ? body.proposal_ids.filter(Boolean) : [];
    if (ids.length === 0) {
      throw invalid([
        { path: 'proposal_ids', code: 'SCHEMA', message: 'Select at least one SEO proposal' },
      ]);
    }
    await this.requireVersion(tenantId, brandId, strategyId, versionId);
    const picked = pickSeoProposalsById(proposalPackage, ids);
    if (picked.seo_keywords.length === 0 && picked.content_gaps.length === 0) {
      throw new DomainError('NOT_FOUND', 'No matching SEO proposals', 404, 'errors.not_found');
    }
    const current = await readStrategyPlan(getPrisma(), versionId);
    const merged = mergeSeoProposalsIntoOrganicPlan(current.organic, picked);
    return this.putOrganic(
      tenantId,
      actorUserId,
      brandId,
      strategyId,
      versionId,
      {
        row_version: body.row_version,
        ...merged,
      },
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
    const { row_version: rowVersion, budget_amount, budget_currency, ...rest } = body ?? {};
    const plan = parsePaidPlan(rest);
    const scope = { tenantId, brandId, versionId };
    return this.guardedWrite(
      tenantId,
      actorUserId,
      brandId,
      strategyId,
      versionId,
      rowVersion,
      ['paid'],
      async (tx) => {
        await writePaidPlan(tx, scope, plan);
        const track = await tx.strategyPaidTrack.findUnique({
          where: { strategyVersionId: versionId },
        });
        if (track) {
          const objectives = plan.allocations.map((a) => ({
            platform: a.platform,
            objective: a.objective,
            share_pct: a.share_pct,
          }));
          await tx.strategyPaidTrack.update({
            where: { id: track.id },
            data: {
              campaignObjectivesJson: JSON.stringify(objectives),
              ...(budget_amount !== undefined
                ? {
                    budgetAmount:
                      budget_amount == null || budget_amount === '' ? null : String(budget_amount),
                  }
                : {}),
              ...(budget_currency !== undefined ? { budgetCurrency: String(budget_currency) } : {}),
              rowVersion: { increment: 1 },
            },
          });
        }
      },
      correlationId,
    );
  }

  /**
   * Generate an Organic/Paid plan proposal from the brand's APPROVED profile
   * (DEC-020). Nothing is written to the version: the caller reviews the
   * proposal and calls `acceptProposal`. `mode: 'template'` returns a
   * deterministic starter built only from approved profile fields when AI is
   * unavailable; it is never stored as an AI run.
   */
  async proposePlan(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    body: Record<string, unknown>,
    opts: {
      idempotencyKey?: string;
      correlationId?: string;
      /** DEC-029 4.10: internal only (never read from the request body). */
      reviewFindings?: unknown[];
    } = {},
  ) {
    const mode = body?.mode == null ? 'ai' : body.mode;
    if (mode !== 'ai' && mode !== 'template') {
      throw invalid([{ path: 'mode', code: 'SCHEMA', message: 'mode must be ai or template' }]);
    }
    const requested = parseTracksRequest(body?.tracks);
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    if (!canPatchVersionContent(version.status as never)) {
      throw new DomainError(
        'APPROVED_VERSION_IMMUTABLE',
        'Only draft strategy versions can receive a generated plan.',
        409,
        'errors.approved_immutable',
        [{ code: 'MUST_REVISE' }],
      );
    }
    const tracks: StrategyPlanTracks = {
      organic: version.organicEnabled && (!requested || requested.includes('organic')),
      paid: version.paidEnabled && (!requested || requested.includes('paid')),
    };
    if (!tracks.organic && !tracks.paid) {
      throw new DomainError(
        'CONFLICT_STATE',
        'No enabled track to generate',
        409,
        'errors.strategy_track_disabled',
        [{ code: 'NO_ENABLED_TRACK' }],
      );
    }
    const brand = await loadBrandContext(tenantId, brandId);
    if (!brand.usedApprovedProfile || !brand.profileVersionId) {
      throw new DomainError(
        'BRAND_PROFILE_NOT_APPROVED',
        'Approve the brand profile before generating a strategy plan.',
        403,
        'errors.brand_profile_not_approved',
        [{ code: 'BRAND_PROFILE_NOT_APPROVED', brand_id: brandId }],
      );
    }
    const language: 'en' | 'ar' =
      brand.languages.includes('ar') && !brand.languages.includes('en') ? 'ar' : 'en';
    const evidenceRefs = [brand.profileVersionId];
    const deterministic = () =>
      deterministicStrategyPlanProposal({
        brandName: brand.brandName,
        language,
        products: brand.products,
        services: brand.services,
        audiences: brand.audiences,
        tracks,
      });
    const base = {
      tracks: (['organic', 'paid'] as const).filter((t) => tracks[t]),
      brand_profile_version_id: brand.profileVersionId,
      requires_acceptance: true,
      auto_approved: false,
      version_status: version.status,
      row_version: version.rowVersion,
    };

    if (mode === 'template') {
      const checked = validateStrategyPlanProposal(deterministic(), tracks, {
        source: 'DETERMINISTIC',
        evidenceRefs,
      });
      if (!checked.ok) throw invalid(checked.issues);
      return {
        data: {
          ...base,
          mode: 'template' as const,
          run_id: null,
          replayed: false,
          rationale: checked.proposal.rationale,
          proposal: proposalPayload(checked.inputs),
        },
      };
    }

    const aiMode = strategyAiMode();
    const available = isAiAnalysisAvailable();
    if (
      mustRefuseAiPropose(version.aiAvailability as never, { mode: aiMode, aiAvailable: available })
    ) {
      const code = !available || aiMode === 'not_configured' ? 'AI_NOT_CONFIGURED' : 'AI_REFUSED';
      throw new DomainError(
        code,
        aiProposeHonestyMessage(code),
        503,
        `errors.${code.toLowerCase()}`,
        [{ code, manual_journey: true, fallback: 'template' }],
      );
    }

    const current = await readStrategyPlan(getPrisma(), versionId);
    const prompt = buildStrategyPlanPrompt({
      language,
      brand,
      organicEnabled: tracks.organic,
      paidEnabled: tracks.paid,
      foundation: JSON.parse(version.foundationJson || '{}'),
      currentPlan: { organic: current.organic, paid: current.paid },
      reviewFindings: opts.reviewFindings ?? null,
    });
    const run = await runStructuredGeneration({
      tenantId,
      actorUserId,
      useCase: prompt.useCase,
      sourceEntityType: 'strategy_version',
      sourceEntityId: versionId,
      sourceVersion: `${version.id}:${version.rowVersion}`,
      idempotencyKey: opts.idempotencyKey,
      correlationId: opts.correlationId,
      prompt,
      schema: strategyPlanProposalJsonSchema(),
      parse: (raw) => {
        const checked = validateStrategyPlanProposal(raw, tracks, {
          source: 'AI_ESTIMATE',
          evidenceRefs,
        });
        return checked.ok ? { ok: true as const, value: checked.proposal } : { ok: false as const };
      },
      testValue: deterministic,
      serialize: (value) => value,
      brandProfileVersionId: brand.profileVersionId,
      metadata: {
        kind: PLAN_PROPOSAL_KIND,
        tracks: base.tracks,
        ...(opts.reviewFindings?.length ? { monthly_review: true } : {}),
      },
    });
    const checked = validateStrategyPlanProposal(run.value, tracks, {
      source: 'AI_ESTIMATE',
      evidenceRefs,
    });
    if (!checked.ok) throw invalid(checked.issues);
    return {
      data: {
        ...base,
        mode: 'ai' as const,
        run_id: run.runId,
        replayed: run.replayed,
        model: run.model,
        prompt_id: prompt.promptId,
        prompt_version: prompt.promptVersion,
        rationale: checked.proposal.rationale,
        proposal: proposalPayload(checked.inputs),
      },
    };
  }

  /**
   * Apply an AI plan proposal to a DRAFT version after explicit human review.
   * Rows keep `info_class=AI_PROPOSAL`, `source=AI_ESTIMATE` and the run id.
   * The version stays DRAFT: approval still goes through the review flow.
   */
  async acceptProposal(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    body: Record<string, unknown>,
    correlationId?: string,
  ) {
    const runId = typeof body?.run_id === 'string' ? body.run_id : '';
    if (!runId) {
      throw invalid([{ path: 'run_id', code: 'SCHEMA', message: 'run_id is required' }]);
    }
    const requested = parseTracksRequest(body?.tracks);
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    const run = await getPrisma().aiRun.findFirst({
      where: {
        id: runId,
        tenantId,
        sourceEntityType: 'strategy_version',
        sourceEntityId: versionId,
      },
    });
    const meta = (() => {
      try {
        return JSON.parse(run?.metadataJson || '{}') as {
          kind?: string;
          tracks?: PlanTrackName[];
          brandProfileVersionId?: string | null;
        };
      } catch {
        return {};
      }
    })();
    if (!run?.proposalJson || run.status !== 'SUCCEEDED' || meta.kind !== PLAN_PROPOSAL_KIND) {
      throw new DomainError('NOT_FOUND', 'Plan proposal not found', 404, 'errors.not_found');
    }
    const proposed = meta.tracks ?? [];
    const apply = (requested ?? proposed).filter((t) => proposed.includes(t));
    if (apply.length === 0) {
      throw invalid([
        { path: 'tracks', code: 'SCHEMA', message: 'Proposal has none of the requested tracks' },
      ]);
    }
    const tracks: StrategyPlanTracks = {
      organic: apply.includes('organic'),
      paid: apply.includes('paid'),
    };
    const checked = validateStrategyPlanProposal(JSON.parse(run.proposalJson), tracks, {
      source: 'AI_ESTIMATE',
      evidenceRefs: meta.brandProfileVersionId ? [meta.brandProfileVersionId] : [],
    });
    if (!checked.ok) {
      throw new DomainError(
        'SCHEMA_INVALID',
        'Proposal failed validation',
        422,
        'errors.schema_invalid',
        checked.issues,
      );
    }
    const scope = { tenantId, brandId, versionId: version.id };
    return this.guardedWrite(
      tenantId,
      actorUserId,
      brandId,
      strategyId,
      versionId,
      body?.row_version,
      apply,
      async (tx) => {
        if (checked.inputs.organic) {
          await writeOrganicPlan(tx, scope, checked.inputs.organic, { aiRunId: run.id });
        }
        if (checked.inputs.paid) {
          await writePaidPlan(tx, scope, checked.inputs.paid, { aiRunId: run.id });
        }
      },
      correlationId,
      'strategy.plan.ai_proposal_accepted',
      `ai_run:${run.id}`,
    );
  }
}
