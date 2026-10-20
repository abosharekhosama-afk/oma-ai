import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { DomainError } from '@oma/domain';
import { campaignService } from '../container';

@Controller()
@UseGuards(AuthGuard, CapabilitiesGuard)
export class CampaignController {
  private requireTenant(req: Request) {
    if (!req.oma?.tenantId) {
      throw new DomainError('TENANT_REQUIRED', 'Tenant required', 403, 'errors.tenant_required');
    }
  }

  @Get('api/v1/brands/:brandId/campaigns')
  async list(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Query('status') status?: string,
    @Query('track') track?: string,
    @Query('q') q?: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.requireTenant(req);
    return campaignService.list(req.oma!.tenantId!, brandId, {
      status,
      track,
      q,
      includeArchived: includeArchived === 'true' || includeArchived === '1',
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('api/v1/brands/:brandId/campaigns')
  @UseGuards(CsrfGuard)
  async create(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body()
    body: {
      name: { en: string; ar?: string } | string;
      description?: { en: string; ar?: string } | string;
      track: 'ORGANIC' | 'PAID';
      timelineStart: string;
      timelineEnd: string;
      links?: string[];
    },
  ) {
    this.requireTenant(req);
    return campaignService.create(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      body,
      req.oma!.correlationId,
    );
  }

  @Get('api/v1/campaigns/:campaignId')
  async get(@Req() req: Request, @Param('campaignId') campaignId: string) {
    this.requireTenant(req);
    return campaignService.get(req.oma!.tenantId!, campaignId);
  }

  @Patch('api/v1/campaigns/:campaignId')
  @UseGuards(CsrfGuard)
  async update(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.requireTenant(req);
    return campaignService.update(
      req.oma!.tenantId!,
      req.oma!.userId!,
      campaignId,
      body as never,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/campaigns/:campaignId/archive')
  @UseGuards(CsrfGuard)
  async archive(@Req() req: Request, @Param('campaignId') campaignId: string) {
    this.requireTenant(req);
    return campaignService.archive(
      req.oma!.tenantId!,
      req.oma!.userId!,
      campaignId,
      req.oma!.correlationId,
    );
  }
}
