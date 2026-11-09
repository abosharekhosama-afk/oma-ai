import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { analyticsService } from './analytics.service';
import { optimalTimesService } from './optimal-times.service';
import { analyticsCache, normaliseParams } from './analytics-cache';
import { billingService } from '../billing/billing.service';

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
    const tenantId = req.oma.tenantId;
    await billingService.assertFeature(tenantId, 'analytics');
    const q = { period, from, to, brandId, campaignId };
    return analyticsCache.wrap(
      { tenantId, userId: req.oma.userId ?? '', name: 'work', params: normaliseParams(q) },
      () => analyticsService.overview(tenantId, q),
    );
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
    const tenantId = req.oma.tenantId;
    await billingService.assertFeature(tenantId, 'analytics');
    const q = { period, from, to, brandId, channels, granularity };
    return analyticsCache.wrap(
      { tenantId, userId: req.oma.userId ?? '', name: 'content', params: normaliseParams(q) },
      () => analyticsService.contentOverview(tenantId, q),
    );
  }

  /** GET /api/v1/analytics/optimal-times */
  @Get('optimal-times')
  @RequireCapabilities('analytics.read')
  async optimalTimes(
    @Req() req: Request,
    @Query('brandId') brandId?: string,
    @Query('socialPageId') socialPageId?: string,
    @Query('network') network?: string,
  ) {
    if (!req.oma?.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    const tenantId = req.oma.tenantId;
    await billingService.assertFeature(tenantId, 'analytics');
    return optimalTimesService.list(tenantId, { brandId, socialPageId, network });
  }

  /** GET /api/v1/analytics/optimal-times/heatmap */
  @Get('optimal-times/heatmap')
  @RequireCapabilities('analytics.read')
  async optimalTimesHeatmap(
    @Req() req: Request,
    @Query('brandId') brandId?: string,
    @Query('socialPageId') socialPageId?: string,
    @Query('network') network?: string,
    @Query('metric') metric?: string,
  ) {
    if (!req.oma?.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    const tenantId = req.oma.tenantId;
    await billingService.assertFeature(tenantId, 'analytics');
    return optimalTimesService.heatmap(tenantId, { brandId, socialPageId, network, metric });
  }

  /** GET /api/v1/analytics/optimal-times/suggest */
  @Get('optimal-times/suggest')
  @RequireCapabilities('content.schedule')
  async optimalTimesSuggest(
    @Req() req: Request,
    @Query('brandId') brandId?: string,
    @Query('socialPageId') socialPageId?: string,
    @Query('socialPageIds') socialPageIds?: string,
    @Query('date') date?: string,
  ) {
    if (!req.oma?.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    return optimalTimesService.suggest(req.oma.tenantId, {
      brandId,
      socialPageId,
      socialPageIds,
      date,
    });
  }
}
