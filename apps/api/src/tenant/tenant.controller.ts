import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { RequireCapabilities } from '../common/decorators/require-capabilities.decorator';
import { tenantService } from '../container';
import { DomainError } from '@oma/domain';
import { getPrisma } from '@oma/db';

@Controller('api/v1')
export class TenantController {
  @Post('tenants')
  @UseGuards(AuthGuard, CsrfGuard)
  async create(@Req() req: Request, @Body() body: { name: string; slug?: string }) {
    if (!req.oma?.userId)
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'oma_session';
    const token = req.cookies?.[cookieName] as string | undefined;
    const tenant = await tenantService.createTenant(
      req.oma.userId,
      body,
      req.oma.correlationId,
      token,
    );
    return { tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } };
  }

  @Get('tenants/current')
  @UseGuards(AuthGuard)
  async current(@Req() req: Request) {
    if (!req.oma?.tenantId)
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    const tenant = await getPrisma().tenant.findFirst({ where: { id: req.oma.tenantId } });
    if (!tenant) throw new DomainError('NOT_FOUND', 'Tenant not found', 404, 'errors.not_found');
    return { tenant };
  }

  @Get('tenants/current/memberships')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  @RequireCapabilities('membership.manage')
  async memberships(@Req() req: Request) {
    if (!req.oma?.tenantId)
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    return { data: await tenantService.listCurrentMemberships(req.oma.tenantId) };
  }

  /** Read-only member list for Team UI (any authenticated tenant member). */
  @Get('tenants/current/members')
  @UseGuards(AuthGuard)
  async membersRead(@Req() req: Request) {
    if (!req.oma?.tenantId)
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    return { data: await tenantService.listCurrentMemberships(req.oma.tenantId) };
  }

  @Post('tenants/active')
  @UseGuards(AuthGuard, CsrfGuard)
  async activate(@Req() req: Request, @Body() body: { tenant_id: string }) {
    if (!req.oma?.userId)
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'oma_session';
    const token = req.cookies?.[cookieName];
    if (!token)
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    return tenantService.setActiveTenant(
      req.oma.userId,
      token,
      body.tenant_id,
      req.oma.correlationId,
    );
  }

  @Get('tenants/current/resource-probe/:id')
  @UseGuards(AuthGuard)
  async probe(@Req() req: Request) {
    if (!req.oma?.tenantId)
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    const id = (req.params as { id: string }).id;
    const row = await getPrisma().membership.findFirst({
      where: { id, tenantId: req.oma.tenantId },
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    return { id: row.id };
  }
}
