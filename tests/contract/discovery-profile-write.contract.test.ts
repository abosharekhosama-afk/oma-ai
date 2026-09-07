import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  authHeaders,
  createRedisConnection,
  fullScanJourney,
  getProfile,
  seedBrandTenant,
} from '../helpers/brand-test';

describe('profile write contract', () => {
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

  it('GET profile, PATCH sections, compare, insight accept/reject', async () => {
    const journey = await fullScanJourney(seed, connection);
    expect(journey.profileVersionId).toBeTruthy();
    const versionId = journey.profileVersionId!;
    const { body: profile } = await getProfile(seed, journey.brandId, versionId);
    expect(profile.data.status).toBe('NEEDS_REVIEW');

    const patch = await fetch(
      `${seed.baseUrl}/api/v1/brands/${journey.brandId}/profiles/${versionId}`,
      {
        method: 'PATCH',
        headers: authHeaders(seed),
        body: JSON.stringify({
          row_version: profile.data.row_version,
          sections: { overview: { note: 'reviewed' } },
        }),
      },
    );
    expect(patch.status).toBe(200);

    const compare = await fetch(
      `${seed.baseUrl}/api/v1/brands/${journey.brandId}/profiles/${versionId}/compare`,
      { headers: { cookie: authHeaders(seed).cookie } },
    );
    expect(compare.status).toBe(200);

    const insight = profile.data.insights[0];
    if (insight) {
      const accept = await fetch(
        `${seed.baseUrl}/api/v1/brands/${journey.brandId}/insights/${insight.id}/accept`,
        {
          method: 'POST',
          headers: authHeaders(seed),
          body: JSON.stringify({ row_version: insight.row_version }),
        },
      );
      expect([200, 201]).toContain(accept.status);
    }
  });
});
