import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '@oma/domain';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { aiStatus, cancelAiRun, createAiRun, readAiRun } from './ai.service';

@Controller('api/v1/ai')
export class AiController {
  private requireTenant(req: Request) {
    if (!req.oma?.userId)
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    if (!req.oma.tenantId)
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    return req.oma;
  }

  @Get('status')
  status() {
    return { data: aiStatus() };
  }

  @Get('budget')
  budget(@Req() req: Request) {
    this.requireTenant(req);
    return {
      data: {
        monthly_usd: Number(process.env.AI_MONTHLY_BUDGET_USD || 25),
        daily_usd: Number(process.env.AI_DAILY_BUDGET_USD || 2),
        warning_ratio: 0.8,
        live_enabled: false,
      },
    };
  }

  @Post('runs')
  @UseGuards(CsrfGuard)
  async create(
    @Req() req: Request,
    @Body()
    body: {
      use_case: string;
      source_entity_type: string;
      source_entity_id: string;
      source_version: string;
      idempotency_key: string;
      evidence_refs?: string[];
    },
  ) {
    const actor = this.requireTenant(req);
    const result = await createAiRun({
      tenantId: actor.tenantId!,
      actorUserId: actor.userId!,
      useCase: body.use_case,
      sourceEntityType: body.source_entity_type,
      sourceEntityId: body.source_entity_id,
      sourceVersion: body.source_version,
      idempotencyKey: body.idempotency_key,
      correlationId: actor.correlationId,
      evidenceRefs: body.evidence_refs,
    });
    return { data: result };
  }

  @Get('runs/:id')
  async read(@Req() req: Request, @Param('id') id: string) {
    const actor = this.requireTenant(req);
    return { data: await readAiRun(actor.tenantId!, id) };
  }

  @Post('runs/:id/cancel')
  @UseGuards(CsrfGuard)
  async cancel(@Req() req: Request, @Param('id') id: string) {
    const actor = this.requireTenant(req);
    return { data: await cancelAiRun(actor.tenantId!, id) };
  }

  @Post('runs/:id/accept')
  @UseGuards(CsrfGuard)
  accept() {
    throw new DomainError(
      'AI_DISABLED',
      'Accept is a human edit into a draft and is unavailable while AI is offline.',
      503,
      'errors.ai_disabled',
      [{ manual_journey: true }],
    );
  }

  @Post('runs/:id/reject')
  @UseGuards(CsrfGuard)
  async reject(@Req() req: Request, @Param('id') id: string) {
    const actor = this.requireTenant(req);
    const run = await readAiRun(actor.tenantId!, id);
    return {
      data: { id: run.id, status: 'REFUSED', manual_journey: true },
    };
  }
}
