import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { metaAdsService } from '../container';

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

/** DEC-029 4.8: read-only Meta Ads insights. */
@Controller()
export class MetaAdsController {
  @Get('api/v1/brands/:brandId/meta-ads')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  @RequireCapabilities('analytics.read')
  status(@Req() req: Request, @Param('brandId') brandId: string) {
    return metaAdsService.status(ctx(req).tenantId, brandId);
  }

  @Post('api/v1/brands/:brandId/meta-ads/oauth/start')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('strategy.paid.edit')
  start(@Req() req: Request, @Param('brandId') brandId: string) {
    const c = ctx(req);
    return metaAdsService.startOAuth(c.tenantId, c.userId, brandId);
  }

  @Get('api/v1/meta-ads/callback')
  @UseGuards(AuthGuard)
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query() q: { code?: string; state?: string; error?: string },
  ) {
    res.redirect(302, await metaAdsService.callback({ userId: req.oma?.userId }, q));
  }

  @Get('api/v1/brands/:brandId/meta-ads/accounts')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  @RequireCapabilities('strategy.paid.edit')
  accounts(@Req() req: Request, @Param('brandId') brandId: string) {
    return metaAdsService.listAccounts(ctx(req).tenantId, brandId);
  }

  @Post('api/v1/brands/:brandId/meta-ads/account')
  @HttpCode(200)
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('strategy.paid.edit')
  select(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: { ad_account_id?: string },
  ) {
    const c = ctx(req);
    return metaAdsService.selectAccount(c.tenantId, c.userId, brandId, body ?? {});
  }

  @Post('api/v1/brands/:brandId/meta-ads/sync')
  @HttpCode(200)
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('strategy.paid.edit')
  sync(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: { days?: number }) {
    const c = ctx(req);
    return metaAdsService.sync(c.tenantId, c.userId, brandId, Number(body?.days) || undefined);
  }

  @Post('api/v1/brands/:brandId/meta-ads/disconnect')
  @HttpCode(200)
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('strategy.paid.edit')
  disconnect(@Req() req: Request, @Param('brandId') brandId: string) {
    const c = ctx(req);
    return metaAdsService.disconnect(c.tenantId, c.userId, brandId);
  }
}
