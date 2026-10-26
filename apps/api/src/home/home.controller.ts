import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { DomainError } from '@oma/domain';
import { buildHome } from './home.service';
import { AuditController } from '../audit/audit.controller';

const requireTenant = (req: Request) => {
  if (!req.oma?.tenantId || !req.oma.userId)
    throw new DomainError('TENANT_REQUIRED', 'Active tenant required', 409, 'errors.tenant_required');
  return { tenantId: req.oma.tenantId, userId: req.oma.userId };
};

/** Real command center (replaces /api/v1/demo/command-center). Requires brand.read. */
@Controller('api/v1/home')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class HomeController {
  @Get()
  async get(@Req() req: Request) {
    const { tenantId, userId } = requireTenant(req);
    const caps = (req.oma as { capabilities?: string[] } | undefined)?.capabilities;
    return buildHome(tenantId, userId, new Date(), {
      canApprove: Array.isArray(caps) ? caps.includes('content.approve') : undefined,
    });
  }
}

const ACTIVITY_CATEGORIES = new Set(['members', 'approvals', 'content', 'settings', 'other']);

/** Workspace activity feed from audit events (readable actors/targets). Requires brand.read. */
@Controller('api/v1/activity')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class ActivityController {
  private readonly audit = new AuditController();

  @Get()
  async list(
    @Req() req: Request,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '30',
    @Query('category') category?: string,
  ) {
    requireTenant(req);
    const res = await this.audit.activity(req, cursor, limit);
    if (!category || !ACTIVITY_CATEGORIES.has(category)) return res;
    return { ...res, items: res.items.filter((i) => i.category === category) };
  }
}
