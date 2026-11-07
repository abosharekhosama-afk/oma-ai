import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { errorKindOf } from '../../apps/web/src/components/ui/error-state';
import { isAllowedMediaTarget } from '../../apps/web/src/app/api/media-proxy/route';

describe('Platform hardening: Error handling, Network banner, OAuth callback, & SSRF/XSS/CSRF guards', () => {
  it('classifies 401, 403, 404, 500, and status 0 (network) errors accurately', () => {
    expect(errorKindOf({ status: 0 })).toBe('network');
    expect(errorKindOf({ status: 401 })).toBe('unauthorized');
    expect(errorKindOf({ status: 403 })).toBe('forbidden');
    expect(errorKindOf({ status: 404 })).toBe('notFound');
    expect(errorKindOf({ status: 502 })).toBe('server');
    expect(errorKindOf({ status: 400 })).toBe('generic');
  });

  it('blocks private/RFC1918/link-local IPs and non-HTTPS URLs in media-proxy (SSRF protection)', () => {
    expect(isAllowedMediaTarget('http://example.com/image.jpg')).toBeNull();
    expect(isAllowedMediaTarget('https://127.0.0.1/secret')).toBeNull();
    expect(isAllowedMediaTarget('https://10.0.0.1/internal')).toBeNull();
    expect(isAllowedMediaTarget('https://192.168.1.50/admin')).toBeNull();
    expect(isAllowedMediaTarget('https://172.16.0.5/meta')).toBeNull();
    expect(isAllowedMediaTarget('https://169.254.169.254/latest/meta-data')).toBeNull();
    expect(isAllowedMediaTarget('https://service.local/photo.png')).toBeNull();
    expect(isAllowedMediaTarget('https://user:pass@example.com/photo.png')).toBeNull();
    expect(isAllowedMediaTarget('https://cdn.example.com/media/banner.webp')?.hostname).toBe(
      'cdn.example.com',
    );
  });

  it('uses timing-safe CSRF comparison and strict API security headers', () => {
    const csrf = readFileSync(resolve('apps/api/src/common/guards/csrf.guard.ts'), 'utf8');
    expect(csrf).toContain('timingSafeEqual');

    const headers = readFileSync(
      resolve('apps/api/src/common/middleware/security-headers.middleware.ts'),
      'utf8',
    );
    expect(headers).toContain('Content-Security-Policy');
    expect(headers).toContain('X-Frame-Options');
    expect(headers).toContain('X-Content-Type-Options');
  });

  it('keeps OAuth callback responsive by syncing URL tab, resetting connecting state, and cleaning query params', () => {
    const brandSettingsPage = readFileSync(
      resolve('apps/web/src/app/(app)/app/brands/[brandId]/settings/page.tsx'),
      'utf8',
    );
    expect(brandSettingsPage).toContain('setConnecting(null)');
    expect(brandSettingsPage).toContain("setTab('accounts')");
    expect(brandSettingsPage).toContain('window.history.replaceState');
  });
});
