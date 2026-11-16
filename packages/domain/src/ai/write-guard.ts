import { DomainError } from '../errors';

/**
 * Draft-only invariant (DEC-027, PR 3.6). AI output may only land in:
 * - the AiRun row itself (proposalJson),
 * - a DRAFT / NEEDS_REVIEW profile version (sections are proposals until a human approves),
 * - PENDING insight claims,
 * - a draft strategy version, and only through a human accept.
 * It never writes an APPROVED, SUPERSEDED, PUBLISHED or SCHEDULED row.
 */
export type AiWriteTarget =
  | { kind: 'ai_run' }
  | { kind: 'profile_version'; status: string }
  | { kind: 'insight_claim'; reviewStatus: string }
  | { kind: 'strategy_version'; status: string; humanActorId?: string | null }
  | { kind: 'content_item'; status: string };

export const AI_FORBIDDEN_STATUSES = [
  'APPROVED',
  'SUPERSEDED',
  'PUBLISHED',
  'SCHEDULED',
  'PUBLISHED_SAMPLE',
] as const;

const PROFILE_WRITABLE = new Set(['DRAFT', 'NEEDS_REVIEW']);
/** Same rule as canPatchVersionContent: only DRAFT strategy versions change. */
const STRATEGY_WRITABLE = new Set(['DRAFT']);
const CONTENT_WRITABLE = new Set(['DRAFT']);

export function aiWriteViolation(target: AiWriteTarget): string | null {
  switch (target.kind) {
    case 'ai_run':
      return null;
    case 'profile_version':
      return PROFILE_WRITABLE.has(target.status)
        ? null
        : `AI cannot write a ${target.status} profile version`;
    case 'insight_claim':
      return target.reviewStatus === 'PENDING'
        ? null
        : `AI claims must be PENDING, not ${target.reviewStatus}`;
    case 'strategy_version':
      if (!STRATEGY_WRITABLE.has(target.status)) {
        return `AI cannot write a ${target.status} strategy version`;
      }
      return target.humanActorId ? null : 'AI proposals reach a strategy only via a human accept';
    case 'content_item':
      return CONTENT_WRITABLE.has(target.status)
        ? null
        : `AI cannot write content in status ${target.status}`;
  }
}

/** Throws 409 AI_WRITE_FORBIDDEN when AI output would reach a non-draft target. */
export function assertAiWriteTarget(target: AiWriteTarget): void {
  const violation = aiWriteViolation(target);
  if (!violation) return;
  throw new DomainError('CONFLICT_STATE', violation, 409, 'errors.conflict_state', [
    { code: 'AI_WRITE_FORBIDDEN', target: target.kind },
  ]);
}

/** Throws 403 when an AI decision has no human actor. */
export function assertHumanActor(actorUserId: string | null | undefined): asserts actorUserId {
  if (actorUserId && actorUserId !== 'unknown') return;
  throw new DomainError(
    'PERMISSION_DENIED',
    'Accepting or rejecting an AI proposal requires a signed-in person.',
    403,
    'errors.permission_denied',
    [{ code: 'HUMAN_ACTOR_REQUIRED' }],
  );
}
