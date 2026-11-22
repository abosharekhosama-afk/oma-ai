import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  actionableFindings,
  expectedPostsInMonth,
  isMonthKey,
  monthWindow,
  monthlyReviewFindings,
  previousMonthKey,
  type MonthlyReviewFinding,
} from '@oma/domain';
import type { AuditService } from '../audit/audit.service';
import type { StrategyService } from './strategy.service';
import { readStrategyPlan, type StrategyPlanService } from './strategy-plan.service';
import type { StrategyKpiScorecardService } from './strategy-kpi-scorecard.service';
import type { PaidExecutionService } from './paid-execution.service';

type ReviewRow = {
  id: string;
  month: string;
  status: string;
  sourceVersionId: string;
  draftVersionId: string | null;
  aiRunId: string | null;
  findingsJson: string;
  createdBy: string;
  createdAt: Date;
};

function present(row: ReviewRow) {
  const stored = JSON.parse(row.findingsJson || '{}') as {
    findings?: MonthlyReviewFinding[];
    ai_error?: string | null;
  };
  return {
    id: row.id,
    month: row.month,
    status: row.status,
    source_version_id: row.sourceVersionId,
    draft_version_id: row.draftVersionId,
    ai_run_id: row.aiRunId,
    ai_error: stored.ai_error ?? null,
    findings: stored.findings ?? [],
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
  };
}

const OPEN_DRAFT = ['DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED'];

/**
 * DEC-029 PR 4.10 — monthly review of an APPROVED version.
 * 1. Deterministic findings from measured data (KPI scorecard, cadence delivery, pillar share,
 *    paid pacing, experiment results) for one calendar month.
 * 2. If anything is actionable: revise → new DRAFT, then the plan AI proposes changes on that
 *    draft grounded in the findings. The proposal is NOT applied; a human accepts it via the
 *    existing plan/ai/accept route and the draft goes through normal review/approval.
 */
@Injectable()
export class StrategyMonthlyReviewService {
  constructor(
    private readonly audit: AuditService,
    private readonly strategies: StrategyService,
    private readonly plans: StrategyPlanService,
    private readonly scorecards: StrategyKpiScorecardService,
    private readonly paid: PaidExecutionService,
  ) {}

  private async approvedVersion(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
  ) {
    const version = await getPrisma().strategyVersion.findFirst({
      where: tenantWhere(tenantId, { id: versionId, brandId, strategyId }),
    });
    if (!version) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (version.status !== 'APPROVED') {
      throw new DomainError(
        'CONFLICT_STATE',
        'Monthly reviews run on approved versions only',
        409,
        'errors.conflict_state',
        [{ code: 'NOT_APPROVED', status: version.status }],
      );
    }
    return version;
  }

  private parseMonth(raw: unknown, now: Date) {
    const month = raw == null || raw === '' ? previousMonthKey(now) : raw;
    const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!isMonthKey(month) || month > current) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid month', 400, 'errors.validation', [
        { path: 'month', code: 'MONTH', message: 'Use YYYY-MM, not in the future' },
      ]);
    }
    return month;
  }

  /** Measured findings for one month (read-only). */
  async findings(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    month: string,
    now: Date = new Date(),
  ): Promise<MonthlyReviewFinding[]> {
    const version = await this.approvedVersion(tenantId, brandId, strategyId, versionId);
    const window = monthWindow(month);
    const asOf = window.to < now ? window.to : now;
    const prisma = getPrisma();
    const [scorecard, paid, plan, published] = await Promise.all([
      this.scorecards.scorecard(tenantId, brandId, strategyId, versionId, asOf),
      version.paidEnabled
        ? this.paid.execution(tenantId, brandId, strategyId, versionId, asOf)
        : Promise.resolve(null),
      readStrategyPlan(prisma, versionId),
      prisma.contentItem.findMany({
        where: tenantWhere(tenantId, {
          brandId,
          strategyVersionId: versionId,
          archivedAt: null,
          publishedAt: { gte: window.from, lte: window.to },
        }),
        select: { channel: true, pillarKey: true },
      }),
    ]);
    const cadence = version.organicEnabled
      ? (plan.organic.cadence ?? []).filter((c) => c.posts_per_week > 0)
      : [];
    const channels = cadence.map((c) => ({
      channel: c.channel,
      expected: expectedPostsInMonth(c.posts_per_week, window.days),
      published: published.filter(
        (p) => (p.channel ?? '').toLowerCase() === c.channel.toLowerCase(),
      ).length,
    }));
    const pillars = version.organicEnabled
      ? plan.organic.pillars.map((p) => ({
          key: p.key,
          share_target_pct: p.share_target_pct ?? null,
          published_share_pct: published.length
            ? Math.round(
                (published.filter((x) => x.pillarKey === p.key).length / published.length) * 100,
              )
            : null,
        }))
      : [];
    const flights = (paid?.data.flights ?? []).filter(
      (f) =>
        f.start_date <= window.to.toISOString().slice(0, 10) &&
        f.end_date >= window.from.toISOString().slice(0, 10),
    );
    return monthlyReviewFindings({
      month,
      kpis: scorecard.data.kpis.map((k) => ({
        name: k.name,
        source: k.source,
        status: k.status,
        actual: k.actual,
        target_number: k.target_number,
        progress_pct: k.progress_pct,
      })),
      channels,
      pillars,
      flights: flights.map((f) => ({
        key: f.key,
        name: f.name,
        status: f.status,
        pacing_pct: f.pacing_pct,
      })),
      experiments: (paid?.data.experiments ?? []).map((e) => ({
        name: e.name,
        status: e.status,
        winner_variant_key: e.winner_variant_key,
      })),
    });
  }

  async preview(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    rawMonth: unknown,
    now: Date = new Date(),
  ) {
    const month = this.parseMonth(rawMonth, now);
    const findings = await this.findings(tenantId, brandId, strategyId, versionId, month, now);
    const existing = await getPrisma().strategyMonthlyReview.findFirst({
      where: { tenantId, sourceVersionId: versionId, month },
    });
    return {
      data: {
        month,
        version_id: versionId,
        findings,
        actionable: actionableFindings(findings).length,
        review: existing ? present(existing) : null,
      },
    };
  }

  async list(tenantId: string, brandId: string, strategyId: string) {
    const rows = await getPrisma().strategyMonthlyReview.findMany({
      where: { tenantId, brandId, strategyId },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
    return { data: rows.map(present) };
  }

  /** Run the review: findings → (if actionable) new draft + AI proposal. Idempotent per version+month. */
  async run(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    body: { month?: unknown } | undefined,
    opts: { correlationId?: string; now?: Date } = {},
  ) {
    const now = opts.now ?? new Date();
    const month = this.parseMonth(body?.month, now);
    const prisma = getPrisma();
    const existing = await prisma.strategyMonthlyReview.findFirst({
      where: { tenantId, sourceVersionId: versionId, month },
    });
    if (existing) return { data: { replayed: true, review: present(existing), proposal: null } };

    const findings = await this.findings(tenantId, brandId, strategyId, versionId, month, now);
    const actionable = actionableFindings(findings);
    let draftVersionId: string | null = null;
    let aiRunId: string | null = null;
    let aiError: string | null = null;
    let proposal: unknown = null;
    let status = 'NO_CHANGES';

    if (actionable.length) {
      const open = await prisma.strategyVersion.findFirst({
        where: tenantWhere(tenantId, { strategyId, brandId, status: { in: OPEN_DRAFT } }),
        select: { id: true, versionNumber: true },
      });
      if (open) {
        throw new DomainError(
          'CONFLICT_STATE',
          'Finish or discard the open draft before a monthly review creates a new one',
          409,
          'errors.conflict_state',
          [{ code: 'OPEN_DRAFT_EXISTS', version_id: open.id, version_number: open.versionNumber }],
        );
      }
      const revised = (await this.strategies.revise(
        tenantId,
        actorUserId,
        brandId,
        strategyId,
        versionId,
        opts.correlationId,
      )) as { data: { id: string } };
      draftVersionId = revised.data.id;
      status = 'DRAFT_ONLY';
      try {
        const proposed = await this.plans.proposePlan(
          tenantId,
          actorUserId,
          brandId,
          strategyId,
          draftVersionId,
          { mode: 'ai' },
          {
            correlationId: opts.correlationId,
            idempotencyKey: `monthly-review:${versionId}:${month}`,
            reviewFindings: actionable,
          },
        );
        aiRunId = proposed.data.run_id;
        proposal = proposed.data;
        status = 'PROPOSED';
      } catch (err) {
        // AI unavailable/refused/invalid: the draft stays a plain copy; findings guide a manual edit.
        aiError = err instanceof DomainError ? err.code : 'AI_FAILED';
      }
    }

    let row: ReviewRow;
    try {
      row = await prisma.strategyMonthlyReview.create({
        data: {
          id: randomUUID(),
          tenantId,
          brandId,
          strategyId,
          sourceVersionId: versionId,
          month,
          findingsJson: JSON.stringify({ findings, ai_error: aiError }),
          draftVersionId,
          aiRunId,
          status,
          createdBy: actorUserId,
        },
      });
    } catch (err) {
      const raced = await prisma.strategyMonthlyReview.findFirst({
        where: { tenantId, sourceVersionId: versionId, month },
      });
      if (!raced) throw err;
      return { data: { replayed: true, review: present(raced), proposal: null } };
    }
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.monthly_review.created',
      targetType: 'StrategyVersion',
      targetId: versionId,
      beforeRef: month,
      afterRef: draftVersionId ? `${status}:${draftVersionId}` : status,
      correlationId: opts.correlationId,
    });
    return { data: { replayed: false, review: present(row), proposal } };
  }
}
