import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { DomainError, newId } from '@oma/domain';
import { getPrisma } from '@oma/db';

const bad = (field: string) =>
  new DomainError('VALIDATION_FAILED', `Invalid ${field}`, 400, 'errors.validation_failed', [
    { field },
  ]);

export const APPROVAL_MODES = ['none', 'optional', 'required'] as const;

type SettingsRow = {
  id: string;
  websiteUrl: string | null;
  timezone: string;
  createPostsAsInternal: boolean;
  hideEmailsFromClients: boolean;
  autoCropImages: boolean;
  approvalMode: string;
  requiredApprovers?: number | null;
  scheduleOnApproval: boolean;
  lockAfterApproval: boolean;
};

export function serializeSettings(tenantId: string, row: SettingsRow | null) {
  const mode = row?.approvalMode === 'multi_level' ? 'required' : (row?.approvalMode ?? 'optional');
  return {
    id: row?.id ?? null,
    tenant_id: tenantId,
    website_url: row?.websiteUrl ?? null,
    timezone: row?.timezone ?? 'Asia/Jerusalem',
    create_posts_as_internal: row?.createPostsAsInternal ?? false,
    hide_emails_from_clients: row?.hideEmailsFromClients ?? false,
    auto_crop_images: row?.autoCropImages ?? true,
    approval_mode: mode,
    required_approvers: mode === 'required' ? Math.max(1, row?.requiredApprovers ?? 1) : 1,
    schedule_on_approval: row?.scheduleOnApproval ?? false,
    lock_after_approval: row?.lockAfterApproval ?? false,
  };
}

export function validateSettingsPatch(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (body.website_url !== undefined) {
    if (body.website_url !== null && typeof body.website_url !== 'string') throw bad('website_url');
    const v = (body.website_url as string | null)?.trim() || null;
    if (v && !/^https?:\/\/[^\s]+$/i.test(v)) throw bad('website_url');
    out.websiteUrl = v;
  }
  if (body.timezone !== undefined) {
    if (typeof body.timezone !== 'string' || !body.timezone.trim()) throw bad('timezone');
    try {
      new Intl.DateTimeFormat('en', { timeZone: body.timezone.trim() });
    } catch {
      throw bad('timezone');
    }
    out.timezone = body.timezone.trim();
  }
  if (body.approval_mode !== undefined) {
    const m = String(body.approval_mode).toLowerCase();
    if (!(APPROVAL_MODES as readonly string[]).includes(m)) throw bad('approval_mode');
    out.approvalMode = m;
  }
  if (body.required_approvers !== undefined) {
    const n = Number(body.required_approvers);
    if (!Number.isInteger(n) || n < 1 || n > 5) throw bad('required_approvers');
    out.requiredApprovers = n;
  }
  for (const [k, col] of [
    ['create_posts_as_internal', 'createPostsAsInternal'],
    ['hide_emails_from_clients', 'hideEmailsFromClients'],
    ['auto_crop_images', 'autoCropImages'],
    ['schedule_on_approval', 'scheduleOnApproval'],
    ['lock_after_approval', 'lockAfterApproval'],
  ] as const) {
    if (body[k] !== undefined) {
      if (typeof body[k] !== 'boolean') throw bad(k);
      out[col] = body[k];
    }
  }
  return out;
}

@Controller('api/v1/workspace')
@UseGuards(AuthGuard)
export class WorkspaceSettingsController {
  private tenantId(req: Request) {
    if (!req.oma?.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    return req.oma.tenantId;
  }

  @Get('settings')
  async getSettings(@Req() req: Request) {
    const tenantId = this.tenantId(req);
    const row = await getPrisma()
      .workspaceSetting.findUnique({ where: { tenantId } })
      .catch(() => null);
    return serializeSettings(tenantId, row);
  }

  /** Workspace settings incl. timezone and the Planable approval policy (tenant.manage). */
  @Patch('settings')
  @UseGuards(CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('tenant.manage')
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
      required_approvers?: number;
      schedule_on_approval?: boolean;
      lock_after_approval?: boolean;
    },
  ) {
    const tenantId = this.tenantId(req);
    const patch = validateSettingsPatch(body ?? {});
    const row = await getPrisma().workspaceSetting.upsert({
      where: { tenantId },
      create: { id: newId(), tenantId, ...patch },
      update: { ...patch, updatedAt: new Date() },
    });
    return serializeSettings(tenantId, row);
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
      throw new DomainError(
        'VALIDATION_FAILED',
        'day_of_week and time_local required',
        400,
        'errors.validation',
      );
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
