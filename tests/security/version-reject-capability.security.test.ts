import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { cookieHeader } from '../helpers/app';
import {
  createRedisConnection,
  fullScanJourney,
  grantCapability,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
} from '../helpers/brand-test';

describe('version reject capability security', () => {
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
      'brand.version.approve',
      owner.userId,
    );
    await grantCapability(owner.tenantId, member.membershipId, 'brand.read', owner.userId);
  });
  afterAll(async () => {
    await connection.quit();
    await app.close();
  });

  it('version.approve holder can reject whole version', async () => {
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
          cookie: cookieHeader(member.cookies),
          'x-csrf-token': member.csrf,
        },
        body: JSON.stringify({ row_version: profileBody.data.row_version }),
      },
    );
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.data.status).toBe('REJECTED');
  });
});
