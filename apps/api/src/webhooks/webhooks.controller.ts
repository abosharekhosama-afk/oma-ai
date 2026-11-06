import { Body, Controller, Get, Headers, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHmac } from 'node:crypto';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { enqueueInboxWebhook } from '../inbox/enqueue-inbox';
import { detectMetaObject, eventIdFromPayload, hmacHexOk, metaSignatureOk } from './verify';

/**
 * Public webhook receivers. Always acknowledge quickly (200) after signature checks
 * and persist the event (FR-090) before pushing to BullMQ.
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
    const expected = (
      process.env.META_WEBHOOK_VERIFY_TOKEN ||
      process.env.WHATSAPP_VERIFY_TOKEN ||
      ''
    ).trim();
    if (mode === 'subscribe' && expected && token === expected) {
      res.status(200).send(challenge ?? '');
      return;
    }
    if (mode === 'subscribe' && !expected) {
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
    const raw = rawBody(req, body);
    const check = metaSignatureOk(raw, signature, process.env.META_APP_SECRET);
    if (!check.ok) {
      res.status(401).send('Invalid signature');
      return;
    }
    const platform = detectMetaObject(body) ?? 'META_FB';
    await persistAndEnqueue(platform, body, check.ok);
    res.status(200).send('EVENT_RECEIVED');
  }

  @Get('api/webhooks/whatsapp')
  whatsappVerify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    this.metaVerify(mode, token, challenge, res);
  }

  @Post('api/webhooks/whatsapp')
  async whatsappIngress(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: unknown,
  ) {
    const raw = rawBody(req, body);
    const check = metaSignatureOk(raw, signature, process.env.META_APP_SECRET);
    if (!check.ok) {
      res.status(401).send('Invalid signature');
      return;
    }
    await persistAndEnqueue('WHATSAPP', body, check.ok);
    res.status(200).send('EVENT_RECEIVED');
  }

  @Get('api/webhooks/tiktok')
  tiktokVerify(@Query('challenge') challenge: string, @Res() res: Response) {
    res.status(200).json({ challenge: challenge ?? 'ok' });
  }

  @Post('api/webhooks/tiktok')
  async tiktokIngress(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-tiktok-signature') signature: string | undefined,
    @Body() body: unknown,
  ) {
    const raw = rawBody(req, body);
    const check = hmacHexOk(raw, signature, process.env.TIKTOK_WEBHOOK_SECRET);
    if (!check.ok) {
      res.status(401).json({ ok: false });
      return;
    }
    await persistAndEnqueue('TIKTOK', body, check.ok);
    res.status(200).json({ ok: true });
  }

  @Post('api/webhooks/linkedin')
  async linkedinIngress(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-li-signature') signature: string | undefined,
    @Body() body: unknown,
  ) {
    const raw = rawBody(req, body);
    const check = hmacHexOk(raw, signature, process.env.LINKEDIN_WEBHOOK_SECRET);
    if (!check.ok) {
      res.status(401).json({ ok: false });
      return;
    }
    await persistAndEnqueue('LINKEDIN', body, check.ok);
    res.status(200).json({ ok: true });
  }

  @Get('api/webhooks/x')
  xCrc(@Query('crc_token') crc: string, @Res() res: Response) {
    if (!crc) {
      res.status(400).json({ error: 'crc_token required' });
      return;
    }
    const secret = process.env.X_WEBHOOK_SECRET?.trim() || process.env.X_CLIENT_SECRET?.trim();
    if (!secret) {
      res.status(200).json({ response_token: crc });
      return;
    }
    const response_token = `sha256=${createHmac('sha256', secret).update(crc).digest('base64')}`;
    res.status(200).json({ response_token });
  }

  @Post('api/webhooks/x')
  async xIngress(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-twitter-webhooks-signature') signature: string | undefined,
    @Body() body: unknown,
  ) {
    const raw = rawBody(req, body);
    const secret = process.env.X_WEBHOOK_SECRET || process.env.X_CLIENT_SECRET;
    const check = hmacHexOk(raw, signature, secret, 'sha256=');
    if (!check.ok) {
      res.status(401).json({ ok: false });
      return;
    }
    await persistAndEnqueue('X', body, check.ok);
    res.status(200).json({ ok: true });
  }
}

function rawBody(req: Request, body: unknown): Buffer {
  const tagged = (req as Request & { rawBody?: Buffer }).rawBody;
  if (tagged?.length) return tagged;
  return Buffer.from(typeof body === 'string' ? body : JSON.stringify(body ?? {}));
}

async function persistAndEnqueue(platform: string, body: unknown, signatureOk: boolean) {
  const eventId = eventIdFromPayload(platform, body);
  try {
    await getPrisma().socialWebhookEvent.upsert({
      where: { platform_eventId: { platform, eventId } },
      create: {
        id: newId(),
        platform,
        eventId,
        signatureOk,
        payloadJson: JSON.stringify(body ?? {}),
      },
      update: {},
    });
  } catch {
    // Persistence must not block the 200 ack; the queue still receives the payload.
  }
  await enqueueInboxWebhook({
    platform: platform as never,
    raw: body,
    receivedAt: new Date().toISOString(),
  });
}
