import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { DomainError, newId } from '@oma/domain';
import { getPrisma } from '@oma/db';

@Controller('api/v1/workspace')
@UseGuards(AuthGuard)
export class WorkspaceSettingsController {
  private tenantId(req: Request) {
    if (!req.oma?.tenantId) {
      throw new DomainError('TENANT_REQUIRED', 'Active tenant required', 409, 'errors.tenant_required');
    }
    return req.oma.tenantId;
  }

  @Get('settings')
  async getSettings(@Req() req: Request) {
    const tenantId = this.tenantId(req);
    const prisma = getPrisma();
    let row = await prisma.workspaceSetting.findUnique({ where: { tenantId } }).catch(() => null);
    if (!row) {
      // Return defaults without requiring write capability
      return {
        tenant_id: tenantId,
        website_url: null,
        timezone: 'Asia/Jerusalem',
        create_posts_as_internal: false,
        hide_emails_from_clients: false,
        auto_crop_images: true,
        approval_mode: 'optional',
        schedule_on_approval: false,
        lock_after_approval: false,
      };
    }
    return {
      id: row.id,
      tenant_id: row.tenantId,
      website_url: row.websiteUrl,
      timezone: row.timezone,
      create_posts_as_internal: row.createPostsAsInternal,
      hide_emails_from_clients: row.hideEmailsFromClients,
      auto_crop_images: row.autoCropImages,
      approval_mode: row.approvalMode,
      schedule_on_approval: row.scheduleOnApproval,
      lock_after_approval: row.lockAfterApproval,
    };
  }

  @Patch('settings')
  @UseGuards(CsrfGuard)
  async patchSettings(
    @Req() req: Request,
    @Body()
    body: {
      website_url?: string | null;
      timezone?: string;
      create_posts_as_internal?: boolean;
      hide_emails_from_clients?: boolean;
      auto_crop_images?: boolean;
      approval_mode?: string;
      schedule_on_approval?: boolean;
      lock_after_approval?: boolean;
    },
  ) {
    const tenantId = this.tenantId(req);
    const prisma = getPrisma();
    const data = {
      websiteUrl: body.website_url ?? undefined,
      timezone: body.timezone ?? undefined,
      createPostsAsInternal: body.create_posts_as_internal ?? undefined,
      hideEmailsFromClients: body.hide_emails_from_clients ?? undefined,
      autoCropImages: body.auto_crop_images ?? undefined,
      approvalMode: body.approval_mode ?? undefined,
      scheduleOnApproval: body.schedule_on_approval ?? undefined,
      lockAfterApproval: body.lock_after_approval ?? undefined,
      updatedAt: new Date(),
    };
    const row = await prisma.workspaceSetting.upsert({
      where: { tenantId },
      create: {
        id: newId(),
        tenantId,
        websiteUrl: body.website_url ?? null,
        timezone: body.timezone ?? 'Asia/Jerusalem',
        createPostsAsInternal: body.create_posts_as_internal ?? false,
        hideEmailsFromClients: body.hide_emails_from_clients ?? false,
        autoCropImages: body.auto_crop_images ?? true,
        approvalMode: body.approval_mode ?? 'optional',
        scheduleOnApproval: body.schedule_on_approval ?? false,
        lockAfterApproval: body.lock_after_approval ?? false,
      },
      update: data,
    });
    return { ok: true, id: row.id };
  }

  @Get('time-slots')
  async listSlots(@Req() req: Request) {
    const tenantId = this.tenantId(req);
    const rows = await getPrisma().workspaceTimeSlot.findMany({
      where: { tenantId },
      orderBy: [{ dayOfWeek: 'asc' }, { timeLocal: 'asc' }],
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        day_of_week: r.dayOfWeek,
        time_local: r.timeLocal,
        color: r.color,
        label: r.label,
      })),
    };
  }

  @Post('time-slots')
  @UseGuards(CsrfGuard)
  async createSlot(
    @Req() req: Request,
    @Body() body: { day_of_week: number; time_local: string; color?: string; label?: string },
  ) {
    const tenantId = this.tenantId(req);
    if (body.day_of_week == null || !body.time_local) {
      throw new DomainError('VALIDATION_FAILED', 'day_of_week and time_local required', 400, 'errors.validation');
    }
    const row = await getPrisma().workspaceTimeSlot.create({
      data: {
        id: newId(),
        tenantId,
        dayOfWeek: Number(body.day_of_week),
        timeLocal: String(body.time_local),
        color: body.color ?? '#fde68a',
        label: body.label ?? null,
      },
    });
    return { id: row.id };
  }

  @Delete('time-slots/:slotId')
  @UseGuards(CsrfGuard)
  async deleteSlot(@Req() req: Request, @Param('slotId') slotId: string) {
    const tenantId = this.tenantId(req);
    const row = await getPrisma().workspaceTimeSlot.findFirst({ where: { id: slotId, tenantId } });
    if (!row) throw new DomainError('NOT_FOUND', 'Slot not found', 404, 'errors.not_found');
    await getPrisma().workspaceTimeSlot.delete({ where: { id: slotId } });
    return { ok: true };
  }
}
