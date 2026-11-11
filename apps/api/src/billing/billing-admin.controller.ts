import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { requireSuperAdminOperator } from '../platform/platform-admin-auth';
import { billingService } from './billing.service';

@Controller()
@UseGuards(AuthGuard)
export class BillingAdminController {
  @Get('api/v1/admin/billing/workspaces')
  async workspaces(@Req() req: Request, @Query('q') q?: string) {
    await requireSuperAdminOperator(req);
    return billingService.adminListWorkspaces(q);
  }

  @Get('api/v1/admin/billing/orders')
  async orders(@Req() req: Request, @Query('status') status?: string) {
    await requireSuperAdminOperator(req);
    return billingService.adminListOrders(status);
  }

  @Get('api/v1/admin/billing/orders/:id/receipt')
  async receipt(@Req() req: Request, @Param('id') id: string) {
    await requireSuperAdminOperator(req);
    return billingService.adminGetOrderReceipt(id);
  }

  @Get('api/v1/admin/billing/settings')
  async settings(@Req() req: Request) {
    await requireSuperAdminOperator(req);
    return billingService.getSettings();
  }

  @Patch('api/v1/admin/billing/settings')
  @UseGuards(CsrfGuard)
  async updateSettings(
    @Req() req: Request,
    @Body()
    body: {
      vat_rate_bps?: number;
      grace_period_days?: number;
      trial_days?: number;
      x_api_addon_monthly_usd_cents?: number;
      bank_instructions_en?: string;
      bank_instructions_ar?: string;
    },
  ) {
    const actor = await requireSuperAdminOperator(req);
    return billingService.updateSettings(actor, body ?? {});
  }

  @Post('api/v1/admin/billing/workspaces/:tenantId/activate')
  @UseGuards(CsrfGuard)
  async activate(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      plan_code?: string;
      billing_cycle?: string;
      days?: number;
      reference?: string;
      note?: string;
      x_api_addon?: boolean;
    },
  ) {
    const actor = await requireSuperAdminOperator(req);
    if (!body?.plan_code) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'plan_code required',
        400,
        'errors.validation_failed',
      );
    }
    return billingService.adminActivate(tenantId, actor, {
      plan_code: body.plan_code,
      billing_cycle: body.billing_cycle,
      days: body.days,
      reference: body.reference,
      note: body.note,
      x_api_addon: body.x_api_addon,
    });
  }

  @Post('api/v1/admin/billing/workspaces/:tenantId/extend')
  @UseGuards(CsrfGuard)
  async extend(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Body() body: { days?: number; note?: string },
  ) {
    const actor = await requireSuperAdminOperator(req);
    return billingService.adminExtend(tenantId, actor, {
      days: Number(body?.days ?? 0),
      note: body?.note,
    });
  }

  @Post('api/v1/admin/billing/workspaces/:tenantId/cancel')
  @UseGuards(CsrfGuard)
  async cancel(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Body() body: { note?: string },
  ) {
    const actor = await requireSuperAdminOperator(req);
    return billingService.adminCancel(tenantId, actor, { note: body?.note });
  }

  @Post('api/v1/admin/billing/orders/:id/approve')
  @UseGuards(CsrfGuard)
  async approve(@Req() req: Request, @Param('id') id: string, @Body() body: { note?: string }) {
    const actor = await requireSuperAdminOperator(req);
    return billingService.adminReviewOrder(id, actor, 'approve', body?.note);
  }

  @Post('api/v1/admin/billing/orders/:id/reject')
  @UseGuards(CsrfGuard)
  async reject(@Req() req: Request, @Param('id') id: string, @Body() body: { note?: string }) {
    const actor = await requireSuperAdminOperator(req);
    return billingService.adminReviewOrder(id, actor, 'reject', body?.note);
  }
}
