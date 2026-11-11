import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { platformAdminService } from '../container';
import { requireSuperAdminOperator } from './platform-admin-auth';

@Controller('api/v1/admin')
@UseGuards(AuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  @Get('health')
  health() {
    return { ok: true, surface: 'platform-admin' };
  }

  @Get('metrics/overview')
  async metricsOverview() {
    return platformAdminService.metricsOverview();
  }

  @Get('tenants')
  async listTenants(
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return platformAdminService.listTenants({
      q: q?.trim() || undefined,
      cursor: cursor?.trim() || undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('tenants/:tenantId')
  async getTenant(@Param('tenantId') tenantId: string) {
    return platformAdminService.getTenant(tenantId);
  }

  @Post('tenants')
  @UseGuards(CsrfGuard)
  async createTenant(
    @Req() req: Request,
    @Body() body: { name: string; slug?: string; owner_user_id?: string },
  ) {
    const actor = await requireSuperAdminOperator(req);
    return platformAdminService.createTenant(actor, body, req.oma?.correlationId);
  }

  @Patch('tenants/:tenantId')
  @UseGuards(CsrfGuard)
  async patchTenant(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      status?: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
      name?: string;
      plan_code?: string;
      billing_cycle?: string;
      storage_limit_bytes?: number | null;
      note?: string;
    },
  ) {
    const actor = await requireSuperAdminOperator(req);
    return platformAdminService.patchTenant(actor, tenantId, body ?? {}, req.oma?.correlationId);
  }

  @Get('system/secrets')
  secretsStatus() {
    return platformAdminService.systemSecretsStatus();
  }
}
