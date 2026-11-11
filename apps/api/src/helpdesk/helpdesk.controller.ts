import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { supportCaseService } from '../container';

function requireTenantUser(req: Request): { userId: string; tenantId: string } {
  const userId = req.oma?.userId;
  const tenantId = req.oma?.tenantId;
  if (!userId) {
    throw new DomainError('UNAUTHENTICATED', 'Sign in required', 401, 'errors.unauthenticated');
  }
  if (!tenantId) {
    throw new DomainError(
      'TENANT_REQUIRED',
      'Active tenant required',
      400,
      'errors.tenant_required',
    );
  }
  return { userId, tenantId };
}

@Controller('api/v1/helpdesk')
@UseGuards(AuthGuard)
export class HelpdeskController {
  @Get('cases')
  async list(@Req() req: Request) {
    const { userId, tenantId } = requireTenantUser(req);
    return supportCaseService.listForCustomer(userId, tenantId);
  }

  @Post('cases')
  @UseGuards(CsrfGuard)
  async create(@Req() req: Request, @Body() body: { subject?: string; message?: string }) {
    const { userId, tenantId } = requireTenantUser(req);
    return supportCaseService.createForCustomer(userId, tenantId, body, req.oma?.correlationId);
  }

  @Get('cases/:caseId')
  async get(@Req() req: Request, @Param('caseId') caseId: string) {
    const { userId, tenantId } = requireTenantUser(req);
    return supportCaseService.getForCustomer(userId, tenantId, caseId);
  }

  @Post('cases/:caseId/messages')
  @UseGuards(CsrfGuard)
  async reply(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { message?: string },
  ) {
    const { userId, tenantId } = requireTenantUser(req);
    return supportCaseService.replyAsCustomer(
      userId,
      tenantId,
      caseId,
      body,
      req.oma?.correlationId,
    );
  }
}
