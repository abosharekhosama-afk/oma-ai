import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { SupportGuard } from '../common/guards/support.guard';

/** Placeholder surface for Support Specialist APIs (Phase 2+). */
@Controller('api/v1/support')
@UseGuards(AuthGuard, SupportGuard)
export class SupportController {
  @Get('health')
  health() {
    return { ok: true, surface: 'platform-support' };
  }
}
