import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  BRIEF_STATUSES,
  DomainError,
  allowedBriefActions,
  briefContentFromStrategy,
  briefContentIssues,
  briefContentSchema,
  briefEntityEnabled,
  briefSelfApprovalBlocked,
  briefSubmitReadiness,
  briefTransitionTarget,
  canBriefTransition,
  emptyBriefContent,
  newId,
  type BriefAction,
  type BriefContent,
  type BriefIssue,
  type BriefStatus,
} from '@oma/domain';
import { z } from 'zod';
import type { AuditService } from '../audit/audit.service';
import { readStrategyPlan } from '../strategy/strategy-plan.service';

type Tx = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0];

type Actor = { tenantId: string; userId: string; correlationId?: string };

const DECISION_KIND: Partial<Record<BriefAction, string>> = {
  submit: 'SUBMIT',
  approve: 'APPROVE',
  request_changes: 'REQUEST_CHANGES',
  revise: 'REVISE',
  convert: 'CONVERT',
  cancel: 'CANCEL',
};

function invalid(issues: BriefIssue[]) {
  return new DomainError(
    'VALIDATION_FAILED',
    'Brief is invalid',
    400,
    'errors.brief_invalid',
    issues,
  );
}

function notFound() {
  return new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
}

function zodIssues(error: z.ZodError): BriefIssue[] {
  return error.issues.map((i) => ({ path: i.path.join('.'), code: 'SCHEMA', message: i.message }));
}

function parseContent(raw: unknown): BriefContent {
  const parsed = briefContentSchema.safeParse(raw ?? {});
  if (!parsed.success) throw invalid(zodIssues(parsed.error));
  const issues = briefContentIssues(parsed.data);
  if (issues.length) throw invalid(issues);
  return parsed.data;
}

function readContent(json: string | null | undefined): BriefContent {
  try {
    const parsed = briefContentSchema.safeParse(JSON.parse(json || '{}'));
    return parsed.success ? parsed.data : emptyBriefContent();
  } catch {
    return emptyBriefContent();
  }
}

function requireRowVersion(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    throw invalid([{ path: 'row_version', code: 'SCHEMA', message: 'row_version is required' }]);
  }
  return raw;
}

function titleOf(raw: unknown): string {
  const parsed = z.string().trim().min(1).max(200).safeParse(raw);
  if (!parsed.success) {
    throw invalid([{ path: 'title', code: 'SCHEMA', message: 'title is required (1-200 chars)' }]);
  }
  return parsed.data;
}

function textOf(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof (raw as { value?: unknown }).value === 'string') {
    return (raw as { value: string }).value;
  }
  return '';
}

function textList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(textOf).filter((v) => v.trim());
  const one = textOf(raw);
  return one.trim() ? [one] : [];
}

@Injectable()
export class BriefService {
  constructor(private readonly audit: AuditService) {}

  private ensureEnabled() {
    if (!briefEntityEnabled()) {
      throw new DomainError('NOT_FOUND', 'Briefs are disabled', 404, 'errors.not_found', [
        { code: 'BRIEF_ENTITY_DISABLED' },
      ]);
    }
  }

  private async requireBrief(tenantId: string, brandId: string, briefId: string) {
    const brief = await getPrisma().brief.findFirst({
      where: tenantWhere(tenantId, { id: briefId, brandId }),
    });
    if (!brief) throw notFound();
    return brief;
  }

  private async currentVersion(tenantId: string, briefId: string, versionNo: number) {
    const version = await getPrisma().briefVersion.findFirst({
      where: { tenantId, briefId, versionNo },
    });
    if (!version) throw notFound();
    return version;
  }

  async list(tenantId: string, brandId: string, query: { status?: string }) {
    this.ensureEnabled();
    const status =
      query.status && (BRIEF_STATUSES as readonly string[]).includes(query.status)
        ? (query.status as BriefStatus)
        : undefined;
    const rows = await getPrisma().brief.findMany({
      where: tenantWhere(tenantId, { brandId, ...(status ? { status } : {}) }),
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: { _count: { select: { tasks: true, comments: true } } },
    });
    return {
      data: rows.map((b) => ({
        id: b.id,
        title: b.title,
        status: b.status,
        origin: b.origin,
        current_version_no: b.currentVersionNo,
        row_version: b.rowVersion,
        strategy_version_id: b.strategyVersionId,
        request_id: b.requestId,
        task_count: b._count.tasks,
        comment_count: b._count.comments,
        allowed_actions: allowedBriefActions(b.status as BriefStatus),
        updated_at: b.updatedAt.toISOString(),
      })),
    };
  }

  async get(tenantId: string, brandId: string, briefId: string) {
    this.ensureEnabled();
    const brief = await this.requireBrief(tenantId, brandId, briefId);
    const [versions, decisions, comments, tasks] = await Promise.all([
      getPrisma().briefVersion.findMany({
        where: { tenantId, briefId },
        orderBy: { versionNo: 'desc' },
      }),
      getPrisma().briefDecision.findMany({
        where: { tenantId, briefId },
        orderBy: { createdAt: 'asc' },
      }),
      getPrisma().briefComment.findMany({
        where: { tenantId, briefId },
        orderBy: { createdAt: 'asc' },
      }),
      getPrisma().workTask.findMany({
        where: { tenantId, briefId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          titleEn: true,
          titleAr: true,
          status: true,
          briefVersionId: true,
          briefDeliverableKey: true,
          dueAt: true,
        },
      }),
    ]);
    const current = versions.find((v) => v.versionNo === brief.currentVersionNo) ?? versions[0];
    const content = readContent(current?.contentJson);
    return {
      data: {
        id: brief.id,
        brand_id: brief.brandId,
        title: brief.title,
        status: brief.status,
        origin: brief.origin,
        row_version: brief.rowVersion,
        request_id: brief.requestId,
        strategy_id: brief.strategyId,
        strategy_version_id: brief.strategyVersionId,
        created_by: brief.createdBy,
        created_at: brief.createdAt.toISOString(),
        updated_at: brief.updatedAt.toISOString(),
        converted_at: brief.convertedAt?.toISOString() ?? null,
        allowed_actions: allowedBriefActions(brief.status as BriefStatus),
        readiness: briefSubmitReadiness(content),
        current_version: current
          ? {
              id: current.id,
              version_no: current.versionNo,
              author_user_id: current.authorUserId,
              submitted_at: current.submittedAt?.toISOString() ?? null,
              approved_at: current.approvedAt?.toISOString() ?? null,
              approved_by: current.approvedBy,
              content,
            }
          : null,
        versions: versions.map((v) => ({
          id: v.id,
          version_no: v.versionNo,
          author_user_id: v.authorUserId,
          approved_at: v.approvedAt?.toISOString() ?? null,
          created_at: v.createdAt.toISOString(),
        })),
        decisions: decisions.map((d) => ({
          id: d.id,
          kind: d.kind,
          from_status: d.fromStatus,
          to_status: d.toStatus,
          comment: d.comment,
          actor_user_id: d.actorUserId,
          brief_version_id: d.briefVersionId,
          self_approval: d.selfApproval,
          created_at: d.createdAt.toISOString(),
        })),
        comments: comments.map((c) => ({
          id: c.id,
          body: c.body,
          author_user_id: c.authorUserId,
          brief_version_id: c.briefVersionId,
          created_at: c.createdAt.toISOString(),
        })),
        tasks: tasks.map((t) => ({
          id: t.id,
          title_en: t.titleEn,
          title_ar: t.titleAr,
          status: t.status,
          brief_version_id: t.briefVersionId,
          deliverable_key: t.briefDeliverableKey,
          due_at: t.dueAt?.toISOString() ?? null,
        })),
      },
    };
  }

  private async createBrief(
    actor: Actor,
    brandId: string,
    input: {
      title: string;
      content: BriefContent;
      origin: 'manual' | 'strategy';
      requestId?: string | null;
      strategyId?: string | null;
      strategyVersionId?: string | null;
    },
  ) {
    const briefId = newId();
    const versionId = newId();
    await getPrisma().$transaction(async (tx) => {
      await tx.brief.create({
        data: {
          id: briefId,
          tenantId: actor.tenantId,
          brandId,
          title: input.title,
          origin: input.origin,
          requestId: input.requestId ?? null,
          strategyId: input.strategyId ?? null,
          strategyVersionId: input.strategyVersionId ?? null,
          currentVersionId: versionId,
          currentVersionNo: 1,
          createdBy: actor.userId,
        },
      });
      await tx.briefVersion.create({
        data: {
          id: versionId,
          tenantId: actor.tenantId,
          briefId,
          versionNo: 1,
          contentJson: JSON.stringify(input.content),
          authorUserId: actor.userId,
        },
      });
    });
    await this.audit.write({
      actorUserId: actor.userId,
      tenantId: actor.tenantId,
      action: 'brief.created',
      targetType: 'Brief',
      targetId: briefId,
      afterRef: input.origin,
      correlationId: actor.correlationId,
    });
    return this.get(actor.tenantId, brandId, briefId);
  }

  async create(actor: Actor, brandId: string, body: Record<string, unknown>) {
    this.ensureEnabled();
    const title = titleOf(body?.title);
    const content = parseContent(body?.content);
    let requestId: string | null = null;
    if (body?.request_id != null) {
      const request = await getPrisma().workRequest.findFirst({
        where: tenantWhere(actor.tenantId, { id: String(body.request_id), brandId }),
        select: { id: true },
      });
      if (!request) throw notFound();
      const existing = await getPrisma().brief.findFirst({
        where: { tenantId: actor.tenantId, requestId: request.id },
        select: { id: true },
      });
      if (existing) {
        throw new DomainError(
          'CONFLICT_STATE',
          'This request already has a brief',
          409,
          'errors.brief_request_taken',
          [{ code: 'REQUEST_HAS_BRIEF', brief_id: existing.id }],
        );
      }
      requestId = request.id;
    }
    return this.createBrief(actor, brandId, { title, content, origin: 'manual', requestId });
  }

  /**
   * Prefill a DRAFT brief from an APPROVED strategy version (DEC-019 §3).
   * Copies approved strategy text only; it is never approved automatically.
   */
  async createFromStrategy(actor: Actor, brandId: string, body: Record<string, unknown>) {
    this.ensureEnabled();
    const versionId = typeof body?.strategy_version_id === 'string' ? body.strategy_version_id : '';
    if (!versionId) {
      throw invalid([
        { path: 'strategy_version_id', code: 'SCHEMA', message: 'strategy_version_id is required' },
      ]);
    }
    const version = await getPrisma().strategyVersion.findFirst({
      where: tenantWhere(actor.tenantId, { id: versionId, brandId }),
      include: { strategy: { select: { name: true } }, audiences: true, organicTrack: true },
    });
    if (!version) throw notFound();
    if (version.status !== 'APPROVED') {
      throw new DomainError(
        'CONFLICT_STATE',
        'Briefs are generated only from an APPROVED strategy version',
        409,
        'errors.brief_strategy_not_approved',
        [{ code: 'STRATEGY_NOT_APPROVED', status: version.status }],
      );
    }
    const profile = version.linkedApprovedProfileVersionId
      ? await getPrisma().profileVersion.findFirst({
          where: {
            id: version.linkedApprovedProfileVersionId,
            tenantId: actor.tenantId,
            brandId,
            status: 'APPROVED',
          },
          select: { id: true },
        })
      : null;
    if (!profile) {
      throw new DomainError(
        'BRAND_PROFILE_NOT_APPROVED',
        'The strategy must be linked to an APPROVED brand profile',
        403,
        'errors.brand_profile_not_approved',
        [{ code: 'BRAND_PROFILE_NOT_APPROVED' }],
      );
    }
    const plan = await readStrategyPlan(getPrisma(), version.id);
    const pillarKey = typeof body?.pillar_key === 'string' ? body.pillar_key : null;
    const pillar = pillarKey ? plan.organic.pillars.find((p) => p.key === pillarKey) : null;
    if (pillarKey && !pillar) {
      throw invalid([
        { path: 'pillar_key', code: 'UNKNOWN_PILLAR', message: `Unknown pillar ${pillarKey}` },
      ]);
    }
    const foundation = (() => {
      try {
        return JSON.parse(version.foundationJson || '{}') as Record<string, unknown>;
      } catch {
        return {};
      }
    })();
    const cadenceChannels = (plan.organic.cadence ?? [])
      .filter((c) => c.posts_per_week > 0)
      .map((c) => c.channel);
    const organicChannels = (() => {
      if (cadenceChannels.length) return cadenceChannels;
      try {
        return z.array(z.string()).parse(JSON.parse(version.organicTrack?.channelsJson || '[]'));
      } catch {
        return [] as string[];
      }
    })();
    const content = briefContentFromStrategy({
      goals: textList(foundation.goals),
      keyMessages: textList(foundation.keyMessages),
      positioning: textOf(foundation.positioning),
      audiences: [
        ...version.audiences.map((a) => a.name),
        ...plan.paid.audiences.map((a) => a.name),
      ],
      channels: [...organicChannels, ...plan.paid.allocations.map((a) => a.platform)],
      pillar: pillar ? { key: pillar.key, name_en: pillar.name_en, name_ar: pillar.name_ar } : null,
    });
    const title =
      body?.title != null
        ? titleOf(body.title)
        : `${version.strategy.name}${pillar ? ` — ${pillar.name_en}` : ''}`.slice(0, 200);
    return this.createBrief(actor, brandId, {
      title,
      content,
      origin: 'strategy',
      strategyId: version.strategyId,
      strategyVersionId: version.id,
    });
  }

  /** Bump rowVersion atomically; throws CONFLICT_VERSION when stale or state moved. */
  private async bump(
    tx: Tx,
    brief: { id: string; tenantId: string; status: string },
    rowVersion: number,
    data: Record<string, unknown> = {},
  ) {
    const res = await tx.brief.updateMany({
      where: {
        id: brief.id,
        tenantId: brief.tenantId,
        rowVersion,
        status: brief.status as BriefStatus,
      },
      data: { ...data, rowVersion: { increment: 1 } },
    });
    if (res.count !== 1) {
      throw new DomainError('CONFLICT_VERSION', 'Stale brief', 409, 'errors.conflict_version');
    }
  }

  private assertTransition(status: BriefStatus, action: BriefAction) {
    if (!canBriefTransition(status, action)) {
      throw new DomainError(
        'CONFLICT_STATE',
        `Cannot ${action} a ${status} brief`,
        409,
        'errors.brief_invalid_transition',
        [{ code: 'INVALID_TRANSITION', status, action }],
      );
    }
  }

  async update(actor: Actor, brandId: string, briefId: string, body: Record<string, unknown>) {
    this.ensureEnabled();
    const rowVersion = requireRowVersion(body?.row_version);
    const brief = await this.requireBrief(actor.tenantId, brandId, briefId);
    this.assertTransition(brief.status as BriefStatus, 'edit');
    const title = body?.title != null ? titleOf(body.title) : undefined;
    const content = body?.content !== undefined ? parseContent(body.content) : undefined;
    const version = await this.currentVersion(actor.tenantId, brief.id, brief.currentVersionNo);
    await getPrisma().$transaction(async (tx) => {
      await this.bump(tx, brief, rowVersion, title ? { title } : {});
      if (content) {
        await tx.briefVersion.update({
          where: { id: version.id },
          data: { contentJson: JSON.stringify(content) },
        });
      }
    });
    await this.audit.write({
      actorUserId: actor.userId,
      tenantId: actor.tenantId,
      action: 'brief.updated',
      targetType: 'Brief',
      targetId: brief.id,
      correlationId: actor.correlationId,
    });
    return this.get(actor.tenantId, brandId, brief.id);
  }

  private async otherApproverCount(tenantId: string, brandId: string, userId: string) {
    const grants = await getPrisma().capabilityGrant.findMany({
      where: {
        tenantId,
        capabilityCode: 'brief.approve',
        revokedAt: null,
        membership: { status: 'ACTIVE', userId: { not: userId } },
      },
      select: { membership: { select: { userId: true } } },
    });
    const candidates = [
      ...new Set(grants.map((g) => g.membership.userId).filter((id): id is string => Boolean(id))),
    ];
    if (candidates.length === 0) return 0;
    const [admins, members] = await Promise.all([
      getPrisma().capabilityGrant.findMany({
        where: {
          tenantId,
          capabilityCode: 'tenant.manage',
          revokedAt: null,
          membership: { status: 'ACTIVE', userId: { in: candidates } },
        },
        select: { membership: { select: { userId: true } } },
      }),
      getPrisma().brandMember.findMany({
        where: { tenantId, brandId, userId: { in: candidates } },
        select: { userId: true },
      }),
    ]);
    return new Set([...admins.map((a) => a.membership.userId), ...members.map((m) => m.userId)])
      .size;
  }

  private async decide(
    actor: Actor,
    brandId: string,
    briefId: string,
    action: Exclude<BriefAction, 'edit' | 'convert'>,
    body: Record<string, unknown>,
  ) {
    this.ensureEnabled();
    const rowVersion = requireRowVersion(body?.row_version);
    const brief = await this.requireBrief(actor.tenantId, brandId, briefId);
    const from = brief.status as BriefStatus;
    this.assertTransition(from, action);
    const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 2000) : '';
    const version = await this.currentVersion(actor.tenantId, brief.id, brief.currentVersionNo);
    let selfApproval = false;

    if (action === 'submit') {
      const readiness = briefSubmitReadiness(readContent(version.contentJson));
      if (!readiness.ready) {
        throw new DomainError(
          'VALIDATION_FAILED',
          'Brief is not ready for review',
          400,
          'errors.brief_not_ready',
          readiness.missing.map((field) => ({ path: field, code: 'REQUIRED', message: field })),
        );
      }
    }
    if (action === 'request_changes' && !comment) {
      throw invalid([
        { path: 'comment', code: 'REQUIRED', message: 'Explain what needs to change' },
      ]);
    }
    if (action === 'approve') {
      selfApproval = version.authorUserId === actor.userId;
      if (selfApproval) {
        const others = await this.otherApproverCount(actor.tenantId, brandId, actor.userId);
        if (
          briefSelfApprovalBlocked({
            approverUserId: actor.userId,
            authorUserId: version.authorUserId,
            otherApproverCount: others,
          })
        ) {
          throw new DomainError(
            'PERMISSION_DENIED',
            'Another approver must approve a brief you wrote',
            403,
            'errors.brief_self_approval',
            [{ code: 'BRIEF_SELF_APPROVAL', other_approvers: others }],
          );
        }
      }
    }

    const to = briefTransitionTarget(from, action);
    const now = new Date();
    let targetVersionId = version.id;
    await getPrisma().$transaction(async (tx) => {
      if (action === 'revise') {
        targetVersionId = newId();
        const nextNo = brief.currentVersionNo + 1;
        await tx.briefVersion.create({
          data: {
            id: targetVersionId,
            tenantId: actor.tenantId,
            briefId: brief.id,
            versionNo: nextNo,
            contentJson: version.contentJson,
            authorUserId: actor.userId,
          },
        });
        await this.bump(tx, brief, rowVersion, {
          status: to,
          currentVersionNo: nextNo,
          currentVersionId: targetVersionId,
          convertedAt: null,
        });
      } else {
        await this.bump(tx, brief, rowVersion, {
          status: to,
          ...(action === 'cancel' ? { cancelledAt: now } : {}),
        });
        if (action === 'submit') {
          await tx.briefVersion.update({ where: { id: version.id }, data: { submittedAt: now } });
        }
        if (action === 'approve') {
          await tx.briefVersion.update({
            where: { id: version.id },
            data: { approvedAt: now, approvedBy: actor.userId },
          });
        }
      }
      await tx.briefDecision.create({
        data: {
          id: newId(),
          tenantId: actor.tenantId,
          briefId: brief.id,
          briefVersionId: targetVersionId,
          kind: DECISION_KIND[action] as never,
          fromStatus: from,
          toStatus: to,
          comment: comment || null,
          actorUserId: actor.userId,
          selfApproval,
        },
      });
    });
    await this.audit.write({
      actorUserId: actor.userId,
      tenantId: actor.tenantId,
      action: `brief.${action}`,
      targetType: 'Brief',
      targetId: brief.id,
      beforeRef: from,
      afterRef: selfApproval ? `${to}:self_approval` : to,
      correlationId: actor.correlationId,
    });
    return this.get(actor.tenantId, brandId, brief.id);
  }

  submit(actor: Actor, brandId: string, briefId: string, body: Record<string, unknown>) {
    return this.decide(actor, brandId, briefId, 'submit', body);
  }
  approve(actor: Actor, brandId: string, briefId: string, body: Record<string, unknown>) {
    return this.decide(actor, brandId, briefId, 'approve', body);
  }
  requestChanges(actor: Actor, brandId: string, briefId: string, body: Record<string, unknown>) {
    return this.decide(actor, brandId, briefId, 'request_changes', body);
  }
  revise(actor: Actor, brandId: string, briefId: string, body: Record<string, unknown>) {
    return this.decide(actor, brandId, briefId, 'revise', body);
  }
  cancel(actor: Actor, brandId: string, briefId: string, body: Record<string, unknown>) {
    return this.decide(actor, brandId, briefId, 'cancel', body);
  }

  /**
   * Convert the APPROVED version into WorkTasks, one per deliverable. Idempotent:
   * repeating the call (or racing it) never duplicates tasks thanks to the
   * (briefVersionId, briefDeliverableKey) unique key.
   */
  async convert(actor: Actor, brandId: string, briefId: string, body: Record<string, unknown>) {
    this.ensureEnabled();
    const brief = await this.requireBrief(actor.tenantId, brandId, briefId);
    const version = await this.currentVersion(actor.tenantId, brief.id, brief.currentVersionNo);
    if (brief.status === 'CONVERTED') {
      const existing = await this.get(actor.tenantId, brandId, brief.id);
      return { data: { ...existing.data, replayed: true, created_task_count: 0 } };
    }
    const rowVersion = requireRowVersion(body?.row_version);
    this.assertTransition(brief.status as BriefStatus, 'convert');
    if (!version.approvedAt) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Only an approved brief version converts to tasks',
        409,
        'errors.brief_invalid_transition',
        [{ code: 'VERSION_NOT_APPROVED' }],
      );
    }
    const content = readContent(version.contentJson);
    let created = 0;
    await getPrisma().$transaction(async (tx) => {
      await this.bump(tx, brief, rowVersion, { status: 'CONVERTED', convertedAt: new Date() });
      const existing = await tx.workTask.findMany({
        where: { tenantId: actor.tenantId, briefVersionId: version.id },
        select: { briefDeliverableKey: true },
      });
      const done = new Set(existing.map((t) => t.briefDeliverableKey));
      for (const d of content.deliverables) {
        if (done.has(d.key)) continue;
        await tx.workTask.create({
          data: {
            id: newId(),
            tenantId: actor.tenantId,
            brandId,
            requestId: brief.requestId,
            titleEn: d.title_en,
            titleAr: d.title_ar,
            descriptionEn: d.notes,
            descriptionAr: d.notes,
            department: d.department,
            dueAt: d.due_at ? new Date(d.due_at) : content.due_at ? new Date(content.due_at) : null,
            createdBy: actor.userId,
            briefId: brief.id,
            briefVersionId: version.id,
            briefDeliverableKey: d.key,
          },
        });
        created += 1;
      }
      await tx.briefDecision.create({
        data: {
          id: newId(),
          tenantId: actor.tenantId,
          briefId: brief.id,
          briefVersionId: version.id,
          kind: 'CONVERT',
          fromStatus: brief.status as BriefStatus,
          toStatus: 'CONVERTED',
          actorUserId: actor.userId,
        },
      });
    });
    await this.audit.write({
      actorUserId: actor.userId,
      tenantId: actor.tenantId,
      action: 'brief.convert',
      targetType: 'Brief',
      targetId: brief.id,
      afterRef: `tasks:${created}`,
      correlationId: actor.correlationId,
    });
    const detail = await this.get(actor.tenantId, brandId, brief.id);
    return { data: { ...detail.data, replayed: false, created_task_count: created } };
  }

  async comment(actor: Actor, brandId: string, briefId: string, body: Record<string, unknown>) {
    this.ensureEnabled();
    const parsed = z.string().trim().min(1).max(4000).safeParse(body?.body);
    if (!parsed.success) {
      throw invalid([{ path: 'body', code: 'SCHEMA', message: 'Comment text is required' }]);
    }
    const brief = await this.requireBrief(actor.tenantId, brandId, briefId);
    const version = await this.currentVersion(actor.tenantId, brief.id, brief.currentVersionNo);
    const row = await getPrisma().briefComment.create({
      data: {
        id: newId(),
        tenantId: actor.tenantId,
        briefId: brief.id,
        briefVersionId: version.id,
        authorUserId: actor.userId,
        body: parsed.data,
      },
    });
    await this.audit.write({
      actorUserId: actor.userId,
      tenantId: actor.tenantId,
      action: 'brief.comment',
      targetType: 'Brief',
      targetId: brief.id,
      correlationId: actor.correlationId,
    });
    return {
      data: {
        id: row.id,
        body: row.body,
        author_user_id: row.authorUserId,
        brief_version_id: row.briefVersionId,
        created_at: row.createdAt.toISOString(),
      },
    };
  }
}
