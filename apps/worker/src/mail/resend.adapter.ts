import type { MailMessage, MailProviderPort } from '@oma/domain';
import { createLogger } from '@oma/observability';

const log = createLogger('mail-resend');

export const RESEND_API_URL = 'https://api.resend.com/emails';

export type ResendConfig = {
  apiKey: string;
  from: string;
  replyTo?: string;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** Error thrown on a failed send. Never contains the API key. */
export class MailSendError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'MailSendError';
  }
}

function redact(value: string, secret: string): string {
  return secret ? value.split(secret).join('[redacted]') : value;
}

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/** Resend (https://resend.com) adapter over its REST API — no SDK dependency. */
export class ResendMailAdapter implements MailProviderPort {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: ResendConfig) {
    if (!config.apiKey) throw new Error('RESEND_API_KEY is not set');
    if (!config.from) throw new Error('MAIL_FROM is not set');
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async send(message: MailMessage): Promise<void> {
    const body: Record<string, unknown> = {
      from: this.config.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    };
    if (message.html) body.html = message.html;
    const replyTo = message.replyTo ?? this.config.replyTo;
    if (replyTo) body.reply_to = replyTo;

    let res: Response;
    try {
      res = await this.fetchImpl(RESEND_API_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
      });
    } catch (err) {
      const reason = redact(err instanceof Error ? err.message : String(err), this.config.apiKey);
      log.error({ to: maskEmail(message.to), reason }, 'resend request failed (network)');
      throw new MailSendError(`Resend request failed: ${reason}`, null, true);
    }

    if (res.ok) {
      let id: string | undefined;
      try {
        id = ((await res.json()) as { id?: string }).id;
      } catch {
        /* body is optional for our purposes */
      }
      log.info({ to: maskEmail(message.to), id }, 'mail sent via resend');
      return;
    }

    let detail = '';
    try {
      const raw = await res.text();
      try {
        const parsed = JSON.parse(raw) as { message?: string; name?: string };
        detail = [parsed.name, parsed.message].filter(Boolean).join(': ');
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
        ? 'check RESEND_API_KEY and that the MAIL_FROM domain is verified in Resend'
        : res.status === 422
          ? 'check MAIL_FROM format/domain and recipient address'
          : undefined;
    log.error(
      { to: maskEmail(message.to), status: res.status, detail, hint },
      'resend rejected the email',
    );
    throw new MailSendError(
      `Resend responded ${res.status}${detail ? `: ${detail}` : ''}`,
      res.status,
      retryable,
    );
  }
}

/** Build from env; returns null (with a clear log) when misconfigured. */
export function resendFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): ResendMailAdapter | null {
  const apiKey = env.RESEND_API_KEY?.trim() ?? '';
  const from = env.MAIL_FROM?.trim() ?? '';
  const missing = [!apiKey && 'RESEND_API_KEY', !from && 'MAIL_FROM'].filter(Boolean);
  if (missing.length) {
    log.error(
      { missing },
      'MAIL_PROVIDER=resend but required env vars are missing; emails will not be sent',
    );
    return null;
  }
  return new ResendMailAdapter({
    apiKey,
    from,
    replyTo: env.MAIL_REPLY_TO?.trim() || undefined,
    fetchImpl,
  });
}
