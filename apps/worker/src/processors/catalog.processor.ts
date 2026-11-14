import type { ConnectionOptions, Job } from 'bullmq';
import { Worker } from 'bullmq';
import { createLogger } from '@oma/observability';
import { runCatalogCreativeJob } from '../brand/catalog-creative';
import { reimportCatalogMediaForScan } from '../brand/catalog-reimport';
import { createWebsiteConnector } from '@oma/domain';

const log = createLogger('catalog-processor');

export type CatalogGenerateJob = {
  tenantId: string;
  brandId: string;
  discoveredProductId: string;
  kind: 'image' | 'video' | 'short_video';
  actorUserId: string;
};

export type CatalogReimportJob = {
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
};

export function startCatalogProcessor(connection: ConnectionOptions) {
  const worker = new Worker(
    'catalog',
    async (job: Job) => {
      if (job.name === 'catalog.generate') {
        const data = job.data as CatalogGenerateJob;
        const result = await runCatalogCreativeJob(data);
        log.info({ jobId: job.id, generated: result.generated }, 'catalog generate done');
        return result;
      }
      if (job.name === 'catalog.reimport') {
        const data = job.data as CatalogReimportJob;
        const connector = createWebsiteConnector();
        const result = await reimportCatalogMediaForScan({ ...data, connector });
        log.info({ jobId: job.id, ...result }, 'catalog reimport done');
        return result;
      }
      throw new Error(`unknown catalog job ${job.name}`);
    },
    { connection, prefix: process.env.BULLMQ_PREFIX || 'oma' },
  );
  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: String(err) }, 'catalog job failed');
  });
  return worker;
}
