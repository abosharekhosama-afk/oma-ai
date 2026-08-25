import { createLogger } from '@oma/observability';
import { createServer } from 'node:http';
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

  const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 3002);
  const health = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
  });
  await new Promise<void>((resolve, reject) => {
    health.once('error', reject);
    health.listen(healthPort, '127.0.0.1', () => resolve());
  });

  log.info(
    { module: WorkerModule.name, queues: WorkerModule.queues, healthPort },
    'worker started',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
