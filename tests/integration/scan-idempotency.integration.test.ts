import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import {
  connectWebsite,
  createBrand,
  createRedisConnection,
  FIXTURE_WEBSITE_URL,
  seedBrandTenant,
  startScan,
} from '../helpers/brand-test';

describe('scan idempotency integration', () => {
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

  it('replays same idempotency key and keeps one attempt', async () => {
    const { body: brand } = await createBrand(seed);
    await connectWebsite(seed, brand.data.id, FIXTURE_WEBSITE_URL, brand.data.version);
    const key = newId();
    const a = await startScan(seed, brand.data.id, key);
    const b = await startScan(seed, brand.data.id, key);
    expect(a.res.status).toBe(202);
    expect(b.res.status).toBe(202);
    expect(a.body.data.scan_attempt_id).toBe(b.body.data.scan_attempt_id);

    const prisma = getPrisma();
    const attempts = await prisma.scanAttempt.findMany({
      where: { brandId: brand.data.id, idempotencyKey: key },
    });
    expect(attempts.length).toBe(1);
  });
});
