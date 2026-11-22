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
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { paidExecutionService } from '../container';

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

/** DEC-029 4.7: paid execution (flights → campaigns, experiments, spend). */
@Controller('api/v1/brands/:brandId')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class PaidExecutionController {
  @Get('strategies/:strategyId/versions/:versionId/paid-execution')
  execution(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
  ) {
    return paidExecutionService.execution(ctx(req).tenantId, brandId, strategyId, versionId);
  }

  @Post('strategies/:strategyId/versions/:versionId/paid-flights/campaigns')
  @UseGuards(CsrfGuard)
  materialize(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
  ) {
    const c = ctx(req);
    return paidExecutionService.materializeFlights(
      c.tenantId,
      c.userId,
      brandId,
      strategyId,
      versionId,
    );
  }

  @Post('strategies/:strategyId/versions/:versionId/experiments/:experimentId/status')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  updateExperiment(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Param('experimentId') experimentId: string,
    @Body() body: unknown,
  ) {
    const c = ctx(req);
    return paidExecutionService.updateExperiment(
      c.tenantId,
      c.userId,
      brandId,
      strategyId,
      versionId,
      experimentId,
      body,
    );
  }

  @Get('strategies/:strategyId/versions/:versionId/experiments/:experimentId/history')
  experimentHistory(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Param('experimentId') experimentId: string,
  ) {
    return paidExecutionService.experimentHistory(
      ctx(req).tenantId,
      brandId,
      strategyId,
      versionId,
      experimentId,
    );
  }

  @Get('paid-spend')
  @RequireCapabilities('analytics.read')
  listSpend(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return paidExecutionService.listSpend(ctx(req).tenantId, brandId, from, to);
  }

  @Post('paid-spend')
  @RequireCapabilities('strategy.paid.edit')
  @UseGuards(CsrfGuard)
  recordSpend(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: unknown) {
    const c = ctx(req);
    return paidExecutionService.recordSpend(c.tenantId, c.userId, brandId, body);
  }

  @Post('paid-spend/import')
  @RequireCapabilities('strategy.paid.edit')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  importSpend(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: { csv?: string; platform?: string; currency?: string; dry_run?: boolean },
  ) {
    const c = ctx(req);
    return paidExecutionService.importSpendCsv(c.tenantId, c.userId, brandId, body ?? {});
  }
}
