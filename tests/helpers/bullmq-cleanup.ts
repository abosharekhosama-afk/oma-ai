import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_QUEUES = ['mail', 'ingestion'] as const;

/** Drain and remove BullMQ keys so no stray worker can consume jobs from a prior test file. */
export async function resetBullQueues(
  connection: IORedis,
  queueNames: readonly string[] = DEFAULT_QUEUES,
): Promise<void> {
  for (const name of queueNames) {
    const queue = new Queue(name, { connection });
    await queue.pause().catch(() => undefined);
    await queue.obliterate({ force: true }).catch(() => undefined);
    await queue.close();
  }
  await delay(200);
}

export async function waitForWorkerHealthDown(
  port = process.env.WORKER_HEALTH_PORT ?? '3002',
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (!res.ok) return;
    } catch {
      return;
    }
    await delay(200);
  }
  throw new Error(`worker health still responding on port ${port} after ${timeoutMs}ms`);
}
