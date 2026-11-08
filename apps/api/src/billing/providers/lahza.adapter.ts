/**
 * Lahza / Bank of Palestine — only documented public endpoints:
 *   POST https://api.lahza.io/transaction/initialize
 *   GET  https://api.lahza.io/transaction/verify/:reference
 *   POST https://api.lahza.io/transaction/charge_authorization
 *   Webhook HMAC: x-lahza-signature (docs.lahza.io/payments/webhooks)
 */
import type { PaymentCheckoutRequest, PaymentCheckoutResult } from '../payment-port';
import { lahzaConfigured } from './registry';

const LAHZA_BASE = 'https://api.lahza.io';

async function lahzaFetch(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const secret = process.env.LAHZA_SECRET_KEY?.trim();
  if (!secret) throw new Error('lahza_not_configured');
  const res = await fetch(`${LAHZA_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof json.message === 'string' ? json.message : `Lahza HTTP ${res.status}`;
    throw new Error(message);
  }
  return json;
}

export async function startLahzaCheckout(
  input: PaymentCheckoutRequest,
): Promise<PaymentCheckoutResult> {
  if (!lahzaConfigured()) return { configured: false, reason: 'lahza_not_configured' };
  const amount = String(input.amountIncVatCents + (input.addonIncVatCents ?? 0));
  const payload = {
    email: input.customerEmail || `billing+${input.tenantId}@oma.local`,
    amount,
    currency: input.currency.toUpperCase(),
    reference: input.checkoutId,
    callback_url: input.successUrl,
    metadata: input.metadata,
  };
  const json = await lahzaFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = (json.data ?? {}) as Record<string, unknown>;
  const url = typeof data.authorization_url === 'string' ? data.authorization_url : null;
  const reference = typeof data.reference === 'string' ? data.reference : input.checkoutId;
  if (!url) return { configured: false, reason: 'lahza_missing_authorization_url' };
  return { configured: true, redirectUrl: url, providerRef: reference, mode: 'redirect' };
}

export async function verifyLahzaTransaction(reference: string): Promise<{
  ok: boolean;
  status?: string;
  amount?: number;
  authorizationCode?: string;
  customerEmail?: string;
  raw: Record<string, unknown>;
}> {
  const json = await lahzaFetch(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
  });
  const data = (json.data ?? {}) as Record<string, unknown>;
  const authorization = (data.authorization ?? {}) as Record<string, unknown>;
  const customer = (data.customer ?? {}) as Record<string, unknown>;
  const status = typeof data.status === 'string' ? data.status : undefined;
  return {
    ok: json.status === true && status === 'success',
    status,
    amount: typeof data.amount === 'number' ? data.amount : Number(data.amount ?? NaN),
    authorizationCode:
      typeof authorization.authorization_code === 'string'
        ? authorization.authorization_code
        : undefined,
    customerEmail: typeof customer.email === 'string' ? customer.email : undefined,
    raw: json,
  };
}

/** Documented recurring charge: POST /transaction/charge_authorization */
export async function chargeLahzaAuthorization(input: {
  authorizationCode: string;
  email: string;
  amountCents: number;
}): Promise<{ ok: boolean; reference?: string }> {
  const json = await lahzaFetch('/transaction/charge_authorization', {
    method: 'POST',
    body: JSON.stringify({
      authorization_code: input.authorizationCode,
      email: input.email,
      amount: String(input.amountCents),
    }),
  });
  const data = (json.data ?? {}) as Record<string, unknown>;
  const status = typeof data.status === 'string' ? data.status : undefined;
  return {
    ok: json.status === true && status === 'success',
    reference: typeof data.reference === 'string' ? data.reference : undefined,
  };
}

export function extractLahzaReference(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;
  const data = (body.data ?? {}) as Record<string, unknown>;
  for (const candidate of [data.reference, body.reference, data.trxref]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

export { lahzaConfigured };
