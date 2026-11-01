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
import { contentService } from '../container';

@Controller()
@UseGuards(AuthGuard, CapabilitiesGuard)
export class ContentController {
  private requireTenant(req: Request) {
    if (!req.oma?.tenantId) {
      throw new DomainError('TENANT_REQUIRED', 'Tenant required', 403, 'errors.tenant_required');
    }
  }

  @Get('api/v1/brands/:brandId/content')
  async list(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Query('campaignId') campaignId?: string,
    @Query('status') status?: string,
    @Query('track') track?: string,
    @Query('channel') channel?: string,
    @Query('q') q?: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.requireTenant(req);
    return contentService.list(req.oma!.tenantId!, brandId, {
      campaignId,
      status,
      track,
      channel,
      q,
      includeArchived: includeArchived === 'true' || includeArchived === '1',
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('api/v1/brands/:brandId/content')
  @UseGuards(CsrfGuard)
  async create(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.requireTenant(req);
    return contentService.create(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      body as never,
      req.oma!.correlationId,
    );
  }

  @Get('api/v1/content/:contentId')
  async get(@Req() req: Request, @Param('contentId') contentId: string) {
    this.requireTenant(req);
    return contentService.get(req.oma!.tenantId!, contentId);
  }

  @Patch('api/v1/content/:contentId')
  @UseGuards(CsrfGuard)
  async update(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.requireTenant(req);
    return contentService.update(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      body as never,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/request-approval')
  @UseGuards(CsrfGuard)
  async requestApproval(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Body() body: { note?: { en: string; ar?: string } | string },
  ) {
    this.requireTenant(req);
    return contentService.requestApproval(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      body?.note,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/approve')
  @UseGuards(CsrfGuard)
  async approve(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Body() body: { note?: { en: string; ar?: string } | string },
  ) {
    this.requireTenant(req);
    return contentService.approve(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      body?.note,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/request-changes')
  @UseGuards(CsrfGuard)
  async requestChanges(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Body() body: { note: { en: string; ar?: string } | string },
  ) {
    this.requireTenant(req);
    return contentService.requestChanges(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      body.note,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/reject')
  @UseGuards(CsrfGuard)
  async reject(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Body() body: { note?: { en: string; ar?: string } | string },
  ) {
    this.requireTenant(req);
    return contentService.reject(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      body?.note,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/mark-published')
  @UseGuards(CsrfGuard)
  async markPublished(@Req() req: Request, @Param('contentId') contentId: string) {
    this.requireTenant(req);
    return contentService.markPublishedSample(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/publish-now')
  @UseGuards(CsrfGuard)
  async publishNow(@Req() req: Request, @Param('contentId') contentId: string) {
    this.requireTenant(req);
    return contentService.publishNow(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/ungroup')
  @UseGuards(CsrfGuard)
  async ungroup(@Req() req: Request, @Param('contentId') contentId: string) {
    this.requireTenant(req);
    return contentService.ungroup(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/detach')
  @UseGuards(CsrfGuard)
  async detach(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Body() body: { socialPageId?: string; social_page_id?: string },
  ) {
    this.requireTenant(req);
    const socialPageId = body.socialPageId ?? body.social_page_id;
    if (!socialPageId) {
      throw new DomainError('VALIDATION_FAILED', 'socialPageId required', 400, 'errors.validation_failed');
    }
    return contentService.detachPublishTarget(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      socialPageId,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/copy-to')
  @UseGuards(CsrfGuard)
  async copyTo(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Body() body: { brandId?: string; brand_id?: string; socialPageId?: string; social_page_id?: string },
  ) {
    this.requireTenant(req);
    const brandId = body.brandId ?? body.brand_id;
    if (!brandId) {
      throw new DomainError('VALIDATION_FAILED', 'brandId required', 400, 'errors.validation_failed');
    }
    return contentService.copyTo(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      { brandId, socialPageId: body.socialPageId ?? body.social_page_id ?? null },
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/preferred-audience')
  @UseGuards(CsrfGuard)
  async preferredAudience(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Body() body: { audience?: string | null },
  ) {
    this.requireTenant(req);
    return contentService.setPreferredAudience(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      body.audience ?? null,
      req.oma!.correlationId,
    );
  }

  @Patch('api/v1/content/:contentId/comments/:commentId')
  @UseGuards(CsrfGuard)
  async updateComment(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Param('commentId') commentId: string,
    @Body() body: { body: { en: string; ar?: string } | string },
  ) {
    this.requireTenant(req);
    return contentService.updateComment(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      commentId,
      body.body,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/comments/:commentId/resolve')
  @UseGuards(CsrfGuard)
  async resolveComment(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Param('commentId') commentId: string,
    @Body() body: { resolved?: boolean },
  ) {
    this.requireTenant(req);
    return contentService.resolveComment(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      commentId,
      body?.resolved !== false,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/comments/:commentId/react')
  @UseGuards(CsrfGuard)
  async reactComment(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Param('commentId') commentId: string,
    @Body() body: { emoji: string },
  ) {
    this.requireTenant(req);
    return contentService.reactToComment(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      commentId,
      body.emoji,
      req.oma!.correlationId,
    );
  }

  @Get('api/v1/content/:contentId/comments')
  async listComments(@Req() req: Request, @Param('contentId') contentId: string) {
    this.requireTenant(req);
    return contentService.listComments(req.oma!.tenantId!, contentId);
  }

  @Post('api/v1/content/:contentId/comments')
  @UseGuards(CsrfGuard)
  async addComment(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Body()
    body: {
      body: { en: string; ar?: string } | string;
      internal?: boolean;
      parent_id?: string | null;
      attachment_media_ids?: string[];
    },
  ) {
    this.requireTenant(req);
    return contentService.addComment(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      body.body,
      req.oma!.correlationId,
      {
        internal: body.internal,
        parentId: body.parent_id,
        attachmentMediaIds: body.attachment_media_ids,
      },
    );
  }

  @Delete('api/v1/content/:contentId/comments/:commentId')
  @UseGuards(CsrfGuard)
  async deleteComment(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Param('commentId') commentId: string,
  ) {
    this.requireTenant(req);
    return contentService.deleteComment(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      commentId,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/schedule')
  @UseGuards(CsrfGuard)
  async schedule(
    @Req() req: Request,
    @Param('contentId') contentId: string,
    @Body() body: { scheduledAt: string; timezone?: string },
  ) {
    this.requireTenant(req);
    return contentService.schedule(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/unschedule')
  @UseGuards(CsrfGuard)
  async unschedule(@Req() req: Request, @Param('contentId') contentId: string) {
    this.requireTenant(req);
    return contentService.unschedule(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/archive')
  @UseGuards(CsrfGuard)
  async archive(@Req() req: Request, @Param('contentId') contentId: string) {
    this.requireTenant(req);
    return contentService.archive(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/content/:contentId/duplicate')
  @UseGuards(CsrfGuard)
  async duplicate(@Req() req: Request, @Param('contentId') contentId: string) {
    this.requireTenant(req);
    return contentService.duplicate(
      req.oma!.tenantId!,
      req.oma!.userId!,
      contentId,
      req.oma!.correlationId,
    );
  }

  @Get('api/v1/brands/:brandId/content-preferences')
  async getPrefs(@Req() req: Request, @Param('brandId') brandId: string) {
    this.requireTenant(req);
    return contentService.getPreferences(req.oma!.tenantId!, brandId);
  }

  @Patch('api/v1/brands/:brandId/content-preferences')
  @UseGuards(CsrfGuard)
  async patchPrefs(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: { approvalPolicy?: 'NONE' | 'OPTIONAL' | 'REQUIRED'; defaultTimezone?: string },
  ) {
    this.requireTenant(req);
    return contentService.updatePreferences(req.oma!.tenantId!, brandId, body);
  }
}
