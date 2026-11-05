import { Queue } from 'bullmq';
import Redis from 'ioredis';

export type InboxWebhookJob = {
  platform: 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN';
  tenantId?: string;
  brandId?: string;
  raw: unknown;
  receivedAt: string;
};

export type ListeningPollJob = {
  tenantId: string;
  ruleId: string;
};

export type InboxSyncJob = {
  tenantId: string;
  brandId?: string | null;
  sinceDays?: number;
  requestedAt: string;
};

function connection() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

export async function enqueueInboxWebhook(payload: InboxWebhookJob): Promise<boolean> {
  const conn = connection();
  if (!conn) return false;
  const queue = new Queue('inbox', {
    connection: conn,
    prefix: process.env.BULLMQ_PREFIX || 'oma',
  });
  try {
    await queue.add('inbox.webhook', payload, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    return true;
  } finally {
    await queue.close().catch(() => undefined);
    conn.disconnect();
  }
}

export async function enqueueInboxSync(payload: InboxSyncJob): Promise<boolean> {
  const conn = connection();
  if (!conn) return false;
  const queue = new Queue('inbox', {
    connection: conn,
    prefix: process.env.BULLMQ_PREFIX || 'oma',
  });
  try {
    await queue.add('inbox.sync', payload, {
      jobId: `inbox-sync-${payload.tenantId}-${payload.brandId ?? 'all'}-${Date.now()}`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 500,
      removeOnFail: 2000,
    });
    return true;
  } finally {
    await queue.close().catch(() => undefined);
    conn.disconnect();
  }
}

export async function enqueueListeningPoll(payload: ListeningPollJob): Promise<boolean> {
  const conn = connection();
  if (!conn) return false;
  const queue = new Queue('listening', {
    connection: conn,
    prefix: process.env.BULLMQ_PREFIX || 'oma',
  });
  try {
    await queue.add('listening.poll', payload, {
      jobId: `listening-poll-${payload.ruleId}`,
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: 100,
    });
    return true;
  } catch {
    return false;
  } finally {
    await queue.close().catch(() => undefined);
    conn.disconnect();
  }
}
