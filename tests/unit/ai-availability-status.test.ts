import { describe, expect, it } from 'vitest';
import {
  defaultAiModels,
  estimateReserveUsd,
  evaluateBudget,
  isAiAnalysisAvailable,
  isAiLiveEnabled,
  resolveAiAvailability,
  resolveAiPublicState,
  computeCostUsd,
} from '@oma/domain';

describe('AI availability and cost', () => {
  it('enables live only when the flag and key are both set', () => {
    expect(isAiLiveEnabled({ AI_LIVE_ENABLED: 'true' })).toBe(false);
    expect(isAiLiveEnabled({ AI_LIVE_ENABLED: 'true', OPENAI_API_KEY: 'sk-test' })).toBe(true);
    expect(
      isAiLiveEnabled({ AI_PROVIDER: 'grok', AI_LIVE_ENABLED: 'true', XAI_API_KEY: 'xai-test' }),
    ).toBe(true);
    expect(
      isAiLiveEnabled({
        AI_PROVIDER: 'gemini',
        AI_LIVE_ENABLED: 'true',
        GEMINI_API_KEY: 'google-test',
      }),
    ).toBe(true);
    expect(
      isAiLiveEnabled({ AI_PROVIDER: 'grok', AI_LIVE_ENABLED: 'true', OPENAI_API_KEY: 'sk-test' }),
    ).toBe(false);
    expect(
      isAiAnalysisAvailable({
        NODE_ENV: 'production',
        AI_TEST_ADAPTER: '1',
        AI_LIVE_ENABLED: 'false',
      }),
    ).toBe(false);
    expect(resolveAiAvailability({ liveEnabled: true, providerConfigured: true })).toBe(
      'AVAILABLE',
    );
    expect(resolveAiAvailability({ liveEnabled: false, providerConfigured: true })).toBe(
      'NOT_CONFIGURED',
    );
    expect(
      resolveAiAvailability({
        liveEnabled: true,
        providerConfigured: true,
        budgetExhausted: true,
      }),
    ).toBe('BUDGET_EXHAUSTED');
  });

  it('reports billing_required when a key exists but live stays off', () => {
    expect(resolveAiPublicState({ providerConfigured: true, liveEnabled: false })).toBe(
      'billing_required',
    );
    expect(resolveAiPublicState({ providerConfigured: true, liveEnabled: true })).toBe('ready');
  });

  it('computes reserve cost and still enforces budgets before a call', () => {
    expect(defaultAiModels({}).defaultModel).toBe('gpt-4.1-mini');
    expect(defaultAiModels({ AI_PROVIDER: 'grok' })).toEqual({
      defaultModel: 'grok-4.7',
      reasoningModel: 'grok-4.7',
    });
    expect(defaultAiModels({ AI_PROVIDER: 'gemini' })).toEqual({
      defaultModel: 'gemini-3.8-flash',
      reasoningModel: 'gemini-3.8-flash',
    });
    expect(computeCostUsd('gpt-4.1-mini', 1_000_000, 1_000_000)).toBeCloseTo(2.0);
    const reserve = estimateReserveUsd({
      model: 'gpt-4.1',
      estimatedInputTokens: 1000,
      maxOutputTokens: 500,
    });
    expect(reserve).toBeGreaterThan(0);
    const denied = evaluateBudget({
      limits: { monthlyUsd: 25, dailyUsd: 2, maxInputTokens: 100, maxOutputTokens: 50 },
      snapshot: {
        monthlySpentUsd: 0,
        dailySpentUsd: 0,
        monthlyReservedUsd: 0,
        dailyReservedUsd: 0,
      },
      reserveUsd: 3,
      inputTokens: 10,
      outputTokens: 10,
    });
    expect(denied.ok).toBe(false);
  });
});
