import { createLogger } from '@oma/observability';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { getPrisma } from '@oma/db';
import { ingestInboundMessage } from '../inbox/ingest-conversation';
import { runInboxSync } from '../inbox/meta-sync';
import { parseInboxWebhook, type InboxPlatform } from '../inbox/parse-webhooks';

const log = createLogger('inbox-processor');

type InboxWebhookJob = {
  platform: InboxPlatform;
  tenantId?: string;
  brandId?: string;
  raw: unknown;
  receivedAt: string;
};

type InboxSyncJob = {
  tenantId: string;
  brandId?: string | null;
  sinceDays?: number;
  requestedAt: string;
};

async function resolveTenantId(hint?: string, pageExternalId?: string): Promise<string | null> {
  if (hint) return hint;
  if (pageExternalId) {
    try {
      const page = await getPrisma().socialPage.findFirst({
        where: { externalId: pageExternalId },
        select: { tenantId: true, brandId: true },
      });
      if (page?.tenantId) return page.tenantId;
    } catch {
      // ignore
    }
  }
  return process.env.INBOX_DEFAULT_TENANT_ID?.trim() || null;
}

async function ingest(
  item: ReturnType<typeof parseInboxWebhook>[number],
  fallbackTenant?: string,
  brandId?: string,
) {
  const tenantId = await resolveTenantId(item.tenantId ?? fallbackTenant, item.pageExternalId);
  if (!tenantId) {
    log.warn(
      { platform: item.platform, thread: item.externalThreadId },
      'inbox event dropped: no tenant',
    );
    return;
  }
  let socialPageId: string | null = null;
  let mappedBrand = brandId ?? null;
  if (item.pageExternalId) {
    const page = await getPrisma().socialPage.findFirst({
      where: { externalId: item.pageExternalId, tenantId },
      select: { id: true, brandId: true },
    });
    socialPageId = page?.id ?? null;
    mappedBrand = mappedBrand ?? page?.brandId ?? null;
  }
  await ingestInboundMessage({
    tenantId,
    brandId: mappedBrand,
    socialPageId,
    platform: item.platform,
    externalThreadId: item.externalThreadId,
    type: item.type,
    externalMessageId: item.externalMessageId ?? null,
    senderExternalId: item.senderExternalId,
    senderName: item.senderName,
    senderAvatar: item.senderAvatar ?? null,
    content: item.content,
    mediaUrls: item.mediaUrls,
  });
}

export function startInboxProcessor(connection: IORedis) {
  const worker = new Worker<InboxWebhookJob | InboxSyncJob>(
    'inbox',
    async (job: Job<InboxWebhookJob | InboxSyncJob>) => {
      if (job.name === 'inbox.sync') {
        const data = job.data as InboxSyncJob;
        await runInboxSync({
          tenantId: data.tenantId,
          brandId: data.brandId,
          sinceDays: data.sinceDays,
        });
        return;
      }
      const { platform, raw, tenantId, brandId } = job.data as InboxWebhookJob;
      const parsed = parseInboxWebhook(platform, raw);
      log.info({ platform, count: parsed.length, jobId: job.id }, 'inbox webhook job');
      for (const item of parsed) {
        await ingest(item, tenantId, brandId);
      }
    },
    {
      connection,
      prefix: process.env.BULLMQ_PREFIX || 'oma',
      concurrency: Number(process.env.INBOX_CONCURRENCY ?? 5),
    },
  );
  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: String(err) }, 'inbox job failed');
  });
  return worker;
}
