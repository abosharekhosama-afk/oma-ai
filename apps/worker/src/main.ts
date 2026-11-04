import { createLogger } from '@oma/observability';
import { createServer } from 'node:http';
import { publishPendingOutbox } from './processors/outbox.publisher';
import { startMailProcessor } from './processors/mail.processor';
import { startIngestionProcessor } from './processors/ingestion.processor';
import { startAnalysisProcessor } from './processors/analysis.processor';
import { startAiProcessor } from './processors/ai.processor';
import IORedis from 'ioredis';
import { WorkerModule } from './worker.module';
import { startSocialProcessor } from './processors/social.processor';
import { startSocialJobs } from './social/social-jobs';
import { startMediaJobs } from './media/media-jobs';
import { startInboxProcessor } from './processors/inbox.processor';
import { startListeningProcessor, tickListeningRules } from './processors/listening.processor';
import { Queue } from 'bullmq';

const log = createLogger('worker');

async function main() {
  const mailProvider =
    process.env.MAIL_PROVIDER?.trim().toLowerCase() ||
    (process.env.RESEND_API_KEY?.trim() ? 'resend' : '') ||
    (process.env.BREVO_API_KEY?.trim() ? 'brevo' : '') ||
    'console';
  log.info(
    {
      mailProvider,
      mailFromConfigured: Boolean(process.env.MAIL_FROM?.trim()),
      resendKeyConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
      brevoKeyConfigured: Boolean(process.env.BREVO_API_KEY?.trim()),
      socialEncryptionConfigured: Boolean(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim()),
      socialOAuthBaseConfigured: Boolean(process.env.SOCIAL_OAUTH_REDIRECT_BASE?.trim()),
    },
    'worker integration configuration',
  );
  const connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
  });
  startMailProcessor(connection);
  startSocialProcessor(connection);
  startIngestionProcessor(connection);
  startAnalysisProcessor(connection);
  startAiProcessor(connection);
  startInboxProcessor(connection);
  startListeningProcessor(connection);
  setInterval(() => {
    void publishPendingOutbox(connection).catch((err) => {
      // Database outages are transient in managed environments. Do not let an
      // unhandled rejection terminate the worker; the next tick retries.
      log.error({ err: String(err) }, 'outbox tick failed; will retry');
    });
  }, 1500);
  // Real social publishing + token refresh (no-op until SOCIAL_TOKEN_ENCRYPTION_KEY is set).
  startSocialJobs(log, connection);
  startMediaJobs(log);

  // Poll live listening rules every 5 minutes
  const scheduleListening = async () => {
    try {
      const rules = await tickListeningRules();
      if (!rules.length) return;
      const q = new Queue('listening', {
        connection,
        prefix: process.env.BULLMQ_PREFIX || 'oma',
      });
      for (const r of rules) {
        try {
          await q.add(
            'listening.poll',
            { tenantId: r.tenantId, ruleId: r.id },
            { jobId: `listening-poll-${r.id}-${Date.now()}`, removeOnComplete: true },
          );
        } catch {
          /* duplicate / transient */
        }
      }
      await q.close().catch(() => undefined);
    } catch (err) {
      log.error({ err: String(err) }, 'listening schedule tick failed');
    }
  };
  setInterval(() => void scheduleListening(), 5 * 60 * 1000);


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
