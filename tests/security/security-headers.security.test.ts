import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { securityHeaders } from '../../apps/api/src/common/middleware/security-headers.middleware';

describe('security response headers', () => {
  it('sets browser hardening headers and continues the request', () => {
    const values = new Map<string, string>();
    const response = {
      setHeader: (name: string, value: string) => values.set(name, value),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    securityHeaders({} as Request, response, next);

    expect(values.get('X-Content-Type-Options')).toBe('nosniff');
    expect(values.get('X-Frame-Options')).toBe('DENY');
    expect(values.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(values.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(next).toHaveBeenCalledOnce();
  });
});
