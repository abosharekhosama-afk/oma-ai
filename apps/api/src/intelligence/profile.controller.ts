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
import { approvalService, insightService, profileService } from '../container';

@Controller('api/v1/brands/:brandId')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class ProfileController {
  @Get('profiles')
  async list(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.requireTenant(req);
    return profileService.list(req.oma!.tenantId!, brandId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('profiles/:versionId')
  async get(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('versionId') versionId: string,
  ) {
    this.requireTenant(req);
    return profileService.get(req.oma!.tenantId!, brandId, versionId);
  }

  @Get('profiles/:versionId/compare')
  async compare(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('versionId') versionId: string,
    @Query('against') against?: string,
  ) {
    this.requireTenant(req);
    return profileService.compare(req.oma!.tenantId!, brandId, versionId, against);
  }

  @Patch('profiles/:versionId')
  @UseGuards(CsrfGuard)
  async patch(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('versionId') versionId: string,
    @Body()
    body: {
      row_version: number;
      sections?: Record<string, unknown>;
      insights?: { id: string; text_value?: string }[];
    },
    @Headers('if-match') ifMatch?: string,
  ) {
    this.requireTenant(req);
    const row_version = body.row_version ?? Number(ifMatch?.replace(/"/g, ''));
    return profileService.patch(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      versionId,
      { ...body, row_version },
      req.oma!.correlationId,
    );
  }

  @Post('profiles/:versionId/approve')
  @UseGuards(CsrfGuard)
  async approve(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('versionId') versionId: string,
    @Body()
    body: {
      row_version: number;
      acknowledge_incomplete: boolean;
      confirm_summary: boolean;
      reason?: string;
    },
  ) {
    this.requireTenant(req);
    return approvalService.approve(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      versionId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('profiles/:versionId/reject')
  @UseGuards(CsrfGuard)
  async reject(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('versionId') versionId: string,
    @Body() body: { row_version: number; reason?: string },
  ) {
    this.requireTenant(req);
    return approvalService.reject(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      versionId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('insights/:insightId/accept')
  @UseGuards(CsrfGuard)
  async acceptInsight(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('insightId') insightId: string,
    @Body() body: { row_version: number },
  ) {
    this.requireTenant(req);
    return insightService.accept(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      insightId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('insights/:insightId/reject')
  @UseGuards(CsrfGuard)
  async rejectInsight(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('insightId') insightId: string,
    @Body() body: { row_version: number },
  ) {
    this.requireTenant(req);
    return insightService.reject(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      insightId,
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
