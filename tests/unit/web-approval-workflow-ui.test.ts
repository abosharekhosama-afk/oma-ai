import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveContentWorkflow } from '@oma/demo';

const read = (p: string) => readFileSync(p, 'utf8');
const en = JSON.parse(read('packages/i18n/messages/en.json')) as Record<string, string>;
const ar = JSON.parse(read('packages/i18n/messages/ar.json')) as Record<string, string>;

describe('Phase 2 web approval workflow UI', () => {
  it('shows CANNOT_SCHEDULE for a scheduled post whose checklist is blocked', () => {
    const base = { status: 'SCHEDULED', scheduledAt: '2026-12-01T10:00:00Z' } as const;
    expect(
      resolveContentWorkflow({ ...base, scheduleState: 'SCHEDULED', scheduleReady: false })
        .publishDisplay,
    ).toBe('CANNOT_SCHEDULE');
    expect(
      resolveContentWorkflow({ ...base, scheduleState: 'SCHEDULED', scheduleReady: true })
        .publishDisplay,
    ).toBe('SCHEDULED_LOCAL');
  });

  it('wires the panel, editor and API helpers', () => {
    const client = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    expect(client).toContain('<ApprovalWorkflowPanel');
    const panel = read('apps/web/src/components/content/approval-workflow-panel.tsx');
    for (const fn of ['reopenContent', 'confirmAiReview', 'getApprovalProgress']) {
      expect(panel).toContain(fn);
    }
    expect(read('apps/web/src/components/shell/workspace-approvals.tsx')).toContain(
      '<ApprovalLevelsEditor',
    );
    const api = read('apps/web/src/lib/content-api.ts');
    expect(api).toContain('/reopen');
    expect(api).toContain('/workspace/approval-levels');
    expect(api).toContain('APPROVAL_RESET_EVENT');
  });

  it('has EN and AR copy for every new key', () => {
    const keys = Object.keys(en).filter(
      (k) => k.startsWith('approvalFlow.') || k.startsWith('approvalLevels.'),
    );
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) {
      expect(ar[k], k).toBeTruthy();
      expect(ar[k]).not.toBe(en[k]);
    }
  });
});
