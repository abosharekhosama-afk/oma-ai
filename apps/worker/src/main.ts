import { createLogger } from '@oma/observability';
import { publishPendingOutbox } from './processors/outbox.publisher';
import { startMailProcessor } from './processors/mail.processor';
import IORedis from 'ioredis';
import { WorkerModule } from './worker.module';

const log = createLogger('worker');

async function main() {
  const connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
  });
  startMailProcessor(connection);
  setInterval(() => {
    void publishPendingOutbox(connection);
  }, 1500);
  log.info({ module: WorkerModule.name, queues: WorkerModule.queues }, 'worker started');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
