import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { strategyMonthlyReviewService } from '../container';

function ctx(req: Request) {
  if (!req.oma?.tenantId) {
    throw new DomainError(
      'TENANT_REQUIRED',
      'Active tenant required',
      409,
      'errors.tenant_required',
    );
  }
  return { tenantId: req.oma.tenantId, userId: req.oma.userId! };
}

/** DEC-029 4.10: monthly review → new draft with an AI proposal (human accepts + approves). */
@Controller('api/v1/brands/:brandId')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class StrategyMonthlyReviewController {
  @Get('strategies/:strategyId/versions/:versionId/monthly-review')
  preview(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Query('month') month?: string,
  ) {
    return strategyMonthlyReviewService.preview(
      ctx(req).tenantId,
      brandId,
      strategyId,
      versionId,
      month,
    );
  }

  @Post('strategies/:strategyId/versions/:versionId/monthly-review')
  @UseGuards(CsrfGuard)
  run(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body() body: { month?: string },
  ) {
    const c = ctx(req);
    return strategyMonthlyReviewService.run(
      c.tenantId,
      c.userId,
      brandId,
      strategyId,
      versionId,
      body,
      { correlationId: req.oma?.correlationId },
    );
  }

  @Get('strategies/:strategyId/monthly-reviews')
  list(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
  ) {
    return strategyMonthlyReviewService.list(ctx(req).tenantId, brandId, strategyId);
  }
}
