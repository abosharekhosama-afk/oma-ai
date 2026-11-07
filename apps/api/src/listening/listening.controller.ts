import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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
  listRules(@Req() req: Request, @Query('brandId') brandId?: string) {
    return listeningService.listRules(ctx(req).tenantId, brandId || undefined);
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

  @Get('api/v1/listening/stats')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  stats(
    @Req() req: Request,
    @Query('ruleId') ruleId?: string,
    @Query('brandId') brandId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('platforms') platforms?: string,
  ) {
    const platformList = platforms ? platforms.split(',').filter(Boolean) : undefined;
    return listeningService.stats(ctx(req).tenantId, {
      ruleId,
      brandId,
      from,
      to,
      platforms: platformList,
    });
  }

  @Get('api/v1/listening/hits')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  listHits(
    @Req() req: Request,
    @Query('ruleId') ruleId?: string,
    @Query('brandId') brandId?: string,
    @Query('sentiment') sentiment?: string,
    @Query('highPriorityOnly') highPriorityOnly?: string,
    @Query('platforms') platforms?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
    @Query('includeHidden') includeHidden?: string,
    @Query('includeExcluded') includeExcluded?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const platformList = platforms ? platforms.split(',').filter(Boolean) : undefined;
    const sortKey =
      sort === 'engagement' || sort === 'recency' || sort === 'relevance' ? sort : 'relevance';
    return listeningService.listHits(ctx(req).tenantId, {
      ruleId,
      brandId,
      sentiment,
      highPriorityOnly: highPriorityOnly === '1' || highPriorityOnly === 'true',
      platforms: platformList,
      from,
      to,
      q,
      sort: sortKey,
      includeHidden: includeHidden === '1' || includeHidden === 'true',
      includeExcluded: includeExcluded === '1' || includeExcluded === 'true',
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 100,
    });
  }

  @Patch('api/v1/listening/hits/:id')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  patchHit(@Req() req: Request, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return listeningService.updateHit(ctx(req).tenantId, id, body as never);
  }

  @Post('api/v1/listening/sync')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  sync(@Req() req: Request, @Body() body: { ruleId?: string; brandId?: string | null }) {
    return listeningService.requestSync(ctx(req).tenantId, body);
  }

  @Get('api/v1/listening/competitors')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  competitors(
    @Req() req: Request,
    @Query('brandId') brandId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('platforms') platforms?: string,
  ) {
    const platformList = platforms ? platforms.split(',').filter(Boolean) : undefined;
    return listeningService.competitorDashboard(ctx(req).tenantId, {
      brandId,
      from,
      to,
      platforms: platformList,
    });
  }

  @Get('api/v1/listening/alerts')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  listAlerts(@Req() req: Request, @Query('brandId') brandId?: string) {
    return listeningService.listAlerts(ctx(req).tenantId, brandId || undefined);
  }

  @Post('api/v1/listening/alerts')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  createAlert(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return listeningService.createAlert(ctx(req).tenantId, body as never);
  }

  @Patch('api/v1/listening/alerts/:id')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  updateAlert(@Req() req: Request, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return listeningService.updateAlert(ctx(req).tenantId, id, body as never);
  }

  @Delete('api/v1/listening/alerts/:id')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  deleteAlert(@Req() req: Request, @Param('id') id: string) {
    return listeningService.deleteAlert(ctx(req).tenantId, id);
  }
}
