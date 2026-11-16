import { getPrisma, Prisma } from '@oma/db';
import {
  DomainError,
  newId,
  type ApprovalLevelPlan,
  type ResolvedApprovalSettings,
} from '@oma/domain';
import type { AuditService } from '../audit/audit.service';

/** Stored levels for a scope (brandId null = workspace default plan), in order. */
export async function listApprovalLevels(
  tenantId: string,
  brandId: string | null,
): Promise<ApprovalLevelPlan[]> {
  const rows = await getPrisma().approvalLevel.findMany({
    where: { tenantId, brandId },
    orderBy: { position: 'asc' },
  });
  return rows.map((r, i) => ({
    position: i + 1,
    nameEn: r.nameEn,
    nameAr: r.nameAr,
    minApprovals: r.minApprovals,
    approverUserIds: r.approverUserIds,
  }));
}

/** Replace a scope's level plan (empty list clears it). Approvers must be active members. */
export async function replaceApprovalLevels(opts: {
  tenantId: string;
  brandId: string | null;
  plan: ApprovalLevelPlan[];
  actorUserId: string;
  audit: AuditService;
  correlationId?: string;
}): Promise<ApprovalLevelPlan[]> {
  const { tenantId, brandId, plan } = opts;
  const ids = [...new Set(plan.flatMap((l) => l.approverUserIds))];
  if (ids.length) {
    const members = await getPrisma().membership.findMany({
      where: { tenantId, userId: { in: ids }, status: 'ACTIVE' },
      select: { userId: true },
    });
    const ok = new Set(members.map((m) => m.userId));
    const missing = ids.filter((id) => !ok.has(id));
    if (missing.length) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Every approver must be an active workspace member',
        400,
        'error.approval_levels_invalid',
        [{ unknown_approvers: missing }],
      );
    }
  }
  await getPrisma().$transaction(async (tx) => {
    await tx.approvalLevel.deleteMany({ where: { tenantId, brandId } });
    for (const l of plan) {
      await tx.approvalLevel.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          position: l.position,
          nameEn: l.nameEn,
          nameAr: l.nameAr,
          minApprovals: l.minApprovals,
          approverUserIds: l.approverUserIds,
        },
      });
    }
  });
  await opts.audit.write({
    actorUserId: opts.actorUserId,
    tenantId,
    action: 'approval_levels.updated',
    targetType: brandId ? 'BrandWorkspace' : 'Tenant',
    targetId: brandId ?? tenantId,
    afterRef: `levels:${plan.length}`,
    correlationId: opts.correlationId,
  });
  return listApprovalLevels(tenantId, brandId);
}

/**
 * The plan a new approval round should use (DEC-026). Only under mode
 * `multi_level`. Brand levels apply when the brand has its own approval override
 * and has levels; otherwise the workspace levels. No levels = counter fallback.
 */
export async function resolveLevelPlan(
  tenantId: string,
  brandId: string,
  cfg: Pick<ResolvedApprovalSettings, 'mode' | 'source'>,
): Promise<{ plan: ApprovalLevelPlan[]; source: 'brand' | 'workspace' } | null> {
  if (cfg.mode !== 'multi_level') return null;
  if (cfg.source === 'brand') {
    const brand = await listApprovalLevels(tenantId, brandId);
    if (brand.length) return { plan: brand, source: 'brand' };
  }
  const ws = await listApprovalLevels(tenantId, null);
  return ws.length ? { plan: ws, source: 'workspace' } : null;
}

export function planJson(plan: ApprovalLevelPlan[] | null) {
  return plan ? (plan as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
}

/** API view of a level plan, with approver names for the settings UI. */
export async function levelsView(tenantId: string, plan: ApprovalLevelPlan[]) {
  const ids = [...new Set(plan.flatMap((l) => l.approverUserIds))];
  const users = ids.length
    ? await getPrisma().user.findMany({
        where: { id: { in: ids }, memberships: { some: { tenantId } } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return plan.map((l) => ({
    position: l.position,
    name: { en: l.nameEn, ar: l.nameAr },
    min_approvals: l.minApprovals,
    approver_user_ids: l.approverUserIds,
    approvers: l.approverUserIds.map((id) => ({
      id,
      name: byId.get(id)?.name ?? null,
      email: byId.get(id)?.email ?? null,
    })),
  }));
}
