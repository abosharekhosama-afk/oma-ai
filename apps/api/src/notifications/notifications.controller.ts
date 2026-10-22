import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError } from '@oma/domain';
import type { Request } from 'express';

function mapNotification(n: {
  id: string;
  type: string;
  deepLinkPath: string;
  objectType: string | null;
  objectId: string | null;
  createdAt: Date;
  readAt: Date | null;
}) {
  return {
    id: n.id,
    type: n.type,
    title: notificationTitle(n.type),
    body: notificationBody(n.type),
    deepLinkPath: n.deepLinkPath,
    objectType: n.objectType,
    objectId: n.objectId,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt?.toISOString() ?? null,
  };
}

function notificationTitle(type: string): string {
  const map: Record<string, string> = {
    'content.approval_requested': 'Approval requested',
    'content.approved': 'Post approved',
    'content.changes_requested': 'Changes requested',
    'content.rejected': 'Post rejected',
    'content.scheduled': 'Post scheduled',
    'content.published': 'Post published',
    'request.assigned': 'Request assigned',
    'request.converted': 'Request converted to task',
    'task.assigned': 'Task assigned',
    'deliverable.review': 'Deliverable ready for review',
    'membership.invited': 'Team invitation',
    'strategy.submitted': 'Strategy submitted',
    'strategy.approved': 'Strategy approved',
  };
  return map[type] ?? type.replace(/\./g, ' ');
}

function notificationBody(type: string): string {
  const map: Record<string, string> = {
    'content.approval_requested': 'A post is waiting for your approval.',
    'content.approved': 'Your post was approved and can be scheduled.',
    'content.changes_requested': 'Changes were requested on a post.',
    'content.rejected': 'A post was rejected.',
    'content.scheduled': 'A post was scheduled on the calendar.',
    'content.published': 'A post was marked as published.',
    'request.assigned': 'A work request was assigned to you.',
    'request.converted': 'A request was converted into a task.',
    'task.assigned': 'A task was assigned to you.',
    'deliverable.review': 'A deliverable is ready for review.',
    'membership.invited': 'You were invited to a workspace.',
    'strategy.submitted': 'A strategy was submitted for review.',
    'strategy.approved': 'A strategy was approved.',
  };
  return map[type] ?? 'You have a new notification.';
}

@Controller('api/v1/notifications')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class NotificationsController {
  @Get()
  @RequireCapabilities('notification.read')
  async list(@Req() req: Request) {
    if (!req.oma?.userId || !req.oma.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    const items = await getPrisma().notification.findMany({
      where: tenantWhere(req.oma.tenantId, { recipientUserId: req.oma.userId }),
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unread = items.filter((n) => !n.readAt).length;
    return {
      items: items.map(mapNotification),
      unread_count: unread,
    };
  }

  @Get('unread-count')
  @RequireCapabilities('notification.read')
  async unreadCount(@Req() req: Request) {
    if (!req.oma?.userId || !req.oma.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    const count = await getPrisma().notification.count({
      where: tenantWhere(req.oma.tenantId, {
        recipientUserId: req.oma.userId,
        readAt: null,
      }),
    });
    return { data: { count } };
  }

  @Post('read-all')
  @UseGuards(CsrfGuard)
  @RequireCapabilities('notification.read')
  async markAllRead(@Req() req: Request, @Body() _body: Record<string, never>) {
    if (!req.oma?.userId || !req.oma.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    const result = await getPrisma().notification.updateMany({
      where: tenantWhere(req.oma.tenantId, {
        recipientUserId: req.oma.userId,
        readAt: null,
      }),
      data: { readAt: new Date() },
    });
    return { data: { updated: result.count } };
  }

  @Post(':id/read')
  @UseGuards(CsrfGuard)
  @RequireCapabilities('notification.read')
  async markRead(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() _body: Record<string, never>,
  ) {
    if (!req.oma?.userId || !req.oma.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    const existing = await getPrisma().notification.findFirst({
      where: tenantWhere(req.oma.tenantId, { id, recipientUserId: req.oma.userId }),
    });
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    }
    const updated =
      existing.readAt != null
        ? existing
        : await getPrisma().notification.update({
            where: { id },
            data: { readAt: new Date() },
          });
    return { data: mapNotification(updated) };
  }
}
