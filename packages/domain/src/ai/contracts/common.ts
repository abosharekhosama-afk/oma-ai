import { z } from 'zod';
import { AI_PROPOSAL_BANNER } from '../proposal';

/** Schema version of every Phase 3 (v2) contract. v1 outputs are legacy, display only. */
export const AI_CONTRACT_SCHEMA_VERSION = '2' as const;

export const contractLanguage = z.enum(['en', 'ar']);

/** Bounded, non-empty, trimmed string. */
export const contractText = (max: number) => z.string().trim().min(1).max(max);

/** Envelope shared by every v2 proposal: provenance and the human-review banner. */
export const proposalEnvelope = {
  promptId: contractText(120),
  promptVersion: contractText(40),
  schemaVersion: z.literal(AI_CONTRACT_SCHEMA_VERSION),
  language: contractLanguage,
  sourceVersion: contractText(200),
  banner: z.literal(AI_PROPOSAL_BANNER),
};
