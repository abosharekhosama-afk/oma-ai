import type { MailMessage, MailProviderPort } from '@oma/domain';
import { createLogger } from '@oma/observability';
import type IORedis from 'ioredis';
import { brevoFromEnv } from './brevo.adapter';
import { resendFromEnv } from './resend.adapter';

const log = createLogger('mail');

export const RECORDING_MAIL_REDIS_KEY = 'oma:test:mail:sent';

export class ConsoleMailAdapter implements MailProviderPort {
  async send(message: MailMessage): Promise<void> {
    log.info({ to: message.to, subject: message.subject, text: message.text }, 'console mail');
  }
}

/** Test-only adapter at the external mail provider boundary (no vendor, no vi.mock). */
export class RedisRecordingMailAdapter implements MailProviderPort {
  constructor(
    private readonly redis: IORedis,
    private readonly key = RECORDING_MAIL_REDIS_KEY,
  ) {}

  async send(message: MailMessage): Promise<void> {
    await this.redis.rpush(
      this.key,
      JSON.stringify({ ...message, sentAt: new Date().toISOString() }),
    );
  }
}

export async function drainRecordedMail(
  redis: IORedis,
  key = RECORDING_MAIL_REDIS_KEY,
): Promise<MailMessage[]> {
  const raw = await redis.lrange(key, 0, -1);
  await redis.del(key);
  return raw.map((row) => JSON.parse(row) as MailMessage);
}

export function createMailAdapter(connection: IORedis): MailProviderPort {
  const mode = (process.env.MAIL_PROVIDER ?? 'console').toLowerCase();
  if (mode === 'recording') {
    return new RedisRecordingMailAdapter(connection);
  }
  if (mode === 'resend') {
    const resend = resendFromEnv();
    if (resend) return resend;
    log.warn('falling back to console mail: Resend is not fully configured');
    return new ConsoleMailAdapter();
  }
  if (mode === 'brevo') {
    const brevo = brevoFromEnv();
    if (brevo) return brevo;
    log.warn('falling back to console mail: Brevo is not fully configured');
    return new ConsoleMailAdapter();
  }
  if (mode !== 'console') {
    log.warn({ provider: mode }, 'unknown MAIL_PROVIDER; using console mail');
  }
  return new ConsoleMailAdapter();
}
