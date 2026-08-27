import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  createRedisConnection,
  fullScanJourney,
  grantCapability,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
} from '../helpers/brand-test';

describe('insight vs version capability security', () => {
  let app: INestApplication;
  let owner: Awaited<ReturnType<typeof seedBrandTenant>>;
  let member: Awaited<ReturnType<typeof seedMemberWithoutBrandCaps>>;
  let connection: ReturnType<typeof createRedisConnection>;

  beforeAll(async () => {
    owner = await seedBrandTenant();
    member = await seedMemberWithoutBrandCaps(owner);
    connection = createRedisConnection();
    app = owner.app;
    await grantCapability(
      owner.tenantId,
      member.membershipId,
      'brand.insight.decide',
      owner.userId,
    );
    await grantCapability(owner.tenantId, member.membershipId, 'brand.read', owner.userId);
  });
  afterAll(async () => {
    await connection.quit();
    await app.close();
  });

  it('insight.decide cannot whole-version reject', async () => {
    const journey = await fullScanJourney(owner, connection);
    const versionId = journey.profileVersionId!;
    const profile = await fetch(
      `${owner.baseUrl}/api/v1/brands/${journey.brandId}/profiles/${versionId}`,
      { headers: { cookie: `oma_session=${owner.cookies.oma_session}` } },
    );
    const profileBody = await profile.json();

    const res = await fetch(
      `${owner.baseUrl}/api/v1/brands/${journey.brandId}/profiles/${versionId}/reject`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `oma_session=${member.cookies.oma_session}`,
          'x-csrf-token': member.csrf,
        },
        body: JSON.stringify({ row_version: profileBody.data.row_version }),
      },
    );
    expect(res.status).toBe(403);
  });
});
