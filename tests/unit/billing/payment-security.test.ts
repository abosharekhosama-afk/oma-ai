import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isSafeCheckoutRedirect,
  resolvePublicAppOrigin,
} from '../../../packages/domain/src/billing/urls';
import { parseReceiptImage } from '../../../packages/domain/src/billing/receipt';

const read = (rel: string) => readFileSync(resolve(rel), 'utf8');
const pngPixel =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('payment and subscription security guards', () => {
  it('does not handle raw card data and verifies webhook signatures with idempotency', () => {
    const stripe = read('apps/api/src/billing/providers/stripe.adapter.ts');
    const webhooks = read('apps/api/src/billing/billing-webhook.controller.ts');
    const service = read('apps/api/src/billing/billing.service.ts');
    expect(stripe).not.toMatch(/cardNumber|cvc|cvv/i);
    expect(service).not.toMatch(/cardNumber|cvc|cvv/i);
    expect(service).toContain('verifyStripeSignature');
    expect(service).toContain('verifyLahzaSignature');
    expect(service).toContain('claimWebhook');
    expect(service).toContain('payloadHash');
    expect(webhooks).toContain('stripe-signature');
    expect(webhooks).toContain('x-lahza-signature');
    expect(service).toContain('quoteFor');
    expect(service).toContain('checkout.xApiAddon');
  });

  it('validates public return origins and https checkout redirects', () => {
    expect(resolvePublicAppOrigin('https://app.oma.example')).toBe('https://app.oma.example');
    expect(resolvePublicAppOrigin('javascript:alert(1)')).toBe('http://127.0.0.1:3000');
    expect(isSafeCheckoutRedirect('https://checkout.stripe.com/c/pay/cs_test')).toBe(true);
    expect(isSafeCheckoutRedirect('http://evil.example/pay')).toBe(false);
    const service = read('apps/api/src/billing/billing.service.ts');
    const client = read('apps/web/src/app/(app)/app/billing/billing-client.tsx');
    expect(service).toContain('resolvePublicAppOrigin');
    expect(client).toContain('isSafeCheckoutRedirect');
  });

  it('rejects receipt images whose magic bytes do not match the declared type', () => {
    expect(parseReceiptImage(pngPixel, 'image/png').ok).toBe(true);
    expect(parseReceiptImage(pngPixel, 'image/jpeg').ok).toBe(false);
    const service = read('apps/api/src/billing/billing.service.ts');
    expect(service).toContain('sniffImageMime');
    expect(service).toContain('RECEIPT_ALLOWED_MIME');
  });
});
