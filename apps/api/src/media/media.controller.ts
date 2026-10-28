import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { mediaService, workDriveService } from '../container';

function ctx(req: Request) {
  if (!req.oma?.tenantId)
    throw new DomainError(
      'TENANT_REQUIRED',
      'Active tenant required',
      409,
      'errors.tenant_required',
    );
  return {
    tenantId: req.oma.tenantId,
    userId: req.oma.userId!,
    capabilities: req.oma.capabilities ?? [],
    correlationId: req.oma.correlationId,
  };
}

@Controller()
export class WorkDriveController {
  @Get('api/v1/workspace/workdrive')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  status(@Req() req: Request) {
    return workDriveService.status(ctx(req).tenantId);
  }

  @Put('api/v1/workspace/workdrive')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  connect(@Req() req: Request, @Body() body: unknown) {
    const c = ctx(req);
    return workDriveService.connect(c.tenantId, c.userId, body, c.correlationId);
  }

  @Post('api/v1/workspace/workdrive/test')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  test(@Req() req: Request) {
    const c = ctx(req);
    return workDriveService.test(c.tenantId, c.userId, c.correlationId);
  }

  @Delete('api/v1/workspace/workdrive')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  disconnect(@Req() req: Request) {
    const c = ctx(req);
    return workDriveService.disconnect(c.tenantId, c.userId, c.correlationId);
  }
}

@Controller()
export class MediaController {
  @Get('api/v1/brands/:brandId/media')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  list(@Req() req: Request, @Param('brandId') brandId: string, @Query() q: Record<string, string>) {
    return mediaService.list(ctx(req).tenantId, brandId, q);
  }

  /** Raw-body upload: `Content-Type` = file type, `?kind=&name=`. Streamed; the WorkDrive key stays server-side. */
  @Post('api/v1/brands/:brandId/media')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  upload(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Query() q: Record<string, string>,
  ) {
    const len = req.headers['content-length'];
    return mediaService.upload(ctx(req), brandId, {
      kind: q.kind,
      name: q.name ?? req.headers['x-file-name'],
      mime: req.headers['content-type'],
      length: len != null && /^\d+$/.test(String(len)) ? Number(len) : null,
      body: req as unknown as Readable,
    });
  }

  /** Direct upload: returns a signed WorkDrive PUT URL + OMA grant (bytes skip the Vercel proxy). */
  @Post('api/v1/brands/:brandId/media/upload-grant')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  uploadGrant(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: unknown) {
    return mediaService.createUploadGrant(ctx(req), brandId, body);
  }

  @Post('api/v1/media/upload-complete')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  uploadComplete(@Req() req: Request, @Body() body: unknown) {
    return mediaService.completeUploadGrant(ctx(req), body);
  }

  @Post('api/v1/brands/:brandId/media/import')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  importFile(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: unknown) {
    return mediaService.importFile(ctx(req), brandId, body);
  }

  @Get('api/v1/brands/:brandId/media/browse')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  browse(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Query() q: Record<string, string>,
  ) {
    return mediaService.browse(ctx(req).tenantId, brandId, q);
  }

  @Get('api/v1/media/:assetId')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  details(@Req() req: Request, @Param('assetId') assetId: string) {
    return mediaService.details(ctx(req).tenantId, assetId);
  }

  @Get('api/v1/media/:assetId/url')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  async url(@Req() req: Request, @Param('assetId') assetId: string, @Query('mode') mode?: string) {
    const r = await mediaService.signedUrl(
      ctx(req).tenantId,
      assetId,
      mode === 'download' ? 'download' : 'preview',
    );
    return { data: { url: r.url, expires_at: r.expires_at } };
  }

  /**
   * Stable URL stored in logoUrl / previewAssetUrl / assetUrl. Images *and* videos redirect to the
   * signed inline WorkDrive URL: real bytes with the stored MIME and HTTP Range, served straight
   * from storage (no proxy hop through Vercel/API). The redirect itself is cacheable for as long
   * as the signed URL stays valid, so revisiting a screen costs no API round trip at all.
   */
  @Get('api/v1/media/:assetId/view')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  async view(@Req() req: Request, @Res() res: Response, @Param('assetId') assetId: string) {
    const r = await mediaService.signedUrl(ctx(req).tenantId, assetId, 'preview');
    redirectToSigned(res, r.url, r.expires_at);
  }

  /**
   * Video URL (`/stream` marks the asset as a video for clients). Plays from the same signed
   * inline URL as `/view`; only when WorkDrive cannot sign one does it fall back to proxying the
   * byte stream (and if WorkDrive itself redirects, the browser is sent to that location).
   */
  @Get('api/v1/media/:assetId/stream')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  async stream(@Req() req: Request, @Res() res: Response, @Param('assetId') assetId: string) {
    const tenantId = ctx(req).tenantId;
    try {
      const r = await mediaService.signedUrl(tenantId, assetId, 'preview');
      return redirectToSigned(res, r.url, r.expires_at);
    } catch (e) {
      if (e instanceof DomainError && (e.status === 404 || e.status === 410)) throw e;
    }
    const up = await mediaService.stream(tenantId, assetId, req.headers.range);
    if (up.status >= 300 && up.status < 400) {
      res.setHeader('cache-control', 'private, no-store');
      return res.redirect(302, up.headers.get('location') as string);
    }
    res.status(up.status);
    for (const h of [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'etag',
      'last-modified',
    ]) {
      const v = up.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    // Browsers (Safari especially) refuse to play `application/octet-stream`; use the asset MIME.
    const upstreamType = up.headers.get('content-type')?.toLowerCase() ?? '';
    if (up.assetMime && (!upstreamType || upstreamType.startsWith('application/octet-stream'))) {
      res.setHeader('content-type', up.assetMime);
    }
    res.setHeader('cache-control', 'private, no-store');
    if (!up.body) return res.end();
    const node = Readable.fromWeb(up.body as never);
    req.on('close', () => node.destroy());
    node.pipe(res);
  }
}

/** Redirect cache lifetime: the signed URL's remaining validity minus a safety margin (≤ 10 min). */
function redirectToSigned(res: Response, url: string, expiresAt: string) {
  const left = Math.floor((Date.parse(expiresAt) - Date.now()) / 1000) - 90;
  const maxAge = Math.max(0, Math.min(600, left));
  res.setHeader('cache-control', maxAge > 0 ? `private, max-age=${maxAge}` : 'private, no-store');
  res.redirect(302, url);
}
