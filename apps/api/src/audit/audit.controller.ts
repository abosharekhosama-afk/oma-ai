import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError } from '@oma/domain';
import type { Request } from 'express';

@Controller('api/v1/audit-events')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class AuditController {
  @Get()
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
}
