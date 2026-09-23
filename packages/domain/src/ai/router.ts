import { LUNA_USE_CASES, TERRA_USE_CASES, type AiUseCase } from './use-cases';

export type AiModelTier = 'default' | 'reasoning';

export type AiModelConfig = {
  defaultModel: string;
  reasoningModel: string;
};

export const MODEL_STATUS = 'CONFIGURED_NOT_LIVE_VERIFIED' as const;

/** Central router. Model IDs come only from configuration — no silent fallback. */
export function routeModel(
  useCase: AiUseCase,
  config: AiModelConfig,
): {
  tier: AiModelTier;
  model: string;
  status: typeof MODEL_STATUS;
} {
  if (!config.defaultModel || !config.reasoningModel) {
    throw new Error('AI model configuration is incomplete');
  }
  if ((LUNA_USE_CASES as readonly string[]).includes(useCase)) {
    return { tier: 'default', model: config.defaultModel, status: MODEL_STATUS };
  }
  if ((TERRA_USE_CASES as readonly string[]).includes(useCase)) {
    return { tier: 'reasoning', model: config.reasoningModel, status: MODEL_STATUS };
  }
  throw new Error(`Unknown AI use case: ${useCase}`);
}
