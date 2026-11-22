'use client';
import { openSettings } from '../../lib/settings-dialog';

import {
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  ExpandPanelOutlined,
  FolderAddOutlined,
  SearchOutlined,
  ShrinkPanelOutlined,
  UploadOutlined,
} from '../ui/lucide-icons';
import { MediaSurface } from './media-surface';
import { MediaFolderNav } from './media-folder-nav';
import {
  enterFolder,
  folderTabs,
  trailBack,
  trailFromPath,
  trailUpTo,
  type FolderCrumb,
} from './media-folder-trail';
import {
  persistSource,
  readStoredSource,
  resolveInitialSource,
  type MediaSource,
} from './media-source';
import { displayFolderLabel } from '../../lib/media-folder-display';
import { storageUsageLabel, storageUsageView } from '../../lib/storage-usage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import {
  formatBytes,
  invalidateMediaCache,
  mediaApi,
  workDriveApi,
  type MediaAsset,
  type MediaKind,
  type MediaLibrary,
  type WorkspaceStorage,
  type WorkDriveBrowse,
  type WorkDriveBrowseFile,
} from '../../lib/workdrive-api';

type Tree = 'brand' | 'organization';

type Tr = (key: string) => string;
type SortKey = 'latest' | 'oldest' | 'name';
type UsageFilter = 'used' | 'unused' | 'deleted';
type TypeFilter = 'image' | 'video' | 'gif' | 'pdf';

const ACCEPT: Record<MediaKind, string> = {
  posts: 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm',
  logos: 'image/png,image/jpeg,image/webp,image/gif',
  deliverables:
    'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf',
};

const CANVA_HIDE_KEY = 'oma-ml-hide-canva';
const BROWSE_FILE_LIMIT = 48;
const GRID_RENDER_STEP = 36;
const page = { file_limit: BROWSE_FILE_LIMIT, file_offset: 0 };

type GridItem = {
  key: string;
  name: string;
  mime: string;
  viewUrl: string;
  streamUrl: string | null;
  usageCount: number;
  missing: boolean;
  createdAt: string | null;
  campaignIds: string[];
  uploaderId: string | null;
  uploaderName: string | null;
  fileId: string;
  asset: MediaAsset | null;
};

function MediaShimmer({ rows = 4 }: { rows?: number }) {
  return (
    <div className="oma-mp-loading" aria-busy="true" data-testid="media-shimmer">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="oma-shim oma-mp-shimmer" />
      ))}
    </div>
  );
}

function LazyMediaThumb({
  item,
  t,
  badge,
  eager = false,
}: {
  item: GridItem;
  t: Tr;
  badge?: string | null;
  eager?: boolean;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(eager);
  useEffect(() => {
    if (eager) return;
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { rootMargin: '160px 0px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);

  const video = item.mime.startsWith('video/');
  return (
    <span ref={host} className="oma-ml-thumb">
      {item.missing ? (
        <span className="oma-mp-thumb oma-mp-thumb--missing">{t('media.missingShort')}</span>
      ) : !visible ? (
        <span className="oma-ml-thumb__placeholder" aria-hidden />
      ) : item.mime.startsWith('image/') || video ? (
        <MediaSurface
          className="oma-ml-thumb__media"
          src={video ? item.streamUrl || item.viewUrl : item.viewUrl}
          mime={item.mime}
          alt=""
          preload="none"
        />
      ) : (
        <span className="oma-ml-thumb__file">{item.name.split('.').pop()}</span>
      )}
      {video ? (
        <span className="oma-ml-play" aria-hidden>
          ▶
        </span>
      ) : null}
      {badge ? <span className="oma-ml-used">{badge}</span> : null}
    </span>
  );
}

export function MediaThumb({ asset, t }: { asset: MediaAsset; t: Tr }) {
  if (asset.missing)
    return (
      <span
        className="oma-mp-thumb oma-mp-thumb--missing"
        role="img"
        aria-label={t('media.missing')}
      >
        {t('media.missingShort')}
      </span>
    );
  if (asset.mime.startsWith('video/') || asset.mime.startsWith('image/'))
    return (
      <MediaSurface
        className="oma-mp-thumb"
        src={(asset.mime.startsWith('video/') ? asset.stream_url : null) ?? asset.view_url}
        mime={asset.mime}
        alt={asset.name}
      />
    );
  return <span className="oma-mp-thumb oma-mp-thumb--file">{asset.name.split('.').pop()}</span>;
}

function fileToItem(
  file: WorkDriveBrowseFile,
  brandId: string,
  kind: MediaKind,
  source?: 'oma' | 'workdrive',
): GridItem {
  const qs = source ? `&source=${encodeURIComponent(source)}` : '';
  const view =
    file.view_url ||
    `/api/v1/brands/${brandId}/media/file-preview?file_id=${encodeURIComponent(file.id)}${qs}`;
  const fileBrandId = file.brand_id || brandId;
  const asset: MediaAsset | null = file.asset_id
    ? {
        id: file.asset_id,
        brand_id: fileBrandId,
        kind,
        name: file.name,
        mime: file.mime,
        size: file.size,
        status: file.missing ? 'MISSING' : 'READY',
        missing: Boolean(file.missing),
        source: 'workdrive',
        storage_provider:
          source === 'oma' ? 'OMA_INTERNAL' : source === 'workdrive' ? 'USER_WORKDRIVE' : null,
        view_url: file.view_url || `/api/v1/media/${file.asset_id}/view`,
        stream_url: file.stream_url ?? null,
        created_at: file.created_at || file.updated_at || new Date().toISOString(),
      }
    : null;
  return {
    key: file.asset_id || file.id,
    name: file.name,
    mime: file.mime,
    viewUrl: view,
    streamUrl: file.stream_url ?? null,
    usageCount: file.usage_count ?? 0,
    missing: Boolean(file.missing),
    createdAt: file.created_at || file.updated_at,
    campaignIds: file.campaign_ids ?? [],
    uploaderId: file.uploader_id ?? null,
    uploaderName: file.uploader_name ?? null,
    fileId: file.id,
    asset,
  };
}

function typeOf(mime: string): TypeFilter | null {
  if (mime === 'image/gif') return 'gif';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.includes('pdf')) return 'pdf';
  return null;
}

function usageLabel(count: number, t: Tr) {
  if (count <= 0) return null;
  if (count === 1) return t('media.postCount').replace('{n}', '1');
  return t('media.postsCount').replace('{n}', String(count));
}

/** Real media picker: WorkDrive library as a Planable right-side panel. */
export function MediaPickerDialog({
  open,
  brandId,
  kind = 'posts',
  t,
  locale,
  canConnect,
  onClose,
  onPick,
  variant = 'drawer',
  brandName,
}: {
  open: boolean;
  brandId: string | null;
  kind?: MediaKind;
  brandName?: string;
  t: Tr;
  locale: string;
  canConnect: boolean;
  onClose: () => void;
  onPick: (asset: MediaAsset) => void;
  variant?: 'drawer' | 'panel';
}) {
  const [lib, setLib] = useState<MediaLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Root of the folder tree (level 0 tabs + files stored at the root). */
  const [root, setRoot] = useState<WorkDriveBrowse | null>(null);
  /** "All media": newest files across the workspace for the source, paged (root grid). */
  const [allFiles, setAllFiles] = useState<WorkDriveBrowse | null>(null);
  /** Listing of the open folder (null at the root). */
  const [browse, setBrowse] = useState<WorkDriveBrowse | null>(null);
  const [treeScope, setTreeScope] = useState<Tree>('organization');
  const [trail, setTrail] = useState<FolderCrumb[]>([]);
  const [storageSource, setStorageSource] = useState<MediaSource | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [progress, setProgress] = useState<{ name: string; value: number } | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('latest');
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [hideCanva, setHideCanva] = useState(false);
  const [usage, setUsage] = useState<Set<UsageFilter>>(new Set());
  const [types, setTypes] = useState<Set<TypeFilter>>(new Set());
  const [campaigns, setCampaigns] = useState<Set<string>>(new Set());
  const [uploaders, setUploaders] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const gridSentinelRef = useRef<HTMLDivElement>(null);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [visibleGridCount, setVisibleGridCount] = useState(GRID_RENDER_STEP);
  const [loadingMore, setLoadingMore] = useState(false);
  const [workspaceStorage, setWorkspaceStorage] = useState<WorkspaceStorage | null>(null);
  const [canvaBusy, setCanvaBusy] = useState(false);
  const [canvaHint, setCanvaHint] = useState<string | null>(null);
  const [fetchedBrandName, setFetchedBrandName] = useState<string | null>(null);
  // Request ordering: a late response never overwrites a newer view (folder clicks, source switch).
  const rootSeq = useRef(0);
  const folderSeq = useRef(0);
  /** folder id → its subfolders, so a leaf folder can keep its siblings in the bar. */
  const childFolders = useRef(
    new Map<string, Array<{ id: string; name: string; label?: string }>>(),
  );
  /** The server picked the source (no remembered choice): adopt it without reloading. */
  const adoptingSource = useRef(false);

  const workspaceLabel = lib?.workdrive.org_name ?? root?.root_name ?? null;
  const brandFolder = root?.brand_folder || browse?.brand_folder || allFiles?.brand_folder;
  const brandDisplayName =
    brandName?.trim() || fetchedBrandName?.trim() || brandFolder?.name || t('media.brandAssets');

  useEffect(() => {
    if (!open || !brandId) {
      setFetchedBrandName(null);
      return;
    }
    if (brandName?.trim()) return;
    void api<{ data: { name: string } }>(`/api/v1/brands/${brandId}`)
      .then((r) => setFetchedBrandName(r.data.name?.trim() || null))
      .catch(() => setFetchedBrandName(null));
  }, [open, brandId, brandName]);

  const labelFor = useCallback(
    (folderId: string, raw: string, serverLabel?: string) =>
      serverLabel ||
      displayFolderLabel(raw, t, {
        brandId: brandId || '',
        brandName: brandDisplayName,
        brandFolderId: brandFolder?.id,
        workspaceLabel,
        folderId,
      }),
    [brandDisplayName, brandFolder?.id, brandId, t, workspaceLabel],
  );
  const toCrumbs = useCallback(
    (rows: Array<{ id: string; name: string; label?: string }> | undefined) =>
      (rows ?? []).map((f) => ({ id: f.id, label: labelFor(f.id, f.name, f.label) })),
    [labelFor],
  );

  // Refs so the loaders stay stable (re-created loaders used to re-run the open effect and
  // snap the view back to the root while the user was inside a folder).
  const sourceRef = useRef<MediaSource | null>(null);
  sourceRef.current = storageSource;
  const treeRef = useRef<Tree>('organization');
  treeRef.current = treeScope;

  useEffect(() => {
    try {
      setHideCanva(sessionStorage.getItem(CANVA_HIDE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  // 1) Pick the source once per open: remembered choice, else the workspace mode.
  useEffect(() => {
    if (!open || !brandId) return;
    let cancelled = false;
    setSourceReady(false);
    void (async () => {
      let ws: WorkspaceStorage | null = null;
      try {
        ws = (await workDriveApi.storage()).data;
      } catch {
        ws = null;
      }
      if (cancelled) return;
      setWorkspaceStorage(ws);
      setStorageSource((cur) => resolveInitialSource(readStoredSource() ?? cur, ws));
      setSourceReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, brandId]);

  // 2) Root: library status, the tree root and "All media", in parallel.
  const loadRoot = useCallback(
    async (opts?: { fresh?: boolean }) => {
      if (!brandId) return;
      const seq = ++rootSeq.current;
      folderSeq.current += 1;
      const src = sourceRef.current ?? undefined;
      setBrowsing(true);
      setError(null);
      setVisibleGridCount(GRID_RENDER_STEP);
      const first = { file_limit: BROWSE_FILE_LIMIT, file_offset: 0, skipCache: opts?.fresh };
      const [libRes, orgRes, allRes] = await Promise.allSettled([
        mediaApi.list(brandId, kind, src, { limit: 1 }),
        mediaApi.browse(brandId, kind, undefined, 'organization', src, first),
        mediaApi.browse(brandId, kind, undefined, 'all', src, first),
      ]);
      if (seq !== rootSeq.current) return;
      if (libRes.status === 'fulfilled') setLib(libRes.value.data);
      else setError(getApiError(libRes.reason).message);
      let rootData: WorkDriveBrowse | null = null;
      let tree: Tree = 'organization';
      if (orgRes.status === 'fulfilled') {
        rootData = orgRes.value.data;
      } else {
        try {
          rootData = (await mediaApi.browse(brandId, kind, undefined, 'brand', src, first)).data;
          tree = 'brand';
        } catch (e) {
          if (seq === rootSeq.current) setError(getApiError(e).message);
        }
      }
      if (seq !== rootSeq.current) return;
      setRoot(rootData);
      setTreeScope(tree);
      if (rootData) childFolders.current.set(rootData.folder.id, rootData.folders);
      setAllFiles(allRes.status === 'fulfilled' ? allRes.value.data : null);
      const served =
        rootData?.source ?? (allRes.status === 'fulfilled' ? allRes.value.data.source : undefined);
      if (!sourceRef.current && (served === 'oma' || served === 'workdrive')) {
        adoptingSource.current = true;
        setStorageSource(served);
        persistSource(served);
      }
      setBrowsing(false);
    },
    [brandId, kind],
  );

  useEffect(() => {
    if (!open || !brandId || !sourceReady) return;
    if (adoptingSource.current) {
      adoptingSource.current = false;
      return;
    }
    setTrail([]);
    setBrowse(null);
    void loadRoot();
  }, [open, brandId, kind, sourceReady, storageSource, loadRoot]);

  // 3) A folder: one request, newest files first; its subfolders replace the tabs.
  const showFolder = useCallback(
    async (nextTrail: FolderCrumb[], opts?: { fresh?: boolean; trustPath?: boolean }) => {
      if (!brandId) return;
      const current = nextTrail[nextTrail.length - 1];
      const seq = ++folderSeq.current;
      setTrail(nextTrail);
      setVisibleGridCount(GRID_RENDER_STEP);
      setError(null);
      if (!current) {
        setBrowse(null);
        setBrowsing(false);
        return;
      }
      setBrowsing(true);
      try {
        const r = await mediaApi.browse(
          brandId,
          kind,
          current.id,
          treeRef.current,
          sourceRef.current ?? undefined,
          { ...page, skipCache: opts?.fresh },
        );
        if (seq !== folderSeq.current) return;
        childFolders.current.set(r.data.folder.id, r.data.folders);
        setBrowse(r.data);
        if (opts?.trustPath) {
          const fromPath = trailFromPath(r.data.path, root?.folder.id, labelFor);
          if (fromPath.length) setTrail(fromPath);
        }
      } catch (e) {
        if (seq === folderSeq.current) setError(getApiError(e).message);
      } finally {
        if (seq === folderSeq.current) setBrowsing(false);
      }
    },
    [brandId, kind, labelFor, root?.folder.id],
  );

  const openFolder = (f: FolderCrumb) => void showFolder(enterFolder(trail, f));
  const goBack = () => void showFolder(trailBack(trail));
  const goCrumb = (index: number) => void showFolder(trailUpTo(trail, index));
  const goRoot = () => void showFolder([]);
  const prefetchFolder = (f: FolderCrumb) => {
    if (!brandId) return;
    void mediaApi
      .browse(brandId, kind, f.id, treeRef.current, sourceRef.current ?? undefined, page)
      .then((r) => childFolders.current.set(r.data.folder.id, r.data.folders))
      .catch(() => undefined);
  };

  const tabs = useMemo(() => {
    const current = trail[trail.length - 1];
    const parent = trail.length > 1 ? trail[trail.length - 2] : null;
    return folderTabs({
      trail,
      rootFolders: toCrumbs(root?.folders),
      currentFolders:
        current && browse?.folder.id === current.id
          ? toCrumbs(browse.folders)
          : current
            ? (() => {
                const cached = childFolders.current.get(current.id);
                return cached ? toCrumbs(cached) : null;
              })()
            : null,
      parentFolders: parent
        ? (() => {
            const cached = childFolders.current.get(parent.id);
            return cached ? toCrumbs(cached) : null;
          })()
        : null,
    });
  }, [browse, root?.folders, toCrumbs, trail]);

  // 4) Progressive loading: next page of the open folder, or of "All media" then root files.
  const loadMore = useCallback(async () => {
    if (!brandId || loadingMore) return;
    const src = sourceRef.current ?? undefined;
    const inFolder = trail.length > 0;
    const target = inFolder
      ? browse?.files_has_more
        ? ('folder' as const)
        : null
      : allFiles?.files_has_more
        ? ('all' as const)
        : root?.files_has_more
          ? ('root' as const)
          : null;
    if (!target) return;
    const base = target === 'folder' ? browse! : target === 'all' ? allFiles! : root!;
    const nextOffset = (base.file_offset ?? 0) + base.files.length;
    const folderSeqAt = folderSeq.current;
    const rootSeqAt = rootSeq.current;
    setLoadingMore(true);
    try {
      const r = await mediaApi.browse(
        brandId,
        kind,
        target === 'folder' ? base.folder.id : undefined,
        target === 'all' ? 'all' : target === 'root' ? treeRef.current : treeRef.current,
        src,
        { file_limit: BROWSE_FILE_LIMIT, file_offset: nextOffset, skipCache: true },
      );
      const merge = (prev: WorkDriveBrowse | null) =>
        prev
          ? {
              ...prev,
              files: [...prev.files, ...r.data.files],
              files_has_more: r.data.files_has_more,
              files_total: r.data.files_total,
            }
          : r.data;
      if (target === 'folder') {
        if (folderSeqAt === folderSeq.current) setBrowse(merge);
      } else if (rootSeqAt === rootSeq.current) {
        if (target === 'all') setAllFiles(merge);
        else setRoot(merge);
      }
    } catch (e) {
      setError(getApiError(e).message);
    } finally {
      setLoadingMore(false);
    }
  }, [allFiles, brandId, browse, kind, loadingMore, root, trail.length]);

  const viewHasMore = trail.length
    ? Boolean(browse?.files_has_more)
    : Boolean(allFiles?.files_has_more || root?.files_has_more);

  useEffect(() => {
    const node = gridSentinelRef.current;
    if (!open || !node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisibleGridCount((n) => n + GRID_RENDER_STEP);
        if (viewHasMore) void loadMore();
      },
      { rootMargin: '240px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [open, viewHasMore, loadMore]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!sortOpen && !filtersOpen && !createOpen) return;
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (sortOpen && sortRef.current && !sortRef.current.contains(node)) setSortOpen(false);
      if (filtersOpen && filterRef.current && !filterRef.current.contains(node))
        setFiltersOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [sortOpen, filtersOpen, createOpen]);

  const storageReady = Boolean(
    lib?.workdrive.can_upload || lib?.workdrive.internal_available || lib?.workdrive.connected,
  );
  const sourceAvailability =
    root?.available_sources ??
    lib?.workdrive.available_sources ??
    (workspaceStorage
      ? {
          oma: workspaceStorage.internal_available,
          workdrive: workspaceStorage.byos_connected,
        }
      : undefined);
  const omaUsable = Boolean(sourceAvailability?.oma ?? lib?.workdrive.internal_available);
  const workdriveUsable = Boolean(
    sourceAvailability?.workdrive ?? lib?.workdrive.byos_connected ?? lib?.workdrive.connected,
  );
  // Both stores are always offered; an unavailable one explains itself instead of hiding.
  const showSourceToggle = omaUsable || workdriveUsable;
  const sourceBlocked =
    storageSource === 'oma' && !omaUsable && lib
      ? t('errors.storage_oma_unavailable')
      : storageSource === 'workdrive' && !workdriveUsable && lib
        ? t('errors.storage_workdrive_unavailable')
        : null;
  const selectSource = (next: MediaSource) => {
    if (!brandId || storageSource === next) return;
    const usable = next === 'oma' ? omaUsable : workdriveUsable;
    if (!usable) {
      if (next === 'workdrive' && canConnect) openSettings('storage');
      else
        setError(
          t(
            next === 'oma'
              ? 'errors.storage_oma_unavailable'
              : 'errors.storage_workdrive_unavailable',
          ),
        );
      return;
    }
    setRoot(null);
    setAllFiles(null);
    setBrowse(null);
    setTrail([]);
    setError(null);
    childFolders.current.clear();
    setVisibleGridCount(GRID_RENDER_STEP);
    persistSource(next);
    setStorageSource(next);
    void workDriveApi
      .storage()
      .then((r) => setWorkspaceStorage(r.data))
      .catch(() => undefined);
  };

  const refreshView = async () => {
    if (!brandId) return;
    invalidateMediaCache(brandId);
    void workDriveApi
      .storage()
      .then((r) => setWorkspaceStorage(r.data))
      .catch(() => undefined);
    if (trail.length) await showFolder(trail, { fresh: true });
    else await loadRoot({ fresh: true });
  };

  const items = useMemo(() => {
    const files = trail.length
      ? (browse?.files ?? [])
      : [...(allFiles?.files ?? []), ...(root?.files ?? [])];
    const seen = new Set<string>();
    const mapped: GridItem[] = [];
    for (const f of files) {
      const item = fileToItem(f, brandId || '', kind, storageSource ?? undefined);
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      mapped.push(item);
    }
    const q = query.trim().toLowerCase();
    return mapped
      .filter((item) => {
        if (q && !item.name.toLowerCase().includes(q)) return false;
        if (usage.size) {
          const used = item.usageCount > 0;
          const deleted = item.missing;
          const unused = !used && !deleted;
          if (!(
            (usage.has('used') && used) ||
            (usage.has('unused') && unused) ||
            (usage.has('deleted') && deleted)
          ))
            return false;
        }
        if (types.size) {
          const tp = typeOf(item.mime);
          if (!tp || !types.has(tp)) return false;
        }
        if (campaigns.size) {
          const none = campaigns.has('__none__') && item.campaignIds.length === 0;
          const hit = item.campaignIds.some((id) => campaigns.has(id));
          if (!none && !hit) return false;
        }
        if (uploaders.size && (!item.uploaderId || !uploaders.has(item.uploaderId))) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        const at = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
        return sort === 'oldest' ? at - bt : bt - at;
      });
  }, [
    allFiles,
    browse,
    root,
    trail.length,
    brandId,
    kind,
    query,
    usage,
    types,
    campaigns,
    uploaders,
    sort,
    storageSource,
  ]);

  const facets =
    (trail.length ? browse?.filter_facets : allFiles?.filter_facets) || root?.filter_facets;
  const filterCount = usage.size + types.size + campaigns.size + uploaders.size;
  const visibleItems = items.slice(0, visibleGridCount);
  const viewingWorkDrive = storageSource === 'workdrive';
  const quotaUsedBytes =
    workspaceStorage?.used_bytes ?? lib?.storage_used_bytes ?? root?.storage_used_bytes ?? 0;
  const quotaLimit = viewingWorkDrive
    ? null
    : (workspaceStorage?.limit_bytes ??
      lib?.storage_limit_bytes ??
      root?.storage_limit_bytes ??
      null);
  const quotaView = storageUsageView(quotaUsedBytes, quotaLimit);
  const quotaPct = !viewingWorkDrive && !quotaView.unlimited ? quotaView.barPct : null;
  const quotaLabel = viewingWorkDrive ? t('media.quotaByos') : storageUsageLabel(quotaView, locale);

  const currentFolderId = trail.length ? trail[trail.length - 1]!.id : null;
  const uploadToFolderId = currentFolderId;

  const upload = async (file: File) => {
    if (!brandId || !lib) return;
    const max =
      (file.type.startsWith('video/') ? lib.workdrive.max_video_mb : lib.workdrive.max_image_mb) *
      1048576;
    if (file.size > max) {
      setError(t('media.tooLarge').replace('{max}', formatBytes(max, locale)));
      return;
    }
    setError(null);
    abort.current = new AbortController();
    setProgress({ name: file.name, value: 0 });
    try {
      const a = await mediaApi.upload(
        brandId,
        kind,
        file,
        (v) => setProgress({ name: file.name, value: v }),
        abort.current.signal,
        uploadToFolderId,
        storageSource ?? undefined,
      );
      onPick(a);
      if (variant === 'drawer') onClose();
      else await refreshView();
    } catch (e) {
      if ((e as { code?: string }).code !== 'ABORTED') setError(getApiError(e).message);
    } finally {
      setProgress(null);
    }
  };

  const pickFile = async (item: GridItem) => {
    if (!brandId || item.missing) return;
    try {
      if (item.asset) {
        onPick(item.asset);
        if (variant === 'drawer') onClose();
        return;
      }
      const r = await mediaApi.importFile(brandId, kind, item.fileId, storageSource ?? undefined);
      onPick(r.data);
      if (variant === 'drawer') onClose();
    } catch (e) {
      setError(getApiError(e).message);
    }
  };

  const createFolder = async () => {
    if (!brandId || !folderName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const parentId = currentFolderId ?? root?.folder.id ?? brandFolder?.id;
      await mediaApi.createFolder(brandId, {
        name: folderName.trim(),
        parent_id: parentId,
        scope: treeScope,
        kind,
        source: storageSource ?? undefined,
      });
      setFolderName('');
      setCreateOpen(false);
      await refreshView();
    } catch (e) {
      setError(getApiError(e).message);
    } finally {
      setCreating(false);
    }
  };

  const toggleSet = <T,>(set: Set<T>, value: T, write: (next: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    write(next);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  const hideCanvaBanner = () => {
    setHideCanva(true);
    try {
      sessionStorage.setItem(CANVA_HIDE_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const connectCanva = async () => {
    if (!brandId) return;
    if (!storageReady) {
      openSettings('storage');
      return;
    }
    if (sourceBlocked) {
      setError(sourceBlocked);
      return;
    }
    setCanvaBusy(true);
    setError(null);
    try {
      const src: 'oma' | 'workdrive' | undefined =
        storageSource ??
        (workspaceStorage?.mode === 'USER_WORKDRIVE' && workspaceStorage.byos_connected
          ? 'workdrive'
          : 'oma');
      const kindFolder = kind === 'deliverables' ? 'deliverables' : 'posts';
      const brandBrowse = (
        await mediaApi.browse(brandId, kind, undefined, 'brand', src, {
          file_limit: 1,
          file_offset: 0,
        })
      ).data;
      const postsFolder = brandBrowse.folders.find((f) => f.name === kindFolder);
      const parentId = postsFolder?.id ?? brandBrowse.brand_folder?.id ?? brandBrowse.folder.id;
      const inside = await mediaApi.browse(brandId, kind, parentId, 'brand', src, {
        file_limit: 1,
        file_offset: 0,
      });
      let canvaFolder = inside.data.folders.find((f) => f.name.toLowerCase() === 'canva');
      if (!canvaFolder) {
        const created = await mediaApi.createFolder(brandId, {
          name: 'Canva',
          parent_id: parentId,
          scope: 'brand',
          kind,
          source: src,
        });
        canvaFolder = { id: created.data.id, name: created.data.name ?? 'Canva' };
      }
      invalidateMediaCache(brandId);
      await showFolder([{ id: canvaFolder.id, label: 'Canva' }], { fresh: true, trustPath: true });
      setCanvaHint(
        viewingWorkDrive || src === 'workdrive'
          ? t('media.canvaWorkdriveHint')
          : t('media.canvaOmaHint'),
      );
      requestAnimationFrame(() => {
        document.querySelector('[data-testid="media-canva-hint"]')?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });
    } catch (e) {
      setError(getApiError(e).message);
    } finally {
      setCanvaBusy(false);
    }
  };

  const sortLabel =
    sort === 'oldest'
      ? t('media.oldestFirst')
      : sort === 'name'
        ? t('media.sortName')
        : t('media.latestFirst');

  const body = !brandId ? (
    <p className="oma-mp-empty">{t('media.pickBrandFirst')}</p>
  ) : !lib ? (
    error ? (
      <p className="oma-bs-notice oma-bs-notice--error" role="alert">
        {error}
      </p>
    ) : (
      <MediaShimmer />
    )
  ) : !storageReady ? (
    <div className="oma-mp-connect" data-testid="media-connect-workdrive">
      <strong>{t('media.connectTitle')}</strong>
      <p>{lib.workdrive.available ? t('media.connectBody') : t('workdrive.notEnabled')}</p>
      {lib.workdrive.available ? (
        canConnect ? (
          <button
            type="button"
            className="oma-ml-btn oma-ml-btn--primary"
            onClick={() => openSettings('storage')}
          >
            {t('media.connectCta')}
          </button>
        ) : (
          <p className="oma-bs-hint">{t('media.askAdmin')}</p>
        )
      ) : null}
    </div>
  ) : (
    <>
      {error && error !== sourceBlocked ? (
        <p className="oma-bs-notice oma-bs-notice--error" role="alert">
          {error}
        </p>
      ) : null}
      {canvaHint ? (
        <p className="oma-bs-hint" data-testid="media-canva-hint">
          {canvaHint}
        </p>
      ) : null}
      {!hideCanva ? (
        <div className="oma-ml-canva" data-testid="media-canva-banner">
          <span className="oma-ml-canva__mark" aria-hidden>
            C
          </span>
          <span className="oma-ml-canva__copy">{t('media.canvaBanner')}</span>
          <button type="button" className="oma-ml-canva__link" onClick={hideCanvaBanner}>
            {t('media.canvaHide')}
          </button>
          <button
            type="button"
            className="oma-ml-canva__link"
            disabled={canvaBusy}
            data-testid="media-canva-connect"
            onClick={() => void connectCanva()}
          >
            {canvaBusy ? t('media.loadingMore') : t('media.canvaConnect')}
          </button>
        </div>
      ) : null}

      <div className="oma-ml-source-row">
        {showSourceToggle ? (
          <div
            className="oma-ml-source"
            data-testid="media-source-toggle"
            role="radiogroup"
            aria-label={t('media.sourceLabel')}
          >
            <button
              type="button"
              role="radio"
              data-testid="media-source-oma"
              data-active={storageSource !== 'workdrive' ? 'true' : 'false'}
              aria-checked={storageSource !== 'workdrive'}
              aria-disabled={!omaUsable}
              data-unavailable={omaUsable ? undefined : 'true'}
              title={omaUsable ? undefined : t('errors.storage_oma_unavailable')}
              onClick={() => selectSource('oma')}
            >
              {t('media.sourceOma')}
            </button>
            <button
              type="button"
              role="radio"
              data-testid="media-source-workdrive"
              data-active={storageSource === 'workdrive' ? 'true' : 'false'}
              aria-checked={storageSource === 'workdrive'}
              aria-disabled={!workdriveUsable}
              data-unavailable={workdriveUsable ? undefined : 'true'}
              title={workdriveUsable ? undefined : t('media.sourceConnectWorkDrive')}
              onClick={() => selectSource('workdrive')}
            >
              {t('media.sourceWorkDrive')}
            </button>
          </div>
        ) : null}
        <p className="oma-ml-source-status" data-testid="media-source-badge">
          {storageSource === 'workdrive' ? t('media.viewingWorkDrive') : t('media.viewingOma')}
        </p>
        {quotaLabel ? (
          <div className="oma-ml-quota" data-testid="media-storage-quota">
            <p>{quotaLabel}</p>
            {quotaPct != null ? (
              <span className="oma-ml-progress__bar" aria-hidden>
                <span style={{ width: `${quotaPct}%` }} />
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {sourceBlocked ? (
        <p
          className="oma-bs-notice oma-bs-notice--error"
          role="alert"
          data-testid="media-source-blocked"
        >
          {sourceBlocked}
        </p>
      ) : null}

      <div className="oma-ml-toolbar">
        <button
          type="button"
          className="oma-ml-btn"
          data-testid="media-dropzone"
          disabled={Boolean(progress) || Boolean(sourceBlocked)}
          onClick={() => fileInput.current?.click()}
        >
          <UploadOutlined />
          {t('media.upload')}
        </button>
        <div className="oma-ml-newfolder">
          <button
            type="button"
            className="oma-ml-iconbtn"
            aria-label={t('media.newFolder')}
            data-testid="media-create-folder"
            onClick={() => setCreateOpen((v) => !v)}
          >
            <FolderAddOutlined />
          </button>
          {createOpen ? (
            <div className="oma-ml-pop oma-ml-pop--create" data-testid="media-create-folder-pop">
              <input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder={t('media.folderName')}
                aria-label={t('media.folderName')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void createFolder();
                  if (e.key === 'Escape') setCreateOpen(false);
                }}
                autoFocus
              />
              <button
                type="button"
                className="oma-ml-btn oma-ml-btn--primary"
                disabled={creating || !folderName.trim()}
                onClick={() => void createFolder()}
              >
                {t('media.createFolder')}
              </button>
            </div>
          ) : null}
        </div>
        <div className="oma-ml-toolbar__end">
          <div className="oma-ml-sort" ref={sortRef}>
            <button
              type="button"
              className="oma-ml-ghost"
              data-testid="media-sort"
              aria-expanded={sortOpen}
              onClick={() => {
                setSortOpen((v) => !v);
                setFiltersOpen(false);
              }}
            >
              {sortLabel}
              <DownOutlined />
            </button>
            {sortOpen ? (
              <div className="oma-ml-pop" role="menu">
                {(
                  [
                    ['latest', t('media.latestFirst')],
                    ['oldest', t('media.oldestFirst')],
                    ['name', t('media.sortName')],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="menuitem"
                    data-active={sort === key ? 'true' : 'false'}
                    onClick={() => {
                      setSort(key);
                      setSortOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="oma-ml-filters" ref={filterRef}>
            <button
              type="button"
              className="oma-ml-ghost"
              data-testid="media-filters"
              data-active={filtersOpen || filterCount > 0 ? 'true' : 'false'}
              aria-expanded={filtersOpen}
              onClick={() => {
                setFiltersOpen((v) => !v);
                setSortOpen(false);
              }}
            >
              {t('media.filters')}
              {filterCount ? <span className="oma-ml-count">{filterCount}</span> : null}
            </button>
            {filtersOpen ? (
              <div className="oma-ml-pop oma-ml-pop--filters" data-testid="media-filters-pop">
                <strong>{t('media.filters')}</strong>
                <p>{t('media.usage')}</p>
                <div className="oma-ml-chips">
                  {(
                    [
                      ['used', t('media.used')],
                      ['unused', t('media.unused')],
                      ['deleted', t('media.deleted')],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      data-on={usage.has(key) ? 'true' : 'false'}
                      onClick={() => toggleSet(usage, key, setUsage)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p>{t('media.type')}</p>
                <div className="oma-ml-chips">
                  {(
                    [
                      ['image', t('media.typeImage')],
                      ['video', t('media.typeVideo')],
                      ['gif', t('media.typeGif')],
                      ['pdf', t('media.typePdf')],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      data-on={types.has(key) ? 'true' : 'false'}
                      onClick={() => toggleSet(types, key, setTypes)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p>{t('media.campaign')}</p>
                <div className="oma-ml-chips">
                  <button
                    type="button"
                    data-on={campaigns.has('__none__') ? 'true' : 'false'}
                    onClick={() => toggleSet(campaigns, '__none__', setCampaigns)}
                  >
                    {t('media.noCampaign')}
                  </button>
                  {(facets?.campaigns ?? []).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      data-on={campaigns.has(c.id) ? 'true' : 'false'}
                      onClick={() => toggleSet(campaigns, c.id, setCampaigns)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <p>{t('media.uploader')}</p>
                <div className="oma-ml-chips">
                  {(facets?.uploaders ?? []).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      data-on={uploaders.has(u.id) ? 'true' : 'false'}
                      onClick={() => toggleSet(uploaders, u.id, setUploaders)}
                    >
                      {uploaders.has(u.id) ? <CheckOutlined /> : null}
                      {u.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          hidden
          accept={ACCEPT[kind]}
          data-testid="media-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void upload(f);
          }}
        />
      </div>

      {progress ? (
        <div className="oma-ml-progress">
          <span>{progress.name}</span>
          <span className="oma-ml-progress__bar">
            <span style={{ width: `${Math.round(progress.value * 100)}%` }} />
          </span>
          <button type="button" className="oma-ml-ghost" onClick={() => abort.current?.abort()}>
            {t('common.cancel')}
          </button>
        </div>
      ) : null}

      {brandId ? (
        <MediaFolderNav
          rootLabel={
            root
              ? labelFor(root.folder.id, root.folder.name, root.folder.label)
              : t('media.workspaceRoot')
          }
          trail={trail}
          tabs={tabs}
          browsing={browsing}
          onRoot={goRoot}
          onCrumb={goCrumb}
          onOpen={openFolder}
          onBack={goBack}
          onPrefetch={prefetchFolder}
          t={t}
        />
      ) : null}
      <div
        className="oma-ml-gridwrap"
        data-testid="media-browser"
        aria-busy={browsing}
        data-loading={browsing ? 'true' : 'false'}
      >
        {browsing && !items.length ? (
          <MediaShimmer rows={6} />
        ) : items.length ? (
          <>
            <div className="oma-ml-grid" data-testid="media-files">
              {visibleItems.map((item, index) => {
                const badge = usageLabel(item.usageCount, t);
                return (
                  <button
                    key={item.key}
                    type="button"
                    className="oma-ml-item"
                    data-testid="media-browser-file"
                    disabled={item.missing}
                    title={item.missing ? t('media.missing') : item.name}
                    onClick={() => void pickFile(item)}
                  >
                    <LazyMediaThumb item={item} t={t} badge={badge} eager={index < 24} />
                    <span className="oma-ml-item__name">{item.name}</span>
                  </button>
                );
              })}
            </div>
            {visibleGridCount < items.length || viewHasMore ? (
              <div
                ref={gridSentinelRef}
                className="oma-ml-grid-sentinel"
                data-testid="media-grid-sentinel"
                aria-hidden
              />
            ) : null}
            {loadingMore ? (
              <p className="oma-bs-hint" data-testid="media-loading-more">
                {t('media.loadingMore')}
              </p>
            ) : null}
          </>
        ) : (
          <p className="oma-mp-empty">
            {query.trim() ? t('media.emptySearch') : t('media.emptyFolder')}
          </p>
        )}
      </div>
    </>
  );

  const panel = (
    <aside
      className={`oma-ml ${variant === 'panel' ? 'oma-ml--panel' : 'oma-ml--drawer'}${variant === 'panel' && panelExpanded ? ' oma-ml--expanded' : ''}`}
      data-testid="media-picker"
      data-open={open ? 'true' : 'false'}
      aria-hidden={!open}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f && !progress && storageReady) void upload(f);
      }}
    >
      <header className="oma-ml-head">
        {searchOpen ? (
          <>
            <label className="oma-ml-search">
              <SearchOutlined />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('media.searchAssets')}
                aria-label={t('media.searchAssets')}
                data-testid="media-search"
              />
            </label>
            <button type="button" className="oma-ml-textbtn" onClick={closeSearch}>
              {t('media.cancelSearch')}
            </button>
          </>
        ) : (
          <>
            <h2>{t('media.title')}</h2>
            <button
              type="button"
              className="oma-ml-iconbtn"
              aria-label={t('media.searchAssets')}
              onClick={() => setSearchOpen(true)}
            >
              <SearchOutlined />
            </button>
            {variant === 'panel' ? (
              <button
                type="button"
                className="oma-ml-iconbtn"
                data-testid="media-panel-expand"
                aria-label={panelExpanded ? t('media.shrinkPanel') : t('media.expandPanel')}
                aria-pressed={panelExpanded}
                onClick={() => setPanelExpanded((v) => !v)}
              >
                {panelExpanded ? <ShrinkPanelOutlined /> : <ExpandPanelOutlined />}
              </button>
            ) : null}
          </>
        )}
        <button
          type="button"
          className="oma-ml-iconbtn"
          aria-label={t('common.close')}
          onClick={() => {
            abort.current?.abort();
            setPanelExpanded(false);
            onClose();
          }}
        >
          <CloseOutlined />
        </button>
      </header>
      <div className="oma-ml-body">{open ? body : null}</div>
    </aside>
  );

  if (variant === 'panel') return panel;
  if (typeof document === 'undefined' || !open) return null;
  return createPortal(
    <div className="oma-ml-overlay" data-open="true">
      <button
        type="button"
        className="oma-ml-overlay__mask"
        aria-label={t('common.close')}
        onClick={() => {
          abort.current?.abort();
          onClose();
        }}
      />
      {panel}
    </div>,
    document.body,
  );
}
