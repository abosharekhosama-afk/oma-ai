import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MailSendError,
  RESEND_API_URL,
  ResendMailAdapter,
  resendFromEnv,
} from '../../apps/worker/src/mail/resend.adapter';
import { createMailAdapter } from '../../apps/worker/src/mail/create-mail-adapter';
import {
  inviteAcceptLink,
  pickMailLocale,
  renderInviteEmail,
  renderPasswordResetEmail,
} from '@oma/domain';

const KEY = 're_test_secret_key_123';

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

describe('ResendMailAdapter', () => {
  it('POSTs to the Resend emails endpoint with auth, from, html, text and reply_to', async () => {
    const f = fakeFetch(200, { id: 'email_1' });
    const a = new ResendMailAdapter({
      apiKey: KEY,
      from: 'OMA <no-reply@example.com>',
      replyTo: 'support@example.com',
      fetchImpl: f as unknown as typeof fetch,
    });
    await a.send({ to: 'u@x.com', subject: 'Hi', text: 'plain', html: '<p>hi</p>' });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(RESEND_API_URL);
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(init?.body))).toEqual({
      from: 'OMA <no-reply@example.com>',
      to: ['u@x.com'],
      subject: 'Hi',
      text: 'plain',
      html: '<p>hi</p>',
      reply_to: 'support@example.com',
    });
  });

  it('omits html and reply_to when not provided', async () => {
    const f = fakeFetch(200, { id: 'x' });
    const a = new ResendMailAdapter({
      apiKey: KEY,
      from: 'a@b.c',
      fetchImpl: f as unknown as typeof fetch,
    });
    await a.send({ to: 'u@x.com', subject: 's', text: 't' });
    const body = JSON.parse(String(f.mock.calls[0]![1]?.body));
    expect(body.html).toBeUndefined();
    expect(body.reply_to).toBeUndefined();
  });

  it('throws a non-retryable MailSendError on 4xx without leaking the key', async () => {
    const f = fakeFetch(403, { name: 'validation_error', message: `domain not verified ${KEY}` });
    const a = new ResendMailAdapter({
      apiKey: KEY,
      from: 'a@b.c',
      fetchImpl: f as unknown as typeof fetch,
    });
    const err = await a.send({ to: 'u@x.com', subject: 's', text: 't' }).catch((e) => e);
    expect(err).toBeInstanceOf(MailSendError);
    expect(err.status).toBe(403);
    expect(err.retryable).toBe(false);
    expect(err.message).toContain('domain not verified');
    expect(err.message).not.toContain(KEY);
  });

  it('marks 429 / 5xx as retryable', async () => {
    for (const status of [429, 500, 503]) {
      const f = fakeFetch(status, 'oops');
      const a = new ResendMailAdapter({
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
    const a = new ResendMailAdapter({
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

describe('resendFromEnv / createMailAdapter', () => {
  it('returns null when RESEND_API_KEY or MAIL_FROM is missing', () => {
    expect(resendFromEnv({ MAIL_FROM: 'a@b.c' } as NodeJS.ProcessEnv)).toBeNull();
    expect(resendFromEnv({ RESEND_API_KEY: KEY } as NodeJS.ProcessEnv)).toBeNull();
  });

  it('selects Resend when MAIL_PROVIDER=resend and configured, else console', () => {
    vi.stubEnv('MAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', KEY);
    vi.stubEnv('MAIL_FROM', 'OMA <no-reply@example.com>');
    expect(createMailAdapter({} as never)).toBeInstanceOf(ResendMailAdapter);
    vi.stubEnv('RESEND_API_KEY', '');
    expect(createMailAdapter({} as never)).not.toBeInstanceOf(ResendMailAdapter);
  });
});

describe('mail templates', () => {
  it('picks locale', () => {
    expect(pickMailLocale(null, 'ar-SA')).toBe('ar');
    expect(pickMailLocale(undefined, '')).toBe('en');
    expect(pickMailLocale('en', 'ar')).toBe('en');
  });

  it('renders an RTL Arabic invite and an English invite with escaped values', () => {
    const url = inviteAcceptLink('https://app.example.com/', 'tok 1');
    expect(url).toBe('https://app.example.com/app/onboarding?invite=tok%201');
    const ar = renderInviteEmail({
      locale: 'ar',
      acceptUrl: url,
      companyName: 'Acme <b>',
      inviterName: 'Sara',
    });
    expect(ar.html).toContain('dir="rtl"');
    expect(ar.html).toContain('lang="ar"');
    expect(ar.html).toContain('Acme &lt;b&gt;');
    expect(ar.text).toContain(url);
    const en = renderInviteEmail({ locale: 'en', acceptUrl: url, companyName: 'Acme' });
    expect(en.subject).toBe("You're invited to join Acme on OMA");
    expect(en.html).toContain('dir="ltr"');
    expect(en.html).not.toMatch(/gradient|box-shadow/i);
  });

  it('renders password reset in both languages', () => {
    const en = renderPasswordResetEmail({
      locale: 'en',
      resetUrl: 'https://x/reset-password?token=t',
    });
    const ar = renderPasswordResetEmail({
      locale: 'ar',
      resetUrl: 'https://x/reset-password?token=t',
    });
    expect(en.text).toContain('https://x/reset-password?token=t');
    expect(ar.html).toContain('dir="rtl"');
  });
});
