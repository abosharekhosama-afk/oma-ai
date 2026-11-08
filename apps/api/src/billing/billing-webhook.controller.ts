import { Controller, Headers, HttpCode, Post, RawBodyRequest, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '@oma/domain';
import { billingService } from './billing.service';

function raw(req: RawBodyRequest<Request>, body: unknown): Buffer {
  if (req.rawBody?.length) return req.rawBody;
  return Buffer.from(typeof body === 'string' ? body : JSON.stringify(body ?? {}));
}

@Controller()
export class BillingWebhookController {
  @Post('api/webhooks/billing/stripe')
  @HttpCode(200)
  async stripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature) {
      throw new DomainError(
        'PERMISSION_DENIED',
        'Missing Stripe signature',
        400,
        'errors.permission_denied',
      );
    }
    return billingService.handleStripeWebhook(raw(req, req.body), signature);
  }

  @Post('api/webhooks/billing/lahza')
  @HttpCode(200)
  async lahza(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-lahza-signature') signature?: string,
  ) {
    return billingService.handleLahzaWebhook(raw(req, req.body), signature);
  }
}
