import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { DomainError } from '@oma/domain';
import { catalogService, discoveryService, evidenceService } from '../container';

@Controller('api/v1/brands/:brandId')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class DiscoveryController {
  @Get('scans/:scanId/pages')
  async pages(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('scanId') scanId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('classification') classification?: string,
    @Query('fetch_status') fetch_status?: string,
  ) {
    this.requireTenant(req);
    return discoveryService.listPages(req.oma!.tenantId!, brandId, scanId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      classification,
      fetch_status,
    });
  }

  @Get('scans/:scanId/products')
  async products(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('scanId') scanId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('kind') kind?: string,
  ) {
    this.requireTenant(req);
    return discoveryService.listProducts(req.oma!.tenantId!, brandId, scanId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      kind,
    });
  }

  @Post('scans/:scanId/catalog/reimport-media')
  @UseGuards(CsrfGuard)
  async reimportCatalogMedia(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('scanId') scanId: string,
  ) {
    this.requireTenant(req);
    return catalogService.reimportScanMedia(req.oma!.tenantId!, brandId, scanId);
  }

  @Get('scans/:scanId/evidence')
  async evidenceList(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('scanId') scanId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.requireTenant(req);
    return discoveryService.listEvidence(req.oma!.tenantId!, brandId, scanId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('evidence/:evidenceId')
  async evidenceGet(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    this.requireTenant(req);
    return evidenceService.get(req.oma!.tenantId!, brandId, evidenceId);
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
  }
}
