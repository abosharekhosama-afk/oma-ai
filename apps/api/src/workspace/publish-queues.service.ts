import { getPrisma, tenantWhere } from '@oma/db';
import {
  clampSlotsPerDay,
  DomainError,
  minuteOfDayToTime,
  newId,
  nextFreeQueueSlot,
  normalizeTimeLocal,
  resolveQueueSlots,
  type QueueSlotCandidate,
} from '@oma/domain';
import { resolveScheduleTimezone } from '../common/schedule-timezone';

function bad(field: string) {
  return new DomainError('VALIDATION_FAILED', `Invalid ${field}`, 400, 'errors.validation_failed', [
    { field },
  ]);
}

export type QueuePatch = {
  social_page_id: string;
  enabled?: boolean;
  slots_per_day?: number;
  window_start?: string | null;
  window_end?: string | null;
  split?: string;
  use_suggested?: boolean;
  manual_slots?: Array<{
    day_of_week: number;
    time_local: string;
    enabled?: boolean;
  }>;
};

async function loadPage(tenantId: string, socialPageId: string) {
  const page = await getPrisma().socialPage.findFirst({
    where: { id: socialPageId, tenantId },
    select: { id: true, name: true, network: true, brandId: true, tenantId: true },
  });
  if (!page) throw new DomainError('NOT_FOUND', 'Social page not found', 404, 'errors.not_found');
  return page;
}

async function suggestedForPage(socialPageId: string): Promise<QueueSlotCandidate[]> {
  const rows = await getPrisma().optimalTimeSlot.findMany({
    where: { socialPageId },
    orderBy: [{ dayOfWeek: 'asc' }, { rank: 'asc' }],
  });
  return rows.map((r) => ({
    dayOfWeek: r.dayOfWeek,
    timeLocal: minuteOfDayToTime(r.minuteOfDay),
    origin: 'optimal' as const,
    enabled: true,
  }));
}

function serializeQueue(
  queue: {
    id: string;
    socialPageId: string;
    enabled: boolean;
    slotsPerDay: number;
    windowStart: string | null;
    windowEnd: string | null;
    split: string;
    useSuggested: boolean;
    slots: Array<{
      id: string;
      dayOfWeek: number;
      timeLocal: string;
      origin: string;
      enabled: boolean;
    }>;
  },
  suggested: QueueSlotCandidate[],
  extras: { name: string; network: string; brandId: string },
) {
  const manual: QueueSlotCandidate[] = queue.slots
    .filter((s) => s.origin === 'manual')
    .map((s) => ({
      dayOfWeek: s.dayOfWeek,
      timeLocal: s.timeLocal,
      origin: 'manual' as const,
      enabled: s.enabled,
    }));
  const resolved = resolveQueueSlots({
    useSuggested: queue.useSuggested,
    suggested,
    manual,
  });
  return {
    id: queue.id,
    social_page_id: queue.socialPageId,
    brand_id: extras.brandId,
    name: extras.name,
    network: extras.network,
    enabled: queue.enabled,
    slots_per_day: queue.slotsPerDay,
    window_start: queue.windowStart,
    window_end: queue.windowEnd,
    split: queue.split,
    use_suggested: queue.useSuggested,
    manual_slots: queue.slots
      .filter((s) => s.origin === 'manual')
      .map((s) => ({
        id: s.id,
        day_of_week: s.dayOfWeek,
        time_local: s.timeLocal,
        enabled: s.enabled,
        origin: 'manual' as const,
      })),
    resolved_slots: resolved.map((s) => ({
      day_of_week: s.dayOfWeek,
      time_local: s.timeLocal,
      origin: s.origin,
      enabled: s.enabled !== false,
      time_label: s.timeLocal,
    })),
  };
}

export async function listPublishQueues(tenantId: string, q: { brandId?: string } = {}) {
  if (q.brandId) {
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: q.brandId, archivedAt: null }),
      select: { id: true },
    });
    if (!brand) throw new DomainError('NOT_FOUND', 'Brand not found', 404, 'errors.not_found');
  }
  const pages = await getPrisma().socialPage.findMany({
    where: { tenantId, ...(q.brandId ? { brandId: q.brandId } : {}) },
    include: { publishQueue: { include: { slots: true } } },
    orderBy: { name: 'asc' },
  });
  const items = [];
  for (const page of pages) {
    const suggested = await suggestedForPage(page.id);
    const queue = page.publishQueue ?? {
      id: `virtual:${page.id}`,
      socialPageId: page.id,
      enabled: false,
      slotsPerDay: 3,
      windowStart: null,
      windowEnd: null,
      split: 'per_day',
      useSuggested: true,
      slots: [],
    };
    items.push(serializeQueue(queue, suggested, page));
  }
  return { items };
}

export async function upsertPublishQueue(tenantId: string, body: QueuePatch) {
  const page = await loadPage(tenantId, body.social_page_id);
  const prisma = getPrisma();
  const existing = await prisma.publishQueue.findUnique({ where: { socialPageId: page.id } });
  const slotsPerDay = clampSlotsPerDay(body.slots_per_day ?? existing?.slotsPerDay ?? 3);
  const windowStart =
    body.window_start === undefined
      ? (existing?.windowStart ?? null)
      : body.window_start
        ? normalizeTimeLocal(body.window_start)
        : null;
  const windowEnd =
    body.window_end === undefined
      ? (existing?.windowEnd ?? null)
      : body.window_end
        ? normalizeTimeLocal(body.window_end)
        : null;
  if (body.window_start && !windowStart) throw bad('window_start');
  if (body.window_end && !windowEnd) throw bad('window_end');
  const split = body.split ?? existing?.split ?? 'per_day';
  if (!['per_day', 'weekday_weekend'].includes(split)) throw bad('split');

  const queue = await prisma.publishQueue.upsert({
    where: { socialPageId: page.id },
    create: {
      id: newId(),
      tenantId,
      socialPageId: page.id,
      enabled: body.enabled ?? false,
      slotsPerDay,
      windowStart,
      windowEnd,
      split,
      useSuggested: body.use_suggested ?? true,
    },
    update: {
      enabled: body.enabled ?? existing?.enabled ?? false,
      slotsPerDay,
      windowStart,
      windowEnd,
      split,
      useSuggested: body.use_suggested ?? existing?.useSuggested ?? true,
    },
  });

  if (body.manual_slots) {
    const cleaned: Array<{ dayOfWeek: number; timeLocal: string; enabled: boolean }> = [];
    for (const slot of body.manual_slots) {
      const time = normalizeTimeLocal(slot.time_local);
      const dow = Number(slot.day_of_week);
      if (!time || !Number.isInteger(dow) || dow < 0 || dow > 6) throw bad('manual_slots');
      cleaned.push({ dayOfWeek: dow, timeLocal: time, enabled: slot.enabled !== false });
    }
    await prisma.queueSlot.deleteMany({ where: { queueId: queue.id, origin: 'manual' } });
    if (cleaned.length) {
      await prisma.queueSlot.createMany({
        data: cleaned.map((s) => ({
          id: newId(),
          queueId: queue.id,
          dayOfWeek: s.dayOfWeek,
          timeLocal: s.timeLocal,
          origin: 'manual',
          enabled: s.enabled,
        })),
        skipDuplicates: true,
      });
    }
  }

  const full = await prisma.publishQueue.findUniqueOrThrow({
    where: { id: queue.id },
    include: { slots: true },
  });
  return serializeQueue(full, await suggestedForPage(page.id), page);
}

export async function pickNextQueueSlot(
  tenantId: string,
  input: { brandId: string; socialPageIds?: string[] },
) {
  const prisma = getPrisma();
  const pages = await prisma.socialPage.findMany({
    where: {
      tenantId,
      brandId: input.brandId,
      ...(input.socialPageIds?.length ? { id: { in: input.socialPageIds } } : {}),
    },
    include: { publishQueue: { include: { slots: true } } },
    orderBy: { name: 'asc' },
  });
  if (!pages.length) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Connect a publishing account before adding to the queue',
      400,
      'errors.validation_failed',
    );
  }
  const timezone = await resolveScheduleTimezone(tenantId, input.brandId);
  const occupiedRows = await prisma.contentItem.findMany({
    where: { tenantId, brandId: input.brandId, scheduledAt: { not: null } },
    select: { scheduledAt: true },
  });
  const occupied = occupiedRows
    .map((r) => r.scheduledAt)
    .filter((d): d is Date => d instanceof Date);

  const ordered = [
    ...pages.filter((p) => p.publishQueue?.enabled),
    ...pages.filter((p) => !p.publishQueue?.enabled),
  ];
  for (const page of ordered) {
    const queue = page.publishQueue;
    const suggested = await suggestedForPage(page.id);
    const manual: QueueSlotCandidate[] = (queue?.slots ?? [])
      .filter((s) => s.origin === 'manual')
      .map((s) => ({
        dayOfWeek: s.dayOfWeek,
        timeLocal: s.timeLocal,
        origin: 'manual' as const,
        enabled: s.enabled,
      }));
    const slots = resolveQueueSlots({
      useSuggested: queue?.useSuggested ?? true,
      suggested,
      manual,
    });
    const next = nextFreeQueueSlot({
      now: new Date(),
      timezone,
      slots,
      slotsPerDay: queue?.slotsPerDay ?? 3,
      occupied,
      windowStart: queue?.windowStart,
      windowEnd: queue?.windowEnd,
    });
    if (next) {
      return {
        at: next.at,
        timezone,
        socialPageId: page.id,
        timeLocal: next.timeLocal,
        origin: next.origin,
      };
    }
  }
  return null;
}
