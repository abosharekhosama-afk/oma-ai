import { describe, expect, it } from 'vitest';
import { isInCrawlScope, parseFetchableUrl, shouldFollowRedirect } from './fetch-url-policy';

describe('fetch-url-policy', () => {
  it('rejects credentials and non-allowed ports', () => {
    expect(parseFetchableUrl('https://user:pass@example.test').ok).toBe(false);
    expect(parseFetchableUrl('https://example.test:8080').ok).toBe(false);
    expect(parseFetchableUrl('https://example.test').ok).toBe(true);
    expect(parseFetchableUrl('http://example.test/path').ok).toBe(true);
  });

  it('follows www/apex but records other cross-origin redirects and blocks downgrades', () => {
    expect(
      shouldFollowRedirect('https://example.test/', 'https://www.example.test/home').follow,
    ).toBe(true);
    expect(shouldFollowRedirect('https://www.example.test/', 'https://example.test/').follow).toBe(
      true,
    );
    expect(shouldFollowRedirect('https://example.test/', 'https://other.test/').follow).toBe(false);
    expect(shouldFollowRedirect('https://example.test/', 'http://example.test/').follow).toBe(
      false,
    );
  });

  it('keeps crawl scope on the same apex', () => {
    expect(isInCrawlScope('https://example.test/', 'https://www.example.test/about')).toBe(true);
    expect(isInCrawlScope('https://example.test/', 'https://cdn.example.test/app.js')).toBe(false);
  });
});
