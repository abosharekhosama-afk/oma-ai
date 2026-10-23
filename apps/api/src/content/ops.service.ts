import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError, newId } from '@oma/domain';
import { AuditService } from '../audit/audit.service';

type LocaleInput = { en: string; ar?: string } | string;

function localePair(input: LocaleInput | undefined, fallback = ''): { en: string; ar: string } {
  if (input == null) return { en: fallback, ar: fallback };
  if (typeof input === 'string') return { en: input.trim(), ar: input.trim() };
  const en = (input.en ?? '').trim() || fallback;
  const ar = (input.ar ?? input.en ?? '').trim() || en;
  return { en, ar };
}

@Injectable()
export class OpsService {
  constructor(private readonly audit: AuditService) {}

  private async requireBrand(tenantId: string, brandId: string) {
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    if (!brand) throw new DomainError('NOT_FOUND', 'Brand not found', 404, 'errors.not_found');
    if (brand.status === 'ARCHIVED') {
      throw new DomainError('BRAND_ARCHIVED', 'Brand is archived', 409, 'error.brand_archived');
    }
    return brand;
  }

  // --- Requests ---
  async listRequests(tenantId: string, brandId: string, query?: { status?: string; q?: string }) {
    await this.requireBrand(tenantId, brandId);
    const where: Record<string, unknown> = { tenantId, brandId };
    if (query?.status) where.status = query.status;
    if (query?.q) {
      where.OR = [
        { titleEn: { contains: query.q, mode: 'insensitive' } },
        { titleAr: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const rows = await getPrisma().workRequest.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    const enriched = await this.enrichRequests(rows);
    return { data: enriched };
  }

  async getRequest(tenantId: string, requestId: string) {
    const row = await getPrisma().workRequest.findFirst({
      where: tenantWhere(tenantId, { id: requestId }),
      include: { tasks: true, deliverables: true },
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Request not found', 404, 'errors.not_found');
    const [data] = await this.enrichRequests([row]);
    const tasks = await this.enrichTasks(row.tasks);
    return {
      data,
      tasks,
      deliverables: await this.enrichDeliverables(row.deliverables),
    };
  }

  /** Resolve user / brand / campaign labels so the UI never shows raw ULID strings. */
  private async enrichRequests(
    rows: Array<{
      id: string;
      tenantId: string;
      brandId: string;
      campaignId: string | null;
      contentId: string | null;
      titleEn: string;
      titleAr: string;
      descriptionEn: string;
      descriptionAr: string;
      type: string;
      priority: string;
      status: string;
      dueAt: Date | null;
      requesterUserId: string;
      assigneeUserId: string | null;
      channels: string[];
      formats: string[];
      createdAt: Date;
      updatedAt: Date;
    }>,
  ) {
    if (!rows.length) return [];
    const userIds = new Set<string>();
    const brandIds = new Set<string>();
    const campaignIds = new Set<string>();
    for (const r of rows) {
      if (r.requesterUserId) userIds.add(r.requesterUserId);
      if (r.assigneeUserId) userIds.add(r.assigneeUserId);
      brandIds.add(r.brandId);
      if (r.campaignId) campaignIds.add(r.campaignId);
    }
    const prisma = getPrisma();
    const [users, brands, campaigns] = await Promise.all([
      userIds.size
        ? prisma.user.findMany({
            where: { id: { in: [...userIds] } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
      brandIds.size
        ? prisma.brandWorkspace.findMany({
            where: { id: { in: [...brandIds] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      campaignIds.size
        ? prisma.campaign.findMany({
            where: { id: { in: [...campaignIds] } },
            select: { id: true, nameEn: true, nameAr: true },
          })
        : Promise.resolve([]),
    ]);
    const userMap = new Map(
      users.map((u) => [u.id, (u.name && u.name.trim()) || u.email || 'Team member']),
    );
    const brandMap = new Map(brands.map((b) => [b.id, b.name || 'Brand']));
    const campaignMap = new Map(
      campaigns.map((c) => [c.id, c.nameEn || c.nameAr || 'Campaign']),
    );
    return rows.map((row) => {
      const base = mapRequest(row);
      return {
        ...base,
        requester_name: userMap.get(row.requesterUserId) || 'Team member',
        assignee_name: row.assigneeUserId
          ? userMap.get(row.assigneeUserId) || 'Team member'
          : null,
        brand_name: brandMap.get(row.brandId) || 'Brand',
        campaign_name: row.campaignId ? campaignMap.get(row.campaignId) || null : null,
      };
    });
  }

  private async enrichTasks(
    rows: Array<{
      id: string;
      tenantId: string;
      brandId: string;
      campaignId: string | null;
      requestId: string | null;
      contentId: string | null;
      titleEn: string;
      titleAr: string;
      descriptionEn: string;
      descriptionAr: string;
      status: string;
      assigneeUserId: string | null;
      dueAt: Date | null;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
    }>,
  ) {
    if (!rows.length) return [];
    const userIds = new Set<string>();
    for (const r of rows) {
      if (r.assigneeUserId) userIds.add(r.assigneeUserId);
      if (r.createdBy) userIds.add(r.createdBy);
    }
    const users = userIds.size
      ? await getPrisma().user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(
      users.map((u) => [u.id, (u.name && u.name.trim()) || u.email || 'Team member']),
    );
    return rows.map((row) => ({
      ...mapTask(row),
      assignee_name: row.assigneeUserId
        ? userMap.get(row.assigneeUserId) || 'Team member'
        : null,
      created_by_name: userMap.get(row.createdBy) || 'Team member',
    }));
  }


  private async enrichDeliverables(
    rows: Array<{
      id: string;
      tenantId: string;
      brandId: string;
      campaignId: string | null;
      requestId: string | null;
      taskId: string | null;
      contentId: string | null;
      titleEn: string;
      titleAr: string;
      status: string;
      reviewStatus: string;
      assetUrl: string | null;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
    }>,
  ) {
    if (!rows.length) return [];
    const userIds = new Set<string>();
    const brandIds = new Set<string>();
    const campaignIds = new Set<string>();
    const requestIds = new Set<string>();
    const taskIds = new Set<string>();
    for (const r of rows) {
      if (r.createdBy) userIds.add(r.createdBy);
      brandIds.add(r.brandId);
      if (r.campaignId) campaignIds.add(r.campaignId);
      if (r.requestId) requestIds.add(r.requestId);
      if (r.taskId) taskIds.add(r.taskId);
    }
    const prisma = getPrisma();
    const [users, brands, campaigns, requests, tasks] = await Promise.all([
      userIds.size
        ? prisma.user.findMany({
            where: { id: { in: [...userIds] } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
      brandIds.size
        ? prisma.brandWorkspace.findMany({
            where: { id: { in: [...brandIds] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      campaignIds.size
        ? prisma.campaign.findMany({
            where: { id: { in: [...campaignIds] } },
            select: { id: true, nameEn: true, nameAr: true },
          })
        : Promise.resolve([]),
      requestIds.size
        ? prisma.workRequest.findMany({
            where: { id: { in: [...requestIds] } },
            select: { id: true, titleEn: true, titleAr: true },
          })
        : Promise.resolve([]),
      taskIds.size
        ? prisma.workTask.findMany({
            where: { id: { in: [...taskIds] } },
            select: { id: true, titleEn: true, titleAr: true },
          })
        : Promise.resolve([]),
    ]);
    const userMap = new Map(
      users.map((u) => [u.id, (u.name && u.name.trim()) || u.email || 'Team member']),
    );
    const brandMap = new Map(brands.map((b) => [b.id, b.name || 'Brand']));
    const campaignMap = new Map(
      campaigns.map((c) => [c.id, c.nameEn || c.nameAr || 'Campaign']),
    );
    const requestMap = new Map(
      requests.map((r) => [r.id, r.titleEn || r.titleAr || 'Request']),
    );
    const taskMap = new Map(tasks.map((t) => [t.id, t.titleEn || t.titleAr || 'Task']));
    return rows.map((row) => ({
      ...mapDeliverable(row),
      created_by_name: userMap.get(row.createdBy) || 'Team member',
      brand_name: brandMap.get(row.brandId) || 'Brand',
      campaign_name: row.campaignId ? campaignMap.get(row.campaignId) || null : null,
      request_title: row.requestId ? requestMap.get(row.requestId) || null : null,
      task_title: row.taskId ? taskMap.get(row.taskId) || null : null,
    }));
  }

  async createRequest(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    input: {
      title: LocaleInput;
      description?: LocaleInput;
      type?: string;
      priority?: string;
      campaignId?: string | null;
      contentId?: string | null;
      dueAt?: string | null;
      assigneeUserId?: string | null;
      channels?: string[];
      formats?: string[];
    },
    correlationId?: string,
  ) {
    await this.requireBrand(tenantId, brandId);
    const title = localePair(input.title);
    const desc = localePair(input.description);
    const status = input.assigneeUserId ? 'ASSIGNED' : 'OPEN';
    const row = await getPrisma().workRequest.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        campaignId: input.campaignId ?? null,
        contentId: input.contentId ?? null,
        titleEn: title.en,
        titleAr: title.ar,
        descriptionEn: desc.en,
        descriptionAr: desc.ar,
        type: (input.type as never) ?? 'CONTENT',
        priority: (input.priority as never) ?? 'MEDIUM',
        status: status as never,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        requesterUserId: actorUserId,
        assigneeUserId: input.assigneeUserId ?? null,
        channels: input.channels ?? [],
        formats: input.formats ?? [],
      },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'request.created',
      targetType: 'WorkRequest',
      targetId: row.id,
      correlationId,
    });
    return { data: mapRequest(row) };
  }

  async updateRequest(
    tenantId: string,
    actorUserId: string,
    requestId: string,
    patch: Record<string, unknown>,
    correlationId?: string,
  ) {
    const current = await getPrisma().workRequest.findFirst({
      where: tenantWhere(tenantId, { id: requestId }),
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Request not found', 404, 'errors.not_found');
    const title = patch.title != null ? localePair(patch.title as LocaleInput) : null;
    const desc = patch.description != null ? localePair(patch.description as LocaleInput) : null;
    const row = await getPrisma().workRequest.update({
      where: { id: requestId },
      data: {
        ...(title ? { titleEn: title.en, titleAr: title.ar } : {}),
        ...(desc ? { descriptionEn: desc.en, descriptionAr: desc.ar } : {}),
        ...(patch.status ? { status: patch.status as never } : {}),
        ...(patch.priority ? { priority: patch.priority as never } : {}),
        ...(patch.assigneeUserId !== undefined
          ? { assigneeUserId: patch.assigneeUserId as string | null }
          : {}),
        ...(patch.dueAt !== undefined
          ? { dueAt: patch.dueAt ? new Date(String(patch.dueAt)) : null }
          : {}),
        ...(patch.contentId !== undefined ? { contentId: patch.contentId as string | null } : {}),
        ...(patch.campaignId !== undefined ? { campaignId: patch.campaignId as string | null } : {}),
        ...(patch.channels !== undefined ? { channels: patch.channels as string[] } : {}),
        ...(patch.formats !== undefined ? { formats: patch.formats as string[] } : {}),
        ...(patch.type !== undefined ? { type: patch.type as never } : {}),
      },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'request.updated',
      targetType: 'WorkRequest',
      targetId: requestId,
      correlationId,
    });
    return { data: mapRequest(row) };
  }

  /** Convert request → task (start lifecycle). */
  async convertRequestToTask(
    tenantId: string,
    actorUserId: string,
    requestId: string,
    correlationId?: string,
  ) {
    const req = await getPrisma().workRequest.findFirst({
      where: tenantWhere(tenantId, { id: requestId }),
    });
    if (!req) throw new DomainError('NOT_FOUND', 'Request not found', 404, 'errors.not_found');
    const task = await getPrisma().workTask.create({
      data: {
        id: newId(),
        tenantId,
        brandId: req.brandId,
        campaignId: req.campaignId,
        requestId: req.id,
        contentId: req.contentId,
        titleEn: req.titleEn,
        titleAr: req.titleAr,
        descriptionEn: req.descriptionEn,
        descriptionAr: req.descriptionAr,
        status: 'TODO',
        assigneeUserId: req.assigneeUserId,
        dueAt: req.dueAt,
        createdBy: actorUserId,
      },
    });
    await getPrisma().workRequest.update({
      where: { id: requestId },
      data: { status: 'IN_PROGRESS' },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'request.converted_to_task',
      targetType: 'WorkTask',
      targetId: task.id,
      correlationId,
    });
    return { data: mapTask(task) };
  }

  // --- Tasks ---
  async listTasks(tenantId: string, brandId: string, query?: { status?: string }) {
    await this.requireBrand(tenantId, brandId);
    const where: Record<string, unknown> = { tenantId, brandId };
    if (query?.status) where.status = query.status;
    const rows = await getPrisma().workTask.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return { data: rows.map(mapTask) };
  }

  async createTask(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    input: {
      title: LocaleInput;
      description?: LocaleInput;
      requestId?: string | null;
      contentId?: string | null;
      campaignId?: string | null;
      status?: string;
      assigneeUserId?: string | null;
      dueAt?: string | null;
    },
    correlationId?: string,
  ) {
    await this.requireBrand(tenantId, brandId);
    const title = localePair(input.title);
    const desc = localePair(input.description);
    const row = await getPrisma().workTask.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        campaignId: input.campaignId ?? null,
        requestId: input.requestId ?? null,
        contentId: input.contentId ?? null,
        titleEn: title.en,
        titleAr: title.ar,
        descriptionEn: desc.en,
        descriptionAr: desc.ar,
        status: (input.status as never) ?? 'TODO',
        priority: (input.priority as never) ?? 'MEDIUM',
        department: typeof input.department === 'string' ? input.department : '',
        assigneeUserId: input.assigneeUserId ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        createdBy: actorUserId,
      },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'task.created',
      targetType: 'WorkTask',
      targetId: row.id,
      correlationId,
    });
    return { data: mapTask(row) };
  }

  async updateTask(
    tenantId: string,
    actorUserId: string,
    taskId: string,
    patch: Record<string, unknown>,
    correlationId?: string,
  ) {
    const current = await getPrisma().workTask.findFirst({
      where: tenantWhere(tenantId, { id: taskId }),
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Task not found', 404, 'errors.not_found');
    const title = patch.title != null ? localePair(patch.title as LocaleInput) : null;
    const row = await getPrisma().workTask.update({
      where: { id: taskId },
      data: {
        ...(title ? { titleEn: title.en, titleAr: title.ar } : {}),
        ...(patch.status ? { status: patch.status as never } : {}),
        ...(patch.assigneeUserId !== undefined
          ? { assigneeUserId: patch.assigneeUserId as string | null }
          : {}),
        ...(patch.dueAt !== undefined
          ? { dueAt: patch.dueAt ? new Date(String(patch.dueAt)) : null }
          : {}),
      },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'task.updated',
      targetType: 'WorkTask',
      targetId: taskId,
      correlationId,
    });
    return { data: mapTask(row) };
  }

  /** Convert task → deliverable. */
  async convertTaskToDeliverable(
    tenantId: string,
    actorUserId: string,
    taskId: string,
    correlationId?: string,
  ) {
    const task = await getPrisma().workTask.findFirst({
      where: tenantWhere(tenantId, { id: taskId }),
    });
    if (!task) throw new DomainError('NOT_FOUND', 'Task not found', 404, 'errors.not_found');
    const delId = newId();
    const verId = newId();
    const del = await getPrisma().workDeliverable.create({
      data: {
        id: delId,
        tenantId,
        brandId: task.brandId,
        campaignId: task.campaignId,
        requestId: task.requestId,
        taskId: task.id,
        contentId: task.contentId,
        titleEn: task.titleEn,
        titleAr: task.titleAr,
        status: 'DRAFT',
        reviewStatus: 'NOT_STARTED',
        currentVersionId: verId,
        createdBy: actorUserId,
      },
    });
    await getPrisma().workDeliverableVersion.create({
      data: {
        id: verId,
        tenantId,
        deliverableId: delId,
        label: 'v1',
        versionNumber: 1,
        assetUrl: null,
        status: 'DRAFT',
        createdBy: actorUserId,
        updatedAt: new Date(),
      },
    });
    await getPrisma().workTask.update({
      where: { id: taskId },
      data: { status: 'IN_REVIEW' },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'task.converted_to_deliverable',
      targetType: 'WorkDeliverable',
      targetId: del.id,
      correlationId,
    });
    const [enrichedDel] = await this.enrichDeliverables([del]);
    return { data: enrichedDel };
  }

  // --- Deliverables ---
  async listDeliverables(tenantId: string, brandId: string) {
    await this.requireBrand(tenantId, brandId);
    const rows = await getPrisma().workDeliverable.findMany({
      where: { tenantId, brandId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return { data: await this.enrichDeliverables(rows) };
  }

  async getDeliverable(tenantId: string, deliverableId: string) {
    let row: any;
    try {
      row = await getPrisma().workDeliverable.findFirst({
        where: tenantWhere(tenantId, { id: deliverableId }),
        include: {
          versions: { orderBy: { versionNumber: 'asc' } },
          annotations: { orderBy: { createdAt: 'asc' } },
          comments: { orderBy: { createdAt: 'asc' } },
        },
      });
    } catch {
      // Schema/client without relation tables yet — fall back to base row
      row = await getPrisma().workDeliverable.findFirst({
        where: tenantWhere(tenantId, { id: deliverableId }),
      });
      if (row) {
        row = { ...row, versions: [], annotations: [], comments: [] };
      }
    }
    if (!row) {
      throw new DomainError('NOT_FOUND', 'Deliverable not found', 404, 'errors.not_found');
    }
    if (!row.versions) row.versions = [];
    if (!row.annotations) row.annotations = [];
    if (!row.comments) row.comments = [];
    const [data] = await this.enrichDeliverables([row]);
    const userIds = new Set<string>();
    for (const v of row.versions) userIds.add(v.createdBy);
    for (const a of row.annotations) userIds.add(a.authorUserId);
    for (const c of row.comments) userIds.add(c.authorUserId);
    const users = userIds.size
      ? await getPrisma().user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(
      users.map((u) => [u.id, (u.name && u.name.trim()) || u.email || 'Team member']),
    );
    return {
      data,
      versions: row.versions.map((v) => ({
        id: v.id,
        label: v.label,
        version_number: v.versionNumber,
        asset_url: v.assetUrl,
        notes: { en: v.notesEn, ar: v.notesAr },
        status: v.status,
        created_by: v.createdBy,
        created_by_name: userMap.get(v.createdBy) || 'Team member',
        created_at: v.createdAt.toISOString(),
      })),
      annotations: row.annotations.map((a) => ({
        id: a.id,
        version_id: a.versionId,
        author_user_id: a.authorUserId,
        author_name: userMap.get(a.authorUserId) || 'Team member',
        body: { en: a.bodyEn, ar: a.bodyAr },
        x: a.x,
        y: a.y,
        resolved: a.resolved,
        created_at: a.createdAt.toISOString(),
      })),
      comments: row.comments.map((c) => ({
        id: c.id,
        version_id: c.versionId,
        author_user_id: c.authorUserId,
        author_name: userMap.get(c.authorUserId) || 'Team member',
        body: { en: c.bodyEn, ar: c.bodyAr },
        resolved: c.resolved,
        created_at: c.createdAt.toISOString(),
      })),
    };
  }

  async updateDeliverable(
    tenantId: string,
    actorUserId: string,
    deliverableId: string,
    patch: Record<string, unknown>,
    correlationId?: string,
  ) {
    const current = await getPrisma().workDeliverable.findFirst({
      where: tenantWhere(tenantId, { id: deliverableId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Deliverable not found', 404, 'errors.not_found');
    }
    const title =
      patch.title != null ? localePair(patch.title as LocaleInput) : null;
    const row = await getPrisma().workDeliverable.update({
      where: { id: deliverableId },
      data: {
        ...(title ? { titleEn: title.en, titleAr: title.ar } : {}),
        ...(patch.status ? { status: patch.status as never } : {}),
        ...(patch.reviewStatus ? { reviewStatus: String(patch.reviewStatus) } : {}),
        ...(patch.assetUrl !== undefined ? { assetUrl: patch.assetUrl as string | null } : {}),
        ...(patch.contentId !== undefined ? { contentId: patch.contentId as string | null } : {}),
      },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'deliverable.updated',
      targetType: 'WorkDeliverable',
      targetId: deliverableId,
      correlationId,
    });
    const [data] = await this.enrichDeliverables([row]);
    return { data };
  }

  /**
   * Explicit review workflow:
   * submit | approve | request_changes | reject
   */
  async reviewDeliverable(
    tenantId: string,
    actorUserId: string,
    deliverableId: string,
    action: string,
    correlationId?: string,
  ) {
    const current = await getPrisma().workDeliverable.findFirst({
      where: tenantWhere(tenantId, { id: deliverableId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Deliverable not found', 404, 'errors.not_found');
    }
    const from = (current.reviewStatus || 'NOT_STARTED').toUpperCase();
    const normalized = action.toLowerCase().replace(/-/g, '_');
    const transitions: Record<string, { next: string; status?: string }> = {
      submit: { next: 'IN_REVIEW', status: 'IN_REVIEW' },
      approve: { next: 'APPROVED', status: 'APPROVED' },
      request_changes: { next: 'CHANGES_REQUESTED', status: 'CHANGES_REQUESTED' },
      reject: { next: 'REJECTED', status: 'REJECTED' },
    };
    const step = transitions[normalized];
    if (!step) {
      throw new DomainError(
        'INVALID_INPUT',
        'Unknown review action',
        400,
        'errors.invalid_input',
      );
    }
    const allowed: Record<string, string[]> = {
      NOT_STARTED: ['submit'],
      DRAFT: ['submit'],
      AWAITING_REVIEW: ['approve', 'request_changes', 'reject'],
      IN_REVIEW: ['approve', 'request_changes', 'reject'],
      CHANGES_REQUESTED: ['submit'],
      APPROVED: [],
      REJECTED: [],
    };
    const fromKey = from in allowed ? from : 'NOT_STARTED';
    if (!(allowed[fromKey] || []).includes(normalized)) {
      throw new DomainError(
        'INVALID_TRANSITION',
        `Cannot ${normalized} from ${from}`,
        409,
        'errors.invalid_transition',
      );
    }
    const row = await getPrisma().workDeliverable.update({
      where: { id: deliverableId },
      data: {
        reviewStatus: step.next,
        ...(step.status ? { status: step.status as never } : {}),
      },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: `deliverable.review.${normalized}`,
      targetType: 'WorkDeliverable',
      targetId: deliverableId,
      afterRef: step.next,
      correlationId,
    });
    const [data] = await this.enrichDeliverables([row]);
    return { data };
  }

  async addDeliverableVersion(
    tenantId: string,
    actorUserId: string,
    deliverableId: string,
    input: { assetUrl?: string | null; label?: string; notes?: LocaleInput },
    correlationId?: string,
  ) {
    const del = await getPrisma().workDeliverable.findFirst({
      where: tenantWhere(tenantId, { id: deliverableId }),
    });
    if (!del) throw new DomainError('NOT_FOUND', 'Deliverable not found', 404, 'errors.not_found');
    const last = await getPrisma().workDeliverableVersion.findFirst({
      where: { deliverableId },
      orderBy: { versionNumber: 'desc' },
    });
    const n = (last?.versionNumber ?? 0) + 1;
    const notes = localePair(input.notes);
    const ver = await getPrisma().workDeliverableVersion.create({
      data: {
        id: newId(),
        tenantId,
        deliverableId,
        label: input.label?.trim() || `v${n}`,
        versionNumber: n,
        assetUrl: input.assetUrl ?? del.assetUrl,
        notesEn: notes.en,
        notesAr: notes.ar,
        status: 'DRAFT',
        createdBy: actorUserId,
        updatedAt: new Date(),
      },
    });
    await getPrisma().workDeliverable.update({
      where: { id: deliverableId },
      data: { currentVersionId: ver.id, assetUrl: ver.assetUrl, reviewStatus: 'NOT_STARTED' as never, status: 'DRAFT' as never },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'deliverable.version.added',
      targetType: 'WorkDeliverableVersion',
      targetId: ver.id,
      correlationId,
    });
    return this.getDeliverable(tenantId, deliverableId);
  }

  async addDeliverableAnnotation(
    tenantId: string,
    actorUserId: string,
    deliverableId: string,
    input: { body: LocaleInput; x?: number; y?: number; versionId?: string | null },
  ) {
    await this.requireDeliverable(tenantId, deliverableId);
    const body = localePair(input.body);
    const row = await getPrisma().workDeliverableAnnotation.create({
      data: {
        id: newId(),
        tenantId,
        deliverableId,
        versionId: input.versionId ?? null,
        authorUserId: actorUserId,
        bodyEn: body.en,
        bodyAr: body.ar,
        x: input.x ?? 0.5,
        y: input.y ?? 0.5,
        updatedAt: new Date(),
      },
    });
    return {
      data: {
        id: row.id,
        version_id: row.versionId,
        author_user_id: row.authorUserId,
        body: { en: row.bodyEn, ar: row.bodyAr },
        x: row.x,
        y: row.y,
        resolved: row.resolved,
        created_at: row.createdAt.toISOString(),
      },
    };
  }

  async resolveDeliverableAnnotation(
    tenantId: string,
    actorUserId: string,
    annotationId: string,
    resolved = true,
  ) {
    const current = await getPrisma().workDeliverableAnnotation.findFirst({
      where: { id: annotationId, tenantId },
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Annotation not found', 404, 'errors.not_found');
    const row = await getPrisma().workDeliverableAnnotation.update({
      where: { id: annotationId },
      data: { resolved },
    });
    return { data: { id: row.id, resolved: row.resolved } };
  }

  async addDeliverableComment(
    tenantId: string,
    actorUserId: string,
    deliverableId: string,
    input: { body: LocaleInput; versionId?: string | null },
  ) {
    await this.requireDeliverable(tenantId, deliverableId);
    const body = localePair(input.body);
    const row = await getPrisma().workDeliverableComment.create({
      data: {
        id: newId(),
        tenantId,
        deliverableId,
        versionId: input.versionId ?? null,
        authorUserId: actorUserId,
        bodyEn: body.en,
        bodyAr: body.ar,
        updatedAt: new Date(),
      },
    });
    return {
      data: {
        id: row.id,
        version_id: row.versionId,
        author_user_id: row.authorUserId,
        body: { en: row.bodyEn, ar: row.bodyAr },
        resolved: row.resolved,
        created_at: row.createdAt.toISOString(),
      },
    };
  }

  async getTaskDetail(tenantId: string, taskId: string) {
    const row = await getPrisma().workTask.findFirst({
      where: tenantWhere(tenantId, { id: taskId }),
      include: {
        checklistItems: { orderBy: { sortOrder: 'asc' } },
        comments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Task not found', 404, 'errors.not_found');
    const [data] = await this.enrichTasks([row]);
    const userIds = new Set<string>(row.comments.map((c) => c.authorUserId));
    const users = userIds.size
      ? await getPrisma().user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(
      users.map((u) => [u.id, (u.name && u.name.trim()) || u.email || 'Team member']),
    );
    return {
      data,
      checklist: row.checklistItems.map((i) => ({
        id: i.id,
        title: { en: i.titleEn, ar: i.titleAr },
        done: i.done,
        sort_order: i.sortOrder,
      })),
      comments: row.comments.map((c) => ({
        id: c.id,
        author_user_id: c.authorUserId,
        author_name: userMap.get(c.authorUserId) || 'Team member',
        body: { en: c.bodyEn, ar: c.bodyAr },
        created_at: c.createdAt.toISOString(),
      })),
    };
  }

  async addTaskChecklistItem(
    tenantId: string,
    actorUserId: string,
    taskId: string,
    input: { title: LocaleInput },
  ) {
    const task = await getPrisma().workTask.findFirst({ where: tenantWhere(tenantId, { id: taskId }) });
    if (!task) throw new DomainError('NOT_FOUND', 'Task not found', 404, 'errors.not_found');
    const title = localePair(input.title);
    const count = await getPrisma().workTaskChecklistItem.count({ where: { taskId } });
    const row = await getPrisma().workTaskChecklistItem.create({
      data: {
        id: newId(),
        tenantId,
        taskId,
        titleEn: title.en,
        titleAr: title.ar,
        sortOrder: count,
        updatedAt: new Date(),
      },
    });
    return { data: { id: row.id, title: { en: row.titleEn, ar: row.titleAr }, done: row.done, sort_order: row.sortOrder } };
  }

  async updateTaskChecklistItem(
    tenantId: string,
    taskId: string,
    itemId: string,
    patch: { done?: boolean; title?: LocaleInput },
  ) {
    const current = await getPrisma().workTaskChecklistItem.findFirst({
      where: { id: itemId, taskId, tenantId },
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Checklist item not found', 404, 'errors.not_found');
    const title = patch.title != null ? localePair(patch.title) : null;
    const row = await getPrisma().workTaskChecklistItem.update({
      where: { id: itemId },
      data: {
        ...(patch.done !== undefined ? { done: patch.done } : {}),
        ...(title ? { titleEn: title.en, titleAr: title.ar } : {}),
      },
    });
    return { data: { id: row.id, title: { en: row.titleEn, ar: row.titleAr }, done: row.done, sort_order: row.sortOrder } };
  }

  async addTaskComment(
    tenantId: string,
    actorUserId: string,
    taskId: string,
    input: { body: LocaleInput },
  ) {
    const task = await getPrisma().workTask.findFirst({ where: tenantWhere(tenantId, { id: taskId }) });
    if (!task) throw new DomainError('NOT_FOUND', 'Task not found', 404, 'errors.not_found');
    const body = localePair(input.body);
    const row = await getPrisma().workTaskComment.create({
      data: {
        id: newId(),
        tenantId,
        taskId,
        authorUserId: actorUserId,
        bodyEn: body.en,
        bodyAr: body.ar,
        updatedAt: new Date(),
      },
    });
    return {
      data: {
        id: row.id,
        author_user_id: row.authorUserId,
        body: { en: row.bodyEn, ar: row.bodyAr },
        created_at: row.createdAt.toISOString(),
      },
    };
  }

  private async requireDeliverable(tenantId: string, deliverableId: string) {
    const row = await getPrisma().workDeliverable.findFirst({
      where: tenantWhere(tenantId, { id: deliverableId }),
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Deliverable not found', 404, 'errors.not_found');
    return row;
  }
}


function mapRequest(row: {
  id: string;
  tenantId: string;
  brandId: string;
  campaignId: string | null;
  contentId: string | null;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  type: string;
  priority: string;
  status: string;
  dueAt: Date | null;
  requesterUserId: string;
  assigneeUserId: string | null;
  channels: string[];
  formats: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    brand_id: row.brandId,
    campaign_id: row.campaignId,
    content_id: row.contentId,
    title: { en: row.titleEn, ar: row.titleAr },
    description: { en: row.descriptionEn, ar: row.descriptionAr },
    type: row.type,
    priority: row.priority,
    status: row.status,
    due_at: row.dueAt?.toISOString() ?? null,
    requester_user_id: row.requesterUserId,
    assignee_user_id: row.assigneeUserId,
    channels: row.channels,
    formats: row.formats,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapTask(row: {
  id: string;
  tenantId: string;
  brandId: string;
  campaignId: string | null;
  requestId: string | null;
  contentId: string | null;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  status: string;
  priority?: string;
  department?: string;
  assigneeUserId: string | null;
  dueAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    brand_id: row.brandId,
    campaign_id: row.campaignId,
    request_id: row.requestId,
    content_id: row.contentId,
    title: { en: row.titleEn, ar: row.titleAr },
    description: { en: row.descriptionEn, ar: row.descriptionAr },
    status: row.status,
    priority: row.priority || 'MEDIUM',
    department: row.department || '',
    assignee_user_id: row.assigneeUserId,
    due_at: row.dueAt?.toISOString() ?? null,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapDeliverable(row: {
  id: string;
  tenantId: string;
  brandId: string;
  campaignId: string | null;
  requestId: string | null;
  taskId: string | null;
  contentId: string | null;
  titleEn: string;
  titleAr: string;
  status: string;
  reviewStatus: string;
  assetUrl: string | null;
  currentVersionId?: string | null;
  approvedVersionId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    brand_id: row.brandId,
    campaign_id: row.campaignId,
    request_id: row.requestId,
    task_id: row.taskId,
    content_id: row.contentId,
    title: { en: row.titleEn, ar: row.titleAr },
    status: row.status,
    review_status: row.reviewStatus,
    asset_url: row.assetUrl,
    current_version_id: row.currentVersionId ?? null,
    approved_version_id: row.approvedVersionId ?? null,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
