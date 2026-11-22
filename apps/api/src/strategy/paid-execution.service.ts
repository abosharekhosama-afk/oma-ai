import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  canMoveExperiment,
  experimentUpdateIssues,
  experimentUpdateSchema,
  flightPacing,
  newId,
  paidSpendEntrySchema,
  parsePaidSpendCsv,
  preferApiSpend,
  STRATEGY_PAID_PLATFORMS,
  type PaidSpendEntryInput,
  type StrategyExperimentStatus,
  type StrategyPaidPlatform,
} from '@oma/domain';
import { z } from 'zod';
import type { AuditService } from '../audit/audit.service';

const notFound = () => new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
const invalid = (details: Array<{ field: string; code: string; line?: number }>) =>
  new DomainError('VALIDATION_FAILED', 'Invalid input', 400, 'errors.validation', details);
const money = (v: unknown) => (v == null ? null : Math.round(Number(v) * 100) / 100);
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * DEC-029 4.7: paid execution — campaign flights → campaigns, experiment status/results
 * after approval (audited), and manual/CSV spend with flight pacing.
 */
export class PaidExecutionService {
  constructor(private readonly audit: AuditService) {}

  private async version(tenantId: string, brandId: string, strategyId: string, versionId: string) {
    const v = await getPrisma().strategyVersion.findFirst({
      where: tenantWhere(tenantId, { id: versionId, brandId, strategyId }),
    });
    if (!v) throw notFound();
    return v;
  }

  private assertApproved(status: string) {
    if (status !== 'APPROVED') {
      throw new DomainError(
        'CONFLICT_STATE',
        'Only an approved strategy version can be executed',
        409,
        'errors.conflict_state',
        [{ code: 'STRATEGY_NOT_APPROVED', status }],
      );
    }
  }

  async execution(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    now: Date = new Date(),
  ) {
    const version = await this.version(tenantId, brandId, strategyId, versionId);
    const prisma = getPrisma();
    const [flights, experiments] = await Promise.all([
      prisma.strategyPaidFlight.findMany({
        where: { tenantId, strategyVersionId: versionId },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.strategyExperiment.findMany({
        where: { tenantId, strategyVersionId: versionId },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
    const spend = preferApiSpend(
      await prisma.paidSpendEntry.findMany({
        where: tenantWhere(tenantId, {
          brandId,
          OR: [{ strategyVersionId: versionId }, { strategyVersionId: null }],
        }),
      }),
    );
    const flightRows = flights.map((f) => {
      const entries = spend.filter(
        (e) => e.flightKey === f.key && (e.strategyVersionId === versionId || !e.strategyVersionId),
      );
      const actual = entries.reduce((t, e) => t + Number(e.amount), 0);
      const budget = money(f.budgetAmount);
      return {
        key: f.key,
        name: f.name,
        platform: f.platform,
        objective: f.objective,
        audience_key: f.audienceKey,
        start_date: dateKey(f.startDate),
        end_date: dateKey(f.endDate),
        budget_amount: budget,
        currency: f.currency,
        campaign_id: f.campaignId,
        impressions: entries.reduce((t, e) => t + (e.impressions ?? 0), 0),
        clicks: entries.reduce((t, e) => t + (e.clicks ?? 0), 0),
        conversions: entries.reduce((t, e) => t + (e.conversions ?? 0), 0),
        spend_sources: [...new Set(entries.map((e) => e.source))],
        ...flightPacing({ startDate: f.startDate, endDate: f.endDate, budget }, actual, now),
      };
    });
    const unassigned = spend.filter((e) => !e.flightKey);
    return {
      data: {
        version_id: versionId,
        version_status: version.status,
        flights: flightRows,
        experiments: experiments.map((e) => ({
          id: e.id,
          name: e.name,
          hypothesis: e.hypothesis,
          variable: e.variable,
          platform: e.platform,
          primary_metric: e.primaryMetric,
          variants: JSON.parse(e.variantsJson || '[]') as Array<{
            key: string;
            description: string;
          }>,
          status: e.status,
          result_summary: e.resultSummary,
          winner_variant_key: e.winnerVariantKey,
          results: e.resultsJson ? JSON.parse(e.resultsJson) : null,
          started_at: e.startedAt?.toISOString() ?? null,
          ended_at: e.endedAt?.toISOString() ?? null,
          status_updated_at: e.statusUpdatedAt?.toISOString() ?? null,
        })),
        totals: {
          planned_budget: money(flightRows.reduce((t, f) => t + (f.budget_amount ?? 0), 0)),
          actual_spend: money(flightRows.reduce((t, f) => t + f.actual_spend, 0)),
          unassigned_spend: money(unassigned.reduce((t, e) => t + Number(e.amount), 0)),
        },
      },
    };
  }

  /** Create one DRAFT paid campaign per flight (idempotent per flight). */
  async materializeFlights(
    tenantId: string,
    userId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
  ) {
    const version = await this.version(tenantId, brandId, strategyId, versionId);
    this.assertApproved(version.status);
    const prisma = getPrisma();
    const flights = await prisma.strategyPaidFlight.findMany({
      where: { tenantId, strategyVersionId: versionId },
      orderBy: { sortOrder: 'asc' },
    });
    const created: string[] = [];
    for (const f of flights) {
      if (f.campaignId) continue;
      const campaignId = newId();
      await prisma.$transaction([
        prisma.campaign.create({
          data: {
            id: campaignId,
            tenantId,
            brandId,
            nameEn: f.name,
            nameAr: f.name,
            objectiveEn: f.objective ?? null,
            channels: [f.platform],
            strategyId,
            budgetAmount: money(f.budgetAmount),
            budgetCurrency: f.currency ?? 'USD',
            track: 'PAID',
            status: 'DRAFT',
            timelineStart: f.startDate,
            timelineEnd: f.endDate,
            ownerUserId: userId,
            links: [`strategy-flight:${versionId}:${f.key}`],
          },
        }),
        prisma.strategyPaidFlight.update({ where: { id: f.id }, data: { campaignId } }),
      ]);
      created.push(campaignId);
    }
    if (created.length) {
      await this.audit.write({
        tenantId,
        actorUserId: userId,
        action: 'strategy.paid.flights_materialized',
        targetType: 'StrategyVersion',
        targetId: versionId,
        afterRef: JSON.stringify({ campaign_ids: created }),
      });
    }
    return {
      data: { created_campaign_ids: created, skipped: flights.length - created.length },
    };
  }

  /** Status/results of an experiment of an APPROVED version (audited, not a plan edit). */
  async updateExperiment(
    tenantId: string,
    userId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    experimentId: string,
    body: unknown,
  ) {
    const version = await this.version(tenantId, brandId, strategyId, versionId);
    this.assertApproved(version.status);
    const exp = await getPrisma().strategyExperiment.findFirst({
      where: { id: experimentId, tenantId, strategyVersionId: versionId },
    });
    if (!exp) throw notFound();
    const parsed = experimentUpdateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw invalid(
        parsed.error.issues.map((i) => ({ field: String(i.path[0] ?? ''), code: 'SCHEMA' })),
      );
    }
    const update = parsed.data;
    const from = exp.status as StrategyExperimentStatus;
    if (!canMoveExperiment(from, update.status)) {
      throw new DomainError(
        'CONFLICT_STATE',
        `Cannot move experiment from ${from} to ${update.status}`,
        409,
        'errors.conflict_state',
        [{ code: 'EXPERIMENT_TRANSITION', from, to: update.status }],
      );
    }
    const variantKeys = (JSON.parse(exp.variantsJson || '[]') as Array<{ key: string }>).map(
      (v) => v.key,
    );
    const issues = experimentUpdateIssues(update, variantKeys);
    if (issues.length) throw invalid(issues);
    const now = new Date();
    const before = {
      status: exp.status,
      result_summary: exp.resultSummary,
      winner_variant_key: exp.winnerVariantKey,
      results: exp.resultsJson,
    };
    const row = await getPrisma().strategyExperiment.update({
      where: { id: exp.id },
      data: {
        status: update.status,
        resultSummary:
          update.result_summary !== undefined ? update.result_summary || null : exp.resultSummary,
        winnerVariantKey:
          update.winner_variant_key !== undefined
            ? update.winner_variant_key || null
            : exp.winnerVariantKey,
        resultsJson:
          update.results !== undefined
            ? update.results
              ? JSON.stringify(update.results)
              : null
            : exp.resultsJson,
        startedAt: update.status === 'RUNNING' && !exp.startedAt ? now : exp.startedAt,
        endedAt:
          (update.status === 'CONCLUDED' || update.status === 'CANCELLED') && !exp.endedAt
            ? now
            : exp.endedAt,
        statusUpdatedAt: now,
        statusUpdatedBy: userId,
      },
    });
    await this.audit.write({
      tenantId,
      actorUserId: userId,
      action: 'strategy.experiment.updated',
      targetType: 'StrategyExperiment',
      targetId: exp.id,
      beforeRef: JSON.stringify(before),
      afterRef: JSON.stringify({
        status: row.status,
        result_summary: row.resultSummary,
        winner_variant_key: row.winnerVariantKey,
        results: row.resultsJson,
      }),
    });
    return {
      data: {
        id: row.id,
        status: row.status,
        result_summary: row.resultSummary,
        winner_variant_key: row.winnerVariantKey,
        started_at: row.startedAt?.toISOString() ?? null,
        ended_at: row.endedAt?.toISOString() ?? null,
      },
    };
  }

  /** Audit trail of an experiment (status/results changes). */
  async experimentHistory(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    experimentId: string,
  ) {
    await this.version(tenantId, brandId, strategyId, versionId);
    const exp = await getPrisma().strategyExperiment.findFirst({
      where: { id: experimentId, tenantId, strategyVersionId: versionId },
      select: { id: true },
    });
    if (!exp) throw notFound();
    const events = await getPrisma().auditEvent.findMany({
      where: { tenantId, targetType: 'StrategyExperiment', targetId: exp.id },
      orderBy: { occurredAt: 'asc' },
    });
    return {
      data: events.map((e) => ({
        at: e.occurredAt.toISOString(),
        actor_user_id: e.actorUserId,
        action: e.action,
        before: e.beforeRef ? JSON.parse(e.beforeRef) : null,
        after: e.afterRef ? JSON.parse(e.afterRef) : null,
      })),
    };
  }

  /** Latest APPROVED version holding each flight key (spend rows tie to it). */
  private async flightVersions(tenantId: string, brandId: string, keys: string[]) {
    if (!keys.length) return new Map<string, string>();
    const flights = await getPrisma().strategyPaidFlight.findMany({
      where: { tenantId, brandId, key: { in: keys }, version: { status: 'APPROVED' } },
      include: { version: { select: { approvedAt: true } } },
    });
    const out = new Map<string, { id: string; at: number }>();
    for (const f of flights) {
      const at = f.version.approvedAt?.getTime() ?? 0;
      const prev = out.get(f.key);
      if (!prev || prev.at < at) out.set(f.key, { id: f.strategyVersionId, at });
    }
    return new Map([...out].map(([k, v]) => [k, v.id]));
  }

  private async saveSpend(
    tenantId: string,
    userId: string,
    brandId: string,
    rows: PaidSpendEntryInput[],
    source: 'MANUAL' | 'CSV',
  ) {
    const batchId = newId();
    // Aggregate duplicates within one submission (exports list one row per ad/day).
    const agg = new Map<string, PaidSpendEntryInput>();
    for (const r of rows) {
      const key = `${r.platform}|${r.date}|${r.flight_key ?? ''}`;
      const prev = agg.get(key);
      if (!prev) agg.set(key, { ...r });
      else {
        if (prev.currency !== r.currency) {
          throw invalid([{ field: 'currency', code: 'MIXED_CURRENCY' }]);
        }
        prev.amount = Math.round((prev.amount + r.amount) * 100) / 100;
        prev.impressions = (prev.impressions ?? 0) + (r.impressions ?? 0) || prev.impressions;
        prev.clicks = (prev.clicks ?? 0) + (r.clicks ?? 0) || prev.clicks;
        prev.conversions = (prev.conversions ?? 0) + (r.conversions ?? 0) || prev.conversions;
      }
    }
    const keys = [
      ...new Set([...agg.values()].map((r) => r.flight_key).filter(Boolean)),
    ] as string[];
    const versions = await this.flightVersions(tenantId, brandId, keys);
    const unknown = keys.filter((k) => !versions.has(k));
    if (unknown.length) {
      throw invalid(unknown.map(() => ({ field: 'flight_key', code: 'UNKNOWN_FLIGHT' })));
    }
    let created = 0;
    let updated = 0;
    for (const r of agg.values()) {
      const flightKey = r.flight_key ?? '';
      const where = {
        tenantId_brandId_platform_spendDate_flightKey_source: {
          tenantId,
          brandId,
          platform: r.platform as StrategyPaidPlatform,
          spendDate: new Date(`${r.date}T00:00:00Z`),
          flightKey,
          source,
        },
      };
      const existing = await getPrisma().paidSpendEntry.findUnique({ where, select: { id: true } });
      const data = {
        amount: r.amount,
        currency: r.currency,
        impressions: r.impressions ?? null,
        clicks: r.clicks ?? null,
        conversions: r.conversions ?? null,
        strategyVersionId: flightKey ? versions.get(flightKey)! : null,
        importBatchId: batchId,
        createdBy: userId,
      };
      if (existing) {
        await getPrisma().paidSpendEntry.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await getPrisma().paidSpendEntry.create({
          data: {
            id: newId(),
            ...where.tenantId_brandId_platform_spendDate_flightKey_source,
            ...data,
          },
        });
        created += 1;
      }
    }
    await this.audit.write({
      tenantId,
      actorUserId: userId,
      action: source === 'CSV' ? 'paid.spend.imported' : 'paid.spend.recorded',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      afterRef: JSON.stringify({ batch_id: batchId, created, updated }),
    });
    return { batch_id: batchId, created, updated };
  }

  async recordSpend(tenantId: string, userId: string, brandId: string, body: unknown) {
    await this.brand(tenantId, brandId);
    const parsed = z
      .strictObject({ entries: z.array(paidSpendEntrySchema).min(1).max(200) })
      .safeParse(body ?? {});
    if (!parsed.success) {
      throw invalid(parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: 'SCHEMA' })));
    }
    return { data: await this.saveSpend(tenantId, userId, brandId, parsed.data.entries, 'MANUAL') };
  }

  async importSpendCsv(
    tenantId: string,
    userId: string,
    brandId: string,
    body: { csv?: unknown; platform?: unknown; currency?: unknown; dry_run?: unknown },
  ) {
    await this.brand(tenantId, brandId);
    const csv = typeof body?.csv === 'string' ? body.csv : '';
    if (!csv.trim() || csv.length > 2_000_000) throw invalid([{ field: 'csv', code: 'REQUIRED' }]);
    const platform =
      typeof body.platform === 'string' &&
      (STRATEGY_PAID_PLATFORMS as readonly string[]).includes(body.platform)
        ? (body.platform as StrategyPaidPlatform)
        : null;
    const currency =
      typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency) ? body.currency : null;
    const { rows, errors } = parsePaidSpendCsv(csv, { platform, currency });
    // All-or-nothing: a file with bad rows is reported, never half-imported.
    if (errors.length || body.dry_run === true) {
      return { data: { imported: false, valid_rows: rows.length, errors: errors.slice(0, 100) } };
    }
    const saved = await this.saveSpend(tenantId, userId, brandId, rows, 'CSV');
    return { data: { imported: true, valid_rows: rows.length, errors: [], ...saved } };
  }

  async listSpend(tenantId: string, brandId: string, from?: string, to?: string) {
    await this.brand(tenantId, brandId);
    const isKey = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const end = isKey(to) ? new Date(`${to}T00:00:00Z`) : new Date();
    const start = isKey(from)
      ? new Date(`${from}T00:00:00Z`)
      : new Date(end.getTime() - 30 * 86_400_000);
    const rows = preferApiSpend(
      await getPrisma().paidSpendEntry.findMany({
        where: tenantWhere(tenantId, { brandId, spendDate: { gte: start, lte: end } }),
        orderBy: [{ spendDate: 'asc' }, { platform: 'asc' }],
        take: 5000,
      }),
    );
    const byPlatform: Record<string, { amount: number; currency: string }> = {};
    for (const r of rows) {
      const k = `${r.platform}`;
      byPlatform[k] = {
        amount: Math.round(((byPlatform[k]?.amount ?? 0) + Number(r.amount)) * 100) / 100,
        currency: r.currency,
      };
    }
    return {
      data: {
        from: dateKey(start),
        to: dateKey(end),
        entries: rows.map((r) => ({
          id: r.id,
          date: dateKey(r.spendDate),
          platform: r.platform,
          flight_key: r.flightKey || null,
          amount: Number(r.amount),
          currency: r.currency,
          impressions: r.impressions,
          clicks: r.clicks,
          conversions: r.conversions,
          source: r.source,
        })),
        by_platform: byPlatform,
      },
    };
  }

  private async brand(tenantId: string, brandId: string) {
    const b = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
      select: { id: true },
    });
    if (!b) throw notFound();
  }
}
