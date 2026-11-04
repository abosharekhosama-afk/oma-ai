import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError, hasCapability } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { billingService } from './billing.service';

@Controller()
@UseGuards(AuthGuard, CapabilitiesGuard)
export class BillingController {
  private requireTenant(req: Request) {
    if (!req.oma?.tenantId) {
      throw new DomainError('TENANT_REQUIRED', 'Tenant required', 403, 'errors.tenant_required');
    }
    return req.oma.tenantId;
  }

  @Get('api/v1/billing/plans')
  async plans(@Req() req: Request) {
    this.requireTenant(req);
    return { data: await billingService.listPlans(), payment_coming_soon: true };
  }

  @Get('api/v1/billing/subscription')
  async subscription(@Req() req: Request) {
    const tenantId = this.requireTenant(req);
    return billingService.getSubscriptionView(tenantId);
  }

  /** Manual plan change — workspace owner/admin (tenant.manage) or platform support. */
  @Patch('api/v1/billing/subscription')
  @UseGuards(CsrfGuard)
  @RequireCapabilities('tenant.manage')
  async changePlan(
    @Req() req: Request,
    @Body() body: { plan_code?: string; billing_cycle?: string; notes?: string },
  ) {
    const tenantId = this.requireTenant(req);
    const caps = req.oma!.capabilities ?? [];
    if (!hasCapability(caps, 'tenant.manage') && !hasCapability(caps, 'platform.support.access')) {
      throw new DomainError(
        'PERMISSION_DENIED',
        'Only workspace admins can change the plan',
        403,
        'errors.permission_denied',
      );
    }
    if (!body?.plan_code) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'plan_code required',
        400,
        'errors.validation_failed',
      );
    }
    return billingService.changePlan(tenantId, req.oma!.userId!, {
      plan_code: body.plan_code,
      billing_cycle: body.billing_cycle,
      notes: body.notes,
    });
  }

  /** Upgrade CTA — creates a contact/request instead of charging (payment deferred). */
  @Post('api/v1/billing/upgrade-requests')
  @UseGuards(CsrfGuard)
  async requestUpgrade(
    @Req() req: Request,
    @Body() body: { plan_code?: string; billing_cycle?: string; note?: string },
  ) {
    const tenantId = this.requireTenant(req);
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
  @RequireCapabilities('tenant.manage')
  async listRequests(@Req() req: Request) {
    const tenantId = this.requireTenant(req);
    return billingService.listUpgradeRequests(tenantId);
  }
}
