import { getPrisma } from '@oma/db';
import {
  createSocialAdapter,
  decryptToken,
  encryptToken,
  fromSocialEnum,
  newId,
  SocialProviderError,
  tokenKeyFromEnv,
  type SocialProviderAdapter,
  type SocialNetworkCode,
  type FetchLike,
} from '@oma/domain';
import { publicMediaUrl } from '../media/media-jobs';

export const MAX_PUBLISH_ATTEMPTS = 5;
/** Backoff after attempt n (1-based): 1m, 5m, 15m, 60m. */
export const PUBLISH_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
/** Refresh tokens that expire within this window. */
export const REFRESH_WINDOW_MS = 3 * 24 * 3600_000;

export type AdapterFactory = (network: SocialNetworkCode) => SocialProviderAdapter;

type Deps = {
  now?: () => Date;
  adapterFor?: AdapterFactory;
  key?: Buffer | null;
  mediaFetch?: FetchLike;
};

function pageForAdapter(
  p: {
    externalId: string;
    name: string;
    accessTokenEnc: string;
    refreshTokenEnc: string | null;
    metaJson: string;
  },
  key: Buffer,
) {
  return {
    externalId: p.externalId,
    name: p.name,
    accessToken: decryptToken(p.accessTokenEnc, key),
    refreshToken: p.refreshTokenEnc ? decryptToken(p.refreshTokenEnc, key) : null,
    meta: JSON.parse(p.metaJson || '{}') as Record<string, unknown>,
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
  for (const userId of recipients) {
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

async function markNeedsReauth(
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

/**
 * Publish approved, scheduled posts whose time has come. Each item is claimed atomically
 * (QUEUED/NONE → PUBLISHING) so concurrent workers never double-post.
 */
export async function runPublishTick(deps: Deps = {}) {
  const now = deps.now?.() ?? new Date();
  const key = deps.key === undefined ? tokenKeyFromEnv() : deps.key;
  const adapterFor = deps.adapterFor ?? ((n) => createSocialAdapter(n));
  if (!key) return { attempted: 0, published: 0, failed: 0, retrying: 0 };
  const prisma = getPrisma();
  // Approved posts, or any scheduled post in brands whose approval policy is "none".
  const noApproval = (
    await prisma.contentPreferences.findMany({
      where: { approvalPolicy: 'NONE' },
      select: { brandId: true },
    })
  ).map((p) => p.brandId);
  const due = await prisma.contentItem.findMany({
    where: {
      AND: [{ OR: [{ approvalState: 'APPROVED' }, { brandId: { in: noApproval } }] }],
      socialPageId: { not: null },
      archivedAt: null,
      scheduleState: 'SCHEDULED',
      scheduledAt: { lte: now },
      publishState: { in: ['NONE', 'QUEUED'] },
      OR: [{ nextPublishAt: null }, { nextPublishAt: { lte: now } }],
    },
    orderBy: { scheduledAt: 'asc' },
    take: 25,
  });
  const out = { attempted: 0, published: 0, failed: 0, retrying: 0 };
  for (const item of due) {
    const claim = await prisma.contentItem.updateMany({
      where: { id: item.id, publishState: { in: ['NONE', 'QUEUED'] } },
      data: { publishState: 'PUBLISHING' },
    });
    if (claim.count !== 1) continue;
    out.attempted++;
    const attempt = item.publishAttempts + 1;
    const page = await prisma.socialPage.findFirst({
      where: { id: item.socialPageId!, tenantId: item.tenantId, brandId: item.brandId },
    });
    const brand = await prisma.brandWorkspace.findFirst({
      where: { id: item.brandId },
      select: { status: true, deletedAt: true },
    });
    try {
      if (!page || page.status === 'DISCONNECTED')
        throw new SocialProviderError('The connected account was removed', { retryable: false });
      if (page.status === 'NEEDS_REAUTH')
        throw new SocialProviderError('The connected account needs to be reconnected', {
          retryable: false,
          reauth: true,
        });
      if (!brand || brand.status === 'ARCHIVED' || brand.deletedAt)
        throw new SocialProviderError('Brand is archived', { retryable: false });
      const adapter = adapterFor(fromSocialEnum(page.network));
      if (!adapter.isConfigured())
        throw new SocialProviderError('Network is not configured', { retryable: false });
      const text =
        [item.captionEn || item.titleEn].filter(Boolean).join('\n').trim() || item.titleEn;
      const res = await adapter.publish(pageForAdapter(page, key), {
        text,
        // WorkDrive media → a fresh signed URL the network can fetch (Instagram / TikTok).
        mediaUrl: await publicMediaUrl(item, { fetchImpl: deps.mediaFetch }),
      });
      await prisma.contentItem.update({
        where: { id: item.id },
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
      out.published++;
    } catch (e) {
      const err =
        e instanceof SocialProviderError
          ? e
          : new SocialProviderError(String((e as Error)?.message ?? e), { retryable: true });
      if (err.opts.reauth && page && page.status !== 'NEEDS_REAUTH')
        await markNeedsReauth(page, err.message, now);
      const retry = err.opts.retryable && attempt < MAX_PUBLISH_ATTEMPTS;
      await prisma.contentItem.update({
        where: { id: item.id },
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
      if (retry) out.retrying++;
      else out.failed++;
    }
  }
  return out;
}

/** Refresh tokens nearing expiry; failures mark the page NEEDS_REAUTH and alert managers. */
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
    } catch (e) {
      const err = e instanceof SocialProviderError ? e : null;
      if (!err || err.opts.reauth || !err.opts.retryable) {
        await markNeedsReauth(page, (e as Error).message ?? 'Refresh failed', now);
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

export function startSocialJobs(log: { error: (o: unknown, m: string) => void }) {
  const publish = setInterval(
    () => {
      runPublishTick().catch((e) => log.error({ err: String(e) }, 'social publish tick failed'));
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
