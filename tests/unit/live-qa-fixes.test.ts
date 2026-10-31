import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { wallTimeToIso } from '@oma/domain';
import { BRIEF_MARKER, briefDisplayText, stripBriefCopy } from '../../apps/web/src/lib/ops-api';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('live QA fixes', () => {
  it('wallTimeToIso builds a real ISO instant in the workspace timezone', () => {
    expect(wallTimeToIso('2026-10-28T14:30', 'Asia/Dubai')).toBe('2026-10-28T10:30:00.000Z');
    expect(wallTimeToIso('2026-10-28', 'Asia/Dubai')).toBe('2026-10-28T06:00:00.000Z');
    expect(wallTimeToIso('2026-07-01 09:00', 'Asia/Jerusalem')).toBe('2026-07-01T06:00:00.000Z');
    expect(wallTimeToIso('Oct 28, 00:00')).toBeNull();
    expect(wallTimeToIso('2026-02-31')).toBeNull();
    expect(wallTimeToIso('')).toBeNull();
  });

  it('briefDisplayText never leaks the encoded brief marker', () => {
    const payload = JSON.stringify({ objective: { en: 'Grow sign-ups', ar: 'زيادة التسجيل' } });
    const raw = `${BRIEF_MARKER}${payload}`;
    expect(briefDisplayText({ en: raw, ar: raw }, 'en')).toBe('Grow sign-ups');
    expect(briefDisplayText({ en: raw, ar: raw }, 'ar')).toBe('زيادة التسجيل');
    expect(briefDisplayText(`Plain intro\n\n${raw}`, 'en')).toBe('Plain intro');
    expect(briefDisplayText(`${BRIEF_MARKER}{broken`, 'en')).toBe('');
    expect(briefDisplayText({ en: 'Just text', ar: 'نص' }, 'ar')).toBe('نص');
    expect(stripBriefCopy({ en: raw, ar: raw }).en).not.toContain(BRIEF_MARKER);
  });

  it('Save draft creates without scheduling', () => {
    const src = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    const fn = src.slice(src.indexOf('async function submitCreate'), src.indexOf('async function', src.indexOf('async function submitCreate') + 10));
    expect(fn).not.toContain('scheduleContent(');
    expect(fn).toContain('wallTimeToIso(');
    expect(fn).toContain('createForm.plannedDate');
    expect(fn).toContain('brandScheduleTimezone');
    expect(src).not.toMatch(/plannedDate: todayKey\(\)/);
  });

  it('task comments and checklist use the persisted API', () => {
    const src = read('apps/web/src/app/(app)/app/tasks/tasks-client.tsx');
    expect(src).toContain('addTaskComment(selected.id');
    expect(src).toContain('addTaskChecklistItem(selected.id');
    expect(src).toContain('updateTaskChecklistItem(taskId');
    expect(src).toContain('getTaskDetail(taskId)');
    expect(src).not.toContain('local-${Date.now()}');
  });

  it('API rejects invalid dates with 400 instead of 500', () => {
    const src = read('apps/api/src/content/content.service.ts');
    expect(src).toContain("parseOptionalDate(input.plannedAt, 'plannedAt')");
    expect(src).toMatch(/VALIDATION_FAILED', `Invalid \$\{field\}`, 400/);
  });

  it('mobile shell hides the rail and uses a header hamburger', () => {
    const css = read('apps/web/src/styles/shell.css');
    const tail = css.slice(css.lastIndexOf('Mobile shell (live-qa-fixes)'));
    expect(tail).toContain('.oma-shell > .oma-rail');
    expect(tail).toContain('display: none !important');
    const chrome = read('apps/web/src/components/shell/shell-chrome.tsx');
    expect(chrome).toContain('data-testid="mobile-nav-toggle"');
    expect(chrome).toMatch(/setMobileOpen\(false\);\s*\}, \[pathname\]\)/);
    const drawer = read('apps/web/src/components/ui/drawer.tsx');
    expect(drawer).toContain("nav ? (rtl ? 'right' : 'left')");
  });
});
