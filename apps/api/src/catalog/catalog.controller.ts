import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { catalogService } from '../container';

type GenerateBody = { kind?: string };
type ReviewBody = { decision?: string };

@Controller('api/v1/brands/:brandId')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class CatalogController {
  @Get('catalog/products/:productId/media')
  async listMedia(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('productId') productId: string,
  ) {
    const tenantId = this.requireTenant(req);
    return catalogService.listProductMedia(tenantId, brandId, productId);
  }

  @Post('catalog/products/:productId/generate')
  @UseGuards(CsrfGuard)
  async generate(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('productId') productId: string,
    @Body() body: GenerateBody,
  ) {
    const tenantId = this.requireTenant(req);
    const userId = req.oma?.userId;
    if (!userId) {
      throw new DomainError('UNAUTHENTICATED', 'Sign in required', 401, 'errors.unauthenticated');
    }
    const kind = body.kind;
    if (kind !== 'image' && kind !== 'video' && kind !== 'short_video') {
      throw new DomainError('VALIDATION_FAILED', 'Invalid kind', 400, 'errors.validation_failed');
    }
    return catalogService.generate(tenantId, brandId, productId, kind, userId);
  }

  @Post('catalog/media/:linkId/review')
  @UseGuards(CsrfGuard)
  async reviewMedia(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('linkId') linkId: string,
    @Body() body: ReviewBody,
  ) {
    const tenantId = this.requireTenant(req);
    const userId = req.oma?.userId;
    if (!userId) {
      throw new DomainError('UNAUTHENTICATED', 'Sign in required', 401, 'errors.unauthenticated');
    }
    const decision = body.decision;
    if (decision !== 'approve' && decision !== 'reject') {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Invalid decision',
        400,
        'errors.validation_failed',
      );
    }
    return catalogService.reviewMediaLink(tenantId, brandId, linkId, decision, userId);
  }

  private requireTenant(req: Request): string {
    if (!req.oma?.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    return req.oma.tenantId;
  }
}
