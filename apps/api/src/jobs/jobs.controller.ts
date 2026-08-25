import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError } from '@oma/domain';
import type { Request } from 'express';

@Controller('api/v1/jobs')
@UseGuards(AuthGuard)
export class JobsController {
  @Get(':id')
  @UseGuards(CapabilitiesGuard)
  @RequireCapabilities('job.read')
  async get(@Req() req: Request, @Param('id') id: string) {
    if (!req.oma?.tenantId)
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    const job = await getPrisma().jobRun.findFirst({
      where: tenantWhere(req.oma.tenantId, { id }),
    });
    if (!job) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    return { job };
  }

  @Post(':id/cancel')
  @UseGuards(CsrfGuard, CapabilitiesGuard)
  @RequireCapabilities('job.read')
  async cancel(@Req() req: Request, @Param('id') id: string) {
    if (!req.oma?.tenantId)
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    const job = await getPrisma().jobRun.findFirst({
      where: tenantWhere(req.oma.tenantId, { id }),
    });
    if (!job) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (['SUCCEEDED', 'FAILED', 'DEAD', 'CANCELLED'].includes(job.status)) {
      throw new DomainError('CONFLICT_STATE', 'Job already terminal', 409, 'errors.conflict_state');
    }
    const updated = await getPrisma().jobRun.update({
      where: { id },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    });
    return { job: updated };
  }
}
