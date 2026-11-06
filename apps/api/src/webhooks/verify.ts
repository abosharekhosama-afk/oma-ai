import { createHmac, timingSafeEqual } from 'node:crypto';

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function metaSignatureOk(
  raw: Buffer,
  signature: string | undefined,
  secret: string | undefined,
): { ok: boolean; required: boolean } {
  const expectedSecret = secret?.trim();
  if (!expectedSecret) return { ok: true, required: false };
  if (!signature) return { ok: false, required: true };
  const expected = `sha256=${createHmac('sha256', expectedSecret).update(raw).digest('hex')}`;
  return { ok: safeEqual(expected, signature), required: true };
}

export function hmacHexOk(
  raw: Buffer,
  signature: string | undefined,
  secret: string | undefined,
  headerPrefix = '',
): { ok: boolean; required: boolean } {
  const expectedSecret = secret?.trim();
  if (!expectedSecret) return { ok: true, required: false };
  if (!signature) return { ok: false, required: true };
  const digest = createHmac('sha256', expectedSecret).update(raw).digest('hex');
  const presented = signature.startsWith(headerPrefix)
    ? signature.slice(headerPrefix.length)
    : signature;
  return { ok: safeEqual(digest, presented), required: true };
}

export function eventIdFromPayload(platform: string, body: unknown): string {
  if (!body || typeof body !== 'object') return `${platform}:${Date.now()}`;
  const o = body as Record<string, unknown>;
  if (typeof o.id === 'string' && o.id) return o.id;
  const entry = Array.isArray(o.entry)
    ? (o.entry[0] as Record<string, unknown> | undefined)
    : undefined;
  if (entry && typeof entry.id === 'string') {
    const time = entry.time ?? o.time ?? '';
    return `${platform}:${entry.id}:${String(time)}`;
  }
  if (typeof o.event_id === 'string') return o.event_id;
  const json = JSON.stringify(body);
  const hash = createHmac('sha256', platform).update(json).digest('hex').slice(0, 32);
  return `${platform}:${hash}`;
}

export function detectMetaObject(body: unknown): 'META_FB' | 'META_IG' | 'WHATSAPP' | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as { object?: string };
  if (o.object === 'instagram') return 'META_IG';
  if (o.object === 'whatsapp_business_account') return 'WHATSAPP';
  if (o.object === 'page') return 'META_FB';
  return null;
}
