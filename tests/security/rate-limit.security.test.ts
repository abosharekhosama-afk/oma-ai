import type { ExecutionContext } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RateLimitGuard } from '../../apps/api/src/common/guards/rate-limit.guard';

const originalNodeEnv = process.env.NODE_ENV;

function context(request: Record<string, unknown>) {
  const response = { setHeader: vi.fn() };
  const value = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  return { value, response };
}

describe('API rate limiting security', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.RATE_LIMIT_STORAGE;
    delete process.env.RATE_LIMIT_PER_MINUTE;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns a stable 429 after the configured request budget is exhausted', async () => {
    vi.useFakeTimers();
    process.env.RATE_LIMIT_STORAGE = 'memory';
    process.env.RATE_LIMIT_PER_MINUTE = '2';
    const guard = new RateLimitGuard();
    const request = {
      ip: '198.51.100.21',
      method: 'GET',
      path: '/api/v1/example',
      route: { path: '/api/v1/example' },
    };
    const first = context(request);
    const second = context(request);
    const third = context(request);

    await expect(guard.canActivate(first.value)).resolves.toBe(true);
    await expect(guard.canActivate(second.value)).resolves.toBe(true);
    await expect(guard.canActivate(third.value)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
    });
    expect(third.response.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('applies account-targeted throttling to login attempts across different IPs', async () => {
    vi.useFakeTimers();
    process.env.RATE_LIMIT_STORAGE = 'memory';
    process.env.RATE_LIMIT_PER_MINUTE = '300';
    const guard = new RateLimitGuard();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { value } = context({
        ip: `198.51.100.${attempt + 1}`,
        method: 'POST',
        path: '/api/v1/auth/login',
        route: { path: '/api/v1/auth/login' },
        body: { email: '  USER@example.com ' },
      });
      await expect(guard.canActivate(value)).resolves.toBe(true);
    }
    const blocked = context({
      ip: '203.0.113.99',
      method: 'POST',
      path: '/api/v1/auth/login',
      route: { path: '/api/v1/auth/login' },
      body: { email: 'user@example.com' },
    });
    await expect(guard.canActivate(blocked.value)).rejects.toMatchObject({ status: 429 });
  });

  it('does not allow a zero global limit to disable throttling in production', async () => {
    vi.useFakeTimers();
    process.env.RATE_LIMIT_STORAGE = 'memory';
    process.env.RATE_LIMIT_PER_MINUTE = '0';
    process.env.NODE_ENV = 'production';
    const guard = new RateLimitGuard();
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const { value } = context({
        ip: '198.51.100.240',
        method: 'GET',
        path: '/api/v1/protected',
        route: { path: '/api/v1/protected' },
      });
      await expect(guard.canActivate(value)).resolves.toBe(true);
    }
    const blocked = context({
      ip: '198.51.100.240',
      method: 'GET',
      path: '/api/v1/protected',
      route: { path: '/api/v1/protected' },
    });
    await expect(guard.canActivate(blocked.value)).rejects.toMatchObject({ status: 429 });
  });
});
