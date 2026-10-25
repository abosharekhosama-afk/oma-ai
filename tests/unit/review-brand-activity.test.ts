import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reviewStep } from '../../packages/domain/src/work/deliverable-review-policy';
import {
  ACTIVE_BRAND_EVENT,
  getActiveBrandId,
  isBrandScopedPath,
  resolveActiveBrand,
  scopeBrands,
  setActiveBrandId,
} from '../../apps/web/src/lib/active-brand';
import { activityVerb, relativeTime } from '../../apps/web/src/components/activity/activity-feed-item';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

function fakeWindow(search = '') {
  const store = new Map<string, string>();
  const events: string[] = [];
  const win = {
    location: { search, href: `http://x/app/tasks${search}`, pathname: '/app/tasks' },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    history: {
      state: null,
      replaceState: (_s: unknown, _t: string, url: string) => {
        const u = new URL(url);
        win.location.search = u.search;
        win.location.href = url;
      },
    },
    dispatchEvent: (e: Event) => {
      events.push(e.type);
      return true;
    },
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('CustomEvent', class extends Event {});
  return { win, store, events };
}

describe('deliverable rejection', () => {
  it('REJECTED is in the Prisma enum with a migration', () => {
    const schema = read('packages/db/prisma/schema.prisma');
    const block = schema.slice(schema.indexOf('enum WorkDeliverableStatus'));
    expect(block.slice(0, block.indexOf('}'))).toContain('REJECTED');
    const sql = read('packages/db/prisma/migrations/20261025150000_work_deliverable_rejected/migration.sql');
    expect(sql).toContain(`ALTER TYPE "WorkDeliverableStatus" ADD VALUE IF NOT EXISTS 'REJECTED'`);
  });
  it('domain policy maps reject → REJECTED and the task is BLOCKED', () => {
    expect(reviewStep('AWAITING_REVIEW', 'reject')).toEqual({ next: 'REJECTED', status: 'REJECTED' });
    expect(read('apps/api/src/content/ops.service.ts')).toMatch(/reject: 'BLOCKED'/);
  });
});

describe('active brand scope', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('reads ?brand= first, persists it, and scopes brand lists', () => {
    const { store } = fakeWindow('?brand=b2');
    expect(getActiveBrandId()).toBe('b2');
    expect(store.get('oma.activeBrandId')).toBe('b2');
    const brands = [{ id: 'b1' }, { id: 'b2' }];
    expect(scopeBrands(brands)).toEqual([{ id: 'b2' }]);
    expect(scopeBrands(brands, 'unknown')).toEqual(brands);
    expect(scopeBrands(brands, null)).toEqual(brands);
  });
  it('setActiveBrandId syncs URL + storage and notifies listeners; null = all', () => {
    const { win, store, events } = fakeWindow('');
    setActiveBrandId('b1');
    expect(win.location.search).toBe('?brand=b1');
    expect(events).toContain(ACTIVE_BRAND_EVENT);
    setActiveBrandId(null);
    expect(store.has('oma.activeBrandId')).toBe(false);
    expect(win.location.search).toBe('');
  });
  it('resolves the switcher label and scoped surfaces', () => {
    expect(resolveActiveBrand([{ id: 'a' }, { id: 'b' }], 'b')).toEqual({ id: 'b' });
    expect(resolveActiveBrand([{ id: 'a' }, { id: 'b' }], null)).toBeNull();
    expect(resolveActiveBrand([{ id: 'a' }], null)).toEqual({ id: 'a' });
    for (const p of ['/app/content', '/app/deliverables/x', '/app/tasks', '/app/requests/1', '/app/campaigns'])
      expect(isBrandScopedPath(p)).toBe(true);
    expect(isBrandScopedPath('/app/brands/x')).toBe(false);
  });
  it('every work-surface loader uses the scoped brand list and reloads on change', () => {
    for (const f of ['apps/web/src/lib/ops-api.ts', 'apps/web/src/lib/content-api.ts'])
      expect(read(f)).not.toMatch(/const brandRows = await listBrandsProduction\(\)/);
    for (const f of [
      'tasks/tasks-client.tsx',
      'requests/requests-client.tsx',
      'deliverables/deliverables-client.tsx',
      'campaigns/campaigns-client.tsx',
      'content/content-client.tsx',
    ])
      expect(read(`apps/web/src/app/(app)/app/${f}`)).toContain('useReloadOnBrandChange(load)');
  });
});

describe('activity feed item', () => {
  it('uses i18n verbs with a readable fallback', () => {
    const t = (k: string) => (k === 'activity.verb.task_created' ? 'created task' : k);
    expect(activityVerb(t, { action: 'task.created', title: 'Task Created' })).toBe('created task');
    expect(activityVerb(t, { action: 'x.y', title: 'Something Happened' })).toBe('something happened');
  });
  it('formats relative time in en and ar', () => {
    const now = Date.parse('2026-10-25T12:00:00Z');
    expect(relativeTime('2026-10-25T11:55:00Z', 'en', now)).toMatch(/5 min/);
    expect(relativeTime('2026-10-25T11:55:00Z', 'ar', now)).toMatch(/٥|5/);
    expect(relativeTime('bad', 'en', now)).toBe('');
  });
  it('has en+ar keys for every verb and uses tokens only (no gradients/hex)', () => {
    const en = JSON.parse(read('packages/i18n/messages/en.json'));
    const ar = JSON.parse(read('packages/i18n/messages/ar.json'));
    const keys = Object.keys(en).filter((k) => k.startsWith('activity.'));
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) expect(ar[k], k).toBeTruthy();
    const css = read('apps/web/src/styles/activity.css');
    expect(css).not.toMatch(/gradient|#[0-9a-f]{3,8}\b|box-shadow|backdrop-filter/i);
  });
});
