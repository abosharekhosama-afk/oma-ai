import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError } from '@oma/domain';
import {
  approvalStats,
  bucketKeys,
  rate,
  resolveRange,
  startOfBucket,
  type AnalyticsRange,
} from './analytics-range';

const CONTENT_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED_SAMPLE',
] as const;
const OPEN_CONTENT = ['DRAFT', 'IN_REVIEW', 'APPROVED'];
const CLOSED_TASK = ['DONE', 'CANCELLED'];
/** Look back before `from` so approvals decided in range can be matched to their earlier request. */
const LOOKBACK_MS = 120 * 86400_000;
const DELIVERABLE_ACTION: Record<string, string> = {
  'deliverable.review.submit': 'REQUEST',
  'deliverable.review.approve': 'APPROVE',
  'deliverable.review.request_changes': 'REQUEST_CHANGES',
  'deliverable.review.reject': 'REJECT',
};

export type AnalyticsQuery = {
  period?: string;
  from?: string;
  to?: string;
  brandId?: string;
  campaignId?: string;
};

/**
 * Internal work analytics (content pipeline, approvals, on-time delivery, team throughput)
 * computed from tenant data. Social reach/engagement is intentionally absent: no platform
 * connectors exist yet.
 */
export class AnalyticsService {
  async overview(tenantId: string, q: AnalyticsQuery, now = new Date()) {
    const prisma = getPrisma();
    const range = resolveRange(q, now);
    const brandId = q.brandId?.trim() || undefined;
    const campaignId = q.campaignId?.trim() || undefined;

    const [brands, campaigns] = await Promise.all([
      prisma.brandWorkspace.findMany({
        where: tenantWhere(tenantId, { archivedAt: null }),
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.campaign.findMany({
        where: tenantWhere(tenantId, { archivedAt: null, ...(brandId ? { brandId } : {}) }),
        select: { id: true, nameEn: true, nameAr: true, brandId: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    if (brandId && !brands.some((b) => b.id === brandId)) {
      throw new DomainError('NOT_FOUND', 'Brand not found', 404, 'errors.not_found');
    }
    if (campaignId && !campaigns.some((c) => c.id === campaignId)) {
      throw new DomainError('NOT_FOUND', 'Campaign not found', 404, 'errors.not_found');
    }
    const scope = tenantWhere(tenantId, {
      ...(brandId ? { brandId } : {}),
      ...(campaignId ? { campaignId } : {}),
    });
    const lookback = new Date(range.from.getTime() - LOOKBACK_MS);

    // All independent reads in parallel (no waterfalls).
    const [content, contentEvents, tasks, deliverables, deliverableAudit, members] =
      await Promise.all([
        prisma.contentItem.findMany({
          where: { ...scope, archivedAt: null },
          select: {
            id: true,
            brandId: true,
            campaignId: true,
            status: true,
            plannedAt: true,
            scheduledAt: true,
            createdAt: true,
            createdBy: true,
          },
        }),
        prisma.contentApprovalEvent.findMany({
          where: {
            tenantId,
            at: { gte: lookback, lte: range.to },
            content: {
              ...(brandId ? { brandId } : {}),
              ...(campaignId ? { campaignId } : {}),
            },
          },
          select: { contentId: true, action: true, at: true, actorUserId: true },
        }),
        prisma.workTask.findMany({
          where: scope,
          select: {
            id: true,
            status: true,
            dueAt: true,
            updatedAt: true,
            assigneeUserId: true,
          },
        }),
        prisma.workDeliverable.findMany({
          where: scope,
          select: { id: true, createdBy: true, task: { select: { assigneeUserId: true } } },
        }),
        prisma.auditEvent.findMany({
          where: {
            tenantId,
            targetType: 'WorkDeliverable',
            action: { in: Object.keys(DELIVERABLE_ACTION) },
            occurredAt: { gte: lookback, lte: range.to },
          },
          select: { targetId: true, action: true, occurredAt: true, actorUserId: true },
        }),
        prisma.membership.findMany({
          where: tenantWhere(tenantId, { status: 'ACTIVE', membershipKind: 'team' }),
          select: { userId: true, user: { select: { id: true, name: true, email: true } } },
        }),
      ]);

    const inRange = (d: Date | null | undefined) => !!d && d >= range.from && d <= range.to;
    const dueOf = (c: { scheduledAt: Date | null; plannedAt: Date | null }) =>
      c.scheduledAt ?? c.plannedAt;

    // ---- Content pipeline ----
    const periodContent = content.filter((c) => inRange(dueOf(c) ?? c.createdAt));
    const byStatus = countBy(periodContent, (c) => c.status, CONTENT_STATUSES);
    const brandName = new Map(brands.map((b) => [b.id, b.name]));
    const campaignName = new Map(campaigns.map((c) => [c.id, { en: c.nameEn, ar: c.nameAr }]));
    const perBrand = groupRows(periodContent, (c) => c.brandId).map(([id, rows]) => ({
      id,
      name: brandName.get(id) ?? '—',
      total: rows.length,
      by_status: countBy(rows, (c) => c.status, CONTENT_STATUSES),
    }));
    const perCampaign = groupRows(
      periodContent.filter((c) => c.campaignId),
      (c) => c.campaignId!,
    ).map(([id, rows]) => ({
      id,
      name: campaignName.get(id) ?? { en: '—', ar: '—' },
      total: rows.length,
      by_status: countBy(rows, (c) => c.status, CONTENT_STATUSES),
    }));

    const keys = bucketKeys(range);
    const series = new Map(keys.map((k) => [k, { scheduled: 0, published: 0, created: 0 }]));
    const bucketOf = (d: Date) => startOfBucket(d, range.bucket).toISOString().slice(0, 10);
    for (const c of content) {
      if (
        c.scheduledAt &&
        inRange(c.scheduledAt) &&
        (c.status === 'SCHEDULED' || c.status === 'PUBLISHED_SAMPLE')
      ) {
        const s = series.get(bucketOf(c.scheduledAt));
        if (s) s.scheduled++;
      }
      if (inRange(c.createdAt)) {
        const s = series.get(bucketOf(c.createdAt));
        if (s) s.created++;
      }
    }
    for (const e of contentEvents) {
      if (e.action === 'PUBLISH_SAMPLE' && inRange(e.at)) {
        const s = series.get(bucketOf(e.at));
        if (s) s.published++;
      }
    }

    // ---- Approvals ----
    const contentApproval = approvalStats(
      contentEvents.map((e) => ({ itemId: e.contentId, action: e.action, at: e.at })),
      range,
    );
    const deliverableIds = new Set(deliverables.map((d) => d.id));
    const scopedDeliverableAudit = deliverableAudit.filter(
      (a) => a.targetId && deliverableIds.has(a.targetId),
    );
    const deliverableApproval = approvalStats(
      scopedDeliverableAudit.map((a) => ({
        itemId: a.targetId!,
        action: DELIVERABLE_ACTION[a.action] ?? a.action,
        at: a.occurredAt,
      })),
      range,
    );

    // ---- On time ----
    const overduePosts = content.filter((c) => {
      const due = dueOf(c);
      return !!due && due < now && OPEN_CONTENT.includes(c.status);
    }).length;
    const overdueTasks = tasks.filter(
      (t) =>
        t.status === 'OVERDUE' || (!!t.dueAt && t.dueAt < now && !CLOSED_TASK.includes(t.status)),
    ).length;
    const doneWithDue = tasks.filter((t) => t.status === 'DONE' && t.dueAt && inRange(t.updatedAt));
    const tasksOnTime = doneWithDue.filter((t) => t.updatedAt <= t.dueAt!).length;
    const firstApproval = new Map<string, Date>();
    for (const e of contentEvents) {
      if (e.action !== 'APPROVE') continue;
      const prev = firstApproval.get(e.contentId);
      if (!prev || e.at < prev) firstApproval.set(e.contentId, e.at);
    }
    const postsDue = content.filter(
      (c) => c.plannedAt && inRange(c.plannedAt) && c.plannedAt <= now,
    );
    const postsOnTime = postsDue.filter((c) => {
      const a = firstApproval.get(c.id);
      return !!a && a <= c.plannedAt!;
    }).length;

    // ---- Team ----
    const team = new Map<
      string,
      {
        user_id: string;
        name: string;
        tasks_completed: number;
        deliverables_approved: number;
        posts_created: number;
        approvals_given: number;
      }
    >();
    for (const m of members) {
      if (!m.user) continue;
      team.set(m.user.id, {
        user_id: m.user.id,
        name: m.user.name || m.user.email,
        tasks_completed: 0,
        deliverables_approved: 0,
        posts_created: 0,
        approvals_given: 0,
      });
    }
    for (const t of tasks) {
      if (t.status === 'DONE' && t.assigneeUserId && inRange(t.updatedAt)) {
        const row = team.get(t.assigneeUserId);
        if (row) row.tasks_completed++;
      }
    }
    for (const c of content) {
      if (inRange(c.createdAt)) {
        const row = team.get(c.createdBy);
        if (row) row.posts_created++;
      }
    }
    for (const e of contentEvents) {
      if (e.action === 'APPROVE' && inRange(e.at)) {
        const row = team.get(e.actorUserId);
        if (row) row.approvals_given++;
      }
    }
    const deliverableOwner = new Map(
      deliverables.map((d) => [d.id, d.task?.assigneeUserId ?? d.createdBy]),
    );
    for (const a of scopedDeliverableAudit) {
      if (a.action !== 'deliverable.review.approve' || !inRange(a.occurredAt)) continue;
      const owner = team.get(deliverableOwner.get(a.targetId!) ?? '');
      if (owner) owner.deliverables_approved++;
      const reviewer = a.actorUserId ? team.get(a.actorUserId) : undefined;
      if (reviewer) reviewer.approvals_given++;
    }
    const teamRows = [...team.values()]
      .filter(
        (r) =>
          r.tasks_completed + r.deliverables_approved + r.posts_created + r.approvals_given > 0,
      )
      .sort(
        (a, b) =>
          b.tasks_completed +
            b.deliverables_approved -
            (a.tasks_completed + a.deliverables_approved) || a.name.localeCompare(b.name),
      );

    return {
      data: {
        range: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          days: range.days,
          bucket: range.bucket,
        },
        filters: {
          brand_id: brandId ?? null,
          campaign_id: campaignId ?? null,
          brands: brands.map((b) => ({ id: b.id, name: b.name })),
          campaigns: campaigns.map((c) => ({
            id: c.id,
            brand_id: c.brandId,
            name: { en: c.nameEn, ar: c.nameAr },
          })),
        },
        content: {
          total: periodContent.length,
          by_status: byStatus,
          per_brand: perBrand,
          per_campaign: perCampaign,
          series: keys.map((k) => ({ bucket: k, ...series.get(k)! })),
        },
        approvals: { content: contentApproval, deliverables: deliverableApproval },
        on_time: {
          overdue_posts: overduePosts,
          overdue_tasks: overdueTasks,
          tasks_completed_with_due: doneWithDue.length,
          tasks_on_time: tasksOnTime,
          task_on_time_rate: rate(tasksOnTime, doneWithDue.length),
          posts_due: postsDue.length,
          posts_approved_on_time: postsOnTime,
          post_on_time_rate: rate(postsOnTime, postsDue.length),
        },
        team: teamRows,
        social: { connected: false },
        generated_at: now.toISOString(),
      },
    };
  }
}

function countBy<T>(rows: T[], key: (r: T) => string, keys: readonly string[]) {
  const out: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + 1;
  return out;
}

function groupRows<T>(rows: T[], key: (r: T) => string): Array<[string, T[]]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k) ?? [];
    list.push(r);
    m.set(k, list);
  }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
}

export type { AnalyticsRange };
export const analyticsService = new AnalyticsService();
