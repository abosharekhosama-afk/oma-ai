import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  resolveCheckoutProvider,
  visiblePaymentProviders,
} from '../../../apps/api/src/billing/providers/registry';
import { planErrorFromUnknown } from '../../../apps/web/src/lib/billing-api';

const KEYS = [
  'STRIPE_SECRET_KEY',
  'LAHZA_SECRET_KEY',
  'BILLING_BANK_TRANSFER_DISABLED',
  'JAWWAL_PAY_ENABLED',
  'PALPAY_ENABLED',
  'REFLECT_ENABLED',
] as const;

function setEnv(map: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) {
    if (map[key] === undefined) delete process.env[key];
    else process.env[key] = map[key];
  }
}

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe('checkout provider fallback', () => {
  it('falls back from Stripe to bank transfer when Stripe is not configured', () => {
    setEnv({});
    expect(resolveCheckoutProvider('stripe')).toEqual({
      id: 'bank_transfer',
      fallback: true,
      requested: 'stripe',
    });
    expect(visiblePaymentProviders().map((p) => p.id)).toEqual(['bank_transfer']);
    expect(visiblePaymentProviders().every((p) => p.configured)).toBe(true);
  });

  it('uses Stripe when the secret key is present and hides Lahza until it is configured', () => {
    setEnv({ STRIPE_SECRET_KEY: 'sk_test_123' });
    expect(resolveCheckoutProvider('stripe')).toEqual({
      id: 'stripe',
      fallback: false,
      requested: 'stripe',
    });
    const ids = visiblePaymentProviders().map((p) => p.id);
    expect(ids).toContain('stripe');
    expect(ids).not.toContain('lahza');
  });

  it('still offers bank transfer when the disable flag is set but no live provider exists', () => {
    setEnv({ BILLING_BANK_TRANSFER_DISABLED: '1' });
    expect(resolveCheckoutProvider('stripe').id).toBe('bank_transfer');
    expect(visiblePaymentProviders().some((p) => p.id === 'bank_transfer' && p.configured)).toBe(
      true,
    );
  });

  it('hides bank transfer when it is disabled and Stripe is live', () => {
    setEnv({ STRIPE_SECRET_KEY: 'sk_test_123', BILLING_BANK_TRANSFER_DISABLED: '1' });
    expect(visiblePaymentProviders().map((p) => p.id)).toEqual(['stripe']);
    expect(resolveCheckoutProvider().id).toBe('stripe');
  });

  it('wires startCheckout to the fallback helper and hides unconfigured providers in the UI', () => {
    const service = readFileSync(resolve('apps/api/src/billing/billing.service.ts'), 'utf8');
    expect(service).toContain('resolveCheckoutProvider');
    expect(service).toContain('visiblePaymentProviders');
    expect(service).toContain('manualCheckoutMessage');
    const client = readFileSync(
      resolve('apps/web/src/app/(app)/app/billing/billing-client.tsx'),
      'utf8',
    );
    expect(client).toContain('planErrorFromUnknown');
    expect(client).toContain('.filter((item) => item.configured)');
    const api = readFileSync(resolve('apps/web/src/lib/billing-api.ts'), 'utf8');
    expect(api).toContain('لم يتم إعداد Stripe بعد');
    const admin = readFileSync(
      resolve('apps/web/src/app/(app)/app/admin/billing/admin-billing-client.tsx'),
      'utf8',
    );
    expect(admin).toContain('adminActivateWorkspace');
    expect(admin).toContain('planErrorFromUnknown');
  });
});

describe('upgrade error copy', () => {
  it('surfaces the Arabic Stripe setup message from a failed checkout', () => {
    const err = Object.assign(new Error('That payment method is not available'), {
      code: 'PROVIDER_NOT_CONFIGURED',
      data: {
        error: {
          code: 'PROVIDER_NOT_CONFIGURED',
          message_key: 'errors.stripe_not_configured',
          details: [{ provider: 'stripe', message_ar: 'لم يتم إعداد Stripe بعد' }],
        },
      },
    });
    expect(planErrorFromUnknown(err, true)).toBe('لم يتم إعداد Stripe بعد');
    expect(planErrorFromUnknown(err, false)).toBe('Stripe is not set up yet');
  });
});
