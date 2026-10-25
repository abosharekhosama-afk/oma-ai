import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeChecklist } from '../../apps/api/src/home/home.service';
import { resolveRecipients } from '../../apps/api/src/notifications/notify';
import {
  capabilitiesToPermissions,
  readablePermissions,
  isOwnerMember,
  type WorkspaceMember,
} from '../../apps/web/src/lib/team-api';

const root = join(__dirname, '../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('home checklist from real data', () => {
  it('marks steps done only when the data exists', () => {
    const empty = computeChecklist({
      brands: 0, brandsWithWebsiteOrProfile: 0, strategies: 0, campaigns: 0,
      content: 0, requestsOrTasks: 0, reviewed: 0,
    });
    expect(empty.filter((s) => s.done).map((s) => s.id)).toEqual(['company']);
    const full = computeChecklist({
      brands: 3, brandsWithWebsiteOrProfile: 1, strategies: 1, campaigns: 5,
      content: 21, requestsOrTasks: 22, reviewed: 4,
    });
    expect(full.every((s) => s.done)).toBe(true);
  });
});

describe('notifications: no self-spam, sensible solo workspace', () => {
  it('never notifies the actor when others exist', () => {
    expect(
      resolveRecipients({ recipients: ['me', 'you'], actorUserId: 'me', type: 'content.approved', activeMemberCount: 2 }),
    ).toEqual(['you']);
  });
  it('solo owner gets decision outcomes only', () => {
    const solo = (type: Parameters<typeof resolveRecipients>[0]['type']) =>
      resolveRecipients({ recipients: ['me'], actorUserId: 'me', type, activeMemberCount: 1 });
    expect(solo('content.approved')).toEqual(['me']);
    expect(solo('deliverable.rejected')).toEqual(['me']);
    expect(solo('content.approval_requested')).toEqual([]);
    expect(solo('task.comment')).toEqual([]);
    expect(
      resolveRecipients({ recipients: ['me'], actorUserId: 'me', type: 'content.approved', activeMemberCount: 2 }),
    ).toEqual([]);
  });
});

describe('team permissions are readable and exact', () => {
  const m = (caps: string[], profiles: string[] = []): WorkspaceMember => ({
    id: 'm', status: 'ACTIVE', user: null, capabilities: caps, source_profiles: profiles,
  });
  it('does not guess from substrings', () => {
    const p = capabilitiesToPermissions(['brand.read']);
    expect(p.view).toBe(true);
    expect(p.approve).toBe(false);
    expect(p.admin).toBe(false);
  });
  it('lists human names (en/ar)', () => {
    const member = m(['content.read', 'content.approve', 'content.schedule']);
    expect(readablePermissions(member, false)).toEqual(['View workspace', 'Approve content', 'Schedule posts']);
    expect(readablePermissions(member, true)[1]).toBe('اعتماد المحتوى');
  });
  it('detects owners', () => {
    expect(isOwnerMember(m([], ['COMPANY_OWNER']))).toBe(true);
    expect(isOwnerMember(m([], ['WRITER']))).toBe(false);
  });
});

describe('demo dependencies removed from real surfaces', () => {
  for (const f of [
    'apps/web/src/app/(app)/app/home-client.tsx',
    'apps/web/src/app/(app)/app/team/team-client.tsx',
    'apps/web/src/app/(app)/app/settings/settings-client.tsx',
    'apps/web/src/lib/activity-api.ts',
  ]) {
    it(`${f} does not call /api/v1/demo`, () => {
      const src = read(f);
      expect(src).not.toMatch(/demoApi\s*[<(]/);
      expect(src).not.toContain('/api/v1/demo');
    });
  }
  it('home and activity APIs are registered and permission-checked', () => {
    expect(read('apps/api/src/app.module.ts')).toMatch(/HomeController[\s\S]*ActivityController/);
    const guard = read('apps/api/src/common/guards/capabilities.guard.ts');
    expect(guard).toContain("'GET /api/v1/home': ['brand.read']");
    expect(guard).toContain("'GET /api/v1/activity': ['brand.read']");
  });
  it('owner/self cannot be removed server-side', () => {
    const svc = read('apps/api/src/tenant/tenant.service.ts');
    expect(svc).toContain("'errors.cannot_remove_owner'");
    expect(svc).toContain("'errors.cannot_remove_self'");
  });
  it('label create accepts flat names and website connect tolerates no connector', () => {
    expect(read('apps/api/src/content/content-extras.service.ts')).toContain('pick(raw.nameEn)');
    expect(read('apps/api/src/brand/website-source.service.ts')).toContain(
      'err instanceof WebsiteConnectorNotConfiguredError',
    );
  });
});
