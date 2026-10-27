import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { identityService, tenantService } from '../container';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import {
  clearSessionCookie,
  ensureCsrfCookie,
  setCsrfCookie,
  setSessionCookie,
} from './session-cookie';
import { DomainError } from '@oma/domain';
import { getPrisma } from '@oma/db';

@Controller('api/v1/auth')
export class AuthController {
  @Post('register')
  @HttpCode(201)
  async register(
    @Body() body: { email: string; password: string; name: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await identityService.register(body);
    const csrf = setCsrfCookie(res);
    return { user: { id: user.id, email: user.email, name: user.name }, csrf_token: csrf };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await identityService.login({
      ...body,
      ip: req.ip,
      userAgent: req.header('user-agent') ?? undefined,
    });
    setSessionCookie(res, result.token);
    const csrf = setCsrfCookie(res);
    return {
      user: { id: result.user.id, email: result.user.email, name: result.user.name },
      csrf_token: csrf,
    };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard, CsrfGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = (req as Request & { sessionId?: string }).sessionId;
    if (!sessionId || !req.oma?.userId)
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    await identityService.logout(sessionId, req.oma.userId);
    clearSessionCookie(res);
    return { ok: true };
  }

  /** Returns a valid CSRF token for the current session (re-issuing the cookie if it was lost). */
  @Get('csrf')
  @UseGuards(AuthGuard)
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('cache-control', 'no-store');
    return { csrf_token: ensureCsrfCookie(req, res) };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: Request) {
    if (!req.oma?.userId)
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    const sessionId = (req as Request & { sessionId?: string }).sessionId;
    let membershipRoute: string | undefined;
    let activeTenantId: string | null | undefined;
    if (sessionId) {
      const reconciled = await tenantService.reconcileSessionTenant(req.oma.userId, sessionId);
      membershipRoute = reconciled.route;
      activeTenantId = reconciled.active_tenant_id;
      req.oma.tenantId = reconciled.active_tenant_id ?? undefined;
    }
    const me = await identityService.me(req.oma.userId);
    return {
      ...me,
      active_tenant_id: activeTenantId ?? me.active_tenant_id,
      membership_route: membershipRoute ?? undefined,
    };
  }

  /**
   * Sliding session refresh: extends expiry by SESSION_TTL_SECONDS and re-issues the cookie.
   * The web client calls this shortly before expiry while the user is active.
   */
  @Post('session/refresh')
  @HttpCode(200)
  @UseGuards(AuthGuard, CsrfGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = (req as Request & { sessionId?: string }).sessionId;
    const name = process.env.SESSION_COOKIE_NAME ?? 'oma_session';
    const token = req.cookies?.[name] as string | undefined;
    if (!sessionId || !token)
      throw new DomainError('UNAUTHENTICATED', 'Session invalid', 401, 'errors.unauthenticated');
    const ttl = Number(process.env.SESSION_TTL_SECONDS ?? 604800);
    const expiresAt = new Date(Date.now() + ttl * 1000);
    await getPrisma().session.update({
      where: { id: sessionId },
      data: { expiresAt, lastSeenAt: new Date() },
    });
    setSessionCookie(res, token);
    return { data: { expires_at: expiresAt.toISOString() } };
  }

  @Post('password/change')
  @UseGuards(AuthGuard, CsrfGuard)
  async changePassword() {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Use recovery flow in this foundation slice',
      400,
      'errors.not_implemented_detail',
    );
  }
}
