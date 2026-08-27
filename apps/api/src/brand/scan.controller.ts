import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
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
import { scanService } from '../container';

@Controller('api/v1/brands/:brandId/scans')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class ScanController {
  @Post()
  @HttpCode(202)
  @UseGuards(CsrfGuard)
  async start(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: { trigger?: string; config?: Record<string, number> },
  ) {
    this.requireTenant(req);
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Idempotency-Key required',
        400,
        'errors.validation_failed',
      );
    }
    return scanService.start(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      body,
      idempotencyKey,
      req.oma!.correlationId,
    );
  }

  @Get()
  async list(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    this.requireTenant(req);
    return scanService.list(req.oma!.tenantId!, brandId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      status,
    });
  }

  @Get(':scanId')
  async get(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('scanId') scanId: string,
  ) {
    this.requireTenant(req);
    return scanService.get(req.oma!.tenantId!, brandId, scanId);
  }

  @Post(':scanId/cancel')
  @UseGuards(CsrfGuard)
  async cancel(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('scanId') scanId: string,
    @Body() _body: { reason?: string },
  ) {
    this.requireTenant(req);
    return scanService.cancel(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      scanId,
      req.oma!.correlationId,
    );
  }

  @Post(':scanId/retry')
  @HttpCode(202)
  @UseGuards(CsrfGuard)
  async retry(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('scanId') scanId: string,
    @Body() body: { config?: Record<string, number> },
  ) {
    this.requireTenant(req);
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Idempotency-Key required',
        400,
        'errors.validation_failed',
      );
    }
    return scanService.retry(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      scanId,
      body,
      idempotencyKey,
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
