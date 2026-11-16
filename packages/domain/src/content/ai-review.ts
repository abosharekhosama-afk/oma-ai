import { DomainError } from '../errors';

/**
 * AI provenance and the human-review gate (DEC-024, building on DEC-020).
 *
 * Any post whose copy came from an AI run is "AI-assisted" for its whole life.
 * It cannot be scheduled or published until a person has reviewed it, even
 * under approval policy NONE. A review is either an explicit
 * `POST /content/:id/ai-review` or the final approval of an approval round.
 * Applying new AI output clears the review; human edits do not.
 */

export const AI_RUN_IDS_LIMIT = 20;

export type AiProvenance = {
  aiAssisted: boolean;
  aiRunIds: string[];
  aiReviewedAt: Date | null;
  aiReviewedBy: string | null;
};

export function aiReviewRequired(row: { aiAssisted: boolean; aiReviewedAt: Date | null }): boolean {
  return row.aiAssisted && row.aiReviewedAt === null;
}

/** Parse `ai_run_ids` from a create/update body. `undefined` means "no AI output applied". */
export function parseAiRunIds(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string' || !v.trim())) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'ai_run_ids must be an array of AI run ids',
      400,
      'errors.validation_failed',
      [{ field: 'ai_run_ids' }],
    );
  }
  const ids = [...new Set((raw as string[]).map((v) => v.trim()))];
  if (ids.length > AI_RUN_IDS_LIMIT) {
    throw new DomainError(
      'VALIDATION_FAILED',
      `ai_run_ids accepts at most ${AI_RUN_IDS_LIMIT} ids`,
      400,
      'errors.validation_failed',
      [{ field: 'ai_run_ids' }],
    );
  }
  return ids.length ? ids : undefined;
}

/**
 * Provenance after applying AI output. Run ids accumulate (latest last, capped)
 * and the review is cleared so a human has to look again.
 */
export function applyAiOutput(
  current: Pick<AiProvenance, 'aiRunIds'>,
  runIds: string[],
): Pick<AiProvenance, 'aiAssisted' | 'aiRunIds' | 'aiReviewedAt' | 'aiReviewedBy'> {
  const merged = [...current.aiRunIds.filter((id) => !runIds.includes(id)), ...runIds];
  return {
    aiAssisted: true,
    aiRunIds: merged.slice(-AI_RUN_IDS_LIMIT),
    aiReviewedAt: null,
    aiReviewedBy: null,
  };
}

/** Copies (duplicate, copy-to, detach) stay AI-assisted but need their own review. */
export function aiProvenanceForCopy(
  source: Pick<AiProvenance, 'aiAssisted' | 'aiRunIds'>,
): Pick<AiProvenance, 'aiAssisted' | 'aiRunIds' | 'aiReviewedAt' | 'aiReviewedBy'> {
  return {
    aiAssisted: source.aiAssisted,
    aiRunIds: [...source.aiRunIds],
    aiReviewedAt: null,
    aiReviewedBy: null,
  };
}
