/**
 * Drill-down navigation for the media library folder bar.
 *
 * The bar shows one level at a time: at the root it lists the top-level folders; opening a
 * folder replaces them with that folder's subfolders (a Back button and a breadcrumb stay
 * visible). A folder without subfolders keeps its siblings in the bar, with itself active.
 */

export type FolderCrumb = { id: string; label: string };

export type FolderTabs = {
  /** Folders shown in the bar right now. */
  folders: FolderCrumb[];
  /** `root`: top level · `children`: subfolders of the open folder · `siblings`: leaf folder. */
  mode: 'root' | 'children' | 'siblings';
  /** Folder highlighted in the bar (the open leaf folder), if any. */
  activeId: string | null;
};

/** Open `crumb` from the current trail: re-opening an ancestor truncates back to it. */
export function enterFolder(trail: FolderCrumb[], crumb: FolderCrumb): FolderCrumb[] {
  const at = trail.findIndex((c) => c.id === crumb.id);
  if (at >= 0) return trail.slice(0, at + 1);
  return [...trail, crumb];
}

/** Breadcrumb jump: `-1` is the root, otherwise keep crumbs up to and including `index`. */
export function trailUpTo(trail: FolderCrumb[], index: number): FolderCrumb[] {
  if (index < 0) return [];
  return trail.slice(0, index + 1);
}

/** Back button: one level up (the root when one level deep). */
export function trailBack(trail: FolderCrumb[]): FolderCrumb[] {
  return trail.slice(0, -1);
}

/**
 * Rebuild the trail from the server `path` (root first, current last). The root entry and the
 * virtual "all" entry are dropped; labels come from `labelFor`.
 */
export function trailFromPath(
  path: Array<{ id: string; name: string; label?: string }> | undefined,
  rootId: string | null | undefined,
  labelFor: (id: string, name: string, label?: string) => string,
): FolderCrumb[] {
  if (!path?.length) return [];
  return path
    .filter((p) => p.id !== '__all__' && p.id !== rootId)
    .map((p) => ({ id: p.id, label: labelFor(p.id, p.name, p.label) }));
}

/** Folders for the bar given the root folders, the open folder's children and its parent's. */
export function folderTabs(input: {
  trail: FolderCrumb[];
  rootFolders: FolderCrumb[];
  currentFolders: FolderCrumb[] | null;
  parentFolders: FolderCrumb[] | null;
}): FolderTabs {
  const current = input.trail[input.trail.length - 1];
  if (!current) return { folders: input.rootFolders, mode: 'root', activeId: null };
  if (input.currentFolders && input.currentFolders.length > 0) {
    return { folders: input.currentFolders, mode: 'children', activeId: null };
  }
  const siblings =
    input.trail.length === 1 ? input.rootFolders : (input.parentFolders ?? [current]);
  const list = siblings.some((f) => f.id === current.id) ? siblings : [...siblings, current];
  return { folders: list, mode: 'siblings', activeId: current.id };
}
