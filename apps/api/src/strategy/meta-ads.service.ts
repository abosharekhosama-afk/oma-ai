import { getPrisma, syncBrandMetaAds, tenantWhere } from '@oma/db';
import {
  DomainError,
  MetaAdsClient,
  META_ADS_SCOPES,
  decryptToken,
  encryptToken,
  metaAdsModeFromEnv,
  newId,
  tokenKeyFromEnv,
} from '@oma/domain';
import type { AuditService } from '../audit/audit.service';

const STATE_TTL_MS = 15 * 60_000;
const notFound = () => new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
const notConfigured = () =>
  new DomainError(
    'PROVIDER_NOT_CONFIGURED',
    'Meta Ads insights are not enabled',
    503,
    'errors.provider_not_configured',
  );

function redirectUri(env = process.env) {
  const base = (
    env.WEB_BASE_URL ||
    env.SOCIAL_OAUTH_REDIRECT_BASE ||
    env.API_PUBLIC_URL ||
    ''
  ).replace(/\/+$/, '');
  return `${base}/api/v1/meta-ads/callback`;
}

/** DEC-029 4.8: read-only Meta Ads connection + insights sync. */
export class MetaAdsService {
  constructor(
    private readonly audit: AuditService,
    private readonly client: () => MetaAdsClient = () => new MetaAdsClient(),
  ) {}

  private async brand(tenantId: string, brandId: string) {
    const b = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
      select: { id: true },
    });
    if (!b) throw notFound();
  }

  private key() {
    const key = tokenKeyFromEnv();
    if (!key) throw notConfigured();
    return key;
  }

  async status(tenantId: string, brandId: string) {
    await this.brand(tenantId, brandId);
    const link = await getPrisma().metaAdsLink.findFirst({
      where: tenantWhere(tenantId, { brandId }),
    });
    return {
      data: {
        mode: metaAdsModeFromEnv(),
        read_only: true,
        scopes: [...META_ADS_SCOPES],
        status: link?.status ?? 'NOT_CONNECTED',
        ad_account_id: link?.adAccountId ?? null,
        ad_account_name: link?.adAccountName ?? null,
        currency: link?.currency ?? null,
        token_expires_at: link?.tokenExpiresAt?.toISOString() ?? null,
        last_sync_at: link?.lastSyncAt?.toISOString() ?? null,
        last_error: link?.lastError ?? null,
      },
    };
  }

  async startOAuth(tenantId: string, userId: string, brandId: string) {
    await this.brand(tenantId, brandId);
    const mode = metaAdsModeFromEnv();
    if (mode === 'fixture') return this.connectFixture(tenantId, userId, brandId);
    if (mode !== 'live') throw notConfigured();
    this.key();
    const id = newId();
    await getPrisma().metaAdsOAuthState.create({
      data: { id, tenantId, brandId, userId, expiresAt: new Date(Date.now() + STATE_TTL_MS) },
    });
    return { data: { authorize_url: this.client().authorizeUrl(id, redirectUri()) } };
  }

  private async connectFixture(tenantId: string, userId: string, brandId: string) {
    await getPrisma().metaAdsLink.upsert({
      where: { brandId },
      create: {
        id: newId(),
        tenantId,
        brandId,
        status: 'FIXTURE',
        adAccountId: 'act_fixture',
        adAccountName: 'Sample ad account (FIXTURE)',
        currency: 'SAR',
        connectedBy: userId,
      },
      update: { status: 'FIXTURE', adAccountId: 'act_fixture', lastError: null },
    });
    await this.audit.write({
      tenantId,
      actorUserId: userId,
      action: 'paid.meta_ads.connected',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      afterRef: 'FIXTURE',
    });
    return { data: { connected: true, mode: 'fixture' } };
  }

  async callback(ctx: { userId?: string }, q: { code?: string; state?: string; error?: string }) {
    const base = (process.env.WEB_BASE_URL || '').replace(/\/+$/, '');
    if (q.error || !q.code || !q.state) return `${base}/app?meta_ads=error`;
    const prisma = getPrisma();
    const row = await prisma.metaAdsOAuthState.findFirst({ where: { id: q.state } });
    if (!row || row.usedAt || row.expiresAt < new Date())
      return `${base}/app?meta_ads=state_invalid`;
    if (ctx.userId && row.userId !== ctx.userId) return `${base}/app?meta_ads=user_mismatch`;
    await prisma.metaAdsOAuthState.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    if (metaAdsModeFromEnv() !== 'live') return `${base}/app?meta_ads=not_configured`;
    let token: { accessToken: string; expiresAt: Date | null };
    try {
      token = await this.client().exchangeCode(q.code, redirectUri());
    } catch {
      return `${base}/app/brands/${row.brandId}/strategy?meta_ads=token_failed`;
    }
    const key = this.key();
    await prisma.metaAdsLink.upsert({
      where: { brandId: row.brandId },
      create: {
        id: newId(),
        tenantId: row.tenantId,
        brandId: row.brandId,
        status: 'PENDING_ACCOUNT',
        accessTokenEnc: encryptToken(token.accessToken, key),
        tokenExpiresAt: token.expiresAt,
        connectedBy: row.userId,
      },
      update: {
        status: 'PENDING_ACCOUNT',
        accessTokenEnc: encryptToken(token.accessToken, key),
        tokenExpiresAt: token.expiresAt,
        lastError: null,
      },
    });
    await this.audit.write({
      tenantId: row.tenantId,
      actorUserId: row.userId,
      action: 'paid.meta_ads.connected',
      targetType: 'BrandWorkspace',
      targetId: row.brandId,
      afterRef: 'ads_read',
    });
    return `${base}/app/brands/${row.brandId}/strategy?meta_ads=pick_account`;
  }

  async listAccounts(tenantId: string, brandId: string) {
    await this.brand(tenantId, brandId);
    const link = await getPrisma().metaAdsLink.findFirst({
      where: tenantWhere(tenantId, { brandId }),
    });
    if (!link) throw notFound();
    if (link.status === 'FIXTURE') {
      return {
        data: [
          { id: 'act_fixture', name: 'Sample ad account (FIXTURE)', currency: 'SAR', status: 1 },
        ],
      };
    }
    if (!link.accessTokenEnc) throw notFound();
    try {
      return {
        data: await this.client().listAdAccounts(decryptToken(link.accessTokenEnc, this.key())),
      };
    } catch (err) {
      throw new DomainError(
        'CONFLICT_STATE',
        String((err as Error).message).slice(0, 200),
        409,
        'errors.conflict_state',
        [{ code: 'META_ADS_PROVIDER_ERROR' }],
      );
    }
  }

  async selectAccount(
    tenantId: string,
    userId: string,
    brandId: string,
    body: { ad_account_id?: unknown },
  ) {
    const id = typeof body?.ad_account_id === 'string' ? body.ad_account_id.trim() : '';
    if (!/^(act_)?[A-Za-z0-9_]+$/.test(id)) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'ad_account_id required',
        400,
        'errors.validation',
        [{ field: 'ad_account_id', code: 'REQUIRED' }],
      );
    }
    const accounts = (await this.listAccounts(tenantId, brandId)).data;
    const account = accounts.find((a) => a.id === id || a.id === `act_${id}`);
    if (!account) {
      throw new DomainError('VALIDATION_FAILED', 'Unknown ad account', 400, 'errors.validation', [
        { field: 'ad_account_id', code: 'UNKNOWN_ACCOUNT' },
      ]);
    }
    const link = await getPrisma().metaAdsLink.update({
      where: { brandId },
      data: {
        adAccountId: account.id,
        adAccountName: account.name,
        currency: account.currency,
        status:
          (await getPrisma().metaAdsLink.findFirst({ where: { brandId } }))?.status === 'FIXTURE'
            ? 'FIXTURE'
            : 'CONNECTED',
      },
    });
    await this.audit.write({
      tenantId,
      actorUserId: userId,
      action: 'paid.meta_ads.account_selected',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      afterRef: account.id,
    });
    return { data: { status: link.status, ad_account_id: link.adAccountId } };
  }

  async sync(tenantId: string, userId: string, brandId: string, days?: number) {
    await this.brand(tenantId, brandId);
    const res = await syncBrandMetaAds(tenantId, brandId, { days });
    if (!res.ok) {
      if (res.reason === 'disabled') throw notConfigured();
      if (res.reason === 'not_connected') {
        throw new DomainError(
          'CONFLICT_STATE',
          'Pick an ad account first',
          409,
          'errors.conflict_state',
          [{ code: 'META_ADS_NOT_CONNECTED' }],
        );
      }
      throw new DomainError(
        'CONFLICT_STATE',
        res.reason === 'needs_reconnect' ? 'Reconnect Meta Ads' : 'Meta Ads sync failed',
        409,
        'errors.conflict_state',
        [
          {
            code:
              res.reason === 'needs_reconnect'
                ? 'META_ADS_NEEDS_RECONNECT'
                : 'META_ADS_PROVIDER_ERROR',
          },
        ],
      );
    }
    await this.audit.write({
      tenantId,
      actorUserId: userId,
      action: 'paid.meta_ads.synced',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      afterRef: JSON.stringify({ rows: res.rows, days: res.days, source: res.source }),
    });
    return { data: res };
  }

  /** Forget the token locally (OMA holds no write access to revoke on Meta's side). */
  async disconnect(tenantId: string, userId: string, brandId: string) {
    await this.brand(tenantId, brandId);
    await getPrisma().metaAdsLink.deleteMany({ where: { tenantId, brandId } });
    await this.audit.write({
      tenantId,
      actorUserId: userId,
      action: 'paid.meta_ads.disconnected',
      targetType: 'BrandWorkspace',
      targetId: brandId,
    });
    return { data: { disconnected: true } };
  }
}
