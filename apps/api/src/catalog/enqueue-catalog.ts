import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { CatalogGenerateKind } from '@oma/domain';

function connection() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

export async function enqueueCatalogGenerate(payload: {
  tenantId: string;
  brandId: string;
  discoveredProductId: string;
  kind: CatalogGenerateKind;
  actorUserId: string;
}): Promise<string | null> {
  const conn = connection();
  if (!conn) return null;
  const queue = new Queue('catalog', {
    connection: conn,
    prefix: process.env.BULLMQ_PREFIX || 'oma',
  });
  try {
    const job = await queue.add('catalog.generate', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 500,
      removeOnFail: 2000,
    });
    return job.id ?? null;
  } finally {
    await queue.close();
    await conn.quit();
  }
}

export async function enqueueCatalogReimport(payload: {
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
}): Promise<string | null> {
  const conn = connection();
  if (!conn) return null;
  const queue = new Queue('catalog', {
    connection: conn,
    prefix: process.env.BULLMQ_PREFIX || 'oma',
  });
  try {
    const job = await queue.add('catalog.reimport', payload, {
      attempts: 2,
      removeOnComplete: 100,
      removeOnFail: 500,
    });
    return job.id ?? null;
  } finally {
    await queue.close();
    await conn.quit();
  }
}
