import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { DomainError } from '@oma/domain';
import { websiteSourceService } from '../container';

@Controller('api/v1/brands/:brandId/website')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class WebsiteController {
  @Post()
  @UseGuards(CsrfGuard)
  async connect(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: { url: string; authorization_attested: boolean; version: number },
  ) {
    this.requireTenant(req);
    return websiteSourceService.connect(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      body,
      req.oma!.correlationId,
    );
  }

  @Get()
  async get(@Req() req: Request, @Param('brandId') brandId: string) {
    this.requireTenant(req);
    return websiteSourceService.get(req.oma!.tenantId!, brandId);
  }

  private requireTenant(req: Request) {
    if (!req.oma?.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    if (!req.oma?.userId) {
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    }
  }
}
