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
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { DomainError } from '@oma/domain';
import { strategyService } from '../container';

@Controller('api/v1/brands/:brandId')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class StrategyController {
  private requireTenant(req: Request) {
    if (!req.oma?.tenantId) {
      throw new DomainError('TENANT_REQUIRED', 'Active tenant required', 400, 'errors.tenant_required');
    }
  }

  @Get('strategies')
  async list(@Req() req: Request, @Param('brandId') brandId: string) {
    this.requireTenant(req);
    return strategyService.list(req.oma!.tenantId!, brandId);
  }

  @Post('strategies')
  @UseGuards(CsrfGuard)
  async create(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body()
    body: {
      name: string;
      linked_approved_profile_version_id?: string | null;
      draft_profile_version_id?: string | null;
      organic_enabled?: boolean;
      paid_enabled?: boolean;
    },
  ) {
    this.requireTenant(req);
    return strategyService.create(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      body,
      req.oma!.correlationId,
    );
  }

  @Get('strategies/:strategyId')
  async get(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
  ) {
    this.requireTenant(req);
    return strategyService.get(req.oma!.tenantId!, brandId, strategyId);
  }

  @Patch('strategies/:strategyId')
  @UseGuards(CsrfGuard)
  async patch(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Body() body: { name?: string; version: number },
  ) {
    this.requireTenant(req);
    return strategyService.patch(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('strategies/:strategyId/archive')
  @UseGuards(CsrfGuard)
  async archive(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Body() body: { version: number; reason?: string },
  ) {
    this.requireTenant(req);
    return strategyService.archive(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      body,
      req.oma!.correlationId,
    );
  }

  @Get('strategies/:strategyId/versions')
  async listVersions(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
  ) {
    this.requireTenant(req);
    return strategyService.listVersions(req.oma!.tenantId!, brandId, strategyId);
  }

  @Get('strategies/:strategyId/versions/compare')
  async compare(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Query('leftId') leftId: string,
    @Query('rightId') rightId: string,
  ) {
    this.requireTenant(req);
    return strategyService.compare(req.oma!.tenantId!, brandId, strategyId, leftId, rightId);
  }

  @Post('strategies/:strategyId/versions/from-approved')
  @UseGuards(CsrfGuard)
  async fromApproved(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Body() body: { source_version_id?: string },
  ) {
    this.requireTenant(req);
    return strategyService.fromApproved(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      body,
      req.oma!.correlationId,
    );
  }

  @Get('strategies/:strategyId/versions/:versionId')
  async getVersion(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
  ) {
    this.requireTenant(req);
    return strategyService.getVersion(req.oma!.tenantId!, brandId, strategyId, versionId);
  }

  @Patch('strategies/:strategyId/versions/:versionId')
  @UseGuards(CsrfGuard)
  async patchVersion(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body()
    body: {
      row_version: number;
      foundation?: Record<string, unknown>;
      unknowns_acknowledged?: boolean;
    },
  ) {
    this.requireTenant(req);
    return strategyService.patchVersion(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('strategies/:strategyId/versions/:versionId/link-profile')
  @UseGuards(CsrfGuard)
  async linkProfile(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body() body: { profile_version_id: string; role: 'approved' | 'draft_aid'; row_version: number },
  ) {
    this.requireTenant(req);
    return strategyService.linkProfile(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('strategies/:strategyId/versions/:versionId/tracks/enablement')
  @UseGuards(CsrfGuard)
  async enablement(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body()
    body: {
      row_version: number;
      organic_enabled: boolean;
      paid_enabled: boolean;
      organic_disabled_rationale?: string | null;
      paid_disabled_rationale?: string | null;
    },
  ) {
    this.requireTenant(req);
    return strategyService.setTrackEnablement(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      body,
      req.oma!.correlationId,
    );
  }

  @Patch('strategies/:strategyId/versions/:versionId/organic')
  @UseGuards(CsrfGuard)
  async patchOrganic(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body() body: Record<string, unknown> & { row_version: number },
  ) {
    this.requireTenant(req);
    return strategyService.patchOrganic(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      body,
      req.oma!.correlationId,
    );
  }

  @Patch('strategies/:strategyId/versions/:versionId/paid')
  @UseGuards(CsrfGuard)
  async patchPaid(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body() body: Record<string, unknown> & { row_version: number },
  ) {
    this.requireTenant(req);
    return strategyService.patchPaid(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('strategies/:strategyId/versions/:versionId/audiences')
  @UseGuards(CsrfGuard)
  async createAudience(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body() body: { name: string; description?: string; info_class?: string; sort_order?: number },
  ) {
    this.requireTenant(req);
    return strategyService.createAudience(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      body,
    );
  }

  @Delete('strategies/:strategyId/versions/:versionId/audiences/:audienceId')
  @UseGuards(CsrfGuard)
  async deleteAudience(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Param('audienceId') audienceId: string,
  ) {
    this.requireTenant(req);
    return strategyService.deleteAudience(
      req.oma!.tenantId!,
      brandId,
      strategyId,
      versionId,
      audienceId,
    );
  }

  @Post('strategies/:strategyId/versions/:versionId/competitors')
  @UseGuards(CsrfGuard)
  async createCompetitor(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body()
    body: {
      title: string;
      source_url?: string;
      source_note?: string;
      captured_at?: string;
      uncertainty?: string;
      info_class?: string;
    },
  ) {
    this.requireTenant(req);
    return strategyService.createCompetitor(
      req.oma!.tenantId!,
      brandId,
      strategyId,
      versionId,
      body,
    );
  }

  @Delete('strategies/:strategyId/versions/:versionId/competitors/:competitorId')
  @UseGuards(CsrfGuard)
  async deleteCompetitor(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Param('competitorId') competitorId: string,
  ) {
    this.requireTenant(req);
    return strategyService.deleteCompetitor(
      req.oma!.tenantId!,
      brandId,
      strategyId,
      versionId,
      competitorId,
    );
  }

  @Post('strategies/:strategyId/versions/:versionId/kpis')
  @UseGuards(CsrfGuard)
  async createKpi(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body()
    body: {
      name: string;
      target_value?: string;
      unit?: string;
      applies_to?: string;
      info_class?: string;
    },
  ) {
    this.requireTenant(req);
    return strategyService.createKpi(req.oma!.tenantId!, brandId, strategyId, versionId, body);
  }

  @Delete('strategies/:strategyId/versions/:versionId/kpis/:kpiId')
  @UseGuards(CsrfGuard)
  async deleteKpi(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Param('kpiId') kpiId: string,
  ) {
    this.requireTenant(req);
    return strategyService.deleteKpi(req.oma!.tenantId!, brandId, strategyId, versionId, kpiId);
  }

  @Post('strategies/:strategyId/versions/:versionId/gaps')
  @UseGuards(CsrfGuard)
  async createGap(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body() body: { kind: string; text: string; info_class?: string },
  ) {
    this.requireTenant(req);
    return strategyService.createGap(req.oma!.tenantId!, brandId, strategyId, versionId, body);
  }

  @Delete('strategies/:strategyId/versions/:versionId/gaps/:gapId')
  @UseGuards(CsrfGuard)
  async deleteGap(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Param('gapId') gapId: string,
  ) {
    this.requireTenant(req);
    return strategyService.deleteGap(req.oma!.tenantId!, brandId, strategyId, versionId, gapId);
  }

  @Post('strategies/:strategyId/versions/:versionId/evidence-links')
  @UseGuards(CsrfGuard)
  async createEvidenceLink(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body() body: { evidence_excerpt_id?: string; profile_field_key?: string; label?: string },
  ) {
    this.requireTenant(req);
    return strategyService.createEvidenceLink(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      body,
    );
  }

  @Delete('strategies/:strategyId/versions/:versionId/evidence-links/:linkId')
  @UseGuards(CsrfGuard)
  async deleteEvidenceLink(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Param('linkId') linkId: string,
  ) {
    this.requireTenant(req);
    return strategyService.deleteEvidenceLink(
      req.oma!.tenantId!,
      brandId,
      strategyId,
      versionId,
      linkId,
    );
  }

  @Get('strategies/:strategyId/versions/:versionId/evidence-links/:linkId')
  async openEvidenceLink(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Param('linkId') linkId: string,
  ) {
    this.requireTenant(req);
    return strategyService.openEvidenceLink(
      req.oma!.tenantId!,
      brandId,
      strategyId,
      versionId,
      linkId,
    );
  }

  @Post('strategies/:strategyId/versions/:versionId/submit')
  @UseGuards(CsrfGuard)
  async submit(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body() body: { row_version: number; unknowns_acknowledged?: boolean },
  ) {
    this.requireTenant(req);
    return strategyService.submit(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('strategies/:strategyId/versions/:versionId/approve')
  @UseGuards(CsrfGuard)
  async approve(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body() body: { row_version: number; comment?: string; unknowns_acknowledged: boolean },
  ) {
    this.requireTenant(req);
    return strategyService.approvePackage(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('strategies/:strategyId/versions/:versionId/request-changes')
  @UseGuards(CsrfGuard)
  async requestChanges(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body() body: { row_version: number; comment?: string },
  ) {
    this.requireTenant(req);
    return strategyService.requestChanges(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('strategies/:strategyId/versions/:versionId/reject')
  @UseGuards(CsrfGuard)
  async reject(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body() body: { row_version: number; comment?: string },
  ) {
    this.requireTenant(req);
    return strategyService.reject(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      body,
      req.oma!.correlationId,
    );
  }

  @Get('strategies/:strategyId/versions/:versionId/comments')
  async listComments(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
  ) {
    this.requireTenant(req);
    return strategyService.listComments(req.oma!.tenantId!, brandId, strategyId, versionId);
  }

  @Post('strategies/:strategyId/versions/:versionId/comments')
  @UseGuards(CsrfGuard)
  async addComment(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body() body: { body: string; anchor_path?: string },
  ) {
    this.requireTenant(req);
    return strategyService.addComment(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      body,
      req.oma!.correlationId,
    );
  }

  @Get('strategies/:strategyId/versions/:versionId/decisions')
  async listDecisions(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
  ) {
    this.requireTenant(req);
    return strategyService.listDecisions(req.oma!.tenantId!, brandId, strategyId, versionId);
  }

  @Get('strategies/:strategyId/versions/:versionId/approval')
  async getApproval(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
  ) {
    this.requireTenant(req);
    return strategyService.getApproval(req.oma!.tenantId!, brandId, strategyId, versionId);
  }

  @Post('strategies/:strategyId/versions/:versionId/revise')
  @UseGuards(CsrfGuard)
  async revise(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
  ) {
    this.requireTenant(req);
    return strategyService.revise(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      req.oma!.correlationId,
    );
  }

  @Post('strategies/:strategyId/versions/:versionId/clone')
  @UseGuards(CsrfGuard)
  async clone(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
    @Body() body: { name?: string },
  ) {
    this.requireTenant(req);
    return strategyService.clone(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      strategyId,
      versionId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('strategies/:strategyId/versions/:versionId/ai/propose')
  @UseGuards(CsrfGuard)
  async aiPropose(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('strategyId') strategyId: string,
    @Param('versionId') versionId: string,
  ) {
    this.requireTenant(req);
    return strategyService.aiPropose(req.oma!.tenantId!, brandId, strategyId, versionId);
  }

  @Get('current-strategy')
  async getCurrent(@Req() req: Request, @Param('brandId') brandId: string) {
    this.requireTenant(req);
    return strategyService.getCurrentStrategy(req.oma!.tenantId!, brandId);
  }

  @Post('current-strategy')
  @UseGuards(CsrfGuard)
  async setCurrent(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: { strategy_id: string | null; brand_version: number },
  ) {
    this.requireTenant(req);
    return strategyService.setCurrentStrategy(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      body,
      req.oma!.correlationId,
    );
  }
}
