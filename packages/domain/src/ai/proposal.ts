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

/** Strict JSON Schema for OpenAI Structured Outputs. All properties required. */
export function proposalJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'promptId',
      'promptVersion',
      'schemaVersion',
      'language',
      'sourceVersion',
      'evidenceRefs',
      'items',
      'banner',
    ],
    properties: {
      promptId: { type: 'string' },
      promptVersion: { type: 'string' },
      schemaVersion: { type: 'string', enum: ['1'] },
      language: { type: 'string', enum: ['en', 'ar'] },
      sourceVersion: { type: 'string' },
      evidenceRefs: { type: 'array', items: { type: 'string' } },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['field', 'value', 'kind', 'confidence', 'evidenceRefs'],
          properties: {
            field: { type: 'string' },
            value: { type: 'string' },
            kind: { type: 'string', enum: ['fact', 'inference', 'proposal'] },
            confidence: { type: 'number' },
            evidenceRefs: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      banner: { type: 'string', enum: [AI_PROPOSAL_BANNER] },
    },
  };
}
