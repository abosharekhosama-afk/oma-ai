import { getPrisma, Prisma, tenantWhere, withoutBrandScope } from '@oma/db';
import { DomainError, isBrandMemberRole, newId, type BrandMemberRole } from '@oma/domain';
import { AuditService } from '../audit/audit.service';
import { parseBrandName } from './brand-input';

const notFound = () => new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
const bad = (m: string) => new DomainError('VALIDATION_FAILED', m, 400, 'errors.validation_failed');

/** Archive lifecycle, soft delete / purge and per-brand members. */
export class BrandAdminService {
  constructor(private readonly audit: AuditService) {}

  private async load(tenantId: string, brandId: string, opts: { includeDeleted?: boolean } = {}) {
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, {
        id: brandId,
        ...(opts.includeDeleted ? {} : { deletedAt: null }),
      }),
    });
    if (!brand) throw notFound();
    return brand;
  }

  async unarchive(tenantId: string, actorUserId: string, brandId: string, correlationId?: string) {
    const brand = await this.load(tenantId, brandId);
    if (brand.status !== 'ARCHIVED') {
      return { data: { id: brand.id, status: brand.status, archived_at: null } };
    }
    const status = brand.currentApprovedProfileVersionId
      ? 'ACTIVE'
      : brand.primaryWebsiteSourceId
        ? 'READY_TO_SCAN'
        : 'DRAFT';
    const row = await getPrisma().brandWorkspace.update({
      where: { id: brandId },
      data: { status, archivedAt: null, version: { increment: 1 } },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.unarchived',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      correlationId,
    });
    return { data: { id: row.id, status: row.status, version: row.version, archived_at: null } };
  }

  /** Soft delete: archives (unscheduling pending posts) and hides the brand everywhere. */
  async softDelete(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    unschedule: (tx: Prisma.TransactionClient) => Promise<number>,
    correlationId?: string,
  ) {
    const brand = await this.load(tenantId, brandId);
    const now = new Date();
    const unscheduled = await getPrisma().$transaction(async (tx) => {
      const n = await unschedule(tx);
      await tx.socialPage.updateMany({
        where: { tenantId, brandId },
        data: { status: 'DISCONNECTED' },
      });
      await tx.brandWorkspace.update({
        where: { id: brandId },
        data: {
          status: 'ARCHIVED',
          archivedAt: brand.archivedAt ?? now,
          deletedAt: now,
          version: { increment: 1 },
        },
      });
      return n;
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.deleted',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      correlationId,
    });
    return { data: { id: brandId, deleted_at: now.toISOString(), unscheduled_posts: unscheduled } };
  }

  async restore(tenantId: string, actorUserId: string, brandId: string, correlationId?: string) {
    const brand = await this.load(tenantId, brandId, { includeDeleted: true });
    if (!brand.deletedAt) return { data: { id: brandId, deleted_at: null } };
    await getPrisma().brandWorkspace.update({
      where: { id: brandId },
      data: { deletedAt: null, version: { increment: 1 } },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.restored',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      correlationId,
    });
    return { data: { id: brandId, deleted_at: null, status: brand.status } };
  }

  async listDeleted(tenantId: string) {
    const rows = await getPrisma().brandWorkspace.findMany({
      where: tenantWhere(tenantId, { deletedAt: { not: null } }),
      orderBy: { deletedAt: 'desc' },
      select: { id: true, name: true, deletedAt: true, logoUrl: true },
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        logo_url: r.logoUrl,
        deleted_at: r.deletedAt!.toISOString(),
      })),
    };
  }

  /**
   * Permanently remove a soft-deleted brand and every row that belongs to it. Requires the
   * brand name as confirmation. Rows are discovered from the Prisma schema (any model with a
   * brandId, plus child rows reachable through a required relation), deleted in passes until
   * foreign keys are satisfied.
   */
  async purge(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    confirmName: unknown,
    correlationId?: string,
  ) {
    const brand = await this.load(tenantId, brandId, { includeDeleted: true });
    if (!brand.deletedAt) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Delete the brand before purging it',
        409,
        'errors.conflict_state',
      );
    }
    if (
      typeof confirmName !== 'string' ||
      parseBrandName(confirmName, 'confirm_name') !== brand.name
    ) {
      throw bad('confirm_name must match the brand name');
    }
    const removed = await withoutBrandScope(() => purgeBrandRows(tenantId, brandId));
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.purged',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      afterRef: brand.name,
      correlationId,
    });
    return { data: { id: brandId, purged: true, rows_removed: removed } };
  }

  // ---- members ----

  async listMembers(tenantId: string, brandId: string) {
    await this.load(tenantId, brandId);
    const prisma = getPrisma();
    const [rows, memberships] = await Promise.all([
      prisma.brandMember.findMany({ where: { tenantId, brandId }, orderBy: { createdAt: 'asc' } }),
      withoutBrandScope(() =>
        prisma.membership.findMany({
          where: tenantWhere(tenantId, { status: 'ACTIVE', userId: { not: null } }),
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            grants: { where: { revokedAt: null, capabilityCode: 'tenant.manage' } },
          },
        }),
      ),
    ]);
    const byUser = new Map(memberships.filter((m) => m.user).map((m) => [m.userId!, m]));
    const admins = memberships.filter((m) => m.user && m.grants.length > 0);
    const explicit = rows
      .filter((r) => byUser.has(r.userId))
      .map((r) => {
        const u = byUser.get(r.userId)!.user!;
        return {
          user_id: u.id,
          name: u.name,
          email: u.email,
          avatar_url: u.avatarUrl,
          role: r.role,
          workspace_admin: byUser.get(r.userId)!.grants.length > 0,
          added_at: r.createdAt.toISOString(),
        };
      });
    const listed = new Set(explicit.map((m) => m.user_id));
    const implicit = admins
      .filter((m) => !listed.has(m.userId!))
      .map((m) => ({
        user_id: m.user!.id,
        name: m.user!.name,
        email: m.user!.email,
        avatar_url: m.user!.avatarUrl,
        role: 'MANAGER' as const,
        workspace_admin: true,
        added_at: null,
      }));
    const candidates = memberships
      .filter((m) => m.user && m.grants.length === 0 && !listed.has(m.userId!))
      .map((m) => ({
        user_id: m.user!.id,
        name: m.user!.name,
        email: m.user!.email,
        avatar_url: m.user!.avatarUrl,
      }));
    return { data: { members: [...implicit, ...explicit], available: candidates } };
  }

  async addMember(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    body: unknown,
    correlationId?: string,
  ) {
    await this.load(tenantId, brandId);
    const b = (body ?? {}) as Record<string, unknown>;
    const userId =
      typeof b.userId === 'string' ? b.userId : typeof b.user_id === 'string' ? b.user_id : '';
    const role = b.role ?? 'EDITOR';
    if (!userId) throw bad('userId is required');
    if (!isBrandMemberRole(role)) throw bad('role must be MANAGER, EDITOR, APPROVER or VIEWER');
    const member = await withoutBrandScope(() =>
      getPrisma().membership.findFirst({
        where: tenantWhere(tenantId, { userId, status: 'ACTIVE' }),
      }),
    );
    if (!member) throw bad('user is not an active member of this workspace');
    const row = await getPrisma().brandMember.upsert({
      where: { brandId_userId: { brandId, userId } },
      create: { id: newId(), tenantId, brandId, userId, role, addedBy: actorUserId },
      update: { role },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.member.added',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      afterRef: `${userId}:${role}`,
      correlationId,
    });
    return { data: { user_id: row.userId, role: row.role } };
  }

  async updateMember(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    userId: string,
    body: unknown,
    correlationId?: string,
  ) {
    await this.load(tenantId, brandId);
    const role = (body as { role?: unknown } | null)?.role;
    if (!isBrandMemberRole(role)) throw bad('role must be MANAGER, EDITOR, APPROVER or VIEWER');
    const row = await getPrisma().brandMember.findFirst({ where: { tenantId, brandId, userId } });
    if (!row) throw notFound();
    await this.assertNotLastManager(tenantId, brandId, userId, role);
    await getPrisma().brandMember.update({ where: { id: row.id }, data: { role } });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.member.role_changed',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      afterRef: `${userId}:${role}`,
      correlationId,
    });
    return { data: { user_id: userId, role } };
  }

  async removeMember(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    userId: string,
    correlationId?: string,
  ) {
    await this.load(tenantId, brandId);
    const row = await getPrisma().brandMember.findFirst({ where: { tenantId, brandId, userId } });
    if (!row) throw notFound();
    await this.assertNotLastManager(tenantId, brandId, userId, null);
    await getPrisma().brandMember.delete({ where: { id: row.id } });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.member.removed',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      afterRef: userId,
      correlationId,
    });
    return { data: { user_id: userId, removed: true } };
  }

  /** Workspace admins always manage every brand, so only block when no admin exists either. */
  private async assertNotLastManager(
    tenantId: string,
    brandId: string,
    userId: string,
    nextRole: BrandMemberRole | null,
  ) {
    if (nextRole === 'MANAGER') return;
    const prisma = getPrisma();
    const current = await prisma.brandMember.findFirst({ where: { tenantId, brandId, userId } });
    if (current?.role !== 'MANAGER') return;
    const otherManagers = await prisma.brandMember.count({
      where: { tenantId, brandId, role: 'MANAGER', userId: { not: userId } },
    });
    const admins = await withoutBrandScope(() =>
      prisma.capabilityGrant.count({
        where: {
          tenantId,
          capabilityCode: 'tenant.manage',
          revokedAt: null,
          membership: { status: 'ACTIVE' },
        },
      }),
    );
    if (otherManagers === 0 && admins === 0) {
      throw new DomainError(
        'CONFLICT_STATE',
        'A brand needs at least one manager',
        409,
        'errors.conflict_state',
      );
    }
  }
}

type Step = { model: string; where: Record<string, unknown> };

function purgePlan(brandId: string): Step[] {
  const models = Prisma.dmmf.datamodel.models;
  const withBrand = new Set(
    models.filter((m) => m.fields.some((f) => f.name === 'brandId')).map((m) => m.name),
  );
  const steps: Step[] = [];
  for (const m of models) {
    if (m.name === 'BrandWorkspace') continue;
    if (withBrand.has(m.name)) {
      steps.push({ model: m.name, where: { brandId } });
      continue;
    }
    for (const f of m.fields) {
      if (
        f.kind === 'object' &&
        !f.isList &&
        withBrand.has(f.type) &&
        f.type !== 'BrandWorkspace'
      ) {
        steps.push({ model: m.name, where: { [f.name]: { brandId } } });
      }
    }
  }
  return steps;
}

const delegate = (model: string) =>
  (
    getPrisma() as unknown as Record<
      string,
      { deleteMany(a: { where: unknown }): Promise<{ count: number }> }
    >
  )[model.charAt(0).toLowerCase() + model.slice(1)]!;

export async function purgeBrandRows(tenantId: string, brandId: string): Promise<number> {
  let pending = purgePlan(brandId);
  let removed = 0;
  for (let pass = 0; pass < 12 && pending.length; pass++) {
    const failed: Step[] = [];
    for (const step of pending) {
      try {
        removed += (await delegate(step.model).deleteMany({ where: step.where })).count;
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2003', 'P2014'].includes(e.code)
        )
          failed.push(step);
        else throw e;
      }
    }
    pending = failed;
  }
  if (pending.length) {
    throw new DomainError(
      'CONFLICT_STATE',
      `Purge blocked by ${pending.map((p) => p.model).join(', ')}`,
      409,
      'errors.conflict_state',
    );
  }
  // Brand-owned rows that reference the brand through other columns.
  removed += (await getPrisma().contentPreferences.deleteMany({ where: { brandId } })).count;
  const brand = await getPrisma().brandWorkspace.deleteMany({ where: { id: brandId, tenantId } });
  return removed + brand.count;
}
