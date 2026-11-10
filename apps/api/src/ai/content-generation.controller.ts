import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError, type ContentGenerationKind, type ContentLength } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { generateBrandContent } from './content-generation.service';

type GenerateBody = {
  kind?: ContentGenerationKind;
  channel?: string;
  language?: string;
  caption?: string;
  title?: string;
  tone?: string;
  length?: ContentLength;
  variant_count?: number;
  content_id?: string;
  idempotency_key?: string;
};

@Controller()
@UseGuards(AuthGuard, CapabilitiesGuard)
export class ContentGenerationController {
  private actor(req: Request) {
    if (!req.oma?.userId) {
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    }
    if (!req.oma.tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );
    }
    return req.oma;
  }

  private idempotencyKey(req: Request, body: GenerateBody, fallback: string) {
    return req.header('idempotency-key') || body.idempotency_key || fallback;
  }

  private async run(
    req: Request,
    brandId: string,
    kind: ContentGenerationKind,
    body: GenerateBody,
  ) {
    const actor = this.actor(req);
    const data = await generateBrandContent({
      tenantId: actor.tenantId!,
      actorUserId: actor.userId!,
      brandId,
      kind,
      channel: body.channel,
      language: body.language,
      caption: body.caption,
      title: body.title,
      tone: body.tone,
      length: body.length,
      variantCount: body.variant_count,
      contentId: body.content_id,
      idempotencyKey: this.idempotencyKey(
        req,
        body,
        `${kind}:${brandId}:${actor.userId}:${Date.now()}`,
      ),
      correlationId: actor.correlationId,
    });
    return { data };
  }

  @Post('api/v1/brands/:brandId/ai/generate')
  @UseGuards(CsrfGuard)
  generate(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: GenerateBody) {
    const kind = body.kind ?? 'caption';
    return this.run(req, brandId, kind, body);
  }

  @Post('api/v1/brands/:brandId/ai/captions')
  @UseGuards(CsrfGuard)
  captions(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: GenerateBody) {
    return this.run(req, brandId, 'caption', body);
  }

  @Post('api/v1/brands/:brandId/ai/captions/rewrite')
  @UseGuards(CsrfGuard)
  rewrite(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: GenerateBody) {
    return this.run(req, brandId, 'rewrite', body);
  }

  @Post('api/v1/brands/:brandId/ai/alt-text')
  @UseGuards(CsrfGuard)
  altText(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: GenerateBody) {
    return this.run(req, brandId, 'alt', body);
  }

  @Post('api/v1/brands/:brandId/ai/ideas')
  @UseGuards(CsrfGuard)
  ideas(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: GenerateBody) {
    return this.run(req, brandId, 'idea', body);
  }

  @Post('api/v1/brands/:brandId/ai/hashtags')
  @UseGuards(CsrfGuard)
  hashtags(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: GenerateBody) {
    return this.run(req, brandId, 'hashtags', body);
  }
}
