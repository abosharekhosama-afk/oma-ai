import type { z } from 'zod';
import {
  aiStrategyPlanProposalSchema,
  STRATEGY_PLAN_SCHEMA_VERSION,
} from '../../strategy/plan-proposal';
import { AI_USE_CASES, type AiUseCase } from '../use-cases';
import { brandAnalysisSchemaV2 } from './brand-analysis';
import { AI_CONTRACT_SCHEMA_VERSION } from './common';
import { CONTENT_DEFAULT_OPTIONS, contentGenerationSchemaV2 } from './content';
import { describeZodIssues, toProviderJsonSchema } from './json-schema';
import { strategyFoundationSchemaV2 } from './strategy-foundation';

export type AiContractId =
  | 'content.variants'
  | 'content.alt_text'
  | 'content.hashtags'
  | 'inbox.reply'
  | 'brand.analysis'
  | 'strategy.foundation'
  | 'strategy.plan';

export type AiOutputContract = {
  id: AiContractId;
  schemaVersion: string;
  /** Use cases this contract serves. */
  useCases: readonly AiUseCase[];
  /** Static schema (widest bounds). Context-specific builders narrow it per call. */
  schema: z.ZodType;
  /** Provider JSON Schema, always derived from `schema`. */
  jsonSchema(): Record<string, unknown>;
};

function contract(entry: Omit<AiOutputContract, 'jsonSchema'>): AiOutputContract {
  return { ...entry, jsonSchema: () => toProviderJsonSchema(entry.schema) };
}

export const AI_OUTPUT_CONTRACTS: Readonly<Record<AiContractId, AiOutputContract>> = {
  'content.variants': contract({
    id: 'content.variants',
    schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
    useCases: ['caption_generation', 'caption_rewrite', 'content_ideas'],
    schema: contentGenerationSchemaV2('caption', CONTENT_DEFAULT_OPTIONS),
  }),
  'content.alt_text': contract({
    id: 'content.alt_text',
    schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
    useCases: ['alt_text'],
    schema: contentGenerationSchemaV2('alt', CONTENT_DEFAULT_OPTIONS),
  }),
  'content.hashtags': contract({
    id: 'content.hashtags',
    schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
    useCases: ['hashtag_suggestion'],
    schema: contentGenerationSchemaV2('hashtags', CONTENT_DEFAULT_OPTIONS),
  }),
  'inbox.reply': contract({
    id: 'inbox.reply',
    schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
    useCases: ['inbox_reply'],
    schema: contentGenerationSchemaV2('inbox_reply', CONTENT_DEFAULT_OPTIONS),
  }),
  'brand.analysis': contract({
    id: 'brand.analysis',
    schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
    useCases: ['brand_profile_synthesis', 'evidence_summary', 'contradiction_analysis'],
    schema: brandAnalysisSchemaV2,
  }),
  'strategy.foundation': contract({
    id: 'strategy.foundation',
    schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
    useCases: ['strategy_foundation', 'organic_strategy', 'paid_planning'],
    schema: strategyFoundationSchemaV2,
  }),
  'strategy.plan': contract({
    id: 'strategy.plan',
    schemaVersion: STRATEGY_PLAN_SCHEMA_VERSION,
    useCases: ['strategy_foundation', 'organic_strategy', 'paid_planning'],
    schema: aiStrategyPlanProposalSchema,
  }),
};

/**
 * Use cases with no implementation and no contract yet. Any endpoint asked for
 * one of these must refuse instead of falling back to a generic schema.
 */
export const AI_UNSUPPORTED_USE_CASES = [
  'classification',
  'extraction_normalization',
  'summary',
  'translation',
  'rewrite',
  'missing_fields',
  'routine_suggestion',
  'profile_comparison',
  'strategy_comparison',
  'campaign_brief',
  'content_brief',
  'audience_goals_kpis',
] as const satisfies readonly AiUseCase[];

export function getAiContract(id: AiContractId): AiOutputContract {
  return AI_OUTPUT_CONTRACTS[id];
}

export function aiContractsForUseCase(useCase: AiUseCase): AiOutputContract[] {
  return Object.values(AI_OUTPUT_CONTRACTS).filter((c) => c.useCases.includes(useCase));
}

export function isAiUseCaseSupported(useCase: AiUseCase): boolean {
  return aiContractsForUseCase(useCase).length > 0;
}

/** Every use case is either served by a contract or explicitly unsupported. */
export function uncoveredAiUseCases(): AiUseCase[] {
  const unsupported = new Set<string>(AI_UNSUPPORTED_USE_CASES);
  return AI_USE_CASES.filter((u) => !unsupported.has(u) && !isAiUseCaseSupported(u));
}

export type ContractParseResult<T> =
  { ok: true; value: T } | { ok: false; code: 'SCHEMA_INVALID'; issues: string[] };

/** Validate raw model output against a contract schema (or a narrowed variant of it). */
export function parseAiOutput<T>(schema: z.ZodType<T>, raw: unknown): ContractParseResult<T> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, code: 'SCHEMA_INVALID', issues: describeZodIssues(parsed.error) };
}
