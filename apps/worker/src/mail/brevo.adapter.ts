import type { MailMessage, MailProviderPort } from '@oma/domain';
import { createLogger } from '@oma/observability';
import { MailSendError } from './resend.adapter';

const log = createLogger('mail-brevo');

export const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export type BrevoConfig = {
  apiKey: string;
  from: string;
  replyTo?: string;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function redact(value: string, secret: string): string {
  return secret ? value.split(secret).join('[redacted]') : value;
}

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/** Parse `Name <email@x>` or bare `email@x` into Brevo sender shape. */
export function parseMailFrom(from: string): { name?: string; email: string } {
  const trimmed = from.trim();
  const m = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (m) {
    const name = m[1]!.trim().replace(/^["']|["']$/g, '');
    const email = m[2]!.trim();
    return name ? { name, email } : { email };
  }
  return { email: trimmed };
}

/** Brevo (https://www.brevo.com) transactional email adapter — no SDK dependency. */
export class BrevoMailAdapter implements MailProviderPort {
  private readonly fetchImpl: typeof fetch;
  private readonly sender: { name?: string; email: string };

  constructor(private readonly config: BrevoConfig) {
    if (!config.apiKey) throw new Error('BREVO_API_KEY is not set');
    if (!config.from) throw new Error('MAIL_FROM is not set');
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.sender = parseMailFrom(config.from);
    if (!this.sender.email.includes('@')) {
      throw new Error('MAIL_FROM must include a valid email address');
    }
  }

  async send(message: MailMessage): Promise<void> {
    const body: Record<string, unknown> = {
      sender: this.sender,
      to: [{ email: message.to }],
      subject: message.subject,
      textContent: message.text,
    };
    if (message.html) body.htmlContent = message.html;
    const replyTo = message.replyTo ?? this.config.replyTo;
    if (replyTo) {
      const parsed = parseMailFrom(replyTo);
      body.replyTo = parsed.name ? { name: parsed.name, email: parsed.email } : { email: parsed.email };
    }

    let res: Response;
    try {
      res = await this.fetchImpl(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'api-key': this.config.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
      });
    } catch (err) {
      const reason = redact(err instanceof Error ? err.message : String(err), this.config.apiKey);
      log.error({ to: maskEmail(message.to), reason }, 'brevo request failed (network)');
      throw new MailSendError(`Brevo request failed: ${reason}`, null, true);
    }

    if (res.ok) {
      let id: string | undefined;
      try {
        id = ((await res.json()) as { messageId?: string }).messageId;
      } catch {
        /* body is optional */
      }
      log.info({ to: maskEmail(message.to), id }, 'mail sent via brevo');
      return;
    }

    let detail = '';
    try {
      const raw = await res.text();
      try {
        const parsed = JSON.parse(raw) as { message?: string; code?: string };
        detail = [parsed.code, parsed.message].filter(Boolean).join(': ');
      } catch {
        detail = raw.slice(0, 300);
      }
    } catch {
      /* ignore */
    }
    detail = redact(detail, this.config.apiKey);
    const retryable = res.status === 429 || res.status >= 500;
    const hint =
      res.status === 401 || res.status === 403
        ? 'check BREVO_API_KEY and that the MAIL_FROM sender email or domain is verified in Brevo'
        : res.status === 400
          ? 'check MAIL_FROM format/sender verification and recipient address'
          : undefined;
    log.error(
      { to: maskEmail(message.to), status: res.status, detail, hint },
      'brevo rejected the email',
    );
    throw new MailSendError(
      `Brevo responded ${res.status}${detail ? `: ${detail}` : ''}`,
      res.status,
      retryable,
    );
  }
}

/** Build from env; returns null (with a clear log) when misconfigured. */
export function brevoFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): BrevoMailAdapter | null {
  const apiKey = env.BREVO_API_KEY?.trim() ?? '';
  const from = env.MAIL_FROM?.trim() ?? '';
  const missing = [!apiKey && 'BREVO_API_KEY', !from && 'MAIL_FROM'].filter(Boolean);
  if (missing.length) {
    log.error(
      { missing },
      'MAIL_PROVIDER=brevo but required env vars are missing; emails will not be sent',
    );
    return null;
  }
  return new BrevoMailAdapter({
    apiKey,
    from,
    replyTo: env.MAIL_REPLY_TO?.trim() || undefined,
    fetchImpl,
  });
}
