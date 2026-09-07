import { describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';

describe('brand schema', () => {
  it('has brand intelligence tables and scan idempotency constraints', async () => {
    const prisma = getPrisma();
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN (
          'BrandWorkspace', 'WebsiteSource', 'ScanAttempt', 'DiscoveredPage',
          'EvidenceExcerpt', 'ProfileVersion', 'InsightClaim', 'ApprovalRecord'
        )
    `;
    const names = tables.map((t) => t.tablename).sort();
    expect(names).toEqual(
      [
        'ApprovalRecord',
        'BrandWorkspace',
        'DiscoveredPage',
        'EvidenceExcerpt',
        'InsightClaim',
        'ProfileVersion',
        'ScanAttempt',
        'WebsiteSource',
      ].sort(),
    );

    const scanIndexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'ScanAttempt'
        AND indexname IN ('ScanAttempt_idempotencyKey_key', 'ScanAttempt_jobRunId_key')
    `;
    expect(scanIndexes.map((i) => i.indexname).sort()).toEqual(
      ['ScanAttempt_idempotencyKey_key', 'ScanAttempt_jobRunId_key'].sort(),
    );
  });
});
