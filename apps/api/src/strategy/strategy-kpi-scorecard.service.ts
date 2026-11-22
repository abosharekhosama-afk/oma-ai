import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  KPI_METRIC_UNITS,
  isMeasurableKpiMetric,
  kpiProgress,
  kpiWindow,
  measureKpi,
  type KpiMetricSample,
} from '@oma/domain';
import type { AuditService } from '../audit/audit.service';

/**
 * DEC-029 4.5: KPI scorecard. Measurable KPIs are computed from the brand's own
 * content and post metric snapshots; everything else is a manual KPI and shows
 * the last recorded value (with who/when), or "not recorded".
 */
export class StrategyKpiScorecardService {
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

  async scorecard(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    now: Date = new Date(),
  ) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    const kpis = await getPrisma().strategyKpi.findMany({
      where: tenantWhere(tenantId, { strategyVersionId: versionId, brandId }),
      orderBy: { name: 'asc' },
    });
    const rows = [];
    for (const kpi of kpis) {
      const window = kpiWindow(kpi.period, now, version.approvedAt);
      const target = kpi.targetNumber;
      if (!isMeasurableKpiMetric(kpi.metric)) {
        rows.push({
          id: kpi.id,
          name: kpi.name,
          metric: null,
          source: 'manual' as const,
          period: kpi.period,
          scope: kpi.scope,
          target_value: kpi.targetValue,
          target_number: target,
          unit: kpi.unit,
          actual: kpi.manualValue,
          recorded_at: kpi.manualValueAt?.toISOString() ?? null,
          recorded_by: kpi.manualBy,
          note: kpi.manualNote,
          window: null,
          ...kpiProgress(kpi.manualValue, target, { manual: true }),
        });
        continue;
      }
      const contentWhere = {
        brandId,
        ...(kpi.scope === 'BRAND' ? {} : { strategyVersionId: versionId }),
        ...(kpi.pillarKey ? { pillarKey: kpi.pillarKey } : {}),
        ...(kpi.channel ? { channel: { equals: kpi.channel, mode: 'insensitive' as const } } : {}),
      };
      const posts = await getPrisma().contentItem.findMany({
        where: tenantWhere(tenantId, {
          ...contentWhere,
          archivedAt: null,
          OR: [
            { publishedAt: { gte: window.from, lte: window.to } },
            { plannedAt: { gte: window.from, lte: window.to } },
          ],
        }),
        select: { id: true, plannedAt: true, publishedAt: true },
      });
      let metrics: KpiMetricSample[] = [];
      if (!['posts_published', 'publish_rate'].includes(kpi.metric)) {
        const scoped = kpi.scope !== 'BRAND' || kpi.pillarKey || kpi.channel;
        const ids = scoped
          ? (
              await getPrisma().contentItem.findMany({
                where: tenantWhere(tenantId, contentWhere),
                select: { id: true },
              })
            ).map((c) => c.id)
          : null;
        metrics = await getPrisma().postMetricSnapshot.findMany({
          where: tenantWhere(tenantId, {
            brandId,
            excluded: false,
            publishedAt: { gte: window.from, lte: window.to },
            ...(ids ? { contentItemId: { in: ids } } : {}),
          }),
          select: {
            impressions: true,
            reach: true,
            likes: true,
            comments: true,
            shares: true,
            views: true,
            engagementRate: true,
          },
        });
      }
      const actual = measureKpi(kpi.metric, window, posts, metrics);
      rows.push({
        id: kpi.id,
        name: kpi.name,
        metric: kpi.metric,
        source: 'measured' as const,
        period: kpi.period,
        scope: kpi.scope,
        target_value: kpi.targetValue,
        target_number: target,
        unit: kpi.unit ?? KPI_METRIC_UNITS[kpi.metric],
        actual,
        recorded_at: now.toISOString(),
        recorded_by: null,
        note: null,
        sample_size: ['posts_published', 'publish_rate'].includes(kpi.metric)
          ? posts.length
          : metrics.length,
        window: { from: window.from.toISOString(), to: window.to.toISOString() },
        ...kpiProgress(actual, target),
      });
    }
    return {
      data: {
        version_id: versionId,
        version_status: version.status,
        generated_at: now.toISOString(),
        kpis: rows,
        summary: {
          total: rows.length,
          measured: rows.filter((r) => r.source === 'measured').length,
          manual: rows.filter((r) => r.source === 'manual').length,
          on_track: rows.filter((r) => r.status === 'on_track').length,
          at_risk: rows.filter((r) => r.status === 'at_risk').length,
          behind: rows.filter((r) => r.status === 'behind').length,
        },
      },
    };
  }

  /** Record the actual value of a manual KPI. Allowed on approved versions (it is a result, not a plan edit). */
  async recordManual(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    kpiId: string,
    input: { value?: unknown; note?: unknown },
  ) {
    await this.requireVersion(tenantId, brandId, strategyId, versionId);
    const kpi = await getPrisma().strategyKpi.findFirst({
      where: tenantWhere(tenantId, { id: kpiId, strategyVersionId: versionId, brandId }),
    });
    if (!kpi) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (isMeasurableKpiMetric(kpi.metric)) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Measured KPIs are computed from data and cannot be set manually',
        409,
        'errors.conflict_state',
        [{ code: 'KPI_MEASURED' }],
      );
    }
    const value = typeof input.value === 'number' ? input.value : Number(input.value);
    if (input.value === null || input.value === '' || !Number.isFinite(value)) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'value must be a number',
        400,
        'errors.validation',
        [{ field: 'value', code: 'INVALID_NUMBER' }],
      );
    }
    const note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) || null : null;
    const before = { value: kpi.manualValue, note: kpi.manualNote };
    const at = new Date();
    await getPrisma().strategyKpi.update({
      where: { id: kpi.id },
      data: { manualValue: value, manualNote: note, manualValueAt: at, manualBy: actorUserId },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.kpi.manual_recorded',
      targetType: 'StrategyKpi',
      targetId: kpi.id,
      beforeRef: JSON.stringify(before),
      afterRef: JSON.stringify({ value, note, versionId }),
    });
    return { data: { id: kpi.id, actual: value, note, recorded_at: at.toISOString() } };
  }
}
