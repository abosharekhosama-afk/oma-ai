import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { inboxService } from './inbox.service';

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
export class InboxController {
  @Get('api/v1/inbox/stats')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  stats(@Req() req: Request, @Query('brandId') brandId?: string) {
    return inboxService.stats(ctx(req).tenantId, brandId || undefined);
  }

  @Get('api/v1/inbox/conversations')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  list(
    @Req() req: Request,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('sentiment') sentiment?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('unassigned') unassigned?: string,
    @Query('priority') priority?: string,
    @Query('tag') tag?: string,
    @Query('brandId') brandId?: string,
    @Query('unanswered') unanswered?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const c = ctx(req);
    return inboxService.listConversations(c.tenantId, {
      platform: platform as never,
      status: status as never,
      type: type as never,
      category:
        category === 'comments' || category === 'dms'
          ? (category as 'comments' | 'dms')
          : undefined,
      sentiment: sentiment as never,
      assignedTo,
      unassigned: unassigned === '1' || unassigned === 'true',
      unanswered: unanswered === '1' || unanswered === 'true',
      brandId: brandId || undefined,
      priority: priority === '1' || priority === 'true' ? true : undefined,
      tag,
      q,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 30,
    });
  }

  @Get('api/v1/inbox/conversations/:id')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  get(@Req() req: Request, @Param('id') id: string) {
    return inboxService.getConversation(ctx(req).tenantId, id);
  }

  @Post('api/v1/inbox/conversations/:id/reply')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  reply(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { content?: string; replyToMessageId?: string },
  ) {
    const c = ctx(req);
    return inboxService.reply(c.tenantId, c.userId, id, body);
  }

  @Post('api/v1/inbox/conversations/:id/assign')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  assign(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { assignedToUserId?: string | null },
  ) {
    return inboxService.assign(ctx(req).tenantId, id, body);
  }

  @Post('api/v1/inbox/conversations/:id/tags')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  tags(@Req() req: Request, @Param('id') id: string, @Body() body: { tags?: string[] }) {
    return inboxService.setTags(ctx(req).tenantId, id, body);
  }

  @Post('api/v1/inbox/conversations/:id/priority')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  priority(@Req() req: Request, @Param('id') id: string, @Body() body: { priority?: boolean }) {
    return inboxService.setPriority(ctx(req).tenantId, id, body);
  }

  @Post('api/v1/inbox/conversations/:id/notes')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  notes(@Req() req: Request, @Param('id') id: string, @Body() body: { content?: string }) {
    const c = ctx(req);
    return inboxService.addNote(c.tenantId, c.userId, id, body);
  }

  @Post('api/v1/inbox/conversations/:id/status')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  status(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { status?: 'UNREAD' | 'OPEN' | 'PENDING' | 'CLOSED' },
  ) {
    if (!body.status) {
      throw new DomainError('VALIDATION_FAILED', 'status required', 400, 'errors.validation');
    }
    return inboxService.updateStatus(ctx(req).tenantId, id, body.status);
  }

  @Post('api/v1/inbox/sync')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  sync(@Req() req: Request, @Body() body: { brandId?: string | null }) {
    return inboxService.requestSync(ctx(req).tenantId, body.brandId);
  }

  @Get('api/v1/inbox/connections')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  connections(@Req() req: Request, @Query('brandId') brandId?: string) {
    return inboxService.connectionStatus(ctx(req).tenantId, brandId || undefined);
  }

  @Post('api/v1/inbox/messages/:messageId/hide')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  hideMessage(@Req() req: Request, @Param('messageId') messageId: string) {
    return inboxService.hideMessage(ctx(req).tenantId, messageId);
  }

  @Post('api/v1/inbox/messages/:messageId/delete')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  deleteMessage(@Req() req: Request, @Param('messageId') messageId: string) {
    return inboxService.deleteMessage(ctx(req).tenantId, messageId);
  }

  @Post('api/v1/inbox/conversations/bulk')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  bulk(
    @Req() req: Request,
    @Body()
    body: {
      ids?: string[];
      status?: 'UNREAD' | 'OPEN' | 'PENDING' | 'CLOSED';
      assignedToUserId?: string | null;
      priority?: boolean;
    },
  ) {
    return inboxService.bulkUpdate(ctx(req).tenantId, body);
  }
}
