import { describe, expect, it } from 'vitest';
import { createFixtureWebsiteConnector } from '@oma/domain';

describe('ssrf redirect chain security', () => {
  it('denies redirect to private host during fetch', async () => {
    const connector = createFixtureWebsiteConnector();
    await expect(
      connector.fetchPublic({
        url: 'https://acme.test/?redirect=https://127.0.0.1/private',
      }),
    ).rejects.toThrow();
  });

  it('denies redirect to metadata host', async () => {
    const connector = createFixtureWebsiteConnector();
    await expect(
      connector.fetchPublic({
        url: 'https://acme.test/?redirect=https://metadata.google.internal/',
      }),
    ).rejects.toThrow();
  });
});
