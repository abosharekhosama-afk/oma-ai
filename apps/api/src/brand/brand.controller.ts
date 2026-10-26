import {
  Body,
  Controller,
  Delete,
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
import { brandAdminService, brandService } from '../container';
import { parseBrandSettings } from './brand-input';
import { unschedulePendingPosts } from './brand.service';

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
    const res = await brandService.get(req.oma!.tenantId!, brandId);
    const access = req.brandAccess;
    // Effective access on this brand (capabilities already narrowed by the brand role).
    return {
      data: {
        ...res.data,
        access: {
          role: !access || access.all ? 'WORKSPACE_ADMIN' : (access.roles.get(brandId) ?? null),
          capabilities: req.oma!.capabilities ?? [],
        },
      },
    };
  }

  @Patch(':brandId')
  @UseGuards(CsrfGuard)
  async patch(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: unknown,
    @Headers('if-match') ifMatch?: string,
  ) {
    this.requireTenant(req);
    return brandService.patch(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      parseBrandSettings(body, ifMatch),
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

  @Post(':brandId/unarchive')
  @UseGuards(CsrfGuard)
  async unarchive(@Req() req: Request, @Param('brandId') brandId: string) {
    this.requireTenant(req);
    return brandAdminService.unarchive(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      req.oma!.correlationId,
    );
  }

  @Get('-/deleted')
  async deleted(@Req() req: Request) {
    this.requireTenant(req);
    return brandAdminService.listDeleted(req.oma!.tenantId!);
  }

  @Delete(':brandId')
  @UseGuards(CsrfGuard)
  async remove(@Req() req: Request, @Param('brandId') brandId: string) {
    this.requireTenant(req);
    const tenantId = req.oma!.tenantId!;
    return brandAdminService.softDelete(
      tenantId,
      req.oma!.userId!,
      brandId,
      (tx) => unschedulePendingPosts(tx, tenantId, brandId),
      req.oma!.correlationId,
    );
  }

  @Post(':brandId/restore')
  @UseGuards(CsrfGuard)
  async restore(@Req() req: Request, @Param('brandId') brandId: string) {
    this.requireTenant(req);
    return brandAdminService.restore(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      req.oma!.correlationId,
    );
  }

  @Post(':brandId/purge')
  @UseGuards(CsrfGuard)
  async purge(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: { confirm_name?: unknown },
  ) {
    this.requireTenant(req);
    return brandAdminService.purge(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      body?.confirm_name,
      req.oma!.correlationId,
    );
  }

  @Get(':brandId/members')
  async members(@Req() req: Request, @Param('brandId') brandId: string) {
    this.requireTenant(req);
    return brandAdminService.listMembers(req.oma!.tenantId!, brandId);
  }

  @Post(':brandId/members')
  @UseGuards(CsrfGuard)
  async addMember(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: unknown) {
    this.requireTenant(req);
    return brandAdminService.addMember(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      body,
      req.oma!.correlationId,
    );
  }

  @Patch(':brandId/members/:userId')
  @UseGuards(CsrfGuard)
  async updateMember(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ) {
    this.requireTenant(req);
    return brandAdminService.updateMember(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      userId,
      body,
      req.oma!.correlationId,
    );
  }

  @Delete(':brandId/members/:userId')
  @UseGuards(CsrfGuard)
  async removeMember(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('userId') userId: string,
  ) {
    this.requireTenant(req);
    return brandAdminService.removeMember(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      userId,
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
