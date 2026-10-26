import { createLogger } from '@oma/observability';
import { createServer } from 'node:http';
import { publishPendingOutbox } from './processors/outbox.publisher';
import { startMailProcessor } from './processors/mail.processor';
import { startIngestionProcessor } from './processors/ingestion.processor';
import { startAnalysisProcessor } from './processors/analysis.processor';
import { startAiProcessor } from './processors/ai.processor';
import IORedis from 'ioredis';
import { WorkerModule } from './worker.module';
import { startSocialJobs } from './social/social-jobs';

const log = createLogger('worker');

async function main() {
  const connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
  });
  startMailProcessor(connection);
  startIngestionProcessor(connection);
  startAnalysisProcessor(connection);
  startAiProcessor(connection);
  setInterval(() => {
    void publishPendingOutbox(connection);
  }, 1500);
  // Real social publishing + token refresh (no-op until SOCIAL_TOKEN_ENCRYPTION_KEY is set).
  startSocialJobs(log);

  const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 3002);
  const health = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
  });
  await new Promise<void>((resolve, reject) => {
    health.once('error', reject);
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
    health.listen(healthPort, host, () => resolve());
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
