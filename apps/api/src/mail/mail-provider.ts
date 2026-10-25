import type { MailMessage, MailProviderPort } from '@oma/domain';
import { createLogger } from '@oma/observability';

const log = createLogger('mail');

/**
 * Fallback used when no email provider is configured (MAIL_PROVIDER unset).
 * Never sends. In development it logs the message so the reset link can be copied;
 * in production it logs only that a message was dropped (no tokens in logs).
 */
export class NoopMailAdapter implements MailProviderPort {
  constructor(private readonly verbose = process.env.NODE_ENV !== 'production') {}
  async send(message: MailMessage): Promise<void> {
    if (this.verbose) {
      log.info(
        { to: message.to, subject: message.subject, text: message.text },
        'mail (no provider, dev log)',
      );
    } else {
      log.warn({ subject: message.subject }, 'mail dropped: no MAIL_PROVIDER configured');
    }
  }
}

const registry: Record<string, () => MailProviderPort> = {};

/** Plug a real provider in later: registerMailProvider('ses', () => new SesAdapter()). */
export function registerMailProvider(name: string, factory: () => MailProviderPort) {
  registry[name] = factory;
}

export function createMailProvider(name = process.env.MAIL_PROVIDER): MailProviderPort {
  const key = (name ?? '').trim().toLowerCase();
  if (key && registry[key]) return registry[key]();
  if (key && key !== 'console' && key !== 'none') {
    log.warn({ provider: key }, 'unknown MAIL_PROVIDER; falling back to no-op');
  }
  return new NoopMailAdapter();
}

export function passwordResetLink(webOrigin: string, token: string): string {
  return `${webOrigin.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
}
