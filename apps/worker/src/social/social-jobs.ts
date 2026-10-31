import { getPrisma, writeOutbox } from '@oma/db';
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
  skipReasonMessage,
  SocialProviderError,
  tokenKeyFromEnv,
  type SocialProviderAdapter,
  type SocialNetworkCode,
  type FetchLike,
} from '@oma/domain';
import { mediaProxyUrl, publicMediaUrls } from '../media/media-jobs';

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
  log?: { error: (object: unknown, message: string) => void };
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

/** Notify creator/assignee/managers that a publish finished (success or terminal failure). */
async function notifyPublishOutcome(
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
 * Publish approved, scheduled posts whose time has come. Each item is claimed atomically
 * (QUEUED/NONE → PUBLISHING) so concurrent workers never double-post.
 * Due posts that are not eligible (e.g. not approved) get a recorded skip reason.
 */
export async function runPublishTick(deps: Deps = {}) {
  const now = deps.now?.() ?? new Date();
  const key = deps.key === undefined ? tokenKeyFromEnv() : deps.key;
  const adapterFor = deps.adapterFor ?? ((n) => createSocialAdapter(n));
  const prisma = getPrisma();
  const out = { attempted: 0, published: 0, failed: 0, retrying: 0, skipped: 0 };

  // Brands whose approval policy is NONE may publish without APPROVED.
  const noApproval = (
    await prisma.contentPreferences.findMany({
      where: { approvalPolicy: 'NONE' },
      select: { brandId: true },
    })
  ).map((p) => p.brandId);

  // Record why due posts are not picked up (approval / missing encryption key).
  const dueAny = await prisma.contentItem.findMany({
    where: {
      socialPageId: { not: null },
      archivedAt: null,
      scheduleState: 'SCHEDULED',
      scheduledAt: { lte: now },
      publishState: { in: ['NONE', 'QUEUED'] },
      OR: [{ nextPublishAt: null }, { nextPublishAt: { lte: now } }],
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
    select: {
      id: true,
      brandId: true,
      approvalState: true,
      lastPublishSkipReason: true,
    },
  });
  for (const row of dueAny) {
    const eligible = row.approvalState === 'APPROVED' || noApproval.includes(row.brandId);
    if (!eligible) {
      const reason = skipReasonMessage('NOT_APPROVED');
      if (row.lastPublishSkipReason !== reason) {
        await prisma.contentItem.update({
          where: { id: row.id },
          data: { lastPublishSkipReason: reason },
        });
      }
      out.skipped++;
      continue;
    }
    if (!key) {
      const reason = skipReasonMessage('ENCRYPTION_KEY');
      if (row.lastPublishSkipReason !== reason) {
        await prisma.contentItem.update({
          where: { id: row.id },
          data: { lastPublishSkipReason: reason },
        });
      }
      out.skipped++;
    }
  }

  if (!key) return out;

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

  for (const item of due) {
    const claim = await prisma.contentItem.updateMany({
      where: { id: item.id, publishState: { in: ['NONE', 'QUEUED'] } },
      data: {
        publishState: 'PUBLISHING',
        workerPickedAt: now,
        lastPublishSkipReason: null,
      },
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
      const network = fromSocialEnum(page.network);
      const adapter = adapterFor(network);
      if (!adapter.isConfigured())
        throw new SocialProviderError('Network is not configured', { retryable: false });
      const text =
        [item.captionEn || item.titleEn].filter(Boolean).join('\n').trim() || item.titleEn;
      const rawMediaUrls = await publicMediaUrls(item, { fetchImpl: deps.mediaFetch });
      const mediaUrls =
        network === 'tiktok'
          ? rawMediaUrls.map((u) => mediaProxyUrl(u))
          : rawMediaUrls;
      const res = await adapter.publish(pageForAdapter(page, key), {
        text,
        // TikTok needs the URL prefix on a verified domain — proxy every carousel URL.
        mediaUrls,
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
          lastPublishSkipReason: null,
        },
      });
      out.published++;
      await notifyPublishOutcome(item, 'succeeded', { url: res.url });
    } catch (e) {
      const err =
        e instanceof SocialProviderError
          ? e
          : new SocialProviderError(String((e as Error)?.message ?? e), { retryable: true });
      deps.log?.error(
        {
          contentId: item.id,
          network: page?.network ?? null,
          attempt,
          retryable: err.opts.retryable,
          reauth: err.opts.reauth ?? false,
          status: err.opts.status ?? null,
          providerCode: err.opts.providerCode ?? null,
          providerMessage: err.opts.providerMessage ?? null,
          providerLogId: err.opts.providerLogId ?? null,
          error: err.message,
        },
        'social publish rejected',
      );
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
      else {
        out.failed++;
        await notifyPublishOutcome(item, 'failed', { error: err.message });
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
      runPublishTick({ log }).catch((e) =>
        log.error({ err: String(e) }, 'social publish tick failed'),
      );
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
