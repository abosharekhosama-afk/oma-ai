import { getPrisma, tenantWhere } from '@oma/db';

const DAY = 86_400_000;
const OPEN_TASK = ['BACKLOG', 'TODO', 'READY', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'OVERDUE'] as const;
const OPEN_REQUEST = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED'] as const;
const REVIEW_DELIVERABLE = ['AWAITING_REVIEW', 'IN_REVIEW'] as const;

type Copy = { en: string; ar: string };
const copy = (en: string, ar?: string | null): Copy => ({ en, ar: ar || en });

export type ChecklistStep = { id: string; done: boolean; href: string; count: number };

/** Getting-started checklist computed from real workspace data (pure; unit-tested). */
export function computeChecklist(c: {
  brands: number;
  brandsWithWebsiteOrProfile: number;
  strategies: number;
  campaigns: number;
  content: number;
  requestsOrTasks: number;
  reviewed: number;
}): ChecklistStep[] {
  return [
    { id: 'company', done: true, href: '/app/company/members', count: 1 },
    { id: 'brand', done: c.brands > 0, href: '/app/brands/new', count: c.brands },
    { id: 'profile', done: c.brandsWithWebsiteOrProfile > 0, href: '/app/brands', count: c.brandsWithWebsiteOrProfile },
    { id: 'strategy', done: c.strategies > 0, href: '/app/brands', count: c.strategies },
    { id: 'campaign', done: c.campaigns > 0, href: '/app/campaigns', count: c.campaigns },
    { id: 'content', done: c.content > 0, href: '/app/content', count: c.content },
    { id: 'produce', done: c.requestsOrTasks > 0, href: '/app/requests', count: c.requestsOrTasks },
    { id: 'review', done: c.reviewed > 0, href: '/app/reviews', count: c.reviewed },
  ];
}

const PENDING_APPROVAL = ['PENDING', 'PARTIALLY_APPROVED'] as const;

export type ApprovalEventLite = { contentId: string; actorUserId: string; action: string; at: Date };

/**
 * Items the user can still act on: pending/partially approved and not already approved by this
 * user since the latest approval request (mirrors ContentService.approve's duplicate guard).
 * Pure; unit-tested.
 */
export function selectAwaitingForUser<T extends { id: string }>(
  items: T[],
  events: ApprovalEventLite[],
  userId: string,
): Array<T & { requested_by: string | null; requested_at: Date | null }> {
  const out: Array<T & { requested_by: string | null; requested_at: Date | null }> = [];
  for (const item of items) {
    const own = events.filter((e) => e.contentId === item.id).sort((a, b) => b.at.getTime() - a.at.getTime());
    const lastRequest = own.find((e) => e.action === 'REQUEST') ?? null;
    const approvedByMe = own.some(
      (e) => e.action === 'APPROVE' && e.actorUserId === userId && (!lastRequest || e.at >= lastRequest.at),
    );
    if (approvedByMe) continue;
    out.push({ ...item, requested_by: lastRequest?.actorUserId ?? null, requested_at: lastRequest?.at ?? null });
  }
  return out;
}

/** Per-brand counts for Home brand cards (pure; unit-tested). */
export function summarizeBrands(
  brands: Array<{ id: string; name: string }>,
  items: Array<{ brandId: string; channel: string; approvalState: string; scheduleState: string; scheduledAt: Date | null }>,
  weekStart: Date,
  weekEnd: Date,
) {
  return brands.map((b) => {
    const own = items.filter((i) => i.brandId === b.id);
    return {
      id: b.id,
      name: b.name,
      logo_url: null as string | null,
      channels: [...new Set(own.map((i) => i.channel.toLowerCase()))].sort(),
      awaiting_approval: own.filter((i) => (PENDING_APPROVAL as readonly string[]).includes(i.approvalState)).length,
      scheduled_this_week: own.filter(
        (i) => i.scheduleState === 'SCHEDULED' && i.scheduledAt && i.scheduledAt >= weekStart && i.scheduledAt < weekEnd,
      ).length,
    };
  });
}

/** Real, tenant-scoped command-center payload for Home. */
export async function buildHome(
  tenantId: string,
  userId: string,
  now = new Date(),
  opts: { canApprove?: boolean } = {},
) {
  const prisma = getPrisma();
  const weekEnd = new Date(now.getTime() + 7 * DAY);
  const horizon = new Date(now.getTime() + 14 * DAY);
  const live = { archivedAt: null };

  const [
    brands,
    brandsWithWebsiteOrProfile,
    strategies,
    activeCampaigns,
    campaigns,
    content,
    contentInReview,
    scheduledThisWeek,
    openTasks,
    overdueTasks,
    myOpenTasks,
    openRequests,
    deliverablesAwaiting,
    reviewedContent,
    reviewedDeliverables,
    requestsCount,
    tasksCount,
  ] = await Promise.all([
    prisma.brandWorkspace.count({ where: tenantWhere(tenantId, live) }),
    prisma.brandWorkspace.count({
      where: tenantWhere(tenantId, {
        ...live,
        OR: [{ primaryWebsiteSourceId: { not: null } }, { currentApprovedProfileVersionId: { not: null } }],
      }),
    }),
    prisma.brandWorkspace.count({ where: tenantWhere(tenantId, { ...live, currentApprovedStrategyId: { not: null } }) }),
    prisma.campaign.count({ where: tenantWhere(tenantId, { status: 'ACTIVE' }) }),
    prisma.campaign.count({ where: tenantWhere(tenantId, { status: { not: 'ARCHIVED' } }) }),
    prisma.contentItem.count({ where: tenantWhere(tenantId, live) }),
    prisma.contentItem.count({
      where: tenantWhere(tenantId, { ...live, approvalState: { in: ['PENDING', 'PARTIALLY_APPROVED'] } }),
    }),
    prisma.contentItem.count({
      where: tenantWhere(tenantId, { ...live, scheduleState: 'SCHEDULED', scheduledAt: { gte: now, lt: weekEnd } }),
    }),
    prisma.workTask.count({ where: tenantWhere(tenantId, { status: { in: [...OPEN_TASK] } }) }),
    prisma.workTask.count({ where: tenantWhere(tenantId, { status: { in: [...OPEN_TASK] }, dueAt: { lt: now } }) }),
    prisma.workTask.count({
      where: tenantWhere(tenantId, { status: { in: [...OPEN_TASK] }, assigneeUserId: userId }),
    }),
    prisma.workRequest.count({ where: tenantWhere(tenantId, { status: { in: [...OPEN_REQUEST] } }) }),
    prisma.workDeliverable.count({ where: tenantWhere(tenantId, { reviewStatus: { in: [...REVIEW_DELIVERABLE] } }) }),
    prisma.contentItem.count({
      where: tenantWhere(tenantId, { approvalState: { in: ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'] } }),
    }),
    prisma.workDeliverable.count({
      where: tenantWhere(tenantId, { reviewStatus: { in: ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'] } }),
    }),
    prisma.workRequest.count({ where: tenantWhere(tenantId, {}) }),
    prisma.workTask.count({ where: tenantWhere(tenantId, {}) }),
  ]);

  const [myTasks, reviewContent, reviewDeliverables, upcoming, brandRows] = await Promise.all([
    prisma.workTask.findMany({
      where: tenantWhere(tenantId, { status: { in: [...OPEN_TASK] }, assigneeUserId: userId }),
      orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
      take: 8,
      select: { id: true, titleEn: true, titleAr: true, status: true, priority: true, dueAt: true, brandId: true },
    }),
    prisma.contentItem.findMany({
      where: tenantWhere(tenantId, { ...live, approvalState: { in: ['PENDING', 'PARTIALLY_APPROVED'] } }),
      orderBy: { updatedAt: 'desc' },
      take: 6,
      select: {
        id: true, titleEn: true, titleAr: true, brandId: true, approverApproved: true,
        approverRequired: true, updatedAt: true, channel: true,
      },
    }),
    prisma.workDeliverable.findMany({
      where: tenantWhere(tenantId, { reviewStatus: { in: [...REVIEW_DELIVERABLE] } }),
      orderBy: { updatedAt: 'desc' },
      take: 6,
      select: { id: true, titleEn: true, titleAr: true, brandId: true, updatedAt: true },
    }),
    prisma.contentItem.findMany({
      where: tenantWhere(tenantId, { ...live, scheduleState: 'SCHEDULED', scheduledAt: { gte: now, lt: horizon } }),
      orderBy: { scheduledAt: 'asc' },
      take: 8,
      select: { id: true, titleEn: true, titleAr: true, brandId: true, scheduledAt: true, channel: true },
    }),
    prisma.brandWorkspace.findMany({ where: tenantWhere(tenantId, {}), select: { id: true, name: true } }),
  ]);
  const brandName = new Map(brandRows.map((b) => [b.id, b.name]));

  // Planable-style Home additions (additive; existing fields unchanged).
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const stripEnd = new Date(dayStart.getTime() + 7 * DAY);
  const liveBrands = await prisma.brandWorkspace.findMany({
    where: tenantWhere(tenantId, live),
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
  const [brandItems, pendingItems, weekItems] = await Promise.all([
    prisma.contentItem.findMany({
      where: tenantWhere(tenantId, live),
      select: { brandId: true, channel: true, approvalState: true, scheduleState: true, scheduledAt: true },
    }),
    opts.canApprove === false
      ? Promise.resolve([])
      : prisma.contentItem.findMany({
          where: tenantWhere(tenantId, { ...live, approvalState: { in: [...PENDING_APPROVAL] } }),
          orderBy: { updatedAt: 'desc' },
          take: 20,
          select: {
            id: true, titleEn: true, titleAr: true, captionEn: true, captionAr: true, brandId: true,
            channel: true, previewAssetUrl: true, approverApproved: true, approverRequired: true, updatedAt: true,
          },
        }),
    prisma.contentItem.findMany({
      where: tenantWhere(tenantId, { ...live, scheduleState: 'SCHEDULED', scheduledAt: { gte: dayStart, lt: stripEnd } }),
      orderBy: { scheduledAt: 'asc' },
      take: 60,
      select: { id: true, titleEn: true, titleAr: true, brandId: true, channel: true, scheduledAt: true, previewAssetUrl: true },
    }),
  ]);
  const events = pendingItems.length
    ? await prisma.contentApprovalEvent.findMany({
        where: { tenantId, contentId: { in: pendingItems.map((p) => p.id) }, action: { in: ['REQUEST', 'APPROVE'] } },
        select: { contentId: true, actorUserId: true, action: true, at: true },
      })
    : [];
  const awaiting = selectAwaitingForUser(pendingItems, events, userId).slice(0, 8);
  const requesterIds = [...new Set(awaiting.map((a) => a.requested_by).filter((x): x is string => Boolean(x)))];
  const requesters = requesterIds.length
    ? await prisma.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, name: true } })
    : [];
  const userName = new Map(requesters.map((u) => [u.id, u.name]));

  const pendingReviews = [
    ...reviewContent.map((c) => ({
      kind: 'content' as const,
      id: c.id,
      title: copy(c.titleEn, c.titleAr),
      brand: brandName.get(c.brandId) ?? null,
      progress: { approved: c.approverApproved, required: Math.max(1, c.approverRequired) },
      href: `/app/content?item=${encodeURIComponent(c.id)}`,
      at: c.updatedAt.toISOString(),
    })),
    ...reviewDeliverables.map((d) => ({
      kind: 'deliverable' as const,
      id: d.id,
      title: copy(d.titleEn, d.titleAr),
      brand: brandName.get(d.brandId) ?? null,
      progress: null,
      href: `/app/deliverables/${encodeURIComponent(d.id)}`,
      at: d.updatedAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  return {
    data: {
      generated_at: now.toISOString(),
      counts: {
        brands,
        active_campaigns: activeCampaigns,
        content_in_review: contentInReview,
        scheduled_this_week: scheduledThisWeek,
        open_tasks: openTasks,
        overdue_tasks: overdueTasks,
        my_open_tasks: myOpenTasks,
        open_requests: openRequests,
        deliverables_awaiting_review: deliverablesAwaiting,
        pending_reviews: contentInReview + deliverablesAwaiting,
      },
      my_tasks: myTasks.map((t) => ({
        id: t.id,
        title: copy(t.titleEn, t.titleAr),
        status: t.status,
        priority: t.priority,
        due_at: t.dueAt?.toISOString() ?? null,
        overdue: Boolean(t.dueAt && t.dueAt < now),
        brand: brandName.get(t.brandId) ?? null,
        href: `/app/tasks?task=${encodeURIComponent(t.id)}`,
      })),
      pending_reviews: pendingReviews,
      upcoming_schedule: upcoming.map((c) => ({
        id: c.id,
        title: copy(c.titleEn, c.titleAr),
        channel: c.channel,
        scheduled_at: c.scheduledAt?.toISOString() ?? null,
        brand: brandName.get(c.brandId) ?? null,
        href: `/app/content?item=${encodeURIComponent(c.id)}`,
      })),
      brand_summaries: summarizeBrands(liveBrands, brandItems, now, weekEnd),
      awaiting_me: awaiting.map((c) => ({
        id: c.id,
        title: copy(c.titleEn, c.titleAr),
        caption: c.captionEn || c.captionAr ? copy(c.captionEn ?? '', c.captionAr) : null,
        channel: c.channel,
        brand_id: c.brandId,
        brand: brandName.get(c.brandId) ?? null,
        thumbnail_url: c.previewAssetUrl,
        requested_by: c.requested_by ? (userName.get(c.requested_by) ?? null) : null,
        requested_at: (c.requested_at ?? c.updatedAt).toISOString(),
        progress: { approved: c.approverApproved, required: Math.max(1, c.approverRequired) },
        href: `/app/content?item=${encodeURIComponent(c.id)}`,
      })),
      week: {
        start: dayStart.toISOString(),
        items: weekItems.map((c) => ({
          id: c.id,
          title: copy(c.titleEn, c.titleAr),
          channel: c.channel,
          brand: brandName.get(c.brandId) ?? null,
          scheduled_at: c.scheduledAt!.toISOString(),
          thumbnail_url: c.previewAssetUrl,
          href: `/app/content?item=${encodeURIComponent(c.id)}`,
        })),
      },
      can_approve: opts.canApprove !== false,
      checklist: computeChecklist({
        brands,
        brandsWithWebsiteOrProfile,
        strategies,
        campaigns,
        content,
        requestsOrTasks: requestsCount + tasksCount,
        reviewed: reviewedContent + reviewedDeliverables,
      }),
      // Scheduling inside OMA is not external publishing.
      publishing_connected: false,
    },
  };
}
