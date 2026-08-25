import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { tenantService } from '../container';

@Controller('api/v1')
export class CapabilityController {
  @Post('memberships/:id/capabilities')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('capability.assign')
  async caps(@Req() req: Request, @Body() body: { codes: string[] }) {
    const id = (req.params as { id: string }).id;
    return tenantService.assignCapabilities(req.oma!.userId!, req.oma!.tenantId!, id, body.codes);
  }

  @Post('memberships/:id/profiles')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('capability.assign')
  async profiles(@Req() req: Request, @Body() body: { profile_code: string }) {
    const id = (req.params as { id: string }).id;
    return tenantService.attachProfile(req.oma!.userId!, req.oma!.tenantId!, id, body.profile_code);
  }
}
