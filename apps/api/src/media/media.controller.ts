import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { mediaService, workDriveService } from '../container';

function ctx(req: Request) {
  if (!req.oma?.tenantId)
    throw new DomainError('TENANT_REQUIRED', 'Active tenant required', 409, 'errors.tenant_required');
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
  upload(@Req() req: Request, @Param('brandId') brandId: string, @Query() q: Record<string, string>) {
    const len = req.headers['content-length'];
    return mediaService.upload(ctx(req), brandId, {
      kind: q.kind,
      name: q.name ?? req.headers['x-file-name'],
      mime: req.headers['content-type'],
      length: len != null && /^\d+$/.test(String(len)) ? Number(len) : null,
      body: req as unknown as Readable,
    });
  }

  @Post('api/v1/brands/:brandId/media/import')
  @UseGuards(AuthGuard, CsrfGuard, CapabilitiesGuard)
  importFile(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: unknown) {
    return mediaService.importFile(ctx(req), brandId, body);
  }

  @Get('api/v1/brands/:brandId/media/browse')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  browse(@Req() req: Request, @Param('brandId') brandId: string, @Query() q: Record<string, string>) {
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
    const r = await mediaService.signedUrl(ctx(req).tenantId, assetId, mode === 'download' ? 'download' : 'preview');
    return { data: { url: r.url, expires_at: r.expires_at } };
  }

  /** Stable URL stored in logoUrl / previewAssetUrl / assetUrl: redirects to a fresh signed URL. */
  @Get('api/v1/media/:assetId/view')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  async view(@Req() req: Request, @Res() res: Response, @Param('assetId') assetId: string) {
    const r = await mediaService.signedUrl(ctx(req).tenantId, assetId, 'preview');
    res.setHeader('cache-control', 'private, max-age=300');
    res.redirect(302, r.url);
  }

  /** Byte stream with Range support (video playback). */
  @Get('api/v1/media/:assetId/stream')
  @UseGuards(AuthGuard, CapabilitiesGuard)
  async stream(@Req() req: Request, @Res() res: Response, @Param('assetId') assetId: string) {
    const up = await mediaService.stream(ctx(req).tenantId, assetId, req.headers.range);
    res.status(up.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const v = up.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.setHeader('cache-control', 'private, no-store');
    if (!up.body) return res.end();
    const node = Readable.fromWeb(up.body as never);
    req.on('close', () => node.destroy());
    node.pipe(res);
  }
}
