import { getPrisma, tenantWhere } from '@oma/db';
import {
  evaluatePageSeo,
  h1FromExcerpt,
  metaFromFields,
  newId,
  scoreSeoAudit,
  type SeoPageFinding,
} from '@oma/domain';

export async function runSeoAuditForScan(input: {
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
}) {
  const prisma = getPrisma();
  const existing = await prisma.brandSeoAudit.findFirst({
    where: tenantWhere(input.tenantId, { scanAttemptId: input.scanAttemptId }),
  });
  if (existing) return existing.id;

  const pages = await prisma.discoveredPage.findMany({
    where: tenantWhere(input.tenantId, {
      scanAttemptId: input.scanAttemptId,
      brandId: input.brandId,
      fetchStatus: 'FETCHED',
    }),
    select: {
      url: true,
      title: true,
      httpStatus: true,
      classification: true,
      evidenceExcerpts: { select: { excerptText: true }, take: 1 },
    },
  });

  const observations = await prisma.extractedObservation.findMany({
    where: tenantWhere(input.tenantId, { scanAttemptId: input.scanAttemptId }),
    select: { fieldKey: true, valueJson: true, isUnknown: true },
  });
  const globalMeta = metaFromFields(
    observations.map((o) => ({
      fieldKey: o.fieldKey,
      value: o.valueJson ? (JSON.parse(o.valueJson) as unknown) : null,
    })),
  );

  const allFindings: Array<SeoPageFinding & { pageUrl: string }> = [];
  for (const page of pages) {
    const excerpt = page.evidenceExcerpts[0]?.excerptText ?? '';
    const pageFindings = evaluatePageSeo({
      url: page.url,
      httpStatus: page.httpStatus,
      title: page.title,
      metaDescription: globalMeta.metaDescription,
      h1: h1FromExcerpt(excerpt),
      excerptLength: excerpt.replace(/<[^>]+>/g, ' ').trim().length,
      noindex: /noindex/i.test(excerpt),
      hasCanonical: /rel=.canonical/i.test(excerpt),
      classification: page.classification,
    });
    for (const f of pageFindings) {
      allFindings.push({ ...f, pageUrl: page.url });
    }
  }

  const score = scoreSeoAudit(allFindings);
  const byCode: Record<string, number> = {};
  for (const f of allFindings) {
    byCode[f.code] = (byCode[f.code] ?? 0) + 1;
  }

  const auditId = newId();
  await prisma.brandSeoAudit.create({
    data: {
      id: auditId,
      tenantId: input.tenantId,
      brandId: input.brandId,
      scanAttemptId: input.scanAttemptId,
      score,
      findingsCount: allFindings.length,
      metricSource: 'CRAWL',
      summaryJson: JSON.stringify({ by_code: byCode, pages_audited: pages.length }),
    },
  });

  if (allFindings.length > 0) {
    await prisma.seoFinding.createMany({
      data: allFindings.map((f) => ({
        id: newId(),
        tenantId: input.tenantId,
        brandId: input.brandId,
        seoAuditId: auditId,
        pageUrl: f.pageUrl,
        code: f.code,
        severity: f.severity,
        detail: f.detail ?? null,
      })),
    });
  }
  return auditId;
}