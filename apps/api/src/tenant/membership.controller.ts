import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { tenantService } from '../container';
import { DomainError } from '@oma/domain';

@Controller('api/v1')
export class MembershipController {
  @Post('tenants/current/invitations')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('membership.invite')
  async invite(@Req() req: Request, @Body() body: { email: string }) {
    if (!req.oma?.userId || !req.oma.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    return tenantService.invite(
      req.oma.userId,
      req.oma.tenantId,
      body.email,
      req.oma.correlationId,
    );
  }

  @Post('invitations/accept')
  @UseGuards(AuthGuard, CsrfGuard)
  async accept(@Req() req: Request, @Body() body: { token: string }) {
    if (!req.oma?.userId)
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    return tenantService.acceptInvite(req.oma.userId, body.token);
  }

  @Post('memberships/:id/suspend')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('membership.manage')
  async suspend(@Req() req: Request) {
    const id = (req.params as { id: string }).id;
    return tenantService.suspendMembership(req.oma!.userId!, req.oma!.tenantId!, id);
  }

  @Post('memberships/:id/remove')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('membership.manage')
  async remove(@Req() req: Request) {
    const id = (req.params as { id: string }).id;
    return tenantService.removeMembership(req.oma!.userId!, req.oma!.tenantId!, id);
  }
}
