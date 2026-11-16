import type { AiUseCase } from './use-cases';

/**
 * Use cases accepted by the generic `POST /ai/runs` endpoint.
 * Each one has a defined output contract (the brand-analysis proposal schema)
 * and a prompt that actually supports it. Every other use case has its own
 * dedicated, typed endpoint (content generation, inbox reply, strategy plan).
 */
export const GENERIC_AI_RUN_USE_CASES = [
  'brand_profile_synthesis',
  'evidence_summary',
  'contradiction_analysis',
] as const satisfies readonly AiUseCase[];
export type GenericAiRunUseCase = (typeof GENERIC_AI_RUN_USE_CASES)[number];

/** Source entities the generic endpoint can target. `source_entity_id` is a brand id. */
export const GENERIC_AI_RUN_SOURCE_TYPES = ['brand_profile'] as const;
export type GenericAiRunSourceType = (typeof GENERIC_AI_RUN_SOURCE_TYPES)[number];

/** Upper bound on evidence refs per run, to keep prompts bounded. */
export const GENERIC_AI_RUN_MAX_EVIDENCE_REFS = 50;

export function isGenericAiRunUseCase(value: unknown): value is GenericAiRunUseCase {
  return (
    typeof value === 'string' && (GENERIC_AI_RUN_USE_CASES as readonly string[]).includes(value)
  );
}

export function isGenericAiRunSourceType(value: unknown): value is GenericAiRunSourceType {
  return (
    typeof value === 'string' && (GENERIC_AI_RUN_SOURCE_TYPES as readonly string[]).includes(value)
  );
}

/** Human review decision persisted on an AI run's metadata. */
export type AiRunReview =
  | { decision: 'accepted'; by: string; at: string; draftId: string | null }
  | { decision: 'rejected'; by: string; at: string; reason: string | null };

export function readAiRunReview(metadataJson: string | null | undefined): AiRunReview | null {
  if (!metadataJson) return null;
  try {
    const parsed = JSON.parse(metadataJson) as { review?: AiRunReview };
    const review = parsed?.review;
    if (review && (review.decision === 'accepted' || review.decision === 'rejected')) {
      return review;
    }
  } catch {
    return null;
  }
  return null;
}

export function writeAiRunReview(
  metadataJson: string | null | undefined,
  review: AiRunReview,
): string {
  let base: Record<string, unknown> = {};
  if (metadataJson) {
    try {
      const parsed = JSON.parse(metadataJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) base = parsed;
    } catch {
      base = {};
    }
  }
  return JSON.stringify({ ...base, review });
}

/** Validate, dedupe and bound evidence refs; returns null when invalid or over the limit. */
export function normalizeEvidenceRefs(refs: unknown): string[] | null {
  if (refs === undefined || refs === null) return [];
  if (!Array.isArray(refs)) return null;
  if (!refs.every((r) => typeof r === 'string' && r.trim().length > 0)) return null;
  const clean = [...new Set((refs as string[]).map((r) => r.trim()))];
  if (clean.length > GENERIC_AI_RUN_MAX_EVIDENCE_REFS) return null;
  return clean;
}
