import { Body, Controller, Get, Headers, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { enqueueInboxWebhook } from '../inbox/enqueue-inbox';

/**
 * Public webhook receivers. Always acknowledge quickly (200) and push to BullMQ.
 * Signature verification is enforced when platform secrets are configured.
 */
@Controller()
export class WebhooksController {
  @Get('api/webhooks/meta')
  metaVerify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();
    if (mode === 'subscribe' && expected && token === expected) {
      res.status(200).send(challenge ?? '');
      return;
    }
    if (mode === 'subscribe' && !expected) {
      // Dev mode without token configured
      res.status(200).send(challenge ?? '');
      return;
    }
    res.status(403).send('Forbidden');
  }

  @Post('api/webhooks/meta')
  async metaIngress(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: unknown,
  ) {
    const secret = process.env.META_APP_SECRET?.trim();
    if (secret && signature) {
      const raw = (req as Request & { rawBody?: Buffer }).rawBody;
      const payload = raw ?? Buffer.from(JSON.stringify(body));
      const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        res.status(401).send('Invalid signature');
        return;
      }
    }
    // Meta can send FB + IG in one payload; worker splits entries.
    const platform = detectMetaPlatform(body) ?? 'META_FB';
    await enqueueInboxWebhook({
      platform,
      raw: body,
      receivedAt: new Date().toISOString(),
    });
    res.status(200).send('EVENT_RECEIVED');
  }

  @Post('api/webhooks/tiktok')
  async tiktokIngress(@Res() res: Response, @Body() body: unknown) {
    await enqueueInboxWebhook({
      platform: 'TIKTOK',
      raw: body,
      receivedAt: new Date().toISOString(),
    });
    res.status(200).json({ ok: true });
  }

  @Post('api/webhooks/linkedin')
  async linkedinIngress(@Res() res: Response, @Body() body: unknown) {
    await enqueueInboxWebhook({
      platform: 'LINKEDIN',
      raw: body,
      receivedAt: new Date().toISOString(),
    });
    res.status(200).json({ ok: true });
  }
}

function detectMetaPlatform(body: unknown): 'META_FB' | 'META_IG' | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as { object?: string };
  if (o.object === 'instagram') return 'META_IG';
  if (o.object === 'page') return 'META_FB';
  return null;
}
