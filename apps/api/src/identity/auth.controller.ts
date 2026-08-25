import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { identityService } from '../container';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { clearSessionCookie, setCsrfCookie, setSessionCookie } from './session-cookie';
import { DomainError } from '@oma/domain';

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
    return identityService.me(req.oma.userId);
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
