import { Body, Controller, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { DomainError } from '@oma/domain';
import { listPublishQueues, upsertPublishQueue, type QueuePatch } from './publish-queues.service';

@Controller('api/v1/workspace/publish-queues')
@UseGuards(AuthGuard)
export class PublishQueuesController {
  private tenantId(req: Request) {
    const id = req.oma?.tenantId;
    if (!id)
      throw new DomainError('UNAUTHENTICATED', 'Sign in required', 401, 'errors.unauthenticated');
    return id;
  }

  @Get()
  @UseGuards(CapabilitiesGuard)
  @RequireCapabilities('content.schedule')
  async list(@Req() req: Request, @Query('brandId') brandId?: string) {
    return listPublishQueues(this.tenantId(req), { brandId });
  }

  @Put()
  @UseGuards(CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('tenant.manage')
  async upsert(@Req() req: Request, @Body() body: QueuePatch) {
    if (!body?.social_page_id) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'social_page_id required',
        400,
        'errors.validation_failed',
        [{ field: 'social_page_id' }],
      );
    }
    return upsertPublishQueue(this.tenantId(req), body);
  }
}
