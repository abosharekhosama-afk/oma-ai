import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';

/** Placeholder surface for Super Admin APIs (Phase 1+). */
@Controller('api/v1/admin')
@UseGuards(AuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  @Get('health')
  health() {
    return { ok: true, surface: 'platform-admin' };
  }
}
