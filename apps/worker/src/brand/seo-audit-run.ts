import { getPrisma, tenantWhere } from '@oma/db';
import {
  evaluatePageSeo,
  metaFromFields,
  newId,
  parsePageSeoSignalsFromExcerpt,
  scoreSeoAudit,
  summarizeSeoFindings,
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
    const signals = parsePageSeoSignalsFromExcerpt(excerpt);
    const pageFindings = evaluatePageSeo({
      url: page.url,
      httpStatus: page.httpStatus,
      title: page.title,
      metaDescription: signals.metaDescription ?? globalMeta.metaDescription,
      h1: signals.h1,
      excerptLength: signals.plainTextLength,
      noindex: signals.noindex,
      hasCanonical: signals.hasCanonical,
      classification: page.classification,
    });
    for (const f of pageFindings) {
      allFindings.push({ ...f, pageUrl: page.url });
    }
  }

  const summary = summarizeSeoFindings(
    pages.map((p) => ({ title: p.title, url: p.url })),
    allFindings,
  );
  if (summary.duplicate_titles.length > 0) {
    for (const dup of summary.duplicate_titles.slice(0, 20)) {
      allFindings.push({
        code: 'SEO_DUPLICATE_TITLE',
        severity: 'warning',
        detail: dup,
        pageUrl: pages.find((p) => (p.title ?? '').trim().toLowerCase() === dup)?.url ?? pages[0]!.url,
      });
    }
    summary.warning_count += Math.min(20, summary.duplicate_titles.length);
    summary.by_code.SEO_DUPLICATE_TITLE = summary.duplicate_titles.length;
  }
  const score = scoreSeoAudit(allFindings);

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
      summaryJson: JSON.stringify(summary),
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