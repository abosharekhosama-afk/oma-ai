export const REFERENCE_TAXONOMY = ['Fact', 'Inference', 'Proposal'] as const;
export type ReferenceTaxonomy = (typeof REFERENCE_TAXONOMY)[number];

/**
 * Maps OMA's persisted provenance states to the approved external taxonomy.
 *
 * A stale value intentionally returns null: it must not be presented as a
 * current fact, inference, or proposal without a new review decision.
 */
export function referenceTaxonomyFromInfoState(
  infoState: string | null | undefined,
): ReferenceTaxonomy | null {
  switch (infoState) {
    case 'OBSERVED':
    case 'USER_CONFIRMED':
      return 'Fact';
    case 'AI_INFERRED':
      return 'Inference';
    case 'USER_CORRECTED':
      return 'Proposal';
    case 'STALE':
    case null:
    case undefined:
    default:
      return null;
  }
}
