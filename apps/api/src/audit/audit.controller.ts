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
  if (a.includes('membership') || a.includes('invite') || a.includes('capability'))
    return 'members';
  if (a.includes('approv') || a.includes('review')) return 'approvals';
  if (
    a.includes('content') ||
    a.includes('post') ||
    a.includes('campaign') ||
    a.includes('publish')
  )
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
    const targets = await resolveActivityTargets(req.oma.tenantId, rows);

    const items = rows.map((r) => {
      const actor = r.actorUserId ? userMap.get(r.actorUserId) : null;
      const actorName =
        actor?.name?.trim() ||
        actor?.email ||
        (r.actorType === 'SYSTEM' ? 'System' : r.actorType === 'USER' ? 'A teammate' : 'Someone');

      let subject: string | null = null;
      if (r.targetType === 'Membership' && r.targetId) {
        const m = memMap.get(r.targetId);
        subject = m?.user?.name?.trim() || m?.user?.email || m?.invitedEmail || 'a team member';
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
        // Readable target (name + in-app link + optional preview); never a raw ID label.
        target:
          r.targetType && r.targetId
            ? (targets.get(`${r.targetType}:${r.targetId}`) ?? null)
            : null,
      };
    });

    return { items, next_cursor: rows.at(-1)?.id ?? null };
  }
}

type ActivityTarget = {
  type: 'content' | 'campaign' | 'request' | 'task' | 'deliverable' | 'brand';
  name: { en: string; ar: string };
  href: string;
  thumbnail_url?: string | null;
  snippet?: { en: string; ar: string } | null;
  snippet_kind?: 'caption' | 'comment' | null;
};

const clip = (v: string | null | undefined, n = 140) => {
  const t = (v ?? '')
    .replace(/__OMA_BRIEF_V1__[\s\S]*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Batch-resolve audit targets to readable names/links (tenant-scoped). */
async function resolveActivityTargets(
  tenantId: string,
  rows: Array<{ targetType: string | null; targetId: string | null }>,
): Promise<Map<string, ActivityTarget>> {
  const ids = (type: string) => [
    ...new Set(
      rows.filter((r) => r.targetType === type && r.targetId).map((r) => r.targetId as string),
    ),
  ];
  const prisma = getPrisma();
  const commentIds = ids('ContentComment');
  const comments = commentIds.length
    ? await prisma.contentComment.findMany({
        where: { tenantId, id: { in: commentIds } },
        select: { id: true, contentId: true, bodyEn: true, bodyAr: true },
      })
    : [];
  const versionIds = ids('WorkDeliverableVersion');
  const versions = versionIds.length
    ? await prisma.workDeliverableVersion.findMany({
        where: { tenantId, id: { in: versionIds } },
        select: { id: true, deliverableId: true, assetUrl: true },
      })
    : [];
  const deliverableIds = [
    ...new Set([...ids('WorkDeliverable'), ...versions.map((v) => v.deliverableId)]),
  ];
  const contentIds = [...new Set([...ids('ContentItem'), ...comments.map((c) => c.contentId)])];
  const none = Promise.resolve([] as never[]);
  const [content, campaigns, requests, tasks, deliverables, brands] = await Promise.all([
    contentIds.length
      ? prisma.contentItem.findMany({
          where: { tenantId, id: { in: contentIds } },
          select: { id: true, titleEn: true, titleAr: true, captionEn: true, captionAr: true },
        })
      : none,
    ids('Campaign').length
      ? prisma.campaign.findMany({
          where: { tenantId, id: { in: ids('Campaign') } },
          select: { id: true, nameEn: true, nameAr: true },
        })
      : none,
    ids('WorkRequest').length
      ? prisma.workRequest.findMany({
          where: { tenantId, id: { in: ids('WorkRequest') } },
          select: { id: true, titleEn: true, titleAr: true },
        })
      : none,
    ids('WorkTask').length
      ? prisma.workTask.findMany({
          where: { tenantId, id: { in: ids('WorkTask') } },
          select: { id: true, titleEn: true, titleAr: true },
        })
      : none,
    deliverableIds.length
      ? prisma.workDeliverable.findMany({
          where: { tenantId, id: { in: deliverableIds } },
          select: { id: true, titleEn: true, titleAr: true, assetUrl: true },
        })
      : none,
    ids('BrandWorkspace').length
      ? prisma.brandWorkspace.findMany({
          where: { tenantId, id: { in: ids('BrandWorkspace') } },
          select: { id: true, name: true },
        })
      : none,
  ]);
  const out = new Map<string, ActivityTarget>();
  const contentMap = new Map(content.map((c) => [c.id, c]));
  for (const c of content) {
    const snippet = clip(c.captionEn) || clip(c.captionAr);
    out.set(`ContentItem:${c.id}`, {
      type: 'content',
      name: { en: c.titleEn, ar: c.titleAr || c.titleEn },
      href: `/app/content?item=${encodeURIComponent(c.id)}`,
      snippet: snippet
        ? { en: clip(c.captionEn) || snippet, ar: clip(c.captionAr) || snippet }
        : null,
      snippet_kind: snippet ? 'caption' : null,
    });
  }
  for (const cm of comments) {
    const item = contentMap.get(cm.contentId);
    if (!item) continue;
    out.set(`ContentComment:${cm.id}`, {
      type: 'content',
      name: { en: item.titleEn, ar: item.titleAr || item.titleEn },
      href: `/app/content?item=${encodeURIComponent(item.id)}`,
      snippet: { en: clip(cm.bodyEn), ar: clip(cm.bodyAr) || clip(cm.bodyEn) },
      snippet_kind: 'comment',
    });
  }
  for (const c of campaigns)
    out.set(`Campaign:${c.id}`, {
      type: 'campaign',
      name: { en: c.nameEn, ar: c.nameAr || c.nameEn },
      href: `/app/campaigns/${encodeURIComponent(c.id)}`,
    });
  for (const r of requests)
    out.set(`WorkRequest:${r.id}`, {
      type: 'request',
      name: { en: r.titleEn, ar: r.titleAr || r.titleEn },
      href: `/app/requests/${encodeURIComponent(r.id)}`,
    });
  for (const tk of tasks)
    out.set(`WorkTask:${tk.id}`, {
      type: 'task',
      name: { en: tk.titleEn, ar: tk.titleAr || tk.titleEn },
      href: `/app/tasks?task=${encodeURIComponent(tk.id)}`,
    });
  for (const d of deliverables)
    out.set(`WorkDeliverable:${d.id}`, {
      type: 'deliverable',
      name: { en: d.titleEn, ar: d.titleAr || d.titleEn },
      href: `/app/deliverables/${encodeURIComponent(d.id)}`,
      thumbnail_url: d.assetUrl && /^(https?:|\/)/.test(d.assetUrl) ? d.assetUrl : null,
    });
  for (const v of versions) {
    const d = out.get(`WorkDeliverable:${v.deliverableId}`);
    if (!d) continue;
    const thumb = v.assetUrl && /^(https?:|\/)/.test(v.assetUrl) ? v.assetUrl : d.thumbnail_url;
    out.set(`WorkDeliverableVersion:${v.id}`, { ...d, thumbnail_url: thumb ?? null });
  }
  for (const b of brands)
    out.set(`BrandWorkspace:${b.id}`, {
      type: 'brand',
      name: { en: b.name, ar: b.name },
      href: `/app/brands/${encodeURIComponent(b.id)}`,
    });
  return out;
}
