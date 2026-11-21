import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { seoService } from '../container';

function ctx(req: Request) {
  if (!req.oma?.tenantId) {
    throw new DomainError(
      'TENANT_REQUIRED',
      'Active tenant required',
      409,
      'errors.tenant_required',
    );
  }
  return { tenantId: req.oma.tenantId, userId: req.oma.userId! };
}

@Controller()
export class SeoController {
  @Get('api/v1/brands/:brandId/seo/strategy-proposals')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  @RequireCapabilities('brand.read')
  strategyProposals(@Req() req: Request, @Param('brandId') brandId: string) {
    return seoService.strategyProposals(ctx(req).tenantId, brandId);
  }

  @Get('api/v1/brands/:brandId/seo/health')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  @RequireCapabilities('brand.read')
  health(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Query('scanId') scanId?: string,
  ) {
    return seoService.health(ctx(req).tenantId, brandId, scanId);
  }

  @Post('api/v1/brands/:brandId/seo/search-console/connect-fixture')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('brand.website.connect')
  connectFixture(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: { site_url?: string },
  ) {
    const c = ctx(req);
    return seoService.connectFixtureGsc(
      c.tenantId,
      c.userId,
      brandId,
      body?.site_url ?? 'https://example-brand.test/',
    );
  }

  @Post('api/v1/brands/:brandId/seo/search-console/oauth/start')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('brand.website.connect')
  startOAuth(@Req() req: Request, @Param('brandId') brandId: string) {
    const c = ctx(req);
    return seoService.startGscOAuth(c.tenantId, c.userId, brandId);
  }

  @Get('api/v1/seo/gsc/callback')
  @UseGuards(AuthGuard)
  async gscCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query() q: { code?: string; state?: string; error?: string },
  ) {
    const url = await seoService.gscCallback(
      { tenantId: req.oma?.tenantId, userId: req.oma?.userId },
      q,
    );
    res.redirect(302, url);
  }

  @Post('api/v1/brands/:brandId/seo/search-console/sync')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('brand.website.connect')
  syncGsc(@Req() req: Request, @Param('brandId') brandId: string) {
    const c = ctx(req);
    return seoService.syncGsc(c.tenantId, c.userId, brandId);
  }

  @Post('api/v1/brands/:brandId/seo/keywords/research')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('brand.read')
  keywordResearch(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: { keywords?: Array<{ keyword: string; locale: string }>; market?: string },
  ) {
    return seoService.keywordResearch(ctx(req).tenantId, brandId, {
      keywords: body?.keywords ?? [],
      market: body?.market ?? null,
    });
  }

  @Get('api/v1/brands/:brandId/seo/analytics')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  @RequireCapabilities('analytics.read')
  analytics(@Req() req: Request, @Param('brandId') brandId: string, @Query('period') period?: string) {
    const days = Math.min(90, Math.max(7, Number(period ?? 30) || 30));
    return seoService.analyticsSeo(ctx(req).tenantId, brandId, days);
  }
}