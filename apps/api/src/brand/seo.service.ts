import { getPrisma, tenantWhere } from '@oma/db';
import {
  buildSeoStrategyProposals,
  createKeywordResearchPort,
  createSearchConsolePort,
  decryptToken,
  DomainError,
  encryptToken,
  gscModeFromEnv,
  newId,
  tokenKeyFromEnv,
  type KeywordResearchRequest,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';

const STATE_TTL_MS = 15 * 60_000;
const notFound = () => new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');

function gscRedirectUri(env = process.env) {
  const base = (
    env.WEB_BASE_URL ||
    env.SOCIAL_OAUTH_REDIRECT_BASE ||
    env.API_PUBLIC_URL ||
    ''
  ).replace(/\/+$/, '');
  return `${base}/api/v1/seo/gsc/callback`;
}

export class SeoService {
  constructor(private readonly audit: AuditService) {}

  private tokenKey() {
    const key = tokenKeyFromEnv();
    if (!key) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Token encryption not configured',
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

  async health(tenantId: string, brandId: string, scanId?: string) {
    await this.brand(tenantId, brandId);
    const prisma = getPrisma();
    const audit = scanId
      ? await prisma.brandSeoAudit.findFirst({
          where: tenantWhere(tenantId, { brandId, scanAttemptId: scanId }),
          include: { findings: { take: 100, orderBy: { severity: 'asc' } } },
        })
      : await prisma.brandSeoAudit.findFirst({
          where: tenantWhere(tenantId, { brandId }),
          orderBy: { createdAt: 'desc' },
          include: { findings: { take: 100, orderBy: { severity: 'asc' } } },
        });
    const link = await prisma.brandSearchConsoleLink.findFirst({
      where: tenantWhere(tenantId, { brandId }),
    });
    return {
      data: {
        audit: audit
          ? {
              scan_attempt_id: audit.scanAttemptId,
              score: audit.score,
              findings_count: audit.findingsCount,
              metric_source: audit.metricSource,
              summary: JSON.parse(audit.summaryJson),
              findings: audit.findings.map((f) => ({
                page_url: f.pageUrl,
                code: f.code,
                severity: f.severity,
                detail: f.detail,
              })),
              created_at: audit.createdAt.toISOString(),
            }
          : null,
        search_console: {
          status: link?.status ?? 'NOT_CONFIGURED',
          site_url: link?.siteUrl ?? null,
          gsc_mode: gscModeFromEnv(),
          last_sync_at: link?.lastSyncAt?.toISOString() ?? null,
          last_error: link?.lastError ?? null,
        },
      },
    };
  }

  async connectFixtureGsc(tenantId: string, userId: string, brandId: string, siteUrl: string) {
    await this.brand(tenantId, brandId);
    const prisma = getPrisma();
    const id = newId();
    const normalized = siteUrl.trim();
    await prisma.brandSearchConsoleLink.upsert({
      where: { brandId },
      create: {
        id,
        tenantId,
        brandId,
        siteUrl: normalized,
        status: 'CONNECTED',
        connectedAt: new Date(),
      },
      update: {
        siteUrl: normalized,
        status: 'CONNECTED',
        connectedAt: new Date(),
        lastError: null,
      },
    });
    await this.audit.write({
      tenantId,
      actorUserId: userId,
      action: 'brand.seo.gsc.connected',
      targetType: 'BrandWorkspace',
      targetId: brandId,
    });
    return { data: { connected: true, site_url: normalized, mode: gscModeFromEnv() } };
  }

  async startGscOAuth(tenantId: string, userId: string, brandId: string) {
    await this.brand(tenantId, brandId);
    const clientId = process.env.GOOGLE_GSC_CLIENT_ID?.trim();
    if (!clientId) {
      throw new DomainError(
        'PROVIDER_NOT_CONFIGURED',
        'Google Search Console OAuth is not configured',
        503,
        'errors.provider_not_configured',
      );
    }
    const stateId = newId();
    const prisma = getPrisma();
    await prisma.gscOAuthState.create({
      data: {
        id: stateId,
        tenantId,
        brandId,
        userId,
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      },
    });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: gscRedirectUri(),
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state: stateId,
    });
    return { data: { authorize_url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` } };
  }

  async gscCallback(
    ctx: { tenantId?: string; userId?: string },
    query: { code?: string; state?: string; error?: string },
  ) {
    const base = (process.env.WEB_BASE_URL || '').replace(/\/+$/, '');
    if (query.error || !query.code || !query.state) {
      return `${base}/app?gsc=error`;
    }
    const prisma = getPrisma();
    const row = await prisma.gscOAuthState.findFirst({ where: { id: query.state } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      return `${base}/app?gsc=state_invalid`;
    }
    if (ctx.userId && row.userId !== ctx.userId) return `${base}/app?gsc=user_mismatch`;

    const clientId = process.env.GOOGLE_GSC_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_GSC_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) return `${base}/app?gsc=not_configured`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: query.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: gscRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return `${base}/app?gsc=token_failed`;
    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const key = this.tokenKey();
    const port = createSearchConsolePort(tokens.access_token, {
      ...process.env,
      BRAND_GSC_MODE: 'live',
    });
    const sites = await port.listVerifiedSites();
    const siteUrl = sites[0] ?? 'https://example.com/';
    const linkId = newId();
    await prisma.brandSearchConsoleLink.upsert({
      where: { brandId: row.brandId },
      create: {
        id: linkId,
        tenantId: row.tenantId,
        brandId: row.brandId,
        siteUrl,
        status: 'CONNECTED',
        accessTokenEnc: encryptToken(tokens.access_token, key),
        refreshTokenEnc: tokens.refresh_token ? encryptToken(tokens.refresh_token, key) : null,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        connectedAt: new Date(),
      },
      update: {
        siteUrl,
        status: 'CONNECTED',
        accessTokenEnc: encryptToken(tokens.access_token, key),
        refreshTokenEnc: tokens.refresh_token ? encryptToken(tokens.refresh_token, key) : undefined,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        connectedAt: new Date(),
        lastError: null,
      },
    });
    await prisma.gscOAuthState.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    return `${base}/app/brands/${row.brandId}/seo?gsc=connected`;
  }

  async syncGsc(tenantId: string, userId: string, brandId: string) {
    await this.brand(tenantId, brandId);
    const prisma = getPrisma();
    const link = await prisma.brandSearchConsoleLink.findFirst({
      where: tenantWhere(tenantId, { brandId }),
    });
    const mode = gscModeFromEnv();
    if (mode === 'fixture' && !link) {
      const website = await prisma.websiteSource.findFirst({
        where: tenantWhere(tenantId, { brandId, validationStatus: 'VALID' }),
      });
      await this.connectFixtureGsc(
        tenantId,
        userId,
        brandId,
        website?.normalizedUrl ?? 'https://example-brand.test/',
      );
    }
    const refreshed = await prisma.brandSearchConsoleLink.findFirst({
      where: tenantWhere(tenantId, { brandId }),
    });
    if (!refreshed) {
      throw new DomainError(
        'PROVIDER_NOT_CONFIGURED',
        'Search Console is not connected',
        503,
        'errors.provider_not_configured',
      );
    }

    let accessToken: string | undefined;
    if (refreshed.accessTokenEnc) {
      accessToken = decryptToken(refreshed.accessTokenEnc, this.tokenKey());
    }
    const port = createSearchConsolePort(accessToken);
    const end = new Date();
    const start = new Date(end.getTime() - 28 * 86_400_000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const rows = await port.querySearchAnalytics({
      siteUrl: refreshed.siteUrl,
      startDate: fmt(start),
      endDate: fmt(end),
    });

    await prisma.keywordRankObservation.deleteMany({
      where: {
        tenantId,
        brandId,
        source: port.source,
        capturedAt: { gte: new Date(Date.now() - 86_400_000) },
      },
    });
    for (const row of rows) {
      await prisma.keywordRankObservation.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          keyword: row.query,
          locale: 'ar',
          position: row.position,
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: row.ctr,
          pageUrl: row.page ?? null,
          source: port.source,
        },
      });
    }
    await prisma.brandSearchConsoleLink.update({
      where: { id: refreshed.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });
    await this.audit.write({
      tenantId,
      actorUserId: userId,
      action: 'brand.seo.gsc.synced',
      targetType: 'BrandWorkspace',
      targetId: brandId,
    });
    return { data: { synced: true, rows: rows.length, source: port.source } };
  }

  async keywordResearch(tenantId: string, brandId: string, body: KeywordResearchRequest) {
    await this.brand(tenantId, brandId);
    const port = createKeywordResearchPort();
    const metrics = await port.keywordMetrics(body);
    return {
      data: {
        metrics,
        provider: port.id,
        measured: port.measured,
      },
    };
  }

  async strategyProposals(tenantId: string, brandId: string) {
    await this.brand(tenantId, brandId);
    const prisma = getPrisma();
    const audit = await prisma.brandSeoAudit.findFirst({
      where: tenantWhere(tenantId, { brandId }),
      orderBy: { createdAt: 'desc' },
      include: { findings: { take: 100, orderBy: { severity: 'asc' } } },
    });
    const link = await prisma.brandSearchConsoleLink.findFirst({
      where: tenantWhere(tenantId, { brandId }),
    });
    const ranks = await prisma.keywordRankObservation.findMany({
      where: tenantWhere(tenantId, { brandId }),
      orderBy: { impressions: 'desc' },
      take: 40,
    });
    const gscQueries = ranks.map((r) => ({
      keyword: r.keyword,
      locale: r.locale,
      position: r.position,
      impressions: r.impressions,
      clicks: r.clicks,
      page_url: r.pageUrl,
      source: r.source,
    }));

    let researchMetrics:
      | Array<{
          keyword: string;
          locale: string;
          monthly_volume?: number | null;
          difficulty?: number | null;
          source: string;
        }>
      | undefined;
    if (gscQueries.length > 0) {
      const port = createKeywordResearchPort();
      const top = gscQueries.slice(0, 12).map((q) => ({
        keyword: q.keyword,
        locale: q.locale ?? 'ar',
      }));
      const metrics = await port.keywordMetrics({ keywords: top, market: null });
      researchMetrics = metrics.map((m) => ({
        keyword: m.keyword,
        locale: m.locale,
        monthly_volume: m.monthly_volume,
        difficulty: m.difficulty,
        source: m.source,
      }));
    }

    const pkg = buildSeoStrategyProposals({
      scanAttemptId: audit?.scanAttemptId ?? null,
      auditScore: audit?.score ?? null,
      auditCreatedAt: audit?.createdAt.toISOString() ?? null,
      gscLastSyncAt: link?.lastSyncAt?.toISOString() ?? null,
      findings: (audit?.findings ?? []).map((f) => ({
        page_url: f.pageUrl,
        code: f.code,
        severity: f.severity,
        detail: f.detail,
      })),
      gscQueries,
      researchMetrics,
    });

    return { data: pkg };
  }

  async analyticsSeo(tenantId: string, brandId: string, period = 30) {
    await this.brand(tenantId, brandId);
    const prisma = getPrisma();
    const since = new Date(Date.now() - period * 86_400_000);
    const [audit, ranks, content] = await Promise.all([
      prisma.brandSeoAudit.findFirst({
        where: tenantWhere(tenantId, { brandId }),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.keywordRankObservation.findMany({
        where: tenantWhere(tenantId, { brandId, capturedAt: { gte: since } }),
        orderBy: { impressions: 'desc' },
        take: 50,
      }),
      prisma.contentItem.count({
        where: {
          tenantId,
          brandId,
          status: { in: ['SCHEDULED', 'PUBLISHED_SAMPLE'] },
          scheduledAt: { gte: since },
        },
      }),
    ]);
    const gscClicks = ranks.reduce((n, r) => n + (r.clicks ?? 0), 0);
    const gscImpressions = ranks.reduce((n, r) => n + (r.impressions ?? 0), 0);
    return {
      data: {
        period_days: period,
        site_health_score: audit?.score ?? null,
        site_health_scan_id: audit?.scanAttemptId ?? null,
        search_queries: ranks.map((r) => ({
          keyword: r.keyword,
          position: r.position,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          page_url: r.pageUrl,
          source: r.source,
        })),
        totals: {
          gsc_clicks: gscClicks,
          gsc_impressions: gscImpressions,
          published_posts: content,
        },
        metric_sources: {
          crawl: audit?.metricSource ?? null,
          search_console: ranks[0]?.source ?? null,
        },
      },
    };
  }
}
