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

/** Real, tenant-scoped command-center payload for Home. */
export async function buildHome(tenantId: string, userId: string, now = new Date()) {
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
