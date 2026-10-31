import { getPrisma } from '@oma/db';
import {
  createSocialAdapter,
  fromSocialEnum,
  SocialProviderError,
  tokenKeyFromEnv,
  type SocialNetworkCode,
  type SocialProviderAdapter,
  type FetchLike,
} from '@oma/domain';
import { mediaProxyUrl, publicMediaUrls } from '../media/media-jobs';
import {
  MAX_PUBLISH_ATTEMPTS,
  PUBLISH_BACKOFF_MS,
  markNeedsReauth,
  notifyPublishOutcome,
  pageForAdapter,
  type AdapterFactory,
} from './social-jobs';
import { syncContentPublishRollup } from './rollup-sync';

export type PublishTargetDeps = {
  now?: () => Date;
  adapterFor?: AdapterFactory;
  key?: Buffer | null;
  mediaFetch?: FetchLike;
  log?: { error: (object: unknown, message: string) => void };
};

export type PublishTargetResult = {
  outcome: 'published' | 'failed' | 'retrying' | 'skipped' | 'not_claimed';
};

/** Publish one ContentPublishTarget (atomic QUEUED/NONE → PUBLISHING). */
export async function publishOneTarget(
  publishTargetId: string,
  deps: PublishTargetDeps = {},
): Promise<PublishTargetResult> {
  const now = deps.now?.() ?? new Date();
  const key = deps.key === undefined ? tokenKeyFromEnv() : deps.key;
  const adapterFor = deps.adapterFor ?? ((n: SocialNetworkCode) => createSocialAdapter(n));
  const prisma = getPrisma();
  if (!key) return { outcome: 'skipped' };

  const target = await prisma.contentPublishTarget.findUnique({
    where: { id: publishTargetId },
    include: { contentItem: true },
  });
  if (!target?.contentItem) return { outcome: 'skipped' };
  const item = target.contentItem;

  const claim = await prisma.contentPublishTarget.updateMany({
    where: { id: publishTargetId, publishState: { in: ['NONE', 'QUEUED'] } },
    data: { publishState: 'PUBLISHING', workerPickedAt: now, lastPublishError: null },
  });
  if (claim.count !== 1) return { outcome: 'not_claimed' };
  await syncContentPublishRollup(item.id);

  const attempt = target.publishAttempts + 1;
  const page = await prisma.socialPage.findFirst({
    where: {
      id: target.socialPageId,
      tenantId: target.tenantId,
      brandId: item.brandId,
    },
  });
  try {
    if (!page || page.status === 'DISCONNECTED') {
      throw new SocialProviderError('The connected account was removed', { retryable: false });
    }
    if (page.status === 'NEEDS_REAUTH') {
      throw new SocialProviderError('The connected account needs to be reconnected', {
        retryable: false,
        reauth: true,
      });
    }
    const brand = await prisma.brandWorkspace.findFirst({
      where: { id: item.brandId },
      select: { status: true, deletedAt: true },
    });
    if (!brand || brand.status === 'ARCHIVED' || brand.deletedAt) {
      throw new SocialProviderError('Brand is archived', { retryable: false });
    }
    const network = fromSocialEnum(page.network);
    const adapter = adapterFor(network);
    if (!adapter.isConfigured()) {
      throw new SocialProviderError('Network is not configured', { retryable: false });
    }
    const text =
      [item.captionEn || item.titleEn].filter(Boolean).join('\n').trim() || item.titleEn;
    const rawMediaUrls = await publicMediaUrls(item, { fetchImpl: deps.mediaFetch });
    const mediaUrls =
      network === 'tiktok' ? rawMediaUrls.map((u) => mediaProxyUrl(u)) : rawMediaUrls;
    const res = await adapter.publish(pageForAdapter(page, key), { text, mediaUrls });
    if (!res.externalId?.trim()) {
      throw new SocialProviderError('Provider returned no post id', { retryable: true });
    }
    await prisma.contentPublishTarget.update({
      where: { id: publishTargetId },
      data: {
        publishState: 'PUBLISHED',
        publishAttempts: attempt,
        externalPostId: res.externalId,
        externalPostUrl: res.url,
        publishedAt: now,
        lastPublishError: null,
        nextPublishAt: null,
      },
    });
    await syncContentPublishRollup(item.id);
    await notifyPublishOutcome(item, 'succeeded', { url: res.url });
    return { outcome: 'published' };
  } catch (e) {
    const err =
      e instanceof SocialProviderError
        ? e
        : new SocialProviderError(String((e as Error)?.message ?? e), { retryable: true });
    deps.log?.error(
      {
        contentId: item.id,
        publishTargetId,
        network: page?.network ?? null,
        attempt,
        error: err.message,
      },
      'social publish rejected',
    );
    if (err.opts.reauth && page && page.status !== 'NEEDS_REAUTH') {
      await markNeedsReauth(page, err.message, now);
    }
    const retry = err.opts.retryable && attempt < MAX_PUBLISH_ATTEMPTS;
    await prisma.contentPublishTarget.update({
      where: { id: publishTargetId },
      data: {
        publishState: retry ? 'QUEUED' : 'FAILED',
        publishAttempts: attempt,
        lastPublishError: err.message.slice(0, 1000),
        nextPublishAt: retry
          ? new Date(
              now.getTime() +
                PUBLISH_BACKOFF_MS[Math.min(attempt - 1, PUBLISH_BACKOFF_MS.length - 1)]!,
            )
          : null,
      },
    });
    await syncContentPublishRollup(item.id);
    if (!retry) {
      await notifyPublishOutcome(item, 'failed', { error: err.message });
      return { outcome: 'failed' };
    }
    return { outcome: 'retrying' };
  }
}
