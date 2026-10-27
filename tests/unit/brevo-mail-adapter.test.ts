import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BREVO_API_URL,
  BrevoMailAdapter,
  brevoFromEnv,
  parseMailFrom,
} from '../../apps/worker/src/mail/brevo.adapter';
import { MailSendError } from '../../apps/worker/src/mail/resend.adapter';
import { createMailAdapter } from '../../apps/worker/src/mail/create-mail-adapter';

const KEY = 'xkeysib-test-secret-key-123';

function fakeFetch(status: number, body: unknown) {
  return vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
}

afterEach(() => vi.unstubAllEnvs());

describe('parseMailFrom', () => {
  it('parses Name <email> and bare email', () => {
    expect(parseMailFrom('OMA <no-reply@example.com>')).toEqual({
      name: 'OMA',
      email: 'no-reply@example.com',
    });
    expect(parseMailFrom('no-reply@example.com')).toEqual({ email: 'no-reply@example.com' });
  });
});

describe('BrevoMailAdapter', () => {
  it('POSTs to Brevo with api-key, sender, html/text and replyTo', async () => {
    const f = fakeFetch(201, { messageId: '<msg@brevo>' });
    const a = new BrevoMailAdapter({
      apiKey: KEY,
      from: 'OMA <no-reply@example.com>',
      replyTo: 'support@example.com',
      fetchImpl: f as unknown as typeof fetch,
    });
    await a.send({ to: 'u@x.com', subject: 'Hi', text: 'plain', html: '<p>hi</p>' });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(BREVO_API_URL);
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['api-key']).toBe(KEY);
    expect(JSON.parse(String(init?.body))).toEqual({
      sender: { name: 'OMA', email: 'no-reply@example.com' },
      to: [{ email: 'u@x.com' }],
      subject: 'Hi',
      textContent: 'plain',
      htmlContent: '<p>hi</p>',
      replyTo: { email: 'support@example.com' },
    });
  });

  it('omits html and replyTo when not provided', async () => {
    const f = fakeFetch(201, { messageId: 'x' });
    const a = new BrevoMailAdapter({
      apiKey: KEY,
      from: 'a@b.c',
      fetchImpl: f as unknown as typeof fetch,
    });
    await a.send({ to: 'u@x.com', subject: 's', text: 't' });
    const body = JSON.parse(String(f.mock.calls[0]![1]?.body));
    expect(body.htmlContent).toBeUndefined();
    expect(body.replyTo).toBeUndefined();
    expect(body.sender).toEqual({ email: 'a@b.c' });
  });

  it('throws a non-retryable MailSendError on 4xx without leaking the key', async () => {
    const f = fakeFetch(401, { code: 'unauthorized', message: `bad key ${KEY}` });
    const a = new BrevoMailAdapter({
      apiKey: KEY,
      from: 'a@b.c',
      fetchImpl: f as unknown as typeof fetch,
    });
    const err = await a.send({ to: 'u@x.com', subject: 's', text: 't' }).catch((e) => e);
    expect(err).toBeInstanceOf(MailSendError);
    expect(err.status).toBe(401);
    expect(err.retryable).toBe(false);
    expect(err.message).toContain('unauthorized');
    expect(err.message).not.toContain(KEY);
  });

  it('marks 429 / 5xx as retryable', async () => {
    for (const status of [429, 500, 503]) {
      const f = fakeFetch(status, 'oops');
      const a = new BrevoMailAdapter({
        apiKey: KEY,
        from: 'a@b.c',
        fetchImpl: f as unknown as typeof fetch,
      });
      const err = await a.send({ to: 'u@x.com', subject: 's', text: 't' }).catch((e) => e);
      expect(err.retryable).toBe(true);
    }
  });

  it('wraps network errors and redacts the key', async () => {
    const f = vi.fn(async () => {
      throw new Error(`socket hang up ${KEY}`);
    });
    const a = new BrevoMailAdapter({
      apiKey: KEY,
      from: 'a@b.c',
      fetchImpl: f as unknown as typeof fetch,
    });
    const err = await a.send({ to: 'u@x.com', subject: 's', text: 't' }).catch((e) => e);
    expect(err).toBeInstanceOf(MailSendError);
    expect(err.status).toBeNull();
    expect(err.message).not.toContain(KEY);
  });
});

describe('brevoFromEnv / createMailAdapter', () => {
  it('returns null when BREVO_API_KEY or MAIL_FROM is missing', () => {
    expect(brevoFromEnv({ MAIL_FROM: 'a@b.c' } as NodeJS.ProcessEnv)).toBeNull();
    expect(brevoFromEnv({ BREVO_API_KEY: KEY } as NodeJS.ProcessEnv)).toBeNull();
  });

  it('selects Brevo when MAIL_PROVIDER=brevo and configured, else console', () => {
    vi.stubEnv('MAIL_PROVIDER', 'brevo');
    vi.stubEnv('BREVO_API_KEY', KEY);
    vi.stubEnv('MAIL_FROM', 'OMA <no-reply@example.com>');
    expect(createMailAdapter({} as never)).toBeInstanceOf(BrevoMailAdapter);
    vi.stubEnv('BREVO_API_KEY', '');
    expect(createMailAdapter({} as never)).not.toBeInstanceOf(BrevoMailAdapter);
  });
});
