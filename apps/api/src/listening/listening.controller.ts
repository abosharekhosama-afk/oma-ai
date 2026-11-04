import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { listeningService } from './listening.service';

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

@Controller()
export class ListeningController {
  @Get('api/v1/listening/rules')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  listRules(@Req() req: Request) {
    return listeningService.listRules(ctx(req).tenantId);
  }

  @Post('api/v1/listening/rules')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  createRule(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return listeningService.createRule(ctx(req).tenantId, body as never);
  }

  @Post('api/v1/listening/rules/:id')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  updateRule(@Req() req: Request, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return listeningService.updateRule(ctx(req).tenantId, id, body as never);
  }

  @Delete('api/v1/listening/rules/:id')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  deleteRule(@Req() req: Request, @Param('id') id: string) {
    return listeningService.deleteRule(ctx(req).tenantId, id);
  }

  @Get('api/v1/listening/hits')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  listHits(
    @Req() req: Request,
    @Query('ruleId') ruleId?: string,
    @Query('sentiment') sentiment?: string,
    @Query('highPriorityOnly') highPriorityOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return listeningService.listHits(ctx(req).tenantId, {
      ruleId,
      sentiment,
      highPriorityOnly: highPriorityOnly === '1' || highPriorityOnly === 'true',
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 40,
    });
  }
}
