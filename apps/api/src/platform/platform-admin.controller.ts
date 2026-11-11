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
      usage_overrides?: Record<string, number | null>;
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

  @Get('system/integrations')
  integrationsStatus() {
    return platformAdminService.systemIntegrationsStatus();
  }

  @Post('system/probes/redis')
  @UseGuards(CsrfGuard)
  async probeRedis() {
    return platformAdminService.probeRedis();
  }

  @Post('system/probes/ai')
  @UseGuards(CsrfGuard)
  async probeAi() {
    return platformAdminService.probeLiveAi();
  }

  @Post('system/probes/website-scan')
  @UseGuards(CsrfGuard)
  async probeWebsiteScan(@Body() body: { url?: string }) {
    return platformAdminService.probeWebsiteScan(body ?? {});
  }

  @Get('operators')
  async listOperators(@Query('q') q?: string) {
    return platformAdminService.listOperators(q);
  }

  @Post('operators')
  @UseGuards(CsrfGuard)
  async createOperator(
    @Req() req: Request,
    @Body()
    body: {
      email: string;
      name?: string;
      password?: string;
      system_role?: string;
    },
  ) {
    const actor = await requireSuperAdminOperator(req);
    return platformAdminService.createOperator(actor, body ?? {}, req.oma?.correlationId);
  }

  @Patch('operators/:userId')
  @UseGuards(CsrfGuard)
  async patchOperator(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Body() body: { system_role?: string },
  ) {
    const actor = await requireSuperAdminOperator(req);
    return platformAdminService.patchOperator(actor, userId, body ?? {}, req.oma?.correlationId);
  }

  @Get('plans')
  async listPlans() {
    return platformAdminService.listPlans();
  }

  @Patch('plans/:planCode')
  @UseGuards(CsrfGuard)
  async patchPlan(
    @Req() req: Request,
    @Param('planCode') planCode: string,
    @Body()
    body: {
      price_monthly_usd_cents?: number;
      price_yearly_per_month_usd_cents?: number;
      name_en?: string;
      name_ar?: string;
      popular?: boolean;
      active?: boolean;
      limits?: Record<string, number | string | null>;
    },
  ) {
    const actor = await requireSuperAdminOperator(req);
    return platformAdminService.patchPlan(actor, planCode, body ?? {}, req.oma?.correlationId);
  }
}
