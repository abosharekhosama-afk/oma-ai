import { describe, expect, it, vi } from 'vitest';
import {
  AI_PROPOSAL_BANNER,
  evaluateBudget,
  resolveAiPublicState,
  routeModel,
  validateProposal,
} from '@oma/domain';
import { OpenAiProviderAdapter } from '@oma/ai';

describe('offline OpenAI text intelligence', () => {
  it('routes routine work to Luna and synthesis to Terra without fallback', () => {
    const config = { defaultModel: 'gpt-5.6-luna', reasoningModel: 'gpt-5.6-terra' };
    expect(routeModel('summary', config).model).toBe('gpt-5.6-luna');
    expect(routeModel('brand_profile_synthesis', config).model).toBe('gpt-5.6-terra');
    expect(routeModel('campaign_brief', config).status).toBe('CONFIGURED_NOT_LIVE_VERIFIED');
  });

  it('rejects a monthly cap and warns at 80%', () => {
    const limits = { monthlyUsd: 25, dailyUsd: 2, maxInputTokens: 1000, maxOutputTokens: 500 };
    const empty = {
      monthlySpentUsd: 0,
      dailySpentUsd: 0,
      monthlyReservedUsd: 0,
      dailyReservedUsd: 0,
    };
    expect(
      evaluateBudget({ limits, snapshot: empty, reserveUsd: 1, inputTokens: 1, outputTokens: 1 })
        .ok,
    ).toBe(true);
    const warn = evaluateBudget({
      limits,
      snapshot: { ...empty, monthlySpentUsd: 20 },
      reserveUsd: 0.5,
      inputTokens: 1,
      outputTokens: 1,
    });
    expect(warn.ok && warn.warning).toBe(true);
    const denied = evaluateBudget({
      limits,
      snapshot: empty,
      reserveUsd: 3,
      inputTokens: 1,
      outputTokens: 1,
    });
    expect(denied.ok).toBe(false);
  });

  it('rejects schema-invalid proposals and keeps the human-review banner', () => {
    expect(validateProposal({}).ok).toBe(false);
    const ok = validateProposal({
      promptId: 'brand.profile',
      promptVersion: '1',
      schemaVersion: '1',
      language: 'ar',
      sourceVersion: 'v1',
      evidenceRefs: ['e1'],
      items: [{ field: 'positioning', value: 'x', kind: 'proposal', evidenceRefs: ['e1'] }],
      banner: AI_PROPOSAL_BANNER,
    });
    expect(ok.ok).toBe(true);
  });

  it('does not call the Responses client while live is disabled', async () => {
    const create = vi.fn();
    const adapter = new OpenAiProviderAdapter({
      liveEnabled: false,
      defaultModel: 'gpt-5.6-luna',
      reasoningModel: 'gpt-5.6-terra',
      client: { responses: { create } },
    });
    const result = await adapter.completeStructured({ useCase: 'summary', payload: {} });
    expect(result).toEqual({ ok: false, code: 'AI_DISABLED' });
    expect(create).not.toHaveBeenCalled();
    await expect(
      adapter.generate({ tenantId: 't', purpose: 'summary', inputSnapshotRefs: [], prompt: 'x' }),
    ).rejects.toThrow(/not configured/i);
    expect(create).not.toHaveBeenCalled();
  });

  it('reports billing required while live stays off', () => {
    expect(resolveAiPublicState({ providerConfigured: true, liveEnabled: false })).toBe(
      'billing_required',
    );
    expect(resolveAiPublicState({ providerConfigured: false, liveEnabled: false })).toBe(
      'not_connected',
    );
  });
});
