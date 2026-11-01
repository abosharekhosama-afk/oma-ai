import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError } from '@oma/domain';
import type { Request } from 'express';

type NotificationRow = {
  id: string;
  type: string;
  deepLinkPath: string;
  objectType: string | null;
  objectId: string | null;
  createdAt: Date;
  readAt: Date | null;
};

type ContentPreviewRow = {
  id: string;
  previewAssetUrl: string | null;
  previewAssetId: string | null;
  titleEn: string;
  titleAr: string;
  captionEn: string | null;
  captionAr: string | null;
  channel: string;
};

function mapNotification(
  n: NotificationRow,
  preview?: {
    imageUrl: string | null;
    titleEn: string;
    titleAr: string;
    captionEn: string | null;
    captionAr: string | null;
    channel: string;
  },
) {
  return {
    id: n.id,
    type: n.type,
    title: notificationTitle(n.type),
    body: notificationBody(n.type),
    deepLinkPath: n.deepLinkPath,
    objectType: n.objectType,
    objectId: n.objectId,
    contentPreview: preview ?? null,
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
    'content.publish.succeeded': 'Post published',
    'content.publish.failed': 'Publishing failed',
    'request.assigned': 'Request assigned',
    'request.converted': 'Request converted to task',
    'task.assigned': 'Task assigned',
    'deliverable.review': 'Deliverable ready for review',
    'deliverable.approved': 'Deliverable approved',
    'deliverable.changes_requested': 'Changes requested on deliverable',
    'deliverable.rejected': 'Deliverable rejected',
    'deliverable.comment': 'New comment on deliverable',
    'content.comment': 'New comment on post',
    'task.comment': 'New comment on task',
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
    'content.publish.succeeded': 'A scheduled post was published successfully.',
    'content.publish.failed': 'A scheduled post could not be published.',
    'request.assigned': 'A work request was assigned to you.',
    'request.converted': 'A request was converted into a task.',
    'task.assigned': 'A task was assigned to you.',
    'deliverable.review': 'A deliverable is ready for review.',
    'deliverable.approved': 'A deliverable you follow was approved.',
    'deliverable.changes_requested': 'Changes were requested on a deliverable.',
    'deliverable.rejected': 'A deliverable was rejected.',
    'deliverable.comment': 'Someone commented on a deliverable you follow.',
    'content.comment': 'Someone commented on a post you follow.',
    'task.comment': 'Someone commented on a task you follow.',
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
    const items = (await getPrisma().notification.findMany({
      where: tenantWhere(req.oma.tenantId, { recipientUserId: req.oma.userId }),
      orderBy: { createdAt: 'desc' },
      take: 50,
    })) as NotificationRow[];
    const contentIds = items
      .filter((n) => n.objectType === 'ContentItem' && n.objectId)
      .map((n) => n.objectId as string);
    const contentItems = contentIds.length
      ? ((await getPrisma().contentItem.findMany({
          where: tenantWhere(req.oma.tenantId, { id: { in: contentIds } }),
          select: {
            id: true,
            previewAssetUrl: true,
            previewAssetId: true,
            titleEn: true,
            titleAr: true,
            captionEn: true,
            captionAr: true,
            channel: true,
          },
        })) as ContentPreviewRow[])
      : [];
    const contentById = new Map(contentItems.map((item) => [item.id, item]));
    const unread = items.filter((n) => !n.readAt).length;
    return {
      items: items.map((item) => {
        const content =
          item.objectType === 'ContentItem' && item.objectId
            ? contentById.get(item.objectId)
            : undefined;
        return mapNotification(
          item,
          content
            ? {
                imageUrl:
                  content.previewAssetUrl ??
                  (content.previewAssetId ? `/api/v1/media/${content.previewAssetId}/view` : null),
                titleEn: content.titleEn,
                titleAr: content.titleAr,
                captionEn: content.captionEn,
                captionAr: content.captionAr,
                channel: content.channel,
              }
            : undefined,
        );
      }),
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
