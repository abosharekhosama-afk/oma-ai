import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError, hasCapability } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { billingService } from './billing.service';

function requireTenant(req: Request) {
  if (!req.oma?.tenantId) {
    throw new DomainError('TENANT_REQUIRED', 'Tenant required', 403, 'errors.tenant_required');
  }
  return req.oma.tenantId;
}

function requireBillingManage(req: Request) {
  const caps = req.oma?.capabilities ?? [];
  if (!hasCapability(caps, 'billing.manage') && !hasCapability(caps, 'platform.support.access')) {
    throw new DomainError(
      'PERMISSION_DENIED',
      'Only the workspace owner or billing role can change billing',
      403,
      'errors.permission_denied',
    );
  }
}

@Controller()
@UseGuards(AuthGuard, CapabilitiesGuard)
export class BillingController {
  @Get('api/v1/billing/plans')
  async plans(@Req() req: Request) {
    requireTenant(req);
    return { data: await billingService.listPlans() };
  }

  @Get('api/v1/billing/providers')
  async providers(@Req() req: Request) {
    requireTenant(req);
    const view = await billingService.getSubscriptionView(requireTenant(req));
    return { data: view.data.providers };
  }

  @Get('api/v1/billing/subscription')
  async subscription(@Req() req: Request) {
    return billingService.getSubscriptionView(requireTenant(req));
  }

  @Get('api/v1/billing/invoices')
  async invoices(@Req() req: Request) {
    const view = await billingService.getSubscriptionView(requireTenant(req));
    return { data: view.data.invoices };
  }

  @Get('api/v1/billing/entitlements')
  async entitlements(@Req() req: Request) {
    const view = await billingService.getSubscriptionView(requireTenant(req));
    return {
      data: {
        plan_code: view.data.plan_code,
        status: view.data.status,
        features: view.data.plan.features,
        limits: view.data.plan.limits,
        x_api_addon: view.data.x_api_addon,
        payment_configured: view.data.payment_configured,
        cancel_at_period_end: view.data.cancel_at_period_end,
      },
    };
  }

  @Post('api/v1/billing/upgrade-requests')
  @UseGuards(CsrfGuard)
  async requestUpgrade(
    @Req() req: Request,
    @Body() body: { plan_code?: string; billing_cycle?: string; note?: string },
  ) {
    const tenantId = requireTenant(req);
    if (!body?.plan_code) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'plan_code required',
        400,
        'errors.validation_failed',
      );
    }
    return billingService.requestUpgrade(tenantId, req.oma!.userId!, {
      plan_code: body.plan_code,
      billing_cycle: body.billing_cycle,
      note: body.note,
    });
  }

  @Get('api/v1/billing/upgrade-requests')
  async listRequests(@Req() req: Request) {
    requireBillingManage(req);
    return billingService.listUpgradeRequests(requireTenant(req));
  }

  @Post('api/v1/billing/checkouts')
  @UseGuards(CsrfGuard)
  async startCheckout(
    @Req() req: Request,
    @Body()
    body: {
      plan_code?: string;
      billing_cycle?: string;
      provider?: string;
      x_api_addon?: boolean;
      note?: string;
    },
  ) {
    requireBillingManage(req);
    const tenantId = requireTenant(req);
    if (!body?.plan_code) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'plan_code required',
        400,
        'errors.validation_failed',
      );
    }
    return billingService.startCheckout(tenantId, req.oma!.userId!, {
      plan_code: body.plan_code,
      billing_cycle: body.billing_cycle,
      provider: body.provider,
      x_api_addon: body.x_api_addon,
      note: body.note,
    });
  }

  @Get('api/v1/billing/checkouts')
  async listCheckouts(@Req() req: Request) {
    return billingService.listCheckouts(requireTenant(req));
  }

  @Post('api/v1/billing/checkouts/:id/cancel')
  @UseGuards(CsrfGuard)
  async cancelCheckout(@Req() req: Request, @Param('id') id: string) {
    requireBillingManage(req);
    return billingService.cancelCheckout(requireTenant(req), req.oma!.userId!, id);
  }

  @Post('api/v1/billing/manual-orders/proof')
  @UseGuards(CsrfGuard)
  async submitProof(
    @Req() req: Request,
    @Body()
    body: {
      reference?: string;
      order_id?: string;
      proof_note?: string;
      proof_file_name?: string;
      proof_mime?: string;
    },
  ) {
    requireBillingManage(req);
    return billingService.submitManualProof(requireTenant(req), req.oma!.userId!, body ?? {});
  }

  @Post('api/v1/billing/portal')
  @UseGuards(CsrfGuard)
  async portal(@Req() req: Request) {
    requireBillingManage(req);
    return billingService.createPortal(requireTenant(req));
  }

  @Post('api/v1/billing/confirm')
  @UseGuards(CsrfGuard)
  async confirm(@Req() req: Request, @Body() body: { provider?: string; reference?: string }) {
    requireBillingManage(req);
    if (body?.provider !== 'lahza' || !body.reference) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'provider and reference required',
        400,
        'errors.validation_failed',
      );
    }
    return billingService.confirmLahza(requireTenant(req), body.reference);
  }

  @Post('api/v1/billing/subscription/cancel')
  @UseGuards(CsrfGuard)
  async cancelAtPeriodEnd(@Req() req: Request) {
    requireBillingManage(req);
    return billingService.setCancelAtPeriodEnd(requireTenant(req), true);
  }

  @Post('api/v1/billing/subscription/resume')
  @UseGuards(CsrfGuard)
  async resume(@Req() req: Request) {
    requireBillingManage(req);
    return billingService.setCancelAtPeriodEnd(requireTenant(req), false);
  }
}
