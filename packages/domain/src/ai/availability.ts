import { testAdapterAllowed } from './test-adapter';

export type AiServiceAvailability = 'AVAILABLE' | 'NOT_CONFIGURED' | 'BUDGET_EXHAUSTED';

export type AiRuntimeEnv = {
  NODE_ENV?: string;
  AI_LIVE_ENABLED?: string;
  AI_TEST_ADAPTER?: string;
  OPENAI_API_KEY?: string;
};

/** Live path requires an explicit flag and a configured API key. */
export function isAiLiveEnabled(env: AiRuntimeEnv = process.env): boolean {
  return env.AI_LIVE_ENABLED === 'true' && Boolean(env.OPENAI_API_KEY?.trim());
}

export function isAiProviderConfigured(env: AiRuntimeEnv = process.env): boolean {
  return Boolean(env.OPENAI_API_KEY?.trim());
}

/** Worker/API may run analysis with the live adapter or the non-prod test adapter. */
export function isAiAnalysisAvailable(env: AiRuntimeEnv = process.env): boolean {
  return isAiLiveEnabled(env) || testAdapterAllowed(env);
}

export function resolveAiAvailability(input: {
  liveEnabled: boolean;
  providerConfigured: boolean;
  budgetExhausted?: boolean;
  testAdapter?: boolean;
}): AiServiceAvailability {
  if (input.budgetExhausted && (input.liveEnabled || input.testAdapter)) {
    return 'BUDGET_EXHAUSTED';
  }
  if (input.liveEnabled || input.testAdapter) return 'AVAILABLE';
  return 'NOT_CONFIGURED';
}

export function defaultAiModels(
  env: {
    AI_DEFAULT_MODEL?: string;
    AI_REASONING_MODEL?: string;
  } = process.env,
) {
  const defaultModel = env.AI_DEFAULT_MODEL?.trim() || 'gpt-4.1-mini';
  const reasoningModel = env.AI_REASONING_MODEL?.trim() || 'gpt-4.1';
  if (!defaultModel || !reasoningModel) {
    throw new Error('AI model configuration is incomplete');
  }
  return { defaultModel, reasoningModel };
}
