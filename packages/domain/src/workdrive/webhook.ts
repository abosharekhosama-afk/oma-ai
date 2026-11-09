import { createHmac, timingSafeEqual } from 'node:crypto';

export const WORKDRIVE_WEBHOOK_EVENTS = [
  'file.deleted',
  'file.trashed',
  'file.restored',
  'integration_key.revoked',
  'storage.quota_exceeded',
  'storage.quota_near_limit',
] as const;
export type WorkDriveWebhookEventType = (typeof WORKDRIVE_WEBHOOK_EVENTS)[number];

export const DEFAULT_WEBHOOK_TOLERANCE_SEC = 300;

export function workDriveWebhookSecret(env: NodeJS.ProcessEnv = process.env) {
  return (env.WORKDRIVE_WEBHOOK_SECRET ?? '').trim();
}

export function workDriveWebhookPublicUrl(env: NodeJS.ProcessEnv = process.env) {
  return (env.WORKDRIVE_WEBHOOK_PUBLIC_URL ?? '').trim();
}

export function workDriveWebhookToleranceSec(env: NodeJS.ProcessEnv = process.env) {
  const n = Number(env.WORKDRIVE_WEBHOOK_TOLERANCE_SEC);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_WEBHOOK_TOLERANCE_SEC;
}

export function signWorkDriveWebhook(secret: string, timestamp: string, rawBody: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export function verifyWorkDriveWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  signature: string,
) {
  if (!secret || !timestamp || !signature) return false;
  const expected = signWorkDriveWebhook(secret, timestamp, rawBody);
  const got = signature.replace(/^sha256=/i, '');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(got, 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function webhookTimestampFresh(
  timestamp: string,
  now = Date.now(),
  toleranceSec = DEFAULT_WEBHOOK_TOLERANCE_SEC,
) {
  const sec = Number(timestamp);
  if (!Number.isFinite(sec) || sec <= 0) return false;
  return Math.abs(now / 1000 - sec) <= toleranceSec;
}

export type ParsedWorkDriveWebhook = {
  eventId: string;
  type: string;
  createdAt: string | null;
  data: Record<string, unknown>;
};

export function parseWorkDriveWebhookPayload(
  body: unknown,
  headerEvent?: string | null,
): ParsedWorkDriveWebhook | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const r = body as Record<string, unknown>;
  const data =
    r.data && typeof r.data === 'object' && !Array.isArray(r.data)
      ? (r.data as Record<string, unknown>)
      : {};
  const eventId = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : '';
  const type =
    (typeof r.type === 'string' && r.type) ||
    (typeof headerEvent === 'string' && headerEvent) ||
    '';
  if (!eventId || !type) return null;
  return {
    eventId,
    type,
    createdAt: typeof r.created_at === 'string' ? r.created_at : null,
    data,
  };
}

export type WorkDriveWebhookAction =
  | { type: 'mark_missing'; fileId: string }
  | { type: 'mark_restored'; fileId: string }
  | { type: 'key_revoked'; keyId: string; prefix?: string }
  | { type: 'quota_exceeded' }
  | { type: 'noop' };

export function webhookActionFor(event: ParsedWorkDriveWebhook): WorkDriveWebhookAction {
  const fileId = typeof event.data.fileId === 'string' ? event.data.fileId : '';
  const keyId = typeof event.data.keyId === 'string' ? event.data.keyId : '';
  const prefix = typeof event.data.prefix === 'string' ? event.data.prefix : undefined;
  if ((event.type === 'file.deleted' || event.type === 'file.trashed') && fileId) {
    return { type: 'mark_missing', fileId };
  }
  if (event.type === 'file.restored' && fileId) return { type: 'mark_restored', fileId };
  if (event.type === 'integration_key.revoked' && keyId) {
    return { type: 'key_revoked', keyId, prefix };
  }
  if (event.type === 'storage.quota_exceeded') return { type: 'quota_exceeded' };
  return { type: 'noop' };
}
