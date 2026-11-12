export {
  OpenAiProviderAdapter,
  createOpenAiAdapterFromEnv,
  selectAiProvider,
  type AiStructuredFailure,
  type AiStructuredSuccess,
  type OpenAiAdapterOptions,
  type ResponsesClient,
} from './openai-adapter';
export { mapProviderError, type AiStructuredErrorCode } from './provider-errors';
export * from './prompts';

export { ChatCompletionsProviderAdapter } from './chat-completions-adapter';
export { brandAnalysisTimeoutMs } from './brand-analysis-timeout';
export {
  createAiAdapterFromEnv,
  configuredAiProvider,
  configuredAiApiKey,
} from './provider-factory';
