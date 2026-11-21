import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { getPrisma } from '@oma/db';
import { newId, type WebsiteConnectorPort } from '@oma/domain';
import { reimportCatalogMediaForScan } from '../../apps/worker/src/brand/catalog-reimport';
import {
  connectWebsite,
  createBrand,
  FIXTURE_WEBSITE_URL,
  seedBrandTenant,
} from '../helpers/brand-test';

const FIXTURES = join(process.cwd(), 'tests/fixtures/websites/storefront-spa');
const ORIGIN = new URL(FIXTURE_WEBSITE_URL).origin;
const HOME = `${ORIGIN}/`;
const PRODUCT = `${ORIGIN}/ar/products/item-101`;

/** Serves the sanitized SPA fixtures (rendered DOM) for the scan's own host. */
function storefrontConnector(): WebsiteConnectorPort {
  const pages: Record<string, string> = {
    '/': 'home.html',
    '/ar/products/item-101': 'product-detail.html',
  };
  return {
    validateSource: async () => ({ ok: true }),
    startIngestion: async () => undefined,
    getProgress: async () => ({ status: 'done', percent: 100 }),
    resolveRedirectTarget: async () => null,
    evaluateRobots: async () => 'ALLOW',
    inspectRobots: async () => ({ sitemaps: [], crawlDelaySeconds: null, availability: 'missing' }),
    fetchPublic: async ({ url }) => {
      const file = pages[new URL(url).pathname];
      return {
        url,
        finalUrl: url,
        status: file ? 200 : 404,
        contentType: file ? 'text/html' : null,
        body: file ? readFileSync(join(FIXTURES, file), 'utf8') : '',
        redirectChain: [],
      };
    },
  };
}

describe('catalog reimport reconciliation (integration)', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  const prevRender = process.env.BRAND_SCANNER_JS_RENDER_MODE;

  beforeAll(async () => {
    process.env.BRAND_SCANNER_JS_RENDER_MODE = 'off';
    seed = await seedBrandTenant();
    app = seed.app;
  });
  afterAll(async () => {
    process.env.BRAND_SCANNER_JS_RENDER_MODE = prevRender;
    await app.close();
  });

  it('removes fake products and mis-attributed scan media, keeps human media, is idempotent', async () => {
    const prisma = getPrisma();
    const tenantId = seed.tenantId;
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;
    await connectWebsite(seed, brandId, FIXTURE_WEBSITE_URL, brandBody.data.version as number);
    const website = await prisma.websiteSource.findFirstOrThrow({
      where: { tenantId, brandId },
      select: { id: true },
    });
    const jobRunId = newId();
    const scanId = newId();
    await prisma.jobRun.create({
      data: {
        id: jobRunId,
        tenantId,
        queue: 'ingestion',
        jobType: 'scan',
        payloadJson: '{}',
        actorUserId: seed.userId,
        idempotencyKey: `catalog-reimport-${newId()}`,
      },
    });
    await prisma.scanAttempt.create({
      data: {
        id: scanId,
        tenantId,
        brandId,
        websiteSourceId: website.id,
        jobRunId,
        idempotencyKey: `scan-${newId()}`,
        actorUserId: seed.userId,
        status: 'SUCCEEDED',
      },
    });

    const page = async (url: string) =>
      (
        await prisma.discoveredPage.create({
          data: {
            id: newId(),
            tenantId,
            brandId,
            scanAttemptId: scanId,
            url,
            canonicalUrl: url,
            canonicalHash: `test-${newId()}`,
          },
        })
      ).id;
    const homePageId = await page(HOME);
    const productPageId = await page(PRODUCT);

    const row = async (name: string, sourcePageId: string) =>
      (
        await prisma.discoveredProductService.create({
          data: {
            id: newId(),
            tenantId,
            brandId,
            scanAttemptId: scanId,
            kind: 'PRODUCT',
            name,
            sourcePageId,
            dedupeKey: `legacy:${newId()}`,
          },
        })
      ).id;
    const link = async (productId: string, role: string, sourceUrl: string, sortOrder: number) => {
      const asset = await prisma.mediaAsset.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          kind: 'IMAGE',
          workdriveFileId: `wd-${newId()}`,
          name: 'x.webp',
          mime: 'image/webp',
          size: BigInt(2048),
          createdBy: 'test',
        },
      });
      await prisma.catalogProductMedia.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          discoveredProductId: productId,
          mediaAssetId: asset.id,
          role: role as never,
          sourceUrl,
          sortOrder,
        },
      });
    };

    // Legacy state produced by the old heuristics:
    const badge = await row('مميز', homePageId); // badge label with every card's image
    for (const [i, id] of ['p101-a', 'p102-a', 'p103-a'].entries()) {
      await link(
        badge,
        i ? 'SCAN_IMAGE' : 'SCAN_THUMBNAIL',
        `https://cdn.example/media/${id}.webp`,
        i,
      );
    }
    const category = await row('ألعاب الحركة', homePageId); // category tile, reviewed media
    await link(category, 'SCAN_THUMBNAIL', 'https://cdn.example/media/cat-motion.webp', 0);
    await link(category, 'GENERATED_IMAGE', 'https://oma.test/generated/1.png', 1);
    const real = await row('كتاب الأصوات التفاعلي', productPageId);
    await link(real, 'SCAN_THUMBNAIL', 'https://cdn.example/media/p102-a.webp', 0); // wrong
    await link(real, 'SCAN_IMAGE', 'https://cdn.example/media/p101-a.webp?w=300', 1); // own

    const first = await reimportCatalogMediaForScan({
      tenantId,
      brandId,
      scanAttemptId: scanId,
      connector: storefrontConnector(),
    });
    expect(first.removed).toBe(1);
    expect(first.retained).toBe(1);

    expect(await prisma.discoveredProductService.findUnique({ where: { id: badge } })).toBeNull();

    const categoryMedia = await prisma.catalogProductMedia.findMany({
      where: { discoveredProductId: category },
    });
    expect(categoryMedia.map((m) => m.role)).toEqual(['GENERATED_IMAGE']);

    const realRow = await prisma.discoveredProductService.findUniqueOrThrow({
      where: { id: real },
    });
    expect(realRow).toMatchObject({
      priceAmount: '55',
      priceCurrency: 'ILS',
      compareAtPrice: '70',
      skuPublic: 'toy-src-101',
      extractionSource: 'DOM_DETAIL',
    });
    expect(realRow.category).toContain('صوت');
    const realMedia = await prisma.catalogProductMedia.findMany({
      where: { discoveredProductId: real },
      orderBy: { sortOrder: 'asc' },
    });
    // Only its own image survives (now first => thumbnail); missing ones need WorkDrive.
    expect(realMedia.map((m) => [m.role, m.sourceUrl])).toEqual([
      ['SCAN_THUMBNAIL', 'https://cdn.example/media/p101-a.webp?w=300'],
    ]);

    const rowsBefore = await prisma.discoveredProductService.count({
      where: { scanAttemptId: scanId },
    });
    const linksBefore = await prisma.catalogProductMedia.count({ where: { brandId } });
    const second = await reimportCatalogMediaForScan({
      tenantId,
      brandId,
      scanAttemptId: scanId,
      connector: storefrontConnector(),
    });
    expect(second.removed).toBe(0);
    expect(second.mediaRemoved).toBe(0);
    expect(second.created).toBe(0);
    expect(await prisma.discoveredProductService.count({ where: { scanAttemptId: scanId } })).toBe(
      rowsBefore,
    );
    expect(await prisma.catalogProductMedia.count({ where: { brandId } })).toBe(linksBefore);
  });
});
