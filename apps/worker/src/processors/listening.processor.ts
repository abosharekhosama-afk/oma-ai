import { createLogger } from '@oma/observability';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

const log = createLogger('listening-processor');

type ListeningPollJob = { tenantId: string; ruleId: string };

const NEG = /\b(bad|awful|terrible|hate|angry|worst|scam|refund|broken|disappointed|horrible)\b|سيء|فظيع|احتيال|غاضب/i;
const POS = /\b(great|love|amazing|excellent|thanks|awesome|perfect)\b|رائع|ممتاز|شكرا/i;

function classify(text: string): 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' {
  const t = text || '';
  const neg = NEG.test(t);
  const pos = POS.test(t);
  if (neg && !pos) return 'NEGATIVE';
  if (pos && !neg) return 'POSITIVE';
  return 'NEUTRAL';
}

function parseArr(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Polling worker for public keyword / hashtag mentions.
 * Real Graph/TikTok search requires platform app review; until tokens are present
 * this worker validates rule state and exits cleanly (no synthetic hits).
 */
export function startListeningProcessor(connection: IORedis) {
  const worker = new Worker<ListeningPollJob>(
    'listening',
    async (job: Job<ListeningPollJob>) => {
      const { tenantId, ruleId } = job.data;
      const rule = await getPrisma().listeningRule.findFirst({
        where: { id: ruleId, tenantId, isLive: true },
      });
      if (!rule) {
        log.info({ ruleId }, 'listening rule missing or paused');
        return;
      }
      const keywords = parseArr(rule.keywordsJson);
      const hashtags = parseArr(rule.hashtagsJson);
      const hasMeta = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
      if (!hasMeta) {
        log.info(
          { ruleId, keywords: keywords.length, hashtags: hashtags.length },
          'listening poll skipped — platform search credentials not configured',
        );
        return;
      }
      // Placeholder for Graph keyword search integration.
      log.info({ ruleId, keywords, hashtags }, 'listening poll ready for platform API');
    },
    {
      connection,
      prefix: process.env.BULLMQ_PREFIX || 'oma',
      concurrency: 2,
    },
  );
  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: String(err) }, 'listening job failed');
  });
  return worker;
}

/** Schedule periodic poll of all live rules (called from main on interval). */
export async function tickListeningRules() {
  const rules = await getPrisma().listeningRule.findMany({
    where: { isLive: true },
    select: { id: true, tenantId: true },
    take: 200,
  });
  return rules;
}

export { classify as classifyListeningSentiment, newId };
