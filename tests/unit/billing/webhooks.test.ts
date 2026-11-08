import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyLahzaSignature, verifyStripeSignature } from '@oma/domain';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('billing webhook signatures', () => {
  it('accepts a valid Stripe signed payload and rejects a bad one', () => {
    const secret = 'whsec_test';
    const payload = '{"id":"evt_1","type":"invoice.paid"}';
    const timestamp = 1_783_564_800;
    const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    const header = `t=${timestamp},v1=${signature}`;
    expect(verifyStripeSignature(payload, header, secret, { nowMs: timestamp * 1000 })).toEqual({
      ok: true,
      timestamp,
    });
    expect(verifyStripeSignature(payload, header, 'wrong', { nowMs: timestamp * 1000 }).ok).toBe(
      false,
    );
    expect(verifyStripeSignature(payload, undefined, secret).ok).toBe(false);
  });

  it('accepts a valid Lahza HMAC of the raw body', () => {
    const secret = 'sk_test_lahza';
    const payload = '{"event":"charge.success","data":{"reference":"OMA-1"}}';
    const header = createHmac('sha256', secret).update(payload).digest('hex');
    expect(verifyLahzaSignature(payload, header, secret)).toEqual({ ok: true });
    expect(verifyLahzaSignature(payload, 'nope', secret).ok).toBe(false);
  });

  it('registers billing webhook routes that read the raw body', () => {
    const src = readFileSync(resolve('apps/api/src/billing/billing-webhook.controller.ts'), 'utf8');
    expect(src).toContain('api/webhooks/billing/stripe');
    expect(src).toContain('api/webhooks/billing/lahza');
    expect(src).toContain('stripe-signature');
    expect(src).toContain('x-lahza-signature');
    expect(src).toContain('rawBody');
  });
});
