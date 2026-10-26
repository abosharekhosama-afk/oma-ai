import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { analyticsService } from './analytics.service';

@Controller('api/v1/analytics')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class AnalyticsController {
  /** GET /api/v1/analytics?period=7|30|90 | from&to (YYYY-MM-DD) &brandId &campaignId */
  @Get()
  @RequireCapabilities('analytics.read')
  async overview(
    @Req() req: Request,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('brandId') brandId?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    if (!req.oma?.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    return analyticsService.overview(req.oma.tenantId, { period, from, to, brandId, campaignId });
  }

  /** GET /api/v1/analytics/content?period|from&to &brandId &channels=a,b &granularity=day|week */
  @Get('content')
  @RequireCapabilities('analytics.read')
  async content(
    @Req() req: Request,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('brandId') brandId?: string,
    @Query('channels') channels?: string,
    @Query('granularity') granularity?: string,
  ) {
    if (!req.oma?.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    return analyticsService.contentOverview(req.oma.tenantId, {
      period,
      from,
      to,
      brandId,
      channels,
      granularity,
    });
  }
}
