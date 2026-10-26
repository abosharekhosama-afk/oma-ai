import {
  Body,
  Controller,
  Delete,
  Get,
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
import { socialService } from '../container';

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
export class SocialController {
  @Get('api/v1/brands/:brandId/social-pages')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  list(@Req() req: Request, @Param('brandId') brandId: string) {
    return socialService.list(ctx(req).tenantId, brandId);
  }

  @Post('api/v1/brands/:brandId/social-pages/oauth/:network/start')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  start(@Req() req: Request, @Param('brandId') brandId: string, @Param('network') network: string) {
    const c = ctx(req);
    return socialService.start(c.tenantId, c.userId, brandId, network);
  }

  /** Browser lands here from the network; validated by the single-use state + session user. */
  @Get('api/v1/social/oauth/:network/callback')
  @UseGuards(AuthGuard)
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Param('network') network: string,
    @Query() q: { code?: string; state?: string; error?: string },
  ) {
    const url = await socialService.callback(
      { tenantId: req.oma?.tenantId, userId: req.oma?.userId },
      network,
      q,
    );
    res.redirect(302, url);
  }

  @Delete('api/v1/social-pages/:pageId')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  disconnect(@Req() req: Request, @Param('pageId') pageId: string) {
    const c = ctx(req);
    return socialService.disconnect(c.tenantId, c.userId, pageId);
  }

  @Post('api/v1/content/:contentId/publish-target')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  target(@Req() req: Request, @Param('contentId') contentId: string, @Body() body: unknown) {
    return socialService.setPublishTarget(ctx(req).tenantId, contentId, body);
  }
}
