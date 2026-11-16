import { z } from 'zod';
import { proposalEnvelope, contractText } from './common';

export const STRATEGY_FOUNDATION_LIMITS = { list: 8, item: 300, long: 1200 } as const;

const list = z
  .array(contractText(STRATEGY_FOUNDATION_LIMITS.item))
  .max(STRATEGY_FOUNDATION_LIMITS.list);
const optionalText = contractText(STRATEGY_FOUNDATION_LIMITS.long).nullable();

/**
 * v2 contract for the legacy strategy AI propose (deprecated in favour of the
 * strategy plan generator). Typed lists replace the free-text items that the
 * accept step used to split with a regex.
 */
export const strategyFoundationSchemaV2 = z.strictObject({
  ...proposalEnvelope,
  rationale: z.string().trim().max(STRATEGY_FOUNDATION_LIMITS.long),
  foundation: z.strictObject({
    goals: list,
    positioning: optionalText,
    keyMessages: list,
    constraints: list,
  }),
  audienceGoals: list,
  kpis: list,
  organic: z
    .strictObject({
      pillars: list,
      channels: list,
      formats: list,
      frequency: contractText(200).nullable(),
    })
    .nullable(),
  paid: z
    .strictObject({
      campaignObjectives: list,
      offerAngle: optionalText,
      placements: list,
    })
    .nullable(),
});

export type StrategyFoundationV2 = z.infer<typeof strategyFoundationSchemaV2>;

/** Enforce the version's enabled tracks: a disabled track must be null. */
export function strategyFoundationTrackIssues(
  value: StrategyFoundationV2,
  tracks: { organic: boolean; paid: boolean },
): string[] {
  const issues: string[] = [];
  if (!tracks.organic && value.organic) issues.push('organic: must be null (track disabled)');
  if (!tracks.paid && value.paid) issues.push('paid: must be null (track disabled)');
  return issues;
}
