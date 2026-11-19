import { afterEach, describe, expect, it } from 'vitest';
import {
  PUBLIC_INDEXABLE_PATHS,
  absolutePublicUrl,
  publicSiteIndexable,
  resolvePublicSiteUrl,
} from '../../apps/web/src/lib/public-site';

describe('public-site SEO helpers', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('prefers NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://oma.example.com/app';
    expect(resolvePublicSiteUrl().origin).toBe('https://oma.example.com');
    expect(absolutePublicUrl('/privacy')).toBe('https://oma.example.com/privacy');
  });

  it('disables indexing on localhost', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3000';
    expect(publicSiteIndexable()).toBe(false);
  });

  it('lists only marketing paths in sitemap set', () => {
    expect(PUBLIC_INDEXABLE_PATHS).toContain('/');
    expect(PUBLIC_INDEXABLE_PATHS.some((p) => p.startsWith('/app'))).toBe(false);
  });
});