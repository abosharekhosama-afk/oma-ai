import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Stripe webhook signing: `t=timestamp,v1=hex` over `${timestamp}.${rawBody}`
 * using HMAC-SHA256 and the webhook signing secret.
 * https://docs.stripe.com/webhooks#verify-official-libraries
 */
export function verifyStripeSignature(
  rawBody: Buffer | string,
  header: string | undefined,
  secret: string,
  opts?: { toleranceSec?: number; nowMs?: number },
): { ok: true; timestamp: number } | { ok: false; reason: string } {
  if (!secret) return { ok: false, reason: 'missing_secret' };
  if (!header) return { ok: false, reason: 'missing_header' };
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return i === -1 ? [p, ''] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isFinite(timestamp) || !signature) return { ok: false, reason: 'malformed_header' };
  const tolerance = opts?.toleranceSec ?? 300;
  const nowMs = opts?.nowMs ?? Date.now();
  if (Math.abs(nowMs / 1000 - timestamp) > tolerance)
    return { ok: false, reason: 'timestamp_out_of_tolerance' };
  const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return { ok: false, reason: 'bad_signature' };
  return { ok: true, timestamp };
}

/**
 * Lahza webhook signing: HMAC-SHA256 of the raw body with the secret key,
 * compared to the `x-lahza-signature` header.
 * https://docs.lahza.io/payments/webhooks
 */
export function verifyLahzaSignature(
  rawBody: Buffer | string,
  header: string | undefined,
  secret: string,
): { ok: true } | { ok: false; reason: string } {
  if (!secret) return { ok: false, reason: 'missing_secret' };
  if (!header) return { ok: false, reason: 'missing_header' };
  const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(header.trim(), 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return { ok: false, reason: 'bad_signature' };
  return { ok: true };
}
