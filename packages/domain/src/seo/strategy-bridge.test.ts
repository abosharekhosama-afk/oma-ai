import { describe, expect, it } from 'vitest';
import {
  buildSeoStrategyProposals,
  mergeSeoProposalsIntoOrganicPlan,
  pickSeoProposalsById,
} from './strategy-bridge';

describe('buildSeoStrategyProposals', () => {
  it('maps crawl findings to content gaps and GSC queries to keywords', () => {
    const pkg = buildSeoStrategyProposals({
      scanAttemptId: 'scan-1',
      auditScore: 72,
      auditCreatedAt: '2026-11-21T00:00:00.000Z',
      gscLastSyncAt: '2026-11-20T00:00:00.000Z',
      findings: [
        {
          page_url: 'https://brand.test/products/oud',
          code: 'SEO_META_DESC_MISSING',
          severity: 'warning',
        },
        {
          page_url: 'https://brand.test/blog',
          code: 'SEO_THIN_CONTENT',
          severity: 'info',
        },
      ],
      gscQueries: [
        {
          keyword: 'عطر عود',
          locale: 'ar',
          impressions: 1200,
          clicks: 40,
          position: 11,
          source: 'gsc_fixture',
        },
      ],
      researchMetrics: [
        {
          keyword: 'عطر عود',
          locale: 'ar',
          monthly_volume: 5400,
          difficulty: 42,
          source: 'EXTERNAL',
        },
      ],
    });

    expect(pkg.content_gaps).toHaveLength(2);
    expect(pkg.content_gaps[0]).toMatchObject({
      kind: 'MISSING_TOPIC',
      source: 'DETERMINISTIC',
    });
    expect(pkg.seo_keywords[0]).toMatchObject({
      keyword: 'عطر عود',
      monthly_volume: 5400,
      metric_source: 'EXTERNAL',
      source: 'EXTERNAL',
    });
    expect(pkg.context.audit_score).toBe(72);
  });
});

describe('mergeSeoProposalsIntoOrganicPlan', () => {
  it('dedupes keywords and respects plan limits', () => {
    const merged = mergeSeoProposalsIntoOrganicPlan(
      {
        pillars: [],
        seo_keywords: [
          { keyword: 'existing', locale: 'ar', intent: 'INFORMATIONAL', source: 'MANUAL' },
        ],
        content_gaps: [],
      },
      {
        seo_keywords: [
          { keyword: 'Existing', locale: 'ar', intent: 'COMMERCIAL', source: 'EXTERNAL' },
          { keyword: 'new-term', locale: 'en', intent: 'TRANSACTIONAL', source: 'EXTERNAL' },
        ],
      },
    );
    expect(merged.seo_keywords).toHaveLength(2);
    expect(merged.seo_keywords[1]?.keyword).toBe('new-term');
  });
});

describe('pickSeoProposalsById', () => {
  it('strips proposal metadata before merge', () => {
    const pkg = buildSeoStrategyProposals({
      scanAttemptId: null,
      auditScore: null,
      auditCreatedAt: null,
      gscLastSyncAt: null,
      findings: [{ page_url: null, code: 'SEO_H1_MISSING', severity: 'warning' }],
      gscQueries: [{ keyword: 'test kw', source: 'fixture' }],
    });
    const id = pkg.content_gaps[0]!.proposal_id;
    const picked = pickSeoProposalsById(pkg, [id]);
    expect(picked.content_gaps[0]).not.toHaveProperty('proposal_id');
    expect(picked.content_gaps[0]?.kind).toBe('MISSING_FORMAT');
  });
});
