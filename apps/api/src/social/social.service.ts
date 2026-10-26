import { getPrisma, tenantWhere } from '@oma/db';
import {
  createSocialAdapter,
  decryptToken,
  DomainError,
  encryptToken,
  fromSocialEnum,
  isSocialNetwork,
  newId,
  pkceChallenge,
  pkceVerifier,
  socialAvailability,
  SocialProviderError,
  tokenKeyFromEnv,
  toSocialEnum,
  type SocialNetworkCode,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';

const STATE_TTL_MS = 15 * 60_000;
const notFound = () => new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');

/** Public base the OAuth callback is served from (the web origin proxies /api to the API). */
export function oauthRedirectUri(network: SocialNetworkCode, env = process.env): string {
  const base = (
    env.SOCIAL_OAUTH_REDIRECT_BASE ||
    env.WEB_BASE_URL ||
    env.API_PUBLIC_URL ||
    ''
  ).replace(/\/+$/, '');
  return `${base}/api/v1/social/oauth/${network}/callback`;
}

function webBase(env = process.env) {
  return (env.WEB_BASE_URL || env.SOCIAL_OAUTH_REDIRECT_BASE || '').replace(/\/+$/, '');
}

export function mapSocialPage(p: {
  id: string;
  brandId: string;
  network: string;
  externalId: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  tokenExpiresAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}) {
  return {
    id: p.id,
    brand_id: p.brandId,
    network: fromSocialEnum(p.network),
    external_id: p.externalId,
    name: p.name,
    avatar_url: p.avatarUrl,
    status: p.status,
    token_expires_at: p.tokenExpiresAt?.toISOString() ?? null,
    last_error: p.lastError,
    connected_at: p.createdAt.toISOString(),
  };
}

export class SocialService {
  constructor(private readonly audit: AuditService) {}

  private key() {
    const key = tokenKeyFromEnv();
    if (!key) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Social connections are not available yet',
        409,
        'errors.social_unavailable',
      );
    }
    return key;
  }

  private async brand(tenantId: string, brandId: string) {
    const b = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId, deletedAt: null }),
    });
    if (!b) throw notFound();
    return b;
  }

  async list(tenantId: string, brandId: string) {
    await this.brand(tenantId, brandId);
    const pages = await getPrisma().socialPage.findMany({
      where: { tenantId, brandId, status: { not: 'DISCONNECTED' } },
      orderBy: [{ network: 'asc' }, { name: 'asc' }],
    });
    return { data: { pages: pages.map(mapSocialPage), providers: socialAvailability() } };
  }

  async start(tenantId: string, userId: string, brandId: string, network: string) {
    if (!isSocialNetwork(network)) throw notFound();
    const brand = await this.brand(tenantId, brandId);
    if (brand.status === 'ARCHIVED') {
      throw new DomainError('BRAND_ARCHIVED', 'Brand archived', 409, 'errors.brand_archived');
    }
    const avail = socialAvailability().find((p) => p.network === network)!;
    if (!avail.available) {
      throw new DomainError(
        'CONFLICT_STATE',
        'This network is not available yet',
        409,
        'errors.social_unavailable',
      );
    }
    const key = this.key();
    const adapter = createSocialAdapter(network);
    const verifier = adapter.usesPkce ? pkceVerifier() : null;
    const state = newId() + newId();
    await getPrisma().socialOAuthState.create({
      data: {
        id: state,
        tenantId,
        brandId,
        userId,
        network: toSocialEnum(network),
        codeVerifierEnc: verifier ? encryptToken(verifier, key) : null,
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      },
    });
    const url = adapter.authorizeUrl({
      state,
      redirectUri: oauthRedirectUri(network),
      codeChallenge: verifier ? pkceChallenge(verifier) : undefined,
    });
    return { data: { authorize_url: url } };
  }

  /** Returns the web URL to redirect the browser to. Never throws for provider errors. */
  async callback(
    session: { tenantId?: string; userId?: string },
    network: string,
    q: { code?: string; state?: string; error?: string },
  ): Promise<string> {
    const prisma = getPrisma();
    const row = q.state
      ? await prisma.socialOAuthState.findUnique({ where: { id: q.state } })
      : null;
    const back = (brandId: string | null, status: string) =>
      brandId
        ? `${webBase()}/app/brands/${encodeURIComponent(brandId)}/settings?tab=accounts&connect=${status}&network=${network}`
        : `${webBase()}/app/brands?connect=${status}`;
    if (
      !row ||
      row.usedAt ||
      row.expiresAt < new Date() ||
      fromSocialEnum(row.network) !== network ||
      row.userId !== session.userId ||
      row.tenantId !== session.tenantId
    ) {
      return back(row?.brandId ?? null, 'invalid');
    }
    await prisma.socialOAuthState.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    if (q.error || !q.code) return back(row.brandId, 'cancelled');
    try {
      const key = this.key();
      const adapter = createSocialAdapter(network as SocialNetworkCode);
      const accounts = await adapter.exchangeCode({
        code: q.code,
        redirectUri: oauthRedirectUri(network as SocialNetworkCode),
        codeVerifier: row.codeVerifierEnc ? decryptToken(row.codeVerifierEnc, key) : undefined,
      });
      if (!accounts.length) return back(row.brandId, 'none');
      for (const a of accounts) {
        const data = {
          name: a.name.slice(0, 200),
          avatarUrl: a.avatarUrl ?? null,
          status: 'CONNECTED' as const,
          accessTokenEnc: encryptToken(a.token.accessToken, key),
          refreshTokenEnc: a.token.refreshToken ? encryptToken(a.token.refreshToken, key) : null,
          tokenExpiresAt: a.token.expiresAt ?? null,
          refreshExpiresAt: a.token.refreshExpiresAt ?? null,
          scopes: a.token.scopes ?? [],
          metaJson: JSON.stringify(a.meta ?? {}),
          lastError: null,
          lastRefreshedAt: new Date(),
        };
        await prisma.socialPage.upsert({
          where: {
            brandId_network_externalId: {
              brandId: row.brandId,
              network: row.network,
              externalId: a.externalId,
            },
          },
          create: {
            id: newId(),
            tenantId: row.tenantId,
            brandId: row.brandId,
            network: row.network,
            externalId: a.externalId,
            connectedBy: row.userId,
            ...data,
          },
          update: data,
        });
      }
      await this.audit.write({
        actorUserId: row.userId,
        tenantId: row.tenantId,
        action: 'social.connected',
        targetType: 'BrandWorkspace',
        targetId: row.brandId,
        afterRef: `${network}:${accounts.length}`,
      });
      return back(row.brandId, 'ok');
    } catch (e) {
      const reason = e instanceof SocialProviderError ? 'provider_error' : 'error';
      return back(row.brandId, reason);
    }
  }

  async disconnect(tenantId: string, actorUserId: string, pageId: string) {
    const prisma = getPrisma();
    const page = await prisma.socialPage.findFirst({ where: { id: pageId, tenantId } });
    if (!page) throw notFound();
    await prisma.$transaction([
      // Queued posts targeting this page go back to "not published by OMA".
      prisma.contentItem.updateMany({
        where: {
          tenantId,
          socialPageId: pageId,
          publishState: { in: ['NONE', 'QUEUED', 'FAILED'] },
        },
        data: { socialPageId: null, publishState: 'NONE', nextPublishAt: null },
      }),
      prisma.socialPage.delete({ where: { id: pageId } }),
    ]);
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'social.disconnected',
      targetType: 'SocialPage',
      targetId: pageId,
      afterRef: page.network,
    });
    return { data: { id: pageId, removed: true } };
  }

  async setPublishTarget(tenantId: string, contentId: string, body: unknown) {
    const prisma = getPrisma();
    const raw = (body as { socialPageId?: unknown; social_page_id?: unknown } | null) ?? {};
    const pageId = raw.socialPageId ?? raw.social_page_id ?? null;
    const item = await prisma.contentItem.findFirst({ where: { id: contentId, tenantId } });
    if (!item) throw notFound();
    if (item.publishState === 'PUBLISHED' || item.publishState === 'PUBLISHING') {
      throw new DomainError('CONFLICT_STATE', 'Already published', 409, 'errors.conflict_state');
    }
    if (pageId !== null) {
      if (typeof pageId !== 'string') {
        throw new DomainError(
          'VALIDATION_FAILED',
          'socialPageId must be a string or null',
          400,
          'errors.validation_failed',
        );
      }
      const page = await prisma.socialPage.findFirst({
        where: { id: pageId, tenantId, brandId: item.brandId, status: { not: 'DISCONNECTED' } },
      });
      if (!page) throw notFound();
    }
    const row = await prisma.contentItem.update({
      where: { id: contentId },
      data: {
        socialPageId: pageId,
        publishState: pageId && item.scheduleState === 'SCHEDULED' ? 'QUEUED' : 'NONE',
        publishAttempts: 0,
        nextPublishAt: null,
        lastPublishError: null,
      },
    });
    return {
      data: { id: row.id, social_page_id: row.socialPageId, publish_state: row.publishState },
    };
  }
}
