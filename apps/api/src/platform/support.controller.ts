import {
  Body,
  Controller,
  Delete,
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
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { SupportGuard } from '../common/guards/support.guard';
import { supportService } from '../container';
import { ensureCsrfCookie, setSessionCookie } from '../identity/session-cookie';
import { requireSupportOperator } from './support-auth';

@Controller('api/v1/support')
@UseGuards(AuthGuard, SupportGuard)
export class SupportController {
  @Get('health')
  health() {
    return { ok: true, surface: 'platform-support' };
  }

  @Get('lookup')
  async lookup(
    @Query('q') q: string,
    @Query('type') type?: string,
    @Query('tenant_id') tenantId?: string,
  ) {
    return supportService.lookup({ q, type, tenant_id: tenantId });
  }

  @Get('tenants/:tenantId/social')
  tenantSocial(@Param('tenantId') tenantId: string) {
    return supportService.tenantSocial(tenantId);
  }

  @Get('tenants/:tenantId/storage')
  tenantStorage(@Param('tenantId') tenantId: string) {
    return supportService.tenantStorage(tenantId);
  }

  @Get('publishing/failures')
  publishingFailures(@Query('tenant_id') tenantId?: string, @Query('limit') limit?: string) {
    return supportService.publishingFailures({
      tenant_id: tenantId?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('publishing/:publishTargetId/retry')
  @UseGuards(CsrfGuard)
  @HttpCode(200)
  async retryPublish(@Req() req: Request, @Param('publishTargetId') publishTargetId: string) {
    const actor = await requireSupportOperator(req);
    return supportService.retryPublishTarget(actor, publishTargetId, req.oma?.correlationId);
  }

  @Post('impersonate')
  @UseGuards(CsrfGuard)
  @HttpCode(201)
  async startImpersonation(
    @Req() req: Request,
    @Body() body: { target_user_id: string; tenant_id: string; reason: string },
  ) {
    const actor = await requireSupportOperator(req);
    return supportService.startImpersonation(actor, body, req.oma?.correlationId);
  }

  @Post('impersonate/:impersonationId/assume')
  @UseGuards(CsrfGuard)
  async assumeImpersonation(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('impersonationId') impersonationId: string,
  ) {
    const actor = await requireSupportOperator(req);
    const result = await supportService.assumeImpersonation(actor, impersonationId, {
      ip: req.ip,
      userAgent: req.header('user-agent') ?? undefined,
      correlationId: req.oma?.correlationId,
    });
    setSessionCookie(res, result.token);
    ensureCsrfCookie(req, res);
    const origin = process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3000';
    return {
      data: {
        redirect_url: `${origin}${result.redirect_path}`,
        tenant_id: result.tenant_id,
      },
    };
  }

  @Delete('impersonate/:impersonationId')
  @UseGuards(CsrfGuard)
  async endImpersonation(
    @Req() req: Request,
    @Param('impersonationId') impersonationId: string,
    @Body() body?: { reason?: string },
  ) {
    const actor = await requireSupportOperator(req);
    return supportService.endImpersonation(
      actor,
      impersonationId,
      body?.reason,
      req.oma?.correlationId,
    );
  }
}
