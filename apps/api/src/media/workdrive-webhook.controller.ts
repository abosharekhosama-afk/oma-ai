import { Controller, Headers, HttpCode, Post, RawBodyRequest, Req } from '@nestjs/common';
import type { Request } from 'express';
import { handleInboundWorkDriveWebhook } from './workdrive-webhook';

@Controller()
export class WorkDriveWebhookController {
  @Post('api/v1/integrations/workdrive/webhook')
  @HttpCode(200)
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-workdrive-signature') signature?: string,
    @Headers('x-workdrive-timestamp') timestamp?: string,
    @Headers('x-workdrive-event') eventHeader?: string,
  ) {
    const raw = req.rawBody?.length
      ? req.rawBody
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    return handleInboundWorkDriveWebhook({
      rawBody: raw,
      signature,
      timestamp,
      eventHeader,
    });
  }
}
