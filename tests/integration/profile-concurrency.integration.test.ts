import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  authHeaders,
  createRedisConnection,
  fullScanJourney,
  getProfile,
  seedBrandTenant,
} from '../helpers/brand-test';

describe('profile concurrency integration', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let connection: ReturnType<typeof createRedisConnection>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
    connection = createRedisConnection();
  });
  afterAll(async () => {
    await connection.quit();
    await app.close();
  });

  it('concurrent patch with stale row_version returns 409', async () => {
    const journey = await fullScanJourney(seed, connection);
    const versionId = journey.profileVersionId!;
    const { body: profile } = await getProfile(seed, journey.brandId, versionId);
    const first = await fetch(
      `${seed.baseUrl}/api/v1/brands/${journey.brandId}/profiles/${versionId}`,
      {
        method: 'PATCH',
        headers: authHeaders(seed),
        body: JSON.stringify({
          row_version: profile.data.row_version,
          sections: { overview: { a: 1 } },
        }),
      },
    );
    expect(first.status).toBe(200);

    const stale = await fetch(
      `${seed.baseUrl}/api/v1/brands/${journey.brandId}/profiles/${versionId}`,
      {
        method: 'PATCH',
        headers: authHeaders(seed),
        body: JSON.stringify({
          row_version: profile.data.row_version,
          sections: { overview: { b: 2 } },
        }),
      },
    );
    expect(stale.status).toBe(409);
    const body = await stale.json();
    expect(body.error.code).toBe('CONFLICT_VERSION');
  });
});
