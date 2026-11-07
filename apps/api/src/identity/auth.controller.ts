import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
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
import {
  consumeOAuthState,
  exchangeOAuthCode,
  getAuthProvidersStatus,
  startOAuthFlow,
  startSsoFlow,
} from './oauth-providers.service';
import { DomainError } from '@oma/domain';
import { getPrisma } from '@oma/db';

@Controller('api/v1/auth')
export class AuthController {
  @Post('register')
  @HttpCode(201)
  async register(
    @Body()
    body: {
      email: string;
      password: string;
      name: string;
      terms_accepted?: boolean;
      terms_version?: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await identityService.register(body);
    const csrf = setCsrfCookie(res);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        terms_accepted_at: user.termsAcceptedAt?.toISOString() ?? null,
        terms_version: user.termsVersion ?? null,
      },
      csrf_token: csrf,
    };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body()
    body: {
      email: string;
      password: string;
      terms_accepted?: boolean;
      terms_version?: string;
    },
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
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        terms_accepted_at: result.user.termsAcceptedAt?.toISOString() ?? null,
        terms_version: result.user.termsVersion ?? null,
      },
      csrf_token: csrf,
    };
  }

  @Get('providers')
  providers() {
    return { data: getAuthProvidersStatus() };
  }

  @Post('oauth/:provider/start')
  @HttpCode(200)
  async oauthStart(
    @Param('provider') provider: string,
    @Body()
    body?: {
      return_path?: string;
      terms_accepted?: boolean;
      terms_version?: string;
    },
  ) {
    if (provider !== 'google' && provider !== 'facebook') {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Unsupported auth provider',
        400,
        'errors.validation_failed',
      );
    }
    if (body?.terms_accepted === false) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'You must accept the Terms of Service and Privacy Policy to continue.',
        400,
        'errors.terms_required',
      );
    }
    const started = await startOAuthFlow(provider, {
      returnPath: body?.return_path,
      termsAccepted: body?.terms_accepted ?? true,
      termsVersion: body?.terms_version,
    });
    return { data: { authorize_url: started.authorizeUrl, state: started.state } };
  }

  @Get('oauth/:provider/callback')
  async oauthCallback(
    @Param('provider') provider: string,
    @Query() query: { code?: string; state?: string; error?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const webBase = (
      process.env.WEB_BASE_URL ||
      process.env.AUTH_OAUTH_REDIRECT_BASE ||
      ''
    ).replace(/\/+$/, '');
    const loginErrorUrl = (code: string) =>
      `${webBase || ''}/login?oauth_error=${encodeURIComponent(code)}`;

    if (provider !== 'google' && provider !== 'facebook') {
      res.redirect(302, loginErrorUrl('unsupported_provider'));
      return;
    }
    if (query.error || !query.code || !query.state) {
      res.redirect(302, loginErrorUrl(query.error || 'access_denied'));
      return;
    }
    try {
      const stateRow = await consumeOAuthState(query.state, provider);
      const profile = await exchangeOAuthCode(provider, query.code, stateRow.codeVerifier);
      const sessionResult = await identityService.loginOrRegisterWithOAuth(profile, {
        ip: req.ip,
        userAgent: req.header('user-agent') ?? undefined,
        termsVersion: stateRow.termsVersion,
      });
      setSessionCookie(res, sessionResult.token);
      setCsrfCookie(res);
      res.redirect(302, `${webBase || ''}${stateRow.returnPath}`);
    } catch (err) {
      const code = err instanceof DomainError ? err.code : 'oauth_failed';
      res.redirect(302, loginErrorUrl(code));
    }
  }

  @Post('sso/start')
  @HttpCode(200)
  async ssoStart(
    @Body()
    body?: {
      email?: string;
      domain?: string;
      return_path?: string;
      terms_accepted?: boolean;
    },
  ) {
    if (body?.terms_accepted === false) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'You must accept the Terms of Service and Privacy Policy to continue.',
        400,
        'errors.terms_required',
      );
    }
    const result = await startSsoFlow({
      email: body?.email,
      domain: body?.domain,
      returnPath: body?.return_path,
      termsAccepted: body?.terms_accepted ?? true,
    });
    return { data: { redirect_url: result.redirectUrl, state: result.state } };
  }

  @Get('sso/callback')
  async ssoCallback(
    @Query() query: { state?: string; email?: string; sub?: string; name?: string; error?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const webBase = (
      process.env.WEB_BASE_URL ||
      process.env.AUTH_OAUTH_REDIRECT_BASE ||
      ''
    ).replace(/\/+$/, '');
    const loginErrorUrl = (code: string) =>
      `${webBase || ''}/login?oauth_error=${encodeURIComponent(code)}`;

    if (query.error || !query.state || !query.email) {
      res.redirect(302, loginErrorUrl(query.error || 'sso_failed'));
      return;
    }
    try {
      const row = await getPrisma().authOAuthState.findUnique({ where: { id: query.state } });
      if (!row || !row.provider.startsWith('saml:') || row.usedAt || row.expiresAt < new Date()) {
        res.redirect(302, loginErrorUrl('sso_state_expired'));
        return;
      }
      await getPrisma().authOAuthState.update({
        where: { id: query.state },
        data: { usedAt: new Date() },
      });
      const email = query.email.trim().toLowerCase();
      const sessionResult = await identityService.loginOrRegisterWithOAuth(
        {
          provider: 'saml',
          providerUserId: query.sub?.trim() || `saml:${email}`,
          email,
          name: query.name?.trim() || email.split('@')[0] || 'SSO User',
          emailVerified: true,
        },
        {
          ip: req.ip,
          userAgent: req.header('user-agent') ?? undefined,
          termsVersion: row.termsVersion,
        },
      );
      setSessionCookie(res, sessionResult.token);
      setCsrfCookie(res);
      res.redirect(302, `${webBase || ''}${row.returnPath}`);
    } catch {
      res.redirect(302, loginErrorUrl('sso_failed'));
    }
  }

  @Post('terms/accept')
  @HttpCode(200)
  @UseGuards(AuthGuard, CsrfGuard)
  async acceptTerms(@Req() req: Request, @Body() body?: { terms_version?: string }) {
    if (!req.oma?.userId) {
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    }
    const data = await identityService.acceptTerms(req.oma.userId, body?.terms_version);
    return { data };
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
