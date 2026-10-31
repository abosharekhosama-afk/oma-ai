import { getPrisma, writeOutbox } from '@oma/db';
import { syncContentPublishRollup } from './rollup-sync';
import {
  createSocialAdapter,
  decryptToken,
  encryptToken,
  fromSocialEnum,
  humanizePublishError,
  newId,
  notificationAllowed,
  pickMailLocale,
  renderPublishResultEmail,
  SocialProviderError,
  tokenKeyFromEnv,
  type SocialProviderAdapter,
  type SocialNetworkCode,
  type FetchLike,
} from '@oma/domain';

export const MAX_PUBLISH_ATTEMPTS = 5;
/** Backoff after attempt n (1-based): 1m, 5m, 15m, 60m. */
export const PUBLISH_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
/** TikTok status polling cadence; its publish endpoint is asynchronous. */
export const TIKTOK_STATUS_POLL_MS = 60_000;
/** Refresh tokens that expire within this window. */
export const REFRESH_WINDOW_MS = 3 * 24 * 3600_000;

export type AdapterFactory = (network: SocialNetworkCode) => SocialProviderAdapter;

type Deps = {
  now?: () => Date;
  adapterFor?: AdapterFactory;
  key?: Buffer | null;
  mediaFetch?: FetchLike;
  log?: { error: (object: unknown, message: string) => void };
};

export function pageForAdapter(
  p: {
    externalId: string;
    name: string;
    accessTokenEnc: string;
    refreshTokenEnc: string | null;
    metaJson: string;
    scopes: string[];
  },
  key: Buffer,
) {
  return {
    externalId: p.externalId,
    name: p.name,
    accessToken: decryptToken(p.accessTokenEnc, key),
    refreshToken: p.refreshTokenEnc ? decryptToken(p.refreshTokenEnc, key) : null,
    meta: { ...(JSON.parse(p.metaJson || '{}') as Record<string, unknown>), scopes: p.scopes },
  };
}

/** Notify brand managers + workspace admins that a connected account needs reconnecting. */
export async function alertDisconnected(
  page: { id: string; tenantId: string; brandId: string; network: string },
  now: Date,
) {
  const prisma = getPrisma();
  const [managers, admins] = await Promise.all([
    prisma.brandMember.findMany({
      where: { tenantId: page.tenantId, brandId: page.brandId, role: 'MANAGER' },
      select: { userId: true },
    }),
    prisma.capabilityGrant.findMany({
      where: {
        tenantId: page.tenantId,
        capabilityCode: 'tenant.manage',
        revokedAt: null,
        membership: { status: 'ACTIVE' },
      },
      select: { membership: { select: { userId: true } } },
    }),
  ]);
  const recipients = new Set([
    ...managers.map((m) => m.userId),
    ...admins.map((a) => a.membership.userId).filter((u): u is string => Boolean(u)),
  ]);
  const day = now.toISOString().slice(0, 10);
  // Respect "mute all notifications" in each recipient's preferences.
  const prefs = await prisma.user.findMany({
    where: { id: { in: [...recipients] } },
    select: { id: true, preferencesJson: true },
  });
  const muted = new Set(
    prefs
      .filter((u) => !notificationAllowed(u.preferencesJson, 'social.disconnected'))
      .map((u) => u.id),
  );
  for (const userId of recipients) {
    if (muted.has(userId)) continue;
    await prisma.notification.upsert({
      where: {
        tenantId_dedupeKey: {
          tenantId: page.tenantId,
          dedupeKey: `social.disconnected:${page.id}:${userId}:${day}`,
        },
      },
      create: {
        id: newId(),
        tenantId: page.tenantId,
        recipientUserId: userId,
        type: 'social.disconnected',
        objectType: 'SocialPage',
        objectId: page.id,
        deepLinkPath: `/app/brands/${page.brandId}/settings?tab=accounts`,
        dedupeKey: `social.disconnected:${page.id}:${userId}:${day}`,
      },
      update: {},
    });
  }
  return recipients.size;
}

export async function markNeedsReauth(
  page: { id: string; tenantId: string; brandId: string; network: string },
  message: string,
  now: Date,
) {
  await getPrisma().socialPage.update({
    where: { id: page.id },
    data: { status: 'NEEDS_REAUTH', lastError: message.slice(0, 500) },
  });
  await alertDisconnected(page, now);
}

/** Notify creator/assignee/managers that a publish finished (success or terminal failure). */
export async function notifyPublishOutcome(
  item: {
    id: string;
    tenantId: string;
    brandId: string;
    createdBy: string;
    assigneeUserId: string | null;
    titleEn: string;
    titleAr: string;
  },
  outcome: 'succeeded' | 'failed',
  detail: { url?: string | null; error?: string | null },
) {
  const prisma = getPrisma();
  const type = outcome === 'succeeded' ? 'content.publish.succeeded' : 'content.publish.failed';
  const [managers, admins] = await Promise.all([
    prisma.brandMember.findMany({
      where: { tenantId: item.tenantId, brandId: item.brandId, role: 'MANAGER' },
      select: { userId: true },
    }),
    prisma.capabilityGrant.findMany({
      where: {
        tenantId: item.tenantId,
        capabilityCode: 'tenant.manage',
        revokedAt: null,
        membership: { status: 'ACTIVE' },
      },
      select: { membership: { select: { userId: true } } },
    }),
  ]);
  const recipients = new Set<string>([
    item.createdBy,
    ...(item.assigneeUserId ? [item.assigneeUserId] : []),
    ...managers.map((m) => m.userId),
    ...admins.map((a) => a.membership.userId).filter((u): u is string => Boolean(u)),
  ]);
  const prefs = await prisma.user.findMany({
    where: { id: { in: [...recipients] } },
    select: { id: true, email: true, name: true, preferredLocale: true, preferencesJson: true },
  });
  const deepLink = `/app/schedule?item=${encodeURIComponent(item.id)}`;
  const day = new Date().toISOString().slice(0, 10);
  for (const user of prefs) {
    if (!notificationAllowed(user.preferencesJson, type)) continue;
    await prisma.notification.upsert({
      where: {
        tenantId_dedupeKey: {
          tenantId: item.tenantId,
          dedupeKey: `${type}:${item.id}:${user.id}:${day}`,
        },
      },
      create: {
        id: newId(),
        tenantId: item.tenantId,
        recipientUserId: user.id,
        type,
        objectType: 'ContentItem',
        objectId: item.id,
        deepLinkPath: deepLink,
        dedupeKey: `${type}:${item.id}:${user.id}:${day}`,
      },
      update: {},
    });
    // Optional email via existing mail outbox path (respects mute-all above).
    if (!user.email) continue;
    const locale = pickMailLocale(user.preferredLocale);
    const rendered = renderPublishResultEmail({
      locale,
      outcome,
      postTitle: locale === 'ar' ? item.titleAr || item.titleEn : item.titleEn || item.titleAr,
      postUrl: detail.url ?? null,
      errorMessage: detail.error
        ? humanizePublishError(detail.error, locale === 'ar' ? 'ar' : 'en')
        : null,
      deepLinkUrl: `${(process.env.WEB_ORIGIN || process.env.WEB_BASE_URL || 'https://oma-ai-ecru.vercel.app').replace(/\/+$/, '')}${deepLink}`,
      name: user.name,
    });
    const jobRunId = newId();
    const idempotencyKey = `mail.publish_result:${item.id}:${user.id}:${outcome}:${day}`;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.jobRun.create({
          data: {
            id: jobRunId,
            tenantId: item.tenantId,
            queue: 'mail',
            jobType: 'mail.publish_result',
            status: 'QUEUED',
            payloadJson: JSON.stringify({
              to: user.email,
              subject: rendered.subject,
              text: rendered.text,
              html: rendered.html,
              contentId: item.id,
              outcome,
            }),
            idempotencyKey,
          },
        });
        await writeOutbox(tx, {
          tenantId: item.tenantId,
          eventType: 'mail.publish_result',
          payload: {
            to: user.email,
            subject: rendered.subject,
            text: rendered.text,
            html: rendered.html,
            tenantId: item.tenantId,
            jobRunId,
            idempotencyKey,
          },
        });
      });
    } catch {
      // Duplicate idempotency or mail infra gaps must not fail the publish tick.
    }
  }
}

/**
 * Synchronous publish path (integration tests). Production uses BullMQ via enqueueDueSocialPublishJobs.
 */
export async function runPublishTick(deps: Deps = {}) {
  const now = deps.now?.() ?? new Date();
  const key = deps.key === undefined ? tokenKeyFromEnv() : deps.key;
  const { findDuePublishTargetIds } = await import('./due-publish-targets');
  const { publishOneTarget } = await import('./publish-one-target');
  const out = { attempted: 0, published: 0, failed: 0, retrying: 0, pending: 0, skipped: 0 };
  const ids = await findDuePublishTargetIds(now, key);
  if (!key) return out;
  for (const id of ids) {
    out.attempted++;
    const result = await publishOneTarget(id, deps);
    if (result.outcome === 'published') out.published++;
    else if (result.outcome === 'failed') out.failed++;
    else if (result.outcome === 'retrying') out.retrying++;
    else if (result.outcome === 'pending') out.pending++;
    else if (result.outcome === 'skipped') out.skipped++;
  }
  return out;
}

/** Poll asynchronous TikTok publish IDs; only TikTok's final state marks content complete. */
export async function runPublishStatusTick(deps: Deps = {}) {
  const now = deps.now?.() ?? new Date();
  const key = deps.key === undefined ? tokenKeyFromEnv() : deps.key;
  const adapterFor = deps.adapterFor ?? ((n: SocialNetworkCode) => createSocialAdapter(n));
  const out = { checked: 0, published: 0, failed: 0, pending: 0, retrying: 0 };
  if (!key) return out;
  const prisma = getPrisma();
  const due = await prisma.contentPublishTarget.findMany({
    where: {
      publishState: 'PUBLISHING',
      externalPostId: { not: null },
      nextPublishAt: { lte: now },
      socialPage: { network: 'TIKTOK' },
    },
    include: { contentItem: true, socialPage: true },
    orderBy: { nextPublishAt: 'asc' },
    take: 10,
  });

  for (const target of due) {
    const operationId = target.externalPostId;
    if (!operationId) continue;
    const nextPollAt = new Date(now.getTime() + TIKTOK_STATUS_POLL_MS);
    const claim = await prisma.contentPublishTarget.updateMany({
      where: {
        id: target.id,
        publishState: 'PUBLISHING',
        externalPostId: operationId,
        nextPublishAt: { lte: now },
      },
      data: { nextPublishAt: nextPollAt },
    });
    if (claim.count !== 1) continue;
    out.checked++;
    try {
      const page = target.socialPage;
      if (!page || page.status === 'DISCONNECTED') {
        throw new SocialProviderError('The connected account was removed', { retryable: false });
      }
      if (page.status === 'NEEDS_REAUTH') {
        throw new SocialProviderError('The connected account needs to be reconnected', {
          retryable: false,
          reauth: true,
        });
      }
      const adapter = adapterFor(fromSocialEnum(page.network));
      if (!adapter.fetchPublishStatus) {
        throw new SocialProviderError('TikTok status polling is not configured on this worker.', {
          retryable: false,
        });
      }
      const status = await adapter.fetchPublishStatus(pageForAdapter(page, key), operationId);
      if (status.status === 'PENDING') {
        await prisma.contentPublishTarget.update({
          where: { id: target.id },
          data: { nextPublishAt: nextPollAt, lastPublishError: null },
        });
        out.pending++;
        continue;
      }
      if (status.status === 'PUBLISHED') {
        await prisma.contentPublishTarget.update({
          where: { id: target.id },
          data: {
            publishState: 'PUBLISHED',
            externalPostId: status.externalId ?? operationId,
            externalPostUrl: status.url ?? target.externalPostUrl,
            publishedAt: now,
            nextPublishAt: null,
            lastPublishError: null,
          },
        });
        await syncContentPublishRollup(target.contentItemId);
        await notifyPublishOutcome(target.contentItem, 'succeeded', {
          url: status.url ?? target.externalPostUrl,
        });
        out.published++;
        continue;
      }

      const attempt = target.publishAttempts;
      if (status.reauth && target.socialPage.status !== 'NEEDS_REAUTH') {
        await markNeedsReauth(target.socialPage, status.errorMessage, now);
      }
      const shouldRetry = status.retryable && attempt < MAX_PUBLISH_ATTEMPTS;
      await prisma.contentPublishTarget.update({
        where: { id: target.id },
        data: {
          publishState: shouldRetry ? 'QUEUED' : 'FAILED',
          lastPublishError: status.errorMessage.slice(0, 1000),
          nextPublishAt: shouldRetry
            ? new Date(
                now.getTime() +
                  PUBLISH_BACKOFF_MS[
                    Math.min(Math.max(attempt - 1, 0), PUBLISH_BACKOFF_MS.length - 1)
                  ]!,
              )
            : null,
          externalPostId: null,
        },
      });
      await syncContentPublishRollup(target.contentItemId);
      if (shouldRetry) out.retrying++;
      else {
        await notifyPublishOutcome(target.contentItem, 'failed', { error: status.errorMessage });
        out.failed++;
      }
    } catch (error) {
      const err =
        error instanceof SocialProviderError
          ? error
          : new SocialProviderError(String((error as Error)?.message ?? error), {
              retryable: true,
            });
      if (err.opts.reauth && target.socialPage.status !== 'NEEDS_REAUTH') {
        await markNeedsReauth(target.socialPage, err.message, now);
      }
      if (err.opts.retryable) {
        await prisma.contentPublishTarget.update({
          where: { id: target.id },
          data: { nextPublishAt: nextPollAt, lastPublishError: err.message.slice(0, 1000) },
        });
        out.retrying++;
      } else {
        await prisma.contentPublishTarget.update({
          where: { id: target.id },
          data: {
            publishState: 'FAILED',
            lastPublishError: err.message.slice(0, 1000),
            nextPublishAt: null,
          },
        });
        await syncContentPublishRollup(target.contentItemId);
        await notifyPublishOutcome(target.contentItem, 'failed', { error: err.message });
        out.failed++;
      }
    }
  }
  return out;
}

export async function runTokenRefreshTick(deps: Deps = {}) {
  const now = deps.now?.() ?? new Date();
  const key = deps.key === undefined ? tokenKeyFromEnv() : deps.key;
  const adapterFor = deps.adapterFor ?? ((n) => createSocialAdapter(n));
  if (!key) return { checked: 0, refreshed: 0, reauth: 0 };
  const prisma = getPrisma();
  const soon = new Date(now.getTime() + REFRESH_WINDOW_MS);
  const dayAgo = new Date(now.getTime() - 24 * 3600_000);
  const pages = await prisma.socialPage.findMany({
    where: {
      status: 'CONNECTED',
      OR: [
        { tokenExpiresAt: { lte: soon } },
        // Long-lived tokens (no expiry): validate daily so revoked access is noticed.
        {
          tokenExpiresAt: null,
          OR: [{ lastRefreshedAt: null }, { lastRefreshedAt: { lte: dayAgo } }],
        },
      ],
    },
    take: 50,
  });
  const out = { checked: 0, refreshed: 0, reauth: 0 };
  for (const page of pages) {
    out.checked++;
    try {
      const adapter = adapterFor(fromSocialEnum(page.network));
      const next = await adapter.refresh(pageForAdapter(page, key));
      if (next) {
        await prisma.socialPage.update({
          where: { id: page.id },
          data: {
            accessTokenEnc: encryptToken(next.accessToken, key),
            ...(next.refreshToken ? { refreshTokenEnc: encryptToken(next.refreshToken, key) } : {}),
            tokenExpiresAt: next.expiresAt ?? null,
            ...(next.refreshExpiresAt ? { refreshExpiresAt: next.refreshExpiresAt } : {}),
            lastRefreshedAt: now,
            lastError: null,
          },
        });
        out.refreshed++;
      } else if (page.tokenExpiresAt && page.tokenExpiresAt <= now) {
        // Expired and the network offers no refresh: must reconnect.
        await markNeedsReauth(page, 'Access expired', now);
        out.reauth++;
      } else {
        await prisma.socialPage.update({ where: { id: page.id }, data: { lastRefreshedAt: now } });
      }
    } catch (e: unknown) {
      const err = e instanceof SocialProviderError ? e : null;
      if (!err || err.opts.reauth || !err.opts.retryable) {
        const message = e instanceof Error ? e.message : 'Refresh failed';
        await markNeedsReauth(page, message, now);
        out.reauth++;
      } else {
        await prisma.socialPage.update({
          where: { id: page.id },
          data: { lastError: err.message.slice(0, 500) },
        });
      }
    }
  }
  return out;
}

export function startSocialJobs(
  log: { error: (o: unknown, m: string) => void },
  connection?: import('ioredis').default,
) {
  const publish = setInterval(
    () => {
      const run = async () => {
        if (connection && process.env.SOCIAL_PUBLISH_SYNC !== '1') {
          const { enqueueDueSocialPublishJobs } = await import('./enqueue-social-publish');
          await enqueueDueSocialPublishJobs(connection);
        } else {
          await runPublishTick({ log });
        }
        await runPublishStatusTick({ log });
      };
      run().catch((e) => log.error({ err: String(e) }, 'social publish tick failed'));
    },
    Number(process.env.SOCIAL_PUBLISH_INTERVAL_MS ?? 30_000),
  );
  const refresh = setInterval(
    () => {
      runTokenRefreshTick().catch((e) =>
        log.error({ err: String(e) }, 'social token refresh failed'),
      );
    },
    Number(process.env.SOCIAL_REFRESH_INTERVAL_MS ?? 15 * 60_000),
  );
  return () => {
    clearInterval(publish);
    clearInterval(refresh);
  };
}
