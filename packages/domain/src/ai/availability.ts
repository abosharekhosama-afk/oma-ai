import { testAdapterAllowed } from './test-adapter';

export type AiServiceAvailability = 'AVAILABLE' | 'NOT_CONFIGURED' | 'BUDGET_EXHAUSTED';

export type AiRuntimeEnv = {
  NODE_ENV?: string;
  AI_LIVE_ENABLED?: string;
  AI_TEST_ADAPTER?: string;
  OPENAI_API_KEY?: string;
  XAI_API_KEY?: string;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  AI_PROVIDER?: string;
};

/** Live path requires an explicit flag and the key for the selected provider. */
export function isAiLiveEnabled(env: AiRuntimeEnv = process.env): boolean {
  return env.AI_LIVE_ENABLED === 'true' && isAiProviderConfigured(env);
}

export function isAiProviderConfigured(env: AiRuntimeEnv = process.env): boolean {
  const provider = env.AI_PROVIDER?.trim().toLowerCase() || 'openai';
  if (provider === 'grok') return Boolean(env.XAI_API_KEY?.trim());
  if (provider === 'groq') return Boolean(env.GROQ_API_KEY?.trim());
  if (provider === 'gemini') return Boolean(env.GEMINI_API_KEY?.trim());
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
    AI_PROVIDER?: string;
  } = process.env,
) {
  const provider = env.AI_PROVIDER?.trim().toLowerCase() || 'openai';
  const defaults =
    provider === 'grok'
      ? { defaultModel: 'grok-4.7', reasoningModel: 'grok-4.7' }
      : provider === 'groq'
        ? { defaultModel: 'openai/gpt-oss-20b', reasoningModel: 'openai/gpt-oss-120b' }
        : provider === 'gemini'
          ? { defaultModel: 'gemini-3.8-flash', reasoningModel: 'gemini-3.8-flash' }
          : { defaultModel: 'gpt-4.1-mini', reasoningModel: 'gpt-4.1' };
  const defaultModel = env.AI_DEFAULT_MODEL?.trim() || defaults.defaultModel;
  const reasoningModel = env.AI_REASONING_MODEL?.trim() || defaults.reasoningModel;
  if (!defaultModel || !reasoningModel) {
    throw new Error('AI model configuration is incomplete');
  }
  return { defaultModel, reasoningModel };
}
