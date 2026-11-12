import { defaultAiModels } from '@oma/domain';
import { OpenAiProviderAdapter } from './openai-adapter';
import { ChatCompletionsProviderAdapter } from './chat-completions-adapter';

export type StructuredAiProvider = OpenAiProviderAdapter | ChatCompletionsProviderAdapter;

export function configuredAiProvider(
  env: NodeJS.ProcessEnv = process.env,
): 'openai' | 'grok' | 'groq' | 'gemini' {
  const value = env.AI_PROVIDER?.trim().toLowerCase() || 'openai';
  return value === 'grok' || value === 'groq' || value === 'gemini' ? value : 'openai';
}

export function configuredAiApiKey(env: NodeJS.ProcessEnv = process.env): string {
  switch (configuredAiProvider(env)) {
    case 'grok':
      return env.XAI_API_KEY?.trim() || '';
    case 'groq':
      return env.GROQ_API_KEY?.trim() || '';
    case 'gemini':
      return env.GEMINI_API_KEY?.trim() || '';
    default:
      return env.OPENAI_API_KEY?.trim() || '';
  }
}

export function createAiAdapterFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  overrides?: { timeoutMs?: number; maxRetries?: number },
): StructuredAiProvider {
  const provider = configuredAiProvider(env);
  const models = defaultAiModels(env);
  const liveEnabled = env.AI_LIVE_ENABLED === 'true' && Boolean(configuredAiApiKey(env));
  const timeoutMs =
    overrides?.timeoutMs ??
    (env.AI_REQUEST_TIMEOUT_MS ? Number(env.AI_REQUEST_TIMEOUT_MS) : 60_000);
  const maxRetries = overrides?.maxRetries ?? (env.AI_MAX_RETRIES ? Number(env.AI_MAX_RETRIES) : 2);

  if (provider === 'openai') {
    return new OpenAiProviderAdapter({
      defaultModel: models.defaultModel,
      reasoningModel: models.reasoningModel,
      liveEnabled,
      apiKey: env.OPENAI_API_KEY,
      projectId: env.OPENAI_PROJECT_ID,
      baseUrl: env.OPENAI_BASE_URL,
      timeoutMs,
      maxRetries,
    });
  }

  return new ChatCompletionsProviderAdapter({
    provider,
    defaultModel: models.defaultModel,
    reasoningModel: models.reasoningModel,
    liveEnabled,
    apiKey: configuredAiApiKey(env),
    baseUrl:
      provider === 'grok'
        ? 'https://api.x.ai/v1'
        : provider === 'groq'
          ? env.GROQ_BASE_URL?.trim() || 'https://api.groq.com/openai/v1'
          : 'https://generativelanguage.googleapis.com/v1beta/openai/',
    timeoutMs,
    maxRetries,
  });
}
