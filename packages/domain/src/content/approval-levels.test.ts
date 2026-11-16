import { describe, expect, it } from 'vitest';
import {
  evaluateLevelApproval,
  levelProgress,
  parseApprovalLevelsInput,
  readLevelPlan,
  type ApprovalLevelPlan,
} from './approval-levels';

const plan: ApprovalLevelPlan[] = [
  { position: 1, nameEn: 'Editor', nameAr: 'المحرر', minApprovals: 1, approverUserIds: ['ed'] },
  { position: 2, nameEn: 'Legal', nameAr: 'القانوني', minApprovals: 2, approverUserIds: [] },
  { position: 3, nameEn: 'Client', nameAr: 'العميل', minApprovals: 1, approverUserIds: ['cl'] },
];

describe('approval levels (DEC-026)', () => {
  it('parses and validates level input', () => {
    const parsed = parseApprovalLevelsInput({
      levels: [
        { name: { en: 'Editor', ar: 'المحرر' }, approver_user_ids: ['u1', 'u1'] },
        { name: 'Client', min_approvals: 2 },
      ],
    });
    expect(parsed).toEqual([
      { position: 1, nameEn: 'Editor', nameAr: 'المحرر', minApprovals: 1, approverUserIds: ['u1'] },
      { position: 2, nameEn: 'Client', nameAr: 'Client', minApprovals: 2, approverUserIds: [] },
    ]);
    expect(parseApprovalLevelsInput({ levels: [] })).toEqual([]);
    expect(() => parseApprovalLevelsInput({})).toThrow();
    expect(() => parseApprovalLevelsInput({ levels: Array(6).fill({ name: 'x' }) })).toThrow();
    expect(() => parseApprovalLevelsInput({ levels: [{ name: ' ' }] })).toThrow();
    expect(() => parseApprovalLevelsInput({ levels: [{ name: 'x', min_approvals: 0 }] })).toThrow();
    expect(() =>
      parseApprovalLevelsInput({
        levels: [{ name: 'x', min_approvals: 2, approver_user_ids: ['a'] }],
      }),
    ).toThrow(/at least as many/);
  });

  it('reads frozen plans and treats empty/invalid as counter mode', () => {
    expect(readLevelPlan(null)).toBeNull();
    expect(readLevelPlan([])).toBeNull();
    expect(readLevelPlan([{ bad: true }])).toBeNull();
    expect(readLevelPlan(plan)).toEqual(plan);
  });

  it('decides levels strictly in order with per-level quorum', () => {
    const first = evaluateLevelApproval({
      plan,
      completedLevels: 0,
      decisions: [],
      actorUserId: 'ed',
    });
    expect(first).toMatchObject({ levelComplete: true, completedLevels: 1, final: false });

    const l2a = evaluateLevelApproval({
      plan,
      completedLevels: 1,
      decisions: [],
      actorUserId: 'x',
    });
    expect(l2a).toMatchObject({ levelComplete: false, completedLevels: 1, approvals: 1 });
    const l2b = evaluateLevelApproval({
      plan,
      completedLevels: 1,
      decisions: [{ levelPosition: 2, approverUserId: 'x', decision: 'APPROVED' }],
      actorUserId: 'y',
    });
    expect(l2b).toMatchObject({ levelComplete: true, completedLevels: 2, final: false });
    const last = evaluateLevelApproval({
      plan,
      completedLevels: 2,
      decisions: [],
      actorUserId: 'cl',
    });
    expect(last.final).toBe(true);
  });

  it('rejects out-of-order, unassigned and duplicate approvals', () => {
    expect(() =>
      evaluateLevelApproval({ plan, completedLevels: 0, decisions: [], actorUserId: 'cl' }),
    ).toThrowError(expect.objectContaining({ messageKey: 'error.approval_level_not_reached' }));
    expect(() =>
      evaluateLevelApproval({
        plan: [plan[0]!, plan[2]!],
        completedLevels: 0,
        decisions: [],
        actorUserId: 'stranger',
      }),
    ).toThrowError(
      expect.objectContaining({ status: 403, messageKey: 'error.approval_not_assigned' }),
    );
    expect(() =>
      evaluateLevelApproval({
        plan,
        completedLevels: 1,
        decisions: [],
        actorUserId: 'ed',
        requestedLevel: 1,
      }),
    ).toThrowError(expect.objectContaining({ messageKey: 'error.approval_level_not_reached' }));
    expect(() =>
      evaluateLevelApproval({
        plan,
        completedLevels: 1,
        decisions: [{ levelPosition: 2, approverUserId: 'x', decision: 'APPROVED' }],
        actorUserId: 'x',
      }),
    ).toThrowError(expect.objectContaining({ messageKey: 'error.already_approved' }));
  });

  it('builds stepper progress', () => {
    const p = levelProgress({
      plan,
      completedLevels: 1,
      approvalState: 'PARTIALLY_APPROVED',
      decisions: [
        { levelPosition: 1, approverUserId: 'ed', decision: 'APPROVED' },
        { levelPosition: 2, approverUserId: 'x', decision: 'APPROVED' },
      ],
    });
    expect(p.map((l) => [l.status, l.approvals])).toEqual([
      ['done', 1],
      ['current', 1],
      ['waiting', 0],
    ]);
    const changes = levelProgress({
      plan,
      completedLevels: 0,
      approvalState: 'CHANGES_REQUESTED',
      decisions: [{ levelPosition: 1, approverUserId: 'ed', decision: 'CHANGES_REQUESTED' }],
    });
    expect(changes[0]!.status).toBe('changes_requested');
    expect(
      levelProgress({ plan, completedLevels: 0, approvalState: 'APPROVED', decisions: [] }).every(
        (l) => l.status === 'done',
      ),
    ).toBe(true);
  });
});
