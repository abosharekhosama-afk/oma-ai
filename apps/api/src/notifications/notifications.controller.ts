import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError } from '@oma/domain';
import type { Request } from 'express';

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
    return {
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        deepLinkPath: n.deepLinkPath,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
      })),
    };
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
    return {
      data: {
        id: updated.id,
        type: updated.type,
        deepLinkPath: updated.deepLinkPath,
        createdAt: updated.createdAt.toISOString(),
        readAt: updated.readAt?.toISOString() ?? null,
      },
    };
  }
}
