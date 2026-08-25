import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
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
    return { items };
  }
}
