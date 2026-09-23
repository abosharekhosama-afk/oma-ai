import { z } from 'zod';

export const AI_PROPOSAL_BANNER = 'AI GENERATED PROPOSAL — REQUIRES HUMAN REVIEW';

export const proposalSchema = z.object({
  promptId: z.string().min(1),
  promptVersion: z.string().min(1),
  schemaVersion: z.literal('1'),
  language: z.enum(['en', 'ar']),
  sourceVersion: z.string().min(1),
  evidenceRefs: z.array(z.string()),
  items: z.array(
    z.object({
      field: z.string().min(1),
      value: z.string(),
      kind: z.enum(['fact', 'inference', 'proposal']),
      confidence: z.number().min(0).max(1).optional(),
      evidenceRefs: z.array(z.string()).default([]),
    }),
  ),
  banner: z.literal(AI_PROPOSAL_BANNER),
});

export type AiProposal = z.infer<typeof proposalSchema>;

export function validateProposal(
  input: unknown,
): { ok: true; proposal: AiProposal } | { ok: false; code: 'SCHEMA_INVALID' } {
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'SCHEMA_INVALID' };
  return { ok: true, proposal: parsed.data };
}
