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
export {
  PROVIDER_CAPABILITIES,
  isSchemaRejection,
  structuredOutputMode,
  type AiProviderName,
  type ProviderCapability,
  type StructuredOutputMode,
} from './capabilities';
export {
  buildRepairMessage,
  extractJsonText,
  repairAttemptsFromEnv,
  runStructuredCore,
  type CoreMessage,
  type CoreReply,
  type CoreTransport,
  type StructuredValidate,
} from './structured-core';
