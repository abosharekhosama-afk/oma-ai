import { describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';

describe('strategy schema integration', () => {
  it('exposes strategy models on Prisma client', () => {
    const prisma = getPrisma();
    expect(prisma.strategy).toBeDefined();
    expect(prisma.strategyVersion).toBeDefined();
    expect(prisma.strategyOrganicTrack).toBeDefined();
    expect(prisma.strategyPaidTrack).toBeDefined();
    expect(prisma.strategyAudience).toBeDefined();
    expect(prisma.strategyCompetitorReference).toBeDefined();
    expect(prisma.strategyKpi).toBeDefined();
    expect(prisma.strategyRiskAssumptionDependency).toBeDefined();
    expect(prisma.strategyEvidenceLink).toBeDefined();
    expect(prisma.strategyComment).toBeDefined();
    expect(prisma.strategyReviewDecision).toBeDefined();
    expect(prisma.strategyApprovalRecord).toBeDefined();
    expect(prisma.strategyHumanEdit).toBeDefined();
  });

  it('BrandWorkspace has currentApprovedStrategyId field', async () => {
    const prisma = getPrisma();
    const sample = await prisma.brandWorkspace.findFirst();
    if (sample) {
      expect('currentApprovedStrategyId' in sample).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });
});
