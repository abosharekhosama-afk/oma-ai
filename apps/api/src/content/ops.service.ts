import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  briefFieldsFromDescription,
  briefReadiness,
  hasCapability,
  newId,
  reviewStatusAfterVersionCreate,
  reviewStep,
  versionCreateAllowed,
} from '@oma/domain';
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
      briefObjectiveEn?: string;
      briefObjectiveAr?: string;
      briefAudienceEn?: string;
      briefAudienceAr?: string;
      briefKeyMessageEn?: string;
      briefKeyMessageAr?: string;
      briefReadyAt?: Date | null;
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
    const campaignMap = new Map(campaigns.map((c) => [c.id, c.nameEn || c.nameAr || 'Campaign']));
    return rows.map((row) => {
      const base = mapRequest(row);
      return {
        ...base,
        requester_name: userMap.get(row.requesterUserId) || 'Team member',
        assignee_name: row.assigneeUserId ? userMap.get(row.assigneeUserId) || 'Team member' : null,
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
    // Latest deliverable handed off from each task (for readable task → deliverable links).
    const deliverables = await getPrisma().workDeliverable.findMany({
      where: {
        tenantId: { in: [...new Set(rows.map((r) => r.tenantId))] },
        taskId: { in: rows.map((r) => r.id) },
      },
      select: { id: true, taskId: true },
      orderBy: { createdAt: 'desc' },
    });
    const deliverableByTask = new Map<string, string>();
    for (const d of deliverables) {
      if (d.taskId && !deliverableByTask.has(d.taskId)) deliverableByTask.set(d.taskId, d.id);
    }
    return rows.map((row) => ({
      ...mapTask(row),
      assignee_name: row.assigneeUserId ? userMap.get(row.assigneeUserId) || 'Team member' : null,
      created_by_name: userMap.get(row.createdBy) || 'Team member',
      deliverable_id: deliverableByTask.get(row.id) ?? null,
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
      currentVersionId?: string | null;
      approvedVersionId?: string | null;
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
    const campaignMap = new Map(campaigns.map((c) => [c.id, c.nameEn || c.nameAr || 'Campaign']));
    const requestMap = new Map(requests.map((r) => [r.id, r.titleEn || r.titleAr || 'Request']));
    const taskMap = new Map(tasks.map((t) => [t.id, t.titleEn || t.titleAr || 'Task']));
    const versionIds = rows
      .map((r) => r.currentVersionId)
      .filter((id): id is string => Boolean(id));
    const versions = versionIds.length
      ? await prisma.workDeliverableVersion.findMany({
          where: { id: { in: versionIds } },
          select: { id: true, assetUrl: true, label: true },
        })
      : [];
    const versionAssetMap = new Map(versions.map((v) => [v.id, v.assetUrl]));
    return rows.map((row) => {
      const versionAsset = row.currentVersionId
        ? (versionAssetMap.get(row.currentVersionId) ?? null)
        : null;
      const assetUrl = row.assetUrl || versionAsset || null;
      return {
        ...mapDeliverable({ ...row, assetUrl }),
        created_by_name: userMap.get(row.createdBy) || 'Team member',
        brand_name: brandMap.get(row.brandId) || 'Brand',
        campaign_name: row.campaignId ? campaignMap.get(row.campaignId) || null : null,
        request_title: row.requestId ? requestMap.get(row.requestId) || null : null,
        task_title: row.taskId ? taskMap.get(row.taskId) || null : null,
      };
    });
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
      brief?: {
        objective?: LocaleInput;
        audience?: LocaleInput;
        keyMessage?: LocaleInput;
      };
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
        ...briefColumnsFromInput(input),
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
        ...(patch.campaignId !== undefined
          ? { campaignId: patch.campaignId as string | null }
          : {}),
        ...(patch.channels !== undefined ? { channels: patch.channels as string[] } : {}),
        ...(patch.formats !== undefined ? { formats: patch.formats as string[] } : {}),
        ...(patch.type !== undefined ? { type: patch.type as never } : {}),
        ...nextBriefColumns(current, patch, desc),
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
    const readiness = await this.ensureBriefReady(req);
    if (!readiness.ready) {
      throw new DomainError(
        'CONFLICT_STATE',
        `Brief is not ready (BRIEF_NOT_READY). Missing: ${readiness.missing.join(', ')}`,
        409,
        'errors.brief_not_ready',
        readiness.missing.map((field) => ({ field })),
      );
    }
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
      include: {
        checklistItems: { select: { done: true } },
        _count: { select: { comments: true } },
      },
    });
    // Board cards need assignee name + lightweight comment/checklist counts.
    const enriched = await this.enrichTasks(rows);
    return {
      data: enriched.map((task, i) => {
        const row = rows[i]!;
        return {
          ...task,
          comment_count: row._count.comments,
          checklist_total: row.checklistItems.length,
          checklist_done: row.checklistItems.filter((c) => c.done).length,
        };
      }),
    };
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
      priority?: string;
      department?: string;
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
    const prisma = getPrisma();
    const where = tenantWhere(tenantId, { id: deliverableId });
    const row = await prisma.workDeliverable
      .findFirst({
        where,
        include: {
          versions: { orderBy: { versionNumber: 'asc' as const } },
          annotations: { orderBy: { createdAt: 'asc' as const } },
          comments: { orderBy: { createdAt: 'asc' as const } },
        },
      })
      .catch(async () => {
        // Relation client missing — return the base row with empty child lists.
        const base = await prisma.workDeliverable.findFirst({ where });
        if (!base) return null;
        return {
          ...base,
          versions: [] as Awaited<ReturnType<typeof prisma.workDeliverableVersion.findMany>>,
          annotations: [] as Awaited<ReturnType<typeof prisma.workDeliverableAnnotation.findMany>>,
          comments: [] as Awaited<ReturnType<typeof prisma.workDeliverableComment.findMany>>,
        };
      });
    if (!row) {
      throw new DomainError('NOT_FOUND', 'Deliverable not found', 404, 'errors.not_found');
    }
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
      versions: (
        row.versions as Array<{
          id: string;
          label: string;
          versionNumber: number;
          assetUrl: string | null;
          notesEn: string;
          notesAr: string;
          status: string;
          createdBy: string;
          createdAt: Date;
        }>
      ).map((v) => ({
        id: v.id,
        label: v.label,
        version_number: v.versionNumber,
        asset_url: v.assetUrl,
        notes: { en: v.notesEn, ar: v.notesAr },
        status: v.status,
        immutable: v.status === 'APPROVED',
        created_by: v.createdBy,
        created_by_name: userMap.get(v.createdBy) || 'Team member',
        created_at: v.createdAt.toISOString(),
      })),
      annotations: (
        row.annotations as Array<{
          id: string;
          versionId: string | null;
          authorUserId: string;
          bodyEn: string;
          bodyAr: string;
          x: number;
          y: number;
          resolved: boolean;
          createdAt: Date;
        }>
      ).map((a) => ({
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
      comments: (
        row.comments as Array<{
          id: string;
          versionId: string | null;
          authorUserId: string;
          bodyEn: string;
          bodyAr: string;
          resolved: boolean;
          createdAt: Date;
        }>
      ).map((c) => ({
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
    if (
      patch.reviewStatus !== undefined ||
      patch.status !== undefined ||
      patch.approvedVersionId !== undefined ||
      patch.approved_version_id !== undefined ||
      patch.currentVersionId !== undefined
    ) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Review status and approval identity change only through the review action',
        409,
        'errors.invalid_transition',
      );
    }
    if (
      patch.assetUrl !== undefined &&
      (current.reviewStatus === 'APPROVED' || current.reviewStatus === 'REJECTED')
    ) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Approved deliverable assets are immutable',
        409,
        'errors.invalid_transition',
      );
    }
    const title = patch.title != null ? localePair(patch.title as LocaleInput) : null;
    const row = await getPrisma().workDeliverable.update({
      where: { id: deliverableId },
      data: {
        ...(title ? { titleEn: title.en, titleAr: title.ar } : {}),
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
    capabilities: readonly string[] = [],
  ) {
    const current = await getPrisma().workDeliverable.findFirst({
      where: tenantWhere(tenantId, { id: deliverableId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Deliverable not found', 404, 'errors.not_found');
    }
    const normalized = action.toLowerCase().replace(/-/g, '_');
    this.assertReviewCapability(capabilities, normalized);
    const from = (current.reviewStatus || 'NOT_STARTED').toUpperCase();
    const step = reviewStep(from, normalized);
    if (step === 'UNKNOWN_ACTION') {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Unknown review action',
        400,
        'errors.invalid_input',
      );
    }
    if (step === 'ILLEGAL') {
      throw new DomainError(
        'CONFLICT_STATE',
        `Cannot ${normalized} from ${from}`,
        409,
        'errors.invalid_transition',
      );
    }
    const prisma = getPrisma();
    const pinned = await prisma.$transaction(async (tx) => {
      let approvedVersionId: string | null = null;
      if (normalized === 'approve') {
        approvedVersionId = await this.pinApprovedVersion(
          tx as ReturnType<typeof getPrisma>,
          current,
          actorUserId,
        );
      }
      const row = await tx.workDeliverable.update({
        where: { id: deliverableId },
        data: {
          reviewStatus: step.next as never,
          status: step.status as never,
          ...(approvedVersionId ? { approvedVersionId, currentVersionId: approvedVersionId } : {}),
        },
      });
      // Propagate the review outcome to the originating task (same transaction).
      const taskStatus = REVIEW_ACTION_TASK_STATUS[normalized];
      if (current.taskId && taskStatus) {
        await tx.workTask.updateMany({
          where: { id: current.taskId, tenantId },
          data: { status: taskStatus as never },
        });
      }
      return { row, approvedVersionId };
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: `deliverable.review.${normalized}`,
      targetType: 'WorkDeliverable',
      targetId: deliverableId,
      beforeRef: from,
      afterRef: pinned.approvedVersionId ?? step.next,
      correlationId,
    });
    const [data] = await this.enrichDeliverables([pinned.row]);
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
    // Simpler default: APPROVED/REJECTED/in-review cannot gain a version.
    // CHANGES_REQUESTED keeps that review status until submit and never clears approvedVersionId.
    if (!versionCreateAllowed(del.reviewStatus)) {
      throw new DomainError(
        'CONFLICT_STATE',
        `Cannot add a version while review status is ${del.reviewStatus}`,
        409,
        'errors.invalid_transition',
      );
    }
    const notes = localePair(input.notes);
    const keptReviewStatus = reviewStatusAfterVersionCreate(del.reviewStatus);
    const ver = await getPrisma().$transaction(async (tx) => {
      const last = await tx.workDeliverableVersion.findFirst({
        where: { deliverableId, tenantId },
        orderBy: { versionNumber: 'desc' },
      });
      const n = (last?.versionNumber ?? 0) + 1;
      const created = await tx.workDeliverableVersion.create({
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
      await tx.workDeliverableVersion.updateMany({
        where: {
          deliverableId,
          tenantId,
          id: { not: created.id },
          status: { notIn: ['APPROVED', 'SUPERSEDED'] },
        },
        data: { status: 'SUPERSEDED' },
      });
      await tx.workDeliverable.update({
        where: { id: deliverableId },
        data: {
          currentVersionId: created.id,
          assetUrl: created.assetUrl,
          reviewStatus: keptReviewStatus as never,
        },
      });
      return created;
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'deliverable.version.added',
      targetType: 'WorkDeliverableVersion',
      targetId: ver.id,
      beforeRef: deliverableId,
      afterRef: ver.id,
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
    const del = await this.requireDeliverable(tenantId, deliverableId);
    if (del.reviewStatus === 'APPROVED') {
      throw new DomainError(
        'CONFLICT_STATE',
        'Cannot annotate an approved deliverable',
        409,
        'errors.invalid_transition',
      );
    }
    if (input.versionId) {
      const version = await getPrisma().workDeliverableVersion.findFirst({
        where: { id: input.versionId, deliverableId, tenantId },
      });
      if (version?.status === 'APPROVED') {
        throw new DomainError(
          'CONFLICT_STATE',
          'Cannot annotate an approved version',
          409,
          'errors.invalid_transition',
        );
      }
    }
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
    if (!current)
      throw new DomainError('NOT_FOUND', 'Annotation not found', 404, 'errors.not_found');
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
    const task = await getPrisma().workTask.findFirst({
      where: tenantWhere(tenantId, { id: taskId }),
    });
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
    return {
      data: {
        id: row.id,
        title: { en: row.titleEn, ar: row.titleAr },
        done: row.done,
        sort_order: row.sortOrder,
      },
    };
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
    if (!current)
      throw new DomainError('NOT_FOUND', 'Checklist item not found', 404, 'errors.not_found');
    const title = patch.title != null ? localePair(patch.title) : null;
    const row = await getPrisma().workTaskChecklistItem.update({
      where: { id: itemId },
      data: {
        ...(patch.done !== undefined ? { done: patch.done } : {}),
        ...(title ? { titleEn: title.en, titleAr: title.ar } : {}),
      },
    });
    return {
      data: {
        id: row.id,
        title: { en: row.titleEn, ar: row.titleAr },
        done: row.done,
        sort_order: row.sortOrder,
      },
    };
  }

  async addTaskComment(
    tenantId: string,
    actorUserId: string,
    taskId: string,
    input: { body: LocaleInput },
  ) {
    const task = await getPrisma().workTask.findFirst({
      where: tenantWhere(tenantId, { id: taskId }),
    });
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

  private assertReviewCapability(capabilities: readonly string[], action: string) {
    if (action === 'submit') {
      if (
        !hasCapability(
          capabilities,
          ['deliverable.write', 'deliverable.update', 'deliverable.version.create'],
          'any',
        )
      ) {
        throw new DomainError(
          'PERMISSION_DENIED',
          'Missing capability',
          403,
          'errors.permission_denied',
        );
      }
      return;
    }
    if (action === 'approve' || action === 'request_changes' || action === 'reject') {
      if (
        !hasCapability(capabilities, ['deliverable.review.decide', 'deliverable.review'], 'any')
      ) {
        throw new DomainError(
          'PERMISSION_DENIED',
          'Missing capability deliverable.review.decide',
          403,
          'errors.permission_denied',
        );
      }
    }
  }

  /**
   * Pin approval to a concrete version. Fail when there is no version and no asset.
   * Other non-approved versions become SUPERSEDED.
   */
  private async pinApprovedVersion(
    tx: ReturnType<typeof getPrisma>,
    current: {
      id: string;
      tenantId: string;
      assetUrl: string | null;
      currentVersionId: string | null;
    },
    actorUserId: string,
  ) {
    let versionId = current.currentVersionId;
    if (versionId) {
      const exists = await tx.workDeliverableVersion.findFirst({
        where: { id: versionId, deliverableId: current.id, tenantId: current.tenantId },
      });
      if (!exists) versionId = null;
    }
    if (!versionId) {
      const latest = await tx.workDeliverableVersion.findFirst({
        where: { deliverableId: current.id, tenantId: current.tenantId },
        orderBy: { versionNumber: 'desc' },
      });
      versionId = latest?.id ?? null;
    }
    if (!versionId) {
      if (!current.assetUrl) {
        throw new DomainError(
          'VALIDATION_FAILED',
          'Cannot approve a deliverable with no version or asset',
          400,
          'errors.validation',
        );
      }
      versionId = newId();
      await tx.workDeliverableVersion.create({
        data: {
          id: versionId,
          tenantId: current.tenantId,
          deliverableId: current.id,
          label: 'v1',
          versionNumber: 1,
          assetUrl: current.assetUrl,
          status: 'APPROVED',
          createdBy: actorUserId,
          updatedAt: new Date(),
        },
      });
    } else {
      await tx.workDeliverableVersion.update({
        where: { id: versionId },
        data: { status: 'APPROVED' },
      });
    }
    await tx.workDeliverableVersion.updateMany({
      where: {
        deliverableId: current.id,
        tenantId: current.tenantId,
        id: { not: versionId },
        status: { not: 'APPROVED' },
      },
      data: { status: 'SUPERSEDED' },
    });
    return versionId;
  }

  private async ensureBriefReady(req: {
    id: string;
    descriptionEn: string;
    briefObjectiveEn: string;
    briefAudienceEn: string;
    briefKeyMessageEn: string;
    briefObjectiveAr: string;
    briefAudienceAr: string;
    briefKeyMessageAr: string;
    briefReadyAt: Date | null;
  }) {
    let fields = {
      objective: req.briefObjectiveEn,
      audience: req.briefAudienceEn,
      keyMessage: req.briefKeyMessageEn,
    };
    let gate = briefReadiness(fields);
    if (!gate.ready) {
      const fromMarker = briefFieldsFromDescription(req.descriptionEn);
      if (fromMarker && briefReadiness(fromMarker).ready) {
        fields = {
          objective: fromMarker.objective ?? '',
          audience: fromMarker.audience ?? '',
          keyMessage: fromMarker.keyMessage ?? '',
        };
        gate = briefReadiness(fields);
        await getPrisma().workRequest.update({
          where: { id: req.id },
          data: {
            briefObjectiveEn: fields.objective,
            briefObjectiveAr: req.briefObjectiveAr || fields.objective,
            briefAudienceEn: fields.audience,
            briefAudienceAr: req.briefAudienceAr || fields.audience,
            briefKeyMessageEn: fields.keyMessage,
            briefKeyMessageAr: req.briefKeyMessageAr || fields.keyMessage,
            briefReadyAt: req.briefReadyAt ?? new Date(),
          },
        });
      }
    }
    return gate;
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
  briefObjectiveEn?: string;
  briefObjectiveAr?: string;
  briefAudienceEn?: string;
  briefAudienceAr?: string;
  briefKeyMessageEn?: string;
  briefKeyMessageAr?: string;
  briefReadyAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const brief = briefPayload(row);
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
    brief,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/** Task status implied by a deliverable review action. `reject` leaves the task unchanged. */
const REVIEW_ACTION_TASK_STATUS: Record<string, string> = {
  submit: 'IN_REVIEW',
  request_changes: 'IN_PROGRESS',
  approve: 'DONE',
};

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

function localeFromUnknown(value: unknown): { en: string; ar: string } | null {
  if (typeof value === 'string') return localePair(value);
  if (value && typeof value === 'object') return localePair(value as LocaleInput);
  return null;
}

function briefColumnsFromInput(input: {
  description?: LocaleInput;
  brief?: { objective?: LocaleInput; audience?: LocaleInput; keyMessage?: LocaleInput };
}) {
  const explicit = {
    objective: input.brief?.objective ? localePair(input.brief.objective) : null,
    audience: input.brief?.audience ? localePair(input.brief.audience) : null,
    keyMessage: input.brief?.keyMessage ? localePair(input.brief.keyMessage) : null,
  };
  const marker = briefFieldsFromDescription(
    input.description ? localePair(input.description).en : '',
  );
  const objective = explicit.objective?.en || marker?.objective || '';
  const audience = explicit.audience?.en || marker?.audience || '';
  const keyMessage = explicit.keyMessage?.en || marker?.keyMessage || '';
  const ready = briefReadiness({ objective, audience, keyMessage }).ready;
  if (!objective && !audience && !keyMessage) return {};
  return {
    briefObjectiveEn: objective,
    briefObjectiveAr: explicit.objective?.ar || objective,
    briefAudienceEn: audience,
    briefAudienceAr: explicit.audience?.ar || audience,
    briefKeyMessageEn: keyMessage,
    briefKeyMessageAr: explicit.keyMessage?.ar || keyMessage,
    briefReadyAt: ready ? new Date() : null,
  };
}

function nextBriefColumns(
  current: {
    briefObjectiveEn: string;
    briefObjectiveAr: string;
    briefAudienceEn: string;
    briefAudienceAr: string;
    briefKeyMessageEn: string;
    briefKeyMessageAr: string;
    briefReadyAt: Date | null;
    descriptionEn: string;
  },
  patch: Record<string, unknown>,
  desc: { en: string; ar: string } | null,
) {
  const brief = patch.brief;
  const hasBrief = Boolean(brief && typeof brief === 'object');
  const explicit = hasBrief
    ? {
        objective: localeFromUnknown((brief as { objective?: unknown }).objective),
        audience: localeFromUnknown((brief as { audience?: unknown }).audience),
        keyMessage: localeFromUnknown(
          (brief as { keyMessage?: unknown }).keyMessage ??
            (brief as { key_message?: unknown }).key_message,
        ),
      }
    : { objective: null, audience: null, keyMessage: null };
  const descriptionEn = desc?.en ?? current.descriptionEn;
  const marker = !hasBrief ? briefFieldsFromDescription(descriptionEn) : null;
  if (!hasBrief && !marker) return {};
  const objective = explicit.objective?.en ?? marker?.objective ?? current.briefObjectiveEn;
  const audience = explicit.audience?.en ?? marker?.audience ?? current.briefAudienceEn;
  const keyMessage = explicit.keyMessage?.en ?? marker?.keyMessage ?? current.briefKeyMessageEn;
  const ready = briefReadiness({ objective, audience, keyMessage }).ready;
  return {
    briefObjectiveEn: objective,
    briefObjectiveAr: explicit.objective?.ar || current.briefObjectiveAr || objective,
    briefAudienceEn: audience,
    briefAudienceAr: explicit.audience?.ar || current.briefAudienceAr || audience,
    briefKeyMessageEn: keyMessage,
    briefKeyMessageAr: explicit.keyMessage?.ar || current.briefKeyMessageAr || keyMessage,
    briefReadyAt: ready ? (current.briefReadyAt ?? new Date()) : null,
  };
}

function briefPayload(row: {
  briefObjectiveEn?: string;
  briefObjectiveAr?: string;
  briefAudienceEn?: string;
  briefAudienceAr?: string;
  briefKeyMessageEn?: string;
  briefKeyMessageAr?: string;
  briefReadyAt?: Date | null;
}) {
  const objective = row.briefObjectiveEn ?? '';
  const audience = row.briefAudienceEn ?? '';
  const keyMessage = row.briefKeyMessageEn ?? '';
  const gate = briefReadiness({ objective, audience, keyMessage });
  return {
    objective: { en: objective, ar: row.briefObjectiveAr || objective },
    audience: { en: audience, ar: row.briefAudienceAr || audience },
    key_message: { en: keyMessage, ar: row.briefKeyMessageAr || keyMessage },
    ready: gate.ready,
    ready_at: row.briefReadyAt ? row.briefReadyAt.toISOString() : null,
    missing: gate.missing,
  };
}
