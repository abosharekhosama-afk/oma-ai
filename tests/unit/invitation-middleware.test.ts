import { describe, expect, it } from 'vitest';
import { middleware } from '../../apps/web/src/middleware';

function makeRequest(input: string) {
  const nextUrl = new URL(input) as URL & { clone: () => URL };
  nextUrl.clone = () => new URL(input);
  return {
    nextUrl,
    cookies: { get: () => undefined },
  } as Parameters<typeof middleware>[0];
}

describe('invitation middleware', () => {
  it('redirects legacy invitation links to the standalone page before requiring a session', () => {
    const response = middleware(
      makeRequest('https://oma.example/app/onboarding?invite=legacy%20token'),
    );

    expect(response.status).toBe(307);
    const destination = new URL(response.headers.get('location') ?? '');
    expect(destination.pathname).toBe('/invite');
    expect(destination.searchParams.get('token')).toBe('legacy token');
    expect(response.headers.get('location')).not.toContain('/login');
  });

  it('redirects the trailing-slash legacy URL to the standalone invitation page', () => {
    const response = middleware(
      makeRequest('https://oma.example/app/onboarding/?invite=legacy-token'),
    );

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/invite');
  });

  it('redirects /app/invite?token= to the standalone route before login', () => {
    const response = middleware(makeRequest('https://oma.example/app/invite?token='));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/invite');
    expect(response.headers.get('location')).not.toContain('/login');
  });

  it('preserves the token when redirecting /app/invite', () => {
    const response = middleware(makeRequest('https://oma.example/app/invite?token=abc123'));

    expect(new URL(response.headers.get('location') ?? '').searchParams.get('token')).toBe(
      'abc123',
    );
  });

  it('continues protecting onboarding URLs that do not contain an invitation', () => {
    const response = middleware(makeRequest('https://oma.example/app/onboarding'));

    expect(response.status).toBe(307);
    const destination = new URL(response.headers.get('location') ?? '');
    expect(destination.pathname).toBe('/login');
    expect(destination.searchParams.get('next')).toBe('/app/onboarding');
  });
});
