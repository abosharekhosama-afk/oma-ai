import { describe, expect, it } from 'vitest';
import { createFixtureWebsiteConnector } from '@oma/domain';

describe('crawl content limits security', () => {
  it('fetchPublic bounds body to maxBytes', async () => {
    const connector = createFixtureWebsiteConnector();
    const result = await connector.fetchPublic({
      url: 'https://acme.test/',
      maxBytes: 100,
    });
    expect(result.body.length).toBeLessThanOrEqual(100);
  });

  it('rejects non-html oversized fetch via maxBytes slice not throw', async () => {
    const connector = createFixtureWebsiteConnector();
    const result = await connector.fetchPublic({
      url: 'https://acme.test/',
      maxBytes: 50,
    });
    expect(result.contentType).toContain('text/html');
    expect(result.body.length).toBe(50);
  });
});
