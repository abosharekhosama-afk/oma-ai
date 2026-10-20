import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { DomainError } from '@oma/domain';
import { contentExtrasService } from '../container';

@Controller()
@UseGuards(AuthGuard, CapabilitiesGuard)
export class ContentExtrasController {
  private requireTenant(req: Request) {
    if (!req.oma?.tenantId) {
      throw new DomainError('TENANT_REQUIRED', 'Tenant required', 403, 'errors.tenant_required');
    }
  }

  @Get('api/v1/brands/:brandId/day-notes')
  async listNotes(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.requireTenant(req);
    return contentExtrasService.listDayNotes(req.oma!.tenantId!, brandId, from, to);
  }

  @Post('api/v1/brands/:brandId/day-notes')
  @UseGuards(CsrfGuard)
  async upsertNote(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body()
    body: {
      dayKey: string;
      text?: string | { en?: string; ar?: string };
      color?: string;
      locked?: boolean;
    },
  ) {
    this.requireTenant(req);
    return contentExtrasService.upsertDayNote(req.oma!.tenantId!, req.oma!.userId!, brandId, body);
  }

  @Delete('api/v1/brands/:brandId/day-notes/:dayKey')
  @UseGuards(CsrfGuard)
  async deleteNote(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('dayKey') dayKey: string,
  ) {
    this.requireTenant(req);
    return contentExtrasService.deleteDayNote(req.oma!.tenantId!, brandId, dayKey);
  }

  @Get('api/v1/brands/:brandId/content-labels')
  async listLabels(@Req() req: Request, @Param('brandId') brandId: string) {
    this.requireTenant(req);
    return contentExtrasService.listLabels(req.oma!.tenantId!, brandId);
  }

  @Post('api/v1/brands/:brandId/content-labels')
  @UseGuards(CsrfGuard)
  async createLabel(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: { name: string | { en: string; ar?: string }; color?: string },
  ) {
    this.requireTenant(req);
    return contentExtrasService.createLabel(req.oma!.tenantId!, brandId, body);
  }

  @Delete('api/v1/brands/:brandId/content-labels/:labelId')
  @UseGuards(CsrfGuard)
  async deleteLabel(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('labelId') labelId: string,
  ) {
    this.requireTenant(req);
    return contentExtrasService.deleteLabel(req.oma!.tenantId!, brandId, labelId);
  }

  @Post('api/v1/content/:contentId/labels')
  @UseGuards(CsrfGuard)
  async setLabels(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Body() body: { labels: string[] },
  ) {
    this.requireTenant(req);
    return contentExtrasService.setContentLabels(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      body.labels ?? [],
    );
  }

  @Post('api/v1/content/:contentId/visibility')
  @UseGuards(CsrfGuard)
  async setVisibility(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Body() body: { clientVisible: boolean },
  ) {
    this.requireTenant(req);
    return contentExtrasService.setClientVisible(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      Boolean(body.clientVisible),
    );
  }

  @Get('api/v1/brands/:brandId/content-templates')
  async listTemplates(@Req() req: Request, @Param('brandId') brandId: string) {
    this.requireTenant(req);
    return contentExtrasService.listTemplates(req.oma!.tenantId!, brandId);
  }

  @Post('api/v1/brands/:brandId/content-templates')
  @UseGuards(CsrfGuard)
  async createTemplate(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.requireTenant(req);
    return contentExtrasService.createTemplate(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      body as never,
    );
  }

  @Delete('api/v1/brands/:brandId/content-templates/:templateId')
  @UseGuards(CsrfGuard)
  async deleteTemplate(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('templateId') templateId: string,
  ) {
    this.requireTenant(req);
    return contentExtrasService.deleteTemplate(req.oma!.tenantId!, brandId, templateId);
  }

  @Post('api/v1/brands/:brandId/content-templates/:templateId/use')
  @UseGuards(CsrfGuard)
  async useTemplate(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('templateId') templateId: string,
    @Body() body: { campaignId?: string | null; plannedAt?: string | null },
  ) {
    this.requireTenant(req);
    return contentExtrasService.createFromTemplate(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      templateId,
      body,
    );
  }
}
