import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { DomainError } from '@oma/domain';
import { brandService } from '../container';

@Controller('api/v1/brands')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class BrandController {
  @Get()
  async list(
    @Req() req: Request,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    this.requireTenant(req);
    return brandService.list(req.oma!.tenantId!, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      status,
      q,
    });
  }

  @Post()
  @UseGuards(CsrfGuard)
  async create(@Req() req: Request, @Body() body: { name: string }) {
    this.requireTenant(req);
    return brandService.create(req.oma!.tenantId!, req.oma!.userId!, body, req.oma!.correlationId);
  }

  @Get(':brandId')
  async get(@Req() req: Request, @Param('brandId') brandId: string) {
    this.requireTenant(req);
    return brandService.get(req.oma!.tenantId!, brandId);
  }

  @Patch(':brandId')
  @UseGuards(CsrfGuard)
  async patch(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: { name?: string; version: number },
    @Headers('if-match') ifMatch?: string,
  ) {
    this.requireTenant(req);
    const version = body.version ?? Number(ifMatch?.replace(/"/g, ''));
    return brandService.patch(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      { ...body, version },
      req.oma!.correlationId,
    );
  }

  @Post(':brandId/archive')
  @UseGuards(CsrfGuard)
  async archive(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: { version: number; reason?: string },
  ) {
    this.requireTenant(req);
    return brandService.archive(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      body,
      req.oma!.correlationId,
    );
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
