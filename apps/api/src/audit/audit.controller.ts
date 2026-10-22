import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError } from '@oma/domain';
import type { Request } from 'express';

const ACTION_LABELS: Record<string, string> = {
  'capability.assigned': 'Permissions updated',
  'membership.invited': 'Member invited',
  'membership.removed': 'Member removed',
  'membership.suspended': 'Member suspended',
  'membership.accepted': 'Invitation accepted',
  'tenant.created': 'Workspace created',
  'tenant.updated': 'Workspace updated',
  'mail.invite': 'Invite email queued',
};

const CAP_LABELS: Record<string, string> = {
  'content.read': 'View content',
  'content.view': 'View content',
  'workspace.view': 'View workspace',
  'review.approve': 'Approve reviews',
  'approval.approve': 'Approve content',
  'content.approve': 'Approve content',
  'content.write': 'Edit content',
  'content.edit': 'Edit content',
  'content.create': 'Create content',
  'content.publish': 'Publish content',
  'schedule.publish': 'Schedule & publish',
  'analytics.read': 'View analytics',
  'analytics.view': 'View analytics',
  'membership.manage': 'Manage members',
  'membership.invite': 'Invite members',
  'capability.assign': 'Assign permissions',
  'tenant.admin': 'Administer workspace',
  'audit.read': 'View activity',
};

function humanizeAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return action
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function humanizeCaps(raw?: string | null): string | null {
  if (!raw) return null;
  const parts = raw
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const labels = parts.map((p) => CAP_LABELS[p] || p.replace(/[._]/g, ' '));
  // unique preserve order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const l of labels) {
    if (seen.has(l)) continue;
    seen.add(l);
    unique.push(l);
  }
  if (unique.length <= 4) return unique.join(', ');
  return `${unique.slice(0, 4).join(', ')} +${unique.length - 4} more`;
}

function categoryFor(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('membership') || a.includes('invite') || a.includes('capability')) return 'members';
  if (a.includes('approv') || a.includes('review')) return 'approvals';
  if (a.includes('content') || a.includes('post') || a.includes('campaign') || a.includes('publish'))
    return 'content';
  if (a.includes('setting') || a.includes('preference') || a.includes('tenant')) return 'settings';
  return 'other';
}

@Controller('api/v1/audit-events')
export class AuditController {
  @Get()
  @UseGuards(AuthGuard, CapabilitiesGuard)
  @RequireCapabilities('audit.read')
  async list(@Req() req: Request, @Query('cursor') cursor?: string, @Query('limit') limit = '25') {
    if (!req.oma?.tenantId)
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    const take = Math.min(Number(limit) || 25, 100);
    const rows = await getPrisma().auditEvent.findMany({
      where: tenantWhere(req.oma.tenantId, cursor ? { id: { lt: cursor } } : {}),
      orderBy: { occurredAt: 'desc' },
      take,
    });
    return { items: rows, next_cursor: rows.at(-1)?.id ?? null };
  }

  /** Activity feed for any authenticated tenant member. */
  @Get('feed')
  @UseGuards(AuthGuard)
  async feed(@Req() req: Request, @Query('cursor') cursor?: string, @Query('limit') limit = '25') {
    return this.activity(req, cursor, limit);
  }

  /**
   * Human-readable activity feed: resolved actor names, action labels, no raw IDs.
   * GET /api/v1/audit-events/activity
   */
  @Get('activity')
  @UseGuards(AuthGuard)
  async activity(
    @Req() req: Request,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '25',
  ) {
    if (!req.oma?.tenantId)
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    const take = Math.min(Number(limit) || 25, 100);
    const prisma = getPrisma();
    const rows = await prisma.auditEvent.findMany({
      where: tenantWhere(req.oma.tenantId, cursor ? { id: { lt: cursor } } : {}),
      orderBy: { occurredAt: 'desc' },
      take,
    });

    const actorIds = [
      ...new Set(rows.map((r) => r.actorUserId).filter((id): id is string => Boolean(id))),
    ];
    const targetMembershipIds = rows
      .filter((r) => r.targetType === 'Membership' && r.targetId)
      .map((r) => r.targetId as string);

    const [users, memberships] = await Promise.all([
      actorIds.length
        ? prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
      targetMembershipIds.length
        ? prisma.membership.findMany({
            where: { id: { in: targetMembershipIds } },
            select: {
              id: true,
              invitedEmail: true,
              user: { select: { name: true, email: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const memMap = new Map(memberships.map((m) => [m.id, m]));

    const items = rows.map((r) => {
      const actor = r.actorUserId ? userMap.get(r.actorUserId) : null;
      const actorName =
        actor?.name?.trim() ||
        actor?.email ||
        (r.actorType === 'SYSTEM' ? 'System' : r.actorType === 'USER' ? 'A teammate' : 'Someone');

      let subject: string | null = null;
      if (r.targetType === 'Membership' && r.targetId) {
        const m = memMap.get(r.targetId);
        subject =
          m?.user?.name?.trim() ||
          m?.user?.email ||
          m?.invitedEmail ||
          'a team member';
      } else if (r.targetType) {
        subject = r.targetType.replace(/([A-Z])/g, ' $1').trim();
      }

      const title = humanizeAction(r.action);
      const capsSummary = humanizeCaps(r.afterRef);
      let summary: string;
      if (r.action === 'capability.assigned' && subject) {
        summary = capsSummary
          ? `Updated permissions for ${subject}: ${capsSummary}`
          : `Updated permissions for ${subject}`;
      } else if (r.action === 'membership.invited' && subject) {
        summary = `Invited ${subject} to the workspace`;
      } else if (r.action === 'membership.removed' && subject) {
        summary = `Removed ${subject} from the workspace`;
      } else if (subject) {
        summary = `${title} · ${subject}`;
      } else if (capsSummary) {
        summary = `${title}: ${capsSummary}`;
      } else {
        summary = title;
      }

      return {
        id: r.id,
        at: r.occurredAt,
        action: r.action,
        category: categoryFor(r.action),
        title,
        summary,
        actor_name: actorName,
        actor_email: actor?.email ?? null,
        // intentionally omit raw targetId / afterRef IDs
      };
    });

    return { items, next_cursor: rows.at(-1)?.id ?? null };
  }
}
