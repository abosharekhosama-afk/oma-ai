'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { DownOutlined, FolderOutlined } from '../ui/lucide-icons';
import { mediaApi, type MediaKind, type WorkDriveBrowse } from '../../lib/workdrive-api';

export type MediaTreeScope = 'organization' | 'brand' | 'all';

type TreeEntry = {
  id: string;
  name: string;
  scope: 'organization' | 'brand';
  parentId: string | null;
  children: string[];
  loaded: boolean;
};

type Tr = (key: string) => string;

function childScope(
  parentScope: 'organization' | 'brand',
  folderId: string,
  brandFolderId: string | undefined,
): 'organization' | 'brand' {
  if (parentScope === 'brand') return 'brand';
  if (brandFolderId && folderId === brandFolderId) return 'brand';
  return 'organization';
}

export function MediaFolderTree({
  brandId,
  kind,
  storageSource,
  orgRoot,
  brandRoot,
  brandFolderId,
  brandName,
  workspaceLabel,
  browse,
  selectedFolderId,
  allSelected,
  browsing,
  onNavigate,
  t,
}: {
  brandId: string;
  kind: MediaKind;
  storageSource: 'oma' | 'workdrive' | null;
  orgRoot: WorkDriveBrowse | null;
  brandRoot: WorkDriveBrowse | null;
  brandFolderId: string | undefined;
  brandName: string;
  workspaceLabel: string | null;
  browse: WorkDriveBrowse | null;
  selectedFolderId: string | null;
  allSelected: boolean;
  browsing: boolean;
  onNavigate: (nextScope: MediaTreeScope, folderId?: string) => void;
  t: Tr;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [entries, setEntries] = useState<Map<string, TreeEntry>>(() => new Map());
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const orgRootId = orgRoot?.folder.id;

  const seedFolder = useCallback(
    (
      folderId: string,
      name: string,
      parentId: string | null,
      treeScope: 'organization' | 'brand',
      folders: Array<{ id: string; name: string }>,
    ) => {
      setEntries((prev) => {
        const next = new Map(prev);
        const childIds = folders.map((f) => f.id);
        next.set(folderId, {
          id: folderId,
          name,
          scope: treeScope,
          parentId,
          children: childIds,
          loaded: true,
        });
        for (const f of folders) {
          const scope = childScope(treeScope, f.id, brandFolderId);
          const existing = next.get(f.id);
          next.set(f.id, {
            id: f.id,
            name: f.name,
            scope,
            parentId: folderId,
            children: existing?.loaded ? existing.children : [],
            loaded: existing?.loaded ?? false,
          });
        }
        return next;
      });
    },
    [brandFolderId],
  );

  useEffect(() => {
    if (!orgRootId || !orgRoot) return;
    const rootName =
      workspaceLabel || orgRoot.root_name || orgRoot.folder.name || t('media.workspaceRoot');
    seedFolder(orgRootId, rootName, null, 'organization', orgRoot.folders);
    setExpanded((prev) => new Set(prev).add(orgRootId));
  }, [orgRoot, orgRootId, seedFolder, t, workspaceLabel]);

  useEffect(() => {
    if (!brandFolderId || !brandRoot) return;
    seedFolder(
      brandFolderId,
      brandName || brandRoot.brand_folder?.name || t('media.brandAssets'),
      orgRootId ?? null,
      'brand',
      brandRoot.folders,
    );
    if (orgRootId) {
      setEntries((prev) => {
        const next = new Map(prev);
        const org = next.get(orgRootId);
        if (org && !org.children.includes(brandFolderId)) {
          next.set(orgRootId, { ...org, children: [...org.children, brandFolderId] });
        }
        return next;
      });
    }
  }, [brandFolderId, brandName, brandRoot, orgRootId, seedFolder, t]);

  useEffect(() => {
    if (!browse || browse.folder.id === '__all__') return;
    const folderId = browse.folder.id;
    const treeScope =
      brandFolderId && folderId === brandFolderId
        ? 'brand'
        : brandFolderId && browse.path?.some((p) => p.id === brandFolderId)
          ? 'brand'
          : 'organization';
    seedFolder(folderId, browse.folder.name, null, treeScope, browse.folders);
    setExpanded((prev) => new Set(prev).add(folderId));
  }, [brandFolderId, browse, seedFolder]);

  const ensureChildren = useCallback(
    async (folderId: string) => {
      const entry = entries.get(folderId);
      if (!entry || entry.loaded) return;
      if (!brandId) return;
      setLoadingId(folderId);
      try {
        const treeScope = entry.scope;
        const r = await mediaApi.browse(
          brandId,
          kind,
          folderId,
          treeScope,
          storageSource ?? undefined,
          {
            file_limit: 1,
            file_offset: 0,
            skipCache: true,
          },
        );
        seedFolder(folderId, entry.name, entry.parentId, treeScope, r.data.folders);
      } finally {
        setLoadingId(null);
      }
    },
    [brandId, entries, kind, seedFolder, storageSource],
  );

  const toggleExpand = useCallback(
    async (folderId: string) => {
      const next = new Set(expanded);
      if (next.has(folderId)) {
        next.delete(folderId);
        setExpanded(next);
        return;
      }
      next.add(folderId);
      setExpanded(next);
      await ensureChildren(folderId);
    },
    [ensureChildren, expanded],
  );

  const visibleRows = useMemo(() => {
    const rows: Array<{ entry: TreeEntry; depth: number }> = [];
    const walk = (id: string, depth: number) => {
      const entry = entries.get(id);
      if (!entry) return;
      rows.push({ entry, depth });
      if (!expanded.has(id)) return;
      for (const childId of entry.children) walk(childId, depth + 1);
    };
    if (orgRootId) walk(orgRootId, 0);
    else if (brandFolderId && entries.has(brandFolderId)) walk(brandFolderId, 0);
    return rows;
  }, [entries, expanded, orgRootId, brandFolderId]);

  const isSelected = (folderId: string | null, expectAll: boolean) => {
    if (expectAll) return allSelected;
    if (!folderId || allSelected) return false;
    return selectedFolderId === folderId && !allSelected;
  };

  return (
    <nav className="oma-ml-tree" aria-label={t('media.folderTree')} data-testid="media-folder-tree">
      <button
        type="button"
        className="oma-ml-tree__row"
        data-active={allSelected ? 'true' : 'false'}
        data-testid="media-tree-all"
        onClick={() => onNavigate('all')}
      >
        <span className="oma-ml-tree__spacer" aria-hidden />
        <FolderOutlined className="oma-ml-tree__icon" aria-hidden />
        <span className="oma-ml-tree__label">{t('media.allAssets')}</span>
      </button>
      {visibleRows.map(({ entry, depth }) => {
        const hasKids = entry.children.length > 0 || !entry.loaded;
        const open = expanded.has(entry.id);
        const active = isSelected(entry.id, false);
        return (
          <div
            key={entry.id}
            className="oma-ml-tree__group"
            style={{ '--oma-tree-depth': depth } as CSSProperties}
          >
            <TreeFolderRow
              hasKids={hasKids}
              open={open}
              active={active}
              loading={loadingId === entry.id}
              browsing={browsing}
              label={entry.name}
              onToggle={() => void toggleExpand(entry.id)}
              onSelect={() => onNavigate(entry.scope, entry.id)}
            />
          </div>
        );
      })}
    </nav>
  );
}

function TreeFolderRow({
  hasKids,
  open,
  active,
  loading,
  browsing,
  label,
  onToggle,
  onSelect,
}: {
  hasKids: boolean;
  open: boolean;
  active: boolean;
  loading: boolean;
  browsing: boolean;
  label: string;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <div className="oma-ml-tree__rowwrap" data-active={active ? 'true' : 'false'}>
      {hasKids ? (
        <button
          type="button"
          className="oma-ml-tree__toggle"
          aria-expanded={open}
          onClick={onToggle}
          disabled={loading}
        >
          <DownOutlined data-open={open ? 'true' : 'false'} aria-hidden />
        </button>
      ) : (
        <span className="oma-ml-tree__spacer" aria-hidden />
      )}
      <button
        type="button"
        className="oma-ml-tree__row"
        data-active={active ? 'true' : 'false'}
        disabled={browsing && !active}
        onClick={onSelect}
      >
        <FolderOutlined className="oma-ml-tree__icon" aria-hidden />
        <span className="oma-ml-tree__label" dir="auto">
          {label}
        </span>
      </button>
    </div>
  );
}
