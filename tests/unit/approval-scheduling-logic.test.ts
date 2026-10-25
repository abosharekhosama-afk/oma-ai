import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  serializeSettings,
  validateSettingsPatch,
} from '../../apps/api/src/workspace/workspace-settings.controller';
import { workspaceModeToPolicy } from '../../apps/api/src/content/content.service';

const root = join(__dirname, '../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('workspace approval policy (server-side)', () => {
  it('maps workspace modes to content policies', () => {
    expect(workspaceModeToPolicy('none')).toBe('NONE');
    expect(workspaceModeToPolicy('optional')).toBe('OPTIONAL');
    expect(workspaceModeToPolicy('required')).toBe('REQUIRED');
    expect(workspaceModeToPolicy('multi_level')).toBe('REQUIRED');
    expect(workspaceModeToPolicy(undefined)).toBe('OPTIONAL');
  });

  it('validates the settings patch', () => {
    expect(validateSettingsPatch({ approval_mode: 'REQUIRED', required_approvers: 2 })).toEqual({
      approvalMode: 'required',
      requiredApprovers: 2,
    });
    expect(validateSettingsPatch({ timezone: 'Asia/Jerusalem' })).toEqual({
      timezone: 'Asia/Jerusalem',
    });
    expect(() => validateSettingsPatch({ approval_mode: 'multi_level' })).toThrow(/approval_mode/);
    expect(() => validateSettingsPatch({ required_approvers: 0 })).toThrow(/required_approvers/);
    expect(() => validateSettingsPatch({ timezone: 'Mars/Base' })).toThrow(/timezone/);
    expect(() => validateSettingsPatch({ website_url: 'ftp://x' })).toThrow(/website_url/);
  });

  it('serializes defaults and legacy multi_level', () => {
    expect(serializeSettings('t1', null)).toMatchObject({
      timezone: 'Asia/Jerusalem',
      approval_mode: 'optional',
      required_approvers: 1,
    });
    const legacy = serializeSettings('t1', {
      id: 'x',
      websiteUrl: null,
      timezone: 'Asia/Dubai',
      createPostsAsInternal: false,
      hideEmailsFromClients: false,
      autoCropImages: true,
      approvalMode: 'multi_level',
      requiredApprovers: 3,
      scheduleOnApproval: false,
      lockAfterApproval: false,
    });
    expect(legacy.approval_mode).toBe('required');
    expect(legacy.required_approvers).toBe(3);
  });

  it('settings route is registered and PATCH needs tenant.manage', () => {
    expect(read('apps/api/src/app.module.ts')).toContain('WorkspaceSettingsController');
    expect(read('apps/api/src/common/guards/capabilities.guard.ts')).toContain(
      "'PATCH /api/v1/workspace/settings': ['tenant.manage']",
    );
  });

  it('content service enforces planned/schedule separation and rejected/archived gates', () => {
    const svc = read('apps/api/src/content/content.service.ts');
    expect(svc).not.toContain('plannedAt: current.plannedAt ?? when');
    expect(svc).toContain('assertCanPublish(');
    expect(svc).toContain("'error.already_approved'");
    expect(svc).toMatch(/archivedAt: new Date\(\),\s+scheduleState: 'UNSCHEDULED'/);
  });
});
