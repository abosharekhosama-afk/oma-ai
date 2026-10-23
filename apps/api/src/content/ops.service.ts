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
    return { data: rows.map(mapRequest) };
  }

  async getRequest(tenantId: string, requestId: string) {
    const row = await getPrisma().workRequest.findFirst({
      where: tenantWhere(tenantId, { id: requestId }),
      include: { tasks: true, deliverables: true },
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Request not found', 404, 'errors.not_found');
    return {
      data: mapRequest(row),
      tasks: row.tasks.map(mapTask),
      deliverables: row.deliverables.map(mapDeliverable),
    };
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
    const del = await getPrisma().workDeliverable.create({
      data: {
        id: newId(),
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
        createdBy: actorUserId,
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
    return { data: mapDeliverable(del) };
  }

  // --- Deliverables ---
  async listDeliverables(tenantId: string, brandId: string) {
    await this.requireBrand(tenantId, brandId);
    const rows = await getPrisma().workDeliverable.findMany({
      where: { tenantId, brandId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return { data: rows.map(mapDeliverable) };
  }

  async getDeliverable(tenantId: string, deliverableId: string) {
    const row = await getPrisma().workDeliverable.findFirst({
      where: tenantWhere(tenantId, { id: deliverableId }),
    });
    if (!row) {
      throw new DomainError('NOT_FOUND', 'Deliverable not found', 404, 'errors.not_found');
    }
    return { data: mapDeliverable(row) };
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
    const row = await getPrisma().workDeliverable.update({
      where: { id: deliverableId },
      data: {
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
    return { data: mapDeliverable(row) };
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
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
