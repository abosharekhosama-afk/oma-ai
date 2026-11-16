import { DomainError } from '../errors';

/**
 * Multi-level approval (DEC-026).
 *
 * A level plan is an ordered list of levels. Each level has a name (EN/AR), the
 * number of approvals it needs (`minApprovals`) and an optional list of assigned
 * approvers (empty = anyone with `content.approve`). The plan is frozen on the
 * post when approval is requested, so editing settings never changes a round in
 * flight. Levels are decided strictly in order. In level mode `approverApproved`
 * counts completed levels and `approverRequired` is the number of levels.
 */
export const APPROVAL_LEVELS_MAX = 5;
export const LEVEL_MIN_APPROVALS_MAX = 5;
export const LEVEL_APPROVERS_MAX = 20;
export const LEVEL_NAME_MAX = 60;

export type ApprovalLevelPlan = {
  position: number;
  nameEn: string;
  nameAr: string;
  minApprovals: number;
  approverUserIds: string[];
};

export type ApprovalDecisionKind = 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';

export type LevelDecision = {
  levelPosition: number;
  approverUserId: string;
  decision: ApprovalDecisionKind | string;
  at?: Date;
};

function invalid(message: string, detail?: Record<string, unknown>): DomainError {
  return new DomainError(
    'VALIDATION_FAILED',
    message,
    400,
    'error.approval_levels_invalid',
    detail ? [detail] : [],
  );
}

function levelName(raw: unknown, index: number): { en: string; ar: string } {
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t || t.length > LEVEL_NAME_MAX) throw invalid('Level name is required', { index });
    return { en: t, ar: t };
  }
  if (raw && typeof raw === 'object') {
    const en = String((raw as { en?: unknown }).en ?? '').trim();
    const ar = String((raw as { ar?: unknown }).ar ?? '').trim() || en;
    if (!en || en.length > LEVEL_NAME_MAX || ar.length > LEVEL_NAME_MAX) {
      throw invalid('Level name is required', { index });
    }
    return { en, ar };
  }
  throw invalid('Level name is required', { index });
}

/** Validate a `PUT …/approval-levels` body (`levels: [...]`). Empty list clears the plan. */
export function parseApprovalLevelsInput(raw: unknown): ApprovalLevelPlan[] {
  const list = (raw as { levels?: unknown } | null)?.levels;
  if (!Array.isArray(list)) throw invalid('levels must be an array');
  if (list.length > APPROVAL_LEVELS_MAX) {
    throw invalid(`At most ${APPROVAL_LEVELS_MAX} approval levels`, { max: APPROVAL_LEVELS_MAX });
  }
  return list.map((item, index) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const name = levelName(o.name, index);
    const minRaw = o.min_approvals ?? o.minApprovals ?? 1;
    const min = Number(minRaw);
    if (!Number.isInteger(min) || min < 1 || min > LEVEL_MIN_APPROVALS_MAX) {
      throw invalid('min_approvals must be 1-5', { index });
    }
    const idsRaw = o.approver_user_ids ?? o.approverUserIds ?? [];
    if (!Array.isArray(idsRaw) || idsRaw.some((v) => typeof v !== 'string' || !v.trim())) {
      throw invalid('approver_user_ids must be a list of user ids', { index });
    }
    const ids = [...new Set(idsRaw.map((v: string) => v.trim()))];
    if (ids.length > LEVEL_APPROVERS_MAX) throw invalid('Too many approvers', { index });
    if (ids.length && ids.length < min) {
      throw invalid('A level needs at least as many assigned approvers as min_approvals', {
        index,
      });
    }
    return {
      position: index + 1,
      nameEn: name.en,
      nameAr: name.ar,
      minApprovals: min,
      approverUserIds: ids,
    };
  });
}

/** Read a frozen plan from `ContentItem.approvalLevels`; null/invalid = counter mode. */
export function readLevelPlan(json: unknown): ApprovalLevelPlan[] | null {
  if (!Array.isArray(json) || !json.length) return null;
  const plan: ApprovalLevelPlan[] = [];
  for (const [i, l] of json.entries()) {
    const o = (l ?? {}) as Partial<ApprovalLevelPlan>;
    if (typeof o.nameEn !== 'string') return null;
    plan.push({
      position: i + 1,
      nameEn: o.nameEn,
      nameAr: typeof o.nameAr === 'string' ? o.nameAr : o.nameEn,
      minApprovals: Math.max(1, Number(o.minApprovals) || 1),
      approverUserIds: Array.isArray(o.approverUserIds) ? o.approverUserIds.map(String) : [],
    });
  }
  return plan;
}

export function canDecideAtLevel(level: ApprovalLevelPlan, userId: string): boolean {
  return !level.approverUserIds.length || level.approverUserIds.includes(userId);
}

export type LevelApprovalOutcome = {
  level: ApprovalLevelPlan;
  /** Approvals at this level including this one. */
  approvals: number;
  levelComplete: boolean;
  /** Levels completed after this decision (new `approverApproved`). */
  completedLevels: number;
  final: boolean;
};

/**
 * Check and evaluate one approval in level mode. Throws:
 * - 409 `error.approval_level_not_reached` when `requestedLevel` is not the current
 *   level, or the user is only assigned to a later level (out of order);
 * - 403 `error.approval_not_assigned` when the user is not an approver of this plan;
 * - 409 `error.already_approved` when the user already decided at this level.
 */
export function evaluateLevelApproval(input: {
  plan: ApprovalLevelPlan[];
  completedLevels: number;
  decisions: LevelDecision[];
  actorUserId: string;
  requestedLevel?: number | null;
}): LevelApprovalOutcome {
  const { plan, decisions, actorUserId } = input;
  const completed = Math.max(0, Math.min(plan.length, input.completedLevels));
  const level = plan[completed];
  if (!level) {
    throw new DomainError('CONFLICT_STATE', 'All levels are approved', 409, 'error.conflict_state');
  }
  if (input.requestedLevel != null && input.requestedLevel !== level.position) {
    throw new DomainError(
      'CONFLICT_STATE',
      `Level ${level.position} must be approved first`,
      409,
      'error.approval_level_not_reached',
      [{ current_level: level.position, requested_level: input.requestedLevel }],
    );
  }
  if (!canDecideAtLevel(level, actorUserId)) {
    const later = plan.slice(completed + 1).find((l) => canDecideAtLevel(l, actorUserId));
    if (later) {
      throw new DomainError(
        'CONFLICT_STATE',
        `Level ${level.position} must be approved before level ${later.position}`,
        409,
        'error.approval_level_not_reached',
        [{ current_level: level.position, your_level: later.position }],
      );
    }
    throw new DomainError(
      'APPROVAL_INELIGIBLE',
      'You are not an approver for this level',
      403,
      'error.approval_not_assigned',
      [{ current_level: level.position }],
    );
  }
  const atLevel = decisions.filter(
    (d) => d.levelPosition === level.position && d.decision === 'APPROVED',
  );
  if (atLevel.some((d) => d.approverUserId === actorUserId)) {
    throw new DomainError(
      'CONFLICT_STATE',
      'You already approved this level; another approver is needed',
      409,
      'error.already_approved',
      [{ level: level.position, approved: atLevel.length, required: level.minApprovals }],
    );
  }
  const approvals = atLevel.length + 1;
  const levelComplete = approvals >= level.minApprovals;
  const completedLevels = levelComplete ? completed + 1 : completed;
  return {
    level,
    approvals,
    levelComplete,
    completedLevels,
    final: completedLevels >= plan.length,
  };
}

export type LevelProgress = ApprovalLevelPlan & {
  status: 'done' | 'current' | 'waiting' | 'changes_requested' | 'rejected';
  approvals: number;
  decisions: LevelDecision[];
};

/** Per-level progress for the approval stepper. */
export function levelProgress(input: {
  plan: ApprovalLevelPlan[];
  completedLevels: number;
  approvalState: string;
  decisions: LevelDecision[];
}): LevelProgress[] {
  const { plan, decisions, approvalState } = input;
  const done = approvalState === 'APPROVED' ? plan.length : input.completedLevels;
  const inRound = approvalState === 'PENDING' || approvalState === 'PARTIALLY_APPROVED';
  return plan.map((level, i) => {
    const mine = decisions.filter((d) => d.levelPosition === level.position);
    const blocked = mine.find(
      (d) => d.decision === 'CHANGES_REQUESTED' || d.decision === 'REJECTED',
    );
    const status: LevelProgress['status'] =
      i < done
        ? 'done'
        : blocked && !inRound
          ? blocked.decision === 'REJECTED'
            ? 'rejected'
            : 'changes_requested'
          : i === done && inRound
            ? 'current'
            : 'waiting';
    return {
      ...level,
      status,
      approvals: mine.filter((d) => d.decision === 'APPROVED').length,
      decisions: mine,
    };
  });
}
