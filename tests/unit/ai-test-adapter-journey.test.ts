import { describe, expect, it } from 'vitest';
import {
  deterministicProposal,
  evaluateBudget,
  releaseReservation,
  settleReservation,
  snapshotLedger,
  testAdapterAllowed,
  validateProposal,
} from '@oma/domain';

describe('deterministic offline test adapter', () => {
  it('is forbidden in production and when live is on', () => {
    expect(testAdapterAllowed({ NODE_ENV: 'production', AI_TEST_ADAPTER: '1' })).toBe(false);
    expect(
      testAdapterAllowed({ NODE_ENV: 'test', AI_TEST_ADAPTER: '1', AI_LIVE_ENABLED: 'true' }),
    ).toBe(false);
    expect(
      testAdapterAllowed({ NODE_ENV: 'test', AI_TEST_ADAPTER: '1', AI_LIVE_ENABLED: 'false' }),
    ).toBe(true);
  });

  it('builds reviewable brand and strategy proposals from evidence', () => {
    for (const useCase of [
      'brand_profile_synthesis',
      'strategy_foundation',
      'organic_strategy',
      'paid_planning',
      'campaign_brief',
      'content_brief',
      'profile_comparison',
      'strategy_comparison',
    ] as const) {
      const proposal = deterministicProposal({
        useCase,
        evidenceRefs: ['evidence-1'],
        sourceVersion: 'v1',
        language: 'ar',
      });
      expect(validateProposal(proposal).ok).toBe(true);
      expect(proposal.banner).toMatch(/HUMAN REVIEW/);
      expect(proposal.items.some((item) => item.kind === 'proposal')).toBe(true);
      expect(
        proposal.items.some(
          (item) => item.kind === 'fact' && item.evidenceRefs.includes('evidence-1'),
        ),
      ).toBe(true);
      if (useCase.includes('comparison')) {
        expect(proposal.items.find((item) => item.field === 'difference')?.kind).toBe('proposal');
      }
    }
  });

  it('warns at 80%, rejects daily and monthly caps, and releases a cancelled reservation', () => {
    const limits = { monthlyUsd: 25, dailyUsd: 2, maxInputTokens: 100, maxOutputTokens: 50 };
    const entries = [
      {
        tenantId: 'a',
        reservedUsd: 0,
        settledUsd: 20,
        status: 'settled' as const,
        countsTowardDay: false,
      },
      { tenantId: 'b', reservedUsd: 0, settledUsd: 24, status: 'settled' as const },
    ];
    const warn = evaluateBudget({
      limits,
      snapshot: snapshotLedger('a', entries),
      reserveUsd: 0.5,
      inputTokens: 1,
      outputTokens: 1,
    });
    expect(warn.ok && warn.warning).toBe(true);
    expect(snapshotLedger('a', entries).monthlySpentUsd).toBe(20);
    expect(snapshotLedger('b', entries).monthlySpentUsd).toBe(24);
    const daily = evaluateBudget({
      limits,
      snapshot: snapshotLedger('a', []),
      reserveUsd: 2.1,
      inputTokens: 1,
      outputTokens: 1,
    });
    expect(daily.ok).toBe(false);
    const held = { tenantId: 'a', reservedUsd: 0.25, settledUsd: 0, status: 'reserved' as const };
    expect(releaseReservation(held).status).toBe('released');
    expect(settleReservation(held).settledUsd).toBe(0.25);
  });
});
