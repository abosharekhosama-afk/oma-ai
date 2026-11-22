import { describe, expect, it } from 'vitest';
import {
  enterFolder,
  folderTabs,
  trailBack,
  trailFromPath,
  trailUpTo,
} from '../../apps/web/src/components/content/media-folder-trail';
import { resolveInitialSource } from '../../apps/web/src/components/content/media-source';

const brands = [
  { id: 'b1', label: 'Velvet' },
  { id: 'b2', label: 'Other' },
];

describe('media folder drill-down navigation', () => {
  it('shows the root folders as tabs at the top level', () => {
    const tabs = folderTabs({
      trail: [],
      rootFolders: brands,
      currentFolders: null,
      parentFolders: null,
    });
    expect(tabs).toEqual({ folders: brands, mode: 'root', activeId: null });
  });

  it('replaces the root tabs with the open folder subfolders', () => {
    const trail = enterFolder([], brands[0]!);
    const kinds = [
      { id: 'p', label: 'Posts' },
      { id: 'l', label: 'Logos' },
    ];
    const tabs = folderTabs({
      trail,
      rootFolders: brands,
      currentFolders: kinds,
      parentFolders: null,
    });
    expect(tabs.mode).toBe('children');
    expect(tabs.folders).toEqual(kinds);
    expect(tabs.folders).not.toContain(brands[0]);
  });

  it('keeps the siblings with the leaf folder active when it has no subfolders', () => {
    const kinds = [
      { id: 'p', label: 'Posts' },
      { id: 'l', label: 'Logos' },
    ];
    const trail = enterFolder(enterFolder([], brands[0]!), kinds[0]!);
    const tabs = folderTabs({
      trail,
      rootFolders: brands,
      currentFolders: [],
      parentFolders: kinds,
    });
    expect(tabs).toEqual({ folders: kinds, mode: 'siblings', activeId: 'p' });
    // A top-level leaf keeps the root folders as siblings.
    const top = folderTabs({
      trail: [brands[1]!],
      rootFolders: brands,
      currentFolders: [],
      parentFolders: null,
    });
    expect(top).toEqual({ folders: brands, mode: 'siblings', activeId: 'b2' });
  });

  it('goes back one level, jumps by breadcrumb and truncates when an ancestor is reopened', () => {
    const a = { id: 'a', label: 'A' };
    const b = { id: 'b', label: 'B' };
    const c = { id: 'c', label: 'C' };
    const trail = enterFolder(enterFolder(enterFolder([], a), b), c);
    expect(trail.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(trailBack(trail).map((x) => x.id)).toEqual(['a', 'b']);
    expect(trailBack([a])).toEqual([]);
    expect(trailUpTo(trail, 0).map((x) => x.id)).toEqual(['a']);
    expect(trailUpTo(trail, -1)).toEqual([]);
    expect(enterFolder(trail, a).map((x) => x.id)).toEqual(['a']);
  });

  it('rebuilds the trail from the server path without the root or the virtual all entry', () => {
    const trail = trailFromPath(
      [
        { id: 'root', name: 'tenant' },
        { id: 'b1', name: '01BRAND', label: 'Velvet' },
        { id: 'p', name: 'posts' },
      ],
      'root',
      (_id, name, label) => label ?? name.toUpperCase(),
    );
    expect(trail).toEqual([
      { id: 'b1', label: 'Velvet' },
      { id: 'p', label: 'POSTS' },
    ]);
    expect(trailFromPath([{ id: '__all__', name: 'All files' }], null, (_i, n) => n)).toEqual([]);
  });
});

describe('media source choice', () => {
  const both = { mode: 'OMA_INTERNAL', internal_available: true, byos_connected: true };
  it('follows the workspace storage setting over a remembered store', () => {
    // Regression: a remembered WorkDrive browse used to redirect uploads despite OMA mode.
    expect(resolveInitialSource('workdrive', both)).toBe('oma');
    expect(resolveInitialSource('workdrive', { ...both, mode: 'SYNC_BACKUP' })).toBe('oma');
    expect(resolveInitialSource('oma', { ...both, mode: 'USER_WORKDRIVE' })).toBe('workdrive');
  });
  it('falls back to the workspace mode, then to whichever store exists', () => {
    expect(resolveInitialSource(null, { ...both, mode: 'USER_WORKDRIVE' })).toBe('workdrive');
    expect(resolveInitialSource(null, both)).toBe('oma');
    expect(resolveInitialSource('workdrive', { ...both, byos_connected: false })).toBe('oma');
    expect(resolveInitialSource('oma', { ...both, internal_available: false })).toBe('workdrive');
  });
  it('lets the server decide when the workspace status is unknown', () => {
    expect(resolveInitialSource(null, null)).toBeNull();
    expect(resolveInitialSource('workdrive', null)).toBe('workdrive');
  });
});
