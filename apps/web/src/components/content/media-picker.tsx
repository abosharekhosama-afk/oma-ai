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
import { MediaFolderTree } from './media-folder-tree';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

type Tr = (key: string) => string;
type Scope = 'brand' | 'organization' | 'all';
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
const SOURCE_KEY = 'oma-ml-source';
const BROWSE_FILE_LIMIT = 48;
const ASSET_LIST_LIMIT = 32;
const GRID_RENDER_STEP = 36;

function readStoredSource(): 'oma' | 'workdrive' | null {
  if (typeof window === 'undefined') return null;
  try {
    const q = new URL(window.location.href).searchParams.get('media_source');
    if (q === 'oma' || q === 'workdrive') return q;
    const stored = sessionStorage.getItem(SOURCE_KEY);
    if (stored === 'oma' || stored === 'workdrive') return stored;
  } catch {
    /* ignore */
  }
  return null;
}

function persistSource(next: 'oma' | 'workdrive') {
  try {
    sessionStorage.setItem(SOURCE_KEY, next);
  } catch {
    /* ignore */
  }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('media_source') === next) return;
    url.searchParams.set('media_source', next);
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch {
    /* ignore */
  }
}

function assetSource(asset: MediaAsset): 'oma' | 'workdrive' | null {
  if (asset.storage_provider === 'OMA_INTERNAL') return 'oma';
  if (asset.storage_provider === 'USER_WORKDRIVE') return 'workdrive';
  return null;
}

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

function mosaicHue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h + name.charCodeAt(i) * 17) % 360;
  return h;
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
  const asset: MediaAsset | null = file.asset_id
    ? {
        id: file.asset_id,
        brand_id: brandId,
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

function assetToItem(asset: MediaAsset): GridItem {
  return {
    key: asset.id,
    name: asset.name,
    mime: asset.mime,
    viewUrl: asset.view_url,
    streamUrl: asset.stream_url,
    usageCount: 0,
    missing: asset.missing,
    createdAt: asset.created_at,
    campaignIds: [],
    uploaderId: null,
    uploaderName: null,
    fileId: asset.id,
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

function FolderMosaic({
  name,
  thumbs,
  selected,
}: {
  name: string;
  thumbs: string[];
  selected: boolean;
}) {
  const hue = mosaicHue(name);
  const tiles = thumbs.slice(0, 4);
  return (
    <span className="oma-ml-mosaic" data-selected={selected ? 'true' : 'false'}>
      {tiles.length
        ? tiles.map((src) => (
            <span key={src} className="oma-ml-mosaic__tile">
              <img src={src} alt="" />
            </span>
          ))
        : [0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="oma-ml-mosaic__tile"
              style={{ background: `hsl(${(hue + i * 28) % 360} 62% 72%)` }}
            />
          ))}
      {selected ? (
        <span className="oma-ml-mosaic__check" aria-hidden>
          <CheckOutlined />
        </span>
      ) : null}
    </span>
  );
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
}: {
  open: boolean;
  brandId: string | null;
  kind?: MediaKind;
  t: Tr;
  locale: string;
  canConnect: boolean;
  onClose: () => void;
  onPick: (asset: MediaAsset) => void;
  variant?: 'drawer' | 'panel';
}) {
  const [lib, setLib] = useState<MediaLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orgRoot, setOrgRoot] = useState<WorkDriveBrowse | null>(null);
  const [brandRoot, setBrandRoot] = useState<WorkDriveBrowse | null>(null);
  const [browse, setBrowse] = useState<WorkDriveBrowse | null>(null);
  const [storageSource, setStorageSource] = useState<'oma' | 'workdrive' | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [scope, setScope] = useState<Scope>('organization');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
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
  const [browseLoadingMore, setBrowseLoadingMore] = useState(false);
  const [assetsLoadingMore, setAssetsLoadingMore] = useState(false);
  const [workspaceStorage, setWorkspaceStorage] = useState<WorkspaceStorage | null>(null);
  const [canvaBusy, setCanvaBusy] = useState(false);
  const [canvaHint, setCanvaHint] = useState<string | null>(null);

  useEffect(() => {
    try {
      setHideCanva(sessionStorage.getItem(CANVA_HIDE_KEY) === '1');
    } catch {
      /* ignore */
    }
    setStorageSource((cur) => cur ?? readStoredSource());
    setSourceReady(true);
  }, []);

  const loadLibrary = useCallback(
    async (opts?: { append?: boolean; cursor?: string | null }) => {
      if (!brandId) return;
      setError(null);
      try {
        const r = await mediaApi.list(brandId, kind, storageSource ?? undefined, {
          limit: ASSET_LIST_LIMIT,
          cursor: opts?.append ? opts.cursor : undefined,
        });
        setLib((prev) =>
          opts?.append && prev
            ? {
                ...r.data,
                assets: [...prev.assets, ...r.data.assets],
              }
            : r.data,
        );
      } catch (e) {
        setError(getApiError(e).message);
      }
    },
    [brandId, kind, storageSource],
  );

  const openFolder = useCallback(
    async (nextScope: Scope, folderId?: string) => {
      if (!brandId) return;
      setBrowsing(true);
      setError(null);
      setVisibleGridCount(GRID_RENDER_STEP);
      try {
        const r = await mediaApi.browse(
          brandId,
          kind,
          folderId,
          nextScope,
          storageSource ?? undefined,
          { file_limit: BROWSE_FILE_LIMIT, file_offset: 0 },
        );
        setBrowse(r.data);
        if (!storageSource && (r.data.source === 'oma' || r.data.source === 'workdrive')) {
          setStorageSource(r.data.source);
          persistSource(r.data.source);
        }
        setScope(nextScope);
        setSelectedFolderId(folderId || r.data.folder.id);
        if (nextScope === 'organization' && !folderId) setOrgRoot(r.data);
        if (nextScope === 'brand' && !folderId) setBrandRoot(r.data);
        if (r.data.brand_folder && nextScope === 'brand' && !folderId) setBrandRoot(r.data);
      } catch (e) {
        if (nextScope === 'organization') {
          try {
            const r = await mediaApi.browse(
              brandId,
              kind,
              folderId,
              'brand',
              storageSource ?? undefined,
              { file_limit: BROWSE_FILE_LIMIT, file_offset: 0 },
            );
            setBrowse(r.data);
            setScope('brand');
            setSelectedFolderId(folderId || r.data.folder.id);
            setBrandRoot(r.data);
            setError(null);
            return;
          } catch (inner) {
            setError(getApiError(inner).message);
            return;
          }
        }
        setError(getApiError(e).message);
      } finally {
        setBrowsing(false);
      }
    },
    [brandId, kind, storageSource],
  );

  const reloadBrowseRoots = useCallback(
    async (src?: 'oma' | 'workdrive') => {
      if (!brandId) return;
      setBrowsing(true);
      setVisibleGridCount(GRID_RENDER_STEP);
      setError(null);
      try {
        const page = { file_limit: BROWSE_FILE_LIMIT, file_offset: 0 };
        const [org, brand] = await Promise.allSettled([
          mediaApi.browse(brandId, kind, undefined, 'organization', src, page),
          mediaApi.browse(brandId, kind, undefined, 'brand', src, page),
        ]);
        if (brand.status === 'fulfilled') setBrandRoot(brand.value.data);
        if (org.status === 'fulfilled') {
          setOrgRoot(org.value.data);
          setBrowse(org.value.data);
          setScope('organization');
          setSelectedFolderId(org.value.data.folder.id);
        } else if (brand.status === 'fulfilled') {
          setBrowse(brand.value.data);
          setScope('brand');
          setSelectedFolderId(brand.value.data.folder.id);
        }
        if (org.status === 'rejected' && brand.status === 'rejected') {
          setError(getApiError(org.reason).message);
        }
      } catch (e) {
        setError(getApiError(e).message);
      } finally {
        setBrowsing(false);
      }
    },
    [brandId, kind],
  );

  const loadMoreBrowseFiles = useCallback(async () => {
    if (!brandId || !browse?.files_has_more || browseLoadingMore) return;
    const nextOffset = (browse.file_offset ?? 0) + browse.files.length;
    setBrowseLoadingMore(true);
    try {
      const browseScope: Scope = scope === 'all' ? 'all' : scope;
      const folderParam =
        scope === 'all' || selectedFolderId === '__all__'
          ? undefined
          : selectedFolderId || undefined;
      const r = await mediaApi.browse(
        brandId,
        kind,
        folderParam,
        browseScope,
        storageSource ?? undefined,
        { file_limit: BROWSE_FILE_LIMIT, file_offset: nextOffset, skipCache: true },
      );
      setBrowse((prev) =>
        prev
          ? {
              ...r.data,
              files: [...prev.files, ...r.data.files],
              files_has_more: r.data.files_has_more,
              files_total: r.data.files_total,
              file_offset: prev.file_offset ?? 0,
            }
          : r.data,
      );
    } catch (e) {
      setError(getApiError(e).message);
    } finally {
      setBrowseLoadingMore(false);
    }
  }, [brandId, kind, browse, browseLoadingMore, scope, storageSource, selectedFolderId]);

  useEffect(() => {
    if (!open || !brandId || !sourceReady) return;
    void (async () => {
      let browseSource: 'oma' | 'workdrive' | undefined = storageSource ?? undefined;
      try {
        const r = await workDriveApi.storage();
        setWorkspaceStorage(r.data);
        const stored = readStoredSource();
        let next: 'oma' | 'workdrive' | null = stored ?? storageSource;
        if (next === 'workdrive' && !r.data.byos_connected) next = 'oma';
        if (next === 'oma' && !r.data.internal_available && r.data.byos_connected) {
          next = 'workdrive';
        }
        if (!next) {
          next = r.data.mode === 'USER_WORKDRIVE' && r.data.byos_connected ? 'workdrive' : 'oma';
        }
        if (!r.data.internal_available && next === 'oma' && r.data.byos_connected) {
          next = 'workdrive';
        }
        if (next) {
          browseSource = next;
          setStorageSource(next);
          if (!stored) persistSource(next);
        }
      } catch {
        setWorkspaceStorage(null);
      }
      try {
        const libRes = await mediaApi.list(brandId, kind, browseSource, {
          limit: ASSET_LIST_LIMIT,
        });
        setLib(libRes.data);
      } catch (e) {
        setError(getApiError(e).message);
      }
      await reloadBrowseRoots(browseSource);
    })();
  }, [open, brandId, kind, storageSource, sourceReady, reloadBrowseRoots]);

  useEffect(() => {
    const node = gridSentinelRef.current;
    if (!open || !node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisibleGridCount((n) => n + GRID_RENDER_STEP);
        if (browse?.files_has_more) void loadMoreBrowseFiles();
        else if (lib?.next_cursor && !assetsLoadingMore) {
          setAssetsLoadingMore(true);
          void loadLibrary({ append: true, cursor: lib.next_cursor }).finally(() =>
            setAssetsLoadingMore(false),
          );
        }
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [
    open,
    browse?.files_has_more,
    lib?.next_cursor,
    loadMoreBrowseFiles,
    loadLibrary,
    assetsLoadingMore,
  ]);

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
  const showSourceToggle = Boolean(
    lib?.workdrive.internal_available && (lib.workdrive.byos_connected || lib.workdrive.connected),
  );
  const omaUsable = Boolean(lib?.workdrive.internal_available);
  const workdriveUsable = Boolean(lib?.workdrive.byos_connected || lib?.workdrive.connected);
  const sourceBlocked =
    storageSource === 'oma' && !omaUsable
      ? t('errors.storage_oma_unavailable')
      : storageSource === 'workdrive' && !workdriveUsable
        ? t('errors.storage_workdrive_unavailable')
        : null;
  const selectSource = (next: 'oma' | 'workdrive') => {
    if (!brandId || storageSource === next) return;
    setOrgRoot(null);
    setBrandRoot(null);
    setBrowse(null);
    setLib(null);
    setError(null);
    setVisibleGridCount(GRID_RENDER_STEP);
    setStorageSource(next);
    persistSource(next);
    if (brandId) invalidateMediaCache(brandId);
    void workDriveApi
      .storage()
      .then((r) => setWorkspaceStorage(r.data))
      .catch(() => setWorkspaceStorage(null));
    void mediaApi
      .list(brandId, kind, next, { limit: ASSET_LIST_LIMIT })
      .then((r) => setLib(r.data))
      .catch((e) => setError(getApiError(e).message));
    void reloadBrowseRoots(next);
  };
  const brandFolder = browse?.brand_folder || brandRoot?.brand_folder || orgRoot?.brand_folder;
  const allSelected = scope === 'all' || selectedFolderId === '__all__';
  const brandSelected = Boolean(
    !allSelected && brandFolder && selectedFolderId === brandFolder.id && scope === 'brand',
  );

  const breadcrumb = useMemo(() => {
    if (allSelected) return [{ id: '__all__', name: t('media.allAssets') }];
    return browse?.path?.length
      ? browse.path
      : [{ id: browse?.folder.id ?? '', name: browse?.folder.name ?? t('media.folder') }];
  }, [allSelected, browse, t]);

  const items = useMemo(() => {
    const atWorkspaceRoot =
      scope === 'organization' &&
      Boolean(orgRoot) &&
      !allSelected &&
      !brandSelected &&
      selectedFolderId === orgRoot?.folder.id;
    const source = allSelected ? browse : browse;
    let files = source?.files ?? [];
    if (atWorkspaceRoot && files.length === 0 && (brandRoot?.files?.length ?? 0) > 0) {
      files = brandRoot!.files;
    }
    const mapped = files.map((f) => fileToItem(f, brandId || '', kind, storageSource ?? undefined));
    const seen = new Set(mapped.map((i) => i.key));
    if ((allSelected || !brandSelected) && lib?.assets.length) {
      for (const a of lib.assets) {
        if (seen.has(a.id)) continue;
        const assetSrc = assetSource(a);
        if (storageSource && assetSrc && assetSrc !== storageSource && a.storage_provider != null)
          continue;
        seen.add(a.id);
        mapped.push(assetToItem(a));
      }
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
    allSelected,
    brandSelected,
    brandRoot,
    browse,
    lib,
    brandId,
    kind,
    query,
    usage,
    types,
    campaigns,
    uploaders,
    sort,
    storageSource,
    orgRoot,
    selectedFolderId,
    scope,
  ]);

  const facets = browse?.filter_facets || orgRoot?.filter_facets || brandRoot?.filter_facets;
  const filterCount = usage.size + types.size + campaigns.size + uploaders.size;
  const visibleItems = items.slice(0, visibleGridCount);
  const viewingWorkDrive = storageSource === 'workdrive';
  const quotaUsedBytes =
    workspaceStorage?.used_bytes ?? lib?.storage_used_bytes ?? browse?.storage_used_bytes ?? 0;
  const quotaLimit = viewingWorkDrive
    ? null
    : (workspaceStorage?.limit_bytes ??
      lib?.storage_limit_bytes ??
      browse?.storage_limit_bytes ??
      null);
  const quotaPct =
    !viewingWorkDrive && quotaLimit != null && quotaLimit > 0
      ? Math.min(100, (quotaUsedBytes / quotaLimit) * 100)
      : null;
  const quotaLabel = viewingWorkDrive
    ? t('media.quotaByos')
    : quotaLimit == null
      ? `${formatBytes(quotaUsedBytes, locale)} · ${t('storage.usage.unlimited')}`
      : t('storage.usage.of')
          .replace('{used}', formatBytes(quotaUsedBytes, locale))
          .replace('{limit}', formatBytes(quotaLimit, locale));

  const folderScope: 'brand' | 'organization' = scope === 'brand' ? 'brand' : 'organization';
  const uploadToFolderId = allSelected
    ? (orgRoot?.folder.id ?? brandFolder?.id ?? null)
    : brandSelected
      ? (brandRoot?.folders.find(
          (f) => f.name === (kind === 'deliverables' ? 'deliverables' : 'posts'),
        )?.id ?? brandFolder?.id)
      : (browse?.folder.id ?? null);

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
      else {
        void workDriveApi
          .storage()
          .then((r) => setWorkspaceStorage(r.data))
          .catch(() => undefined);
        await loadLibrary();
        await openFolder(scope, allSelected ? undefined : selectedFolderId || undefined);
      }
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
      const parentId =
        allSelected || selectedFolderId === '__all__'
          ? (orgRoot?.folder.id ?? brandFolder?.id)
          : selectedFolderId || browse?.folder.id;
      const created = await mediaApi.createFolder(brandId, {
        name: folderName.trim(),
        parent_id: parentId,
        scope: folderScope,
        kind,
        source: storageSource ?? undefined,
      });
      setFolderName('');
      setCreateOpen(false);
      await openFolder(scope, allSelected ? undefined : created.data.parent_id || parentId);
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
      let brandBrowse = brandRoot;
      if (!brandBrowse) {
        brandBrowse = (
          await mediaApi.browse(brandId, kind, undefined, 'brand', src, {
            file_limit: BROWSE_FILE_LIMIT,
            file_offset: 0,
          })
        ).data;
        setBrandRoot(brandBrowse);
      }
      const postsFolder = brandBrowse.folders.find((f) => f.name === kindFolder);
      const parentId = postsFolder?.id ?? brandBrowse.brand_folder?.id ?? brandBrowse.folder.id;
      const inside = await mediaApi.browse(brandId, kind, parentId, 'brand', src, {
        file_limit: BROWSE_FILE_LIMIT,
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
      setScope('brand');
      await openFolder('brand', canvaFolder.id);
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
            role="group"
            aria-label={t('media.sourceLabel')}
          >
            <button
              type="button"
              data-testid="media-source-oma"
              data-active={storageSource !== 'workdrive' ? 'true' : 'false'}
              onClick={() => selectSource('oma')}
            >
              {t('media.sourceOma')}
            </button>
            <button
              type="button"
              data-testid="media-source-workdrive"
              data-active={storageSource === 'workdrive' ? 'true' : 'false'}
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

      <div className="oma-ml-split">
        {brandId ? (
          <MediaFolderTree
            brandId={brandId}
            kind={kind}
            storageSource={storageSource}
            orgRoot={orgRoot}
            brandRoot={brandRoot}
            brandFolderId={brandFolder?.id}
            brandName={t('media.brandAssets')}
            workspaceLabel={lib?.workdrive.org_name ?? orgRoot?.root_name ?? null}
            browse={browse}
            selectedFolderId={selectedFolderId}
            allSelected={allSelected}
            browsing={browsing}
            onNavigate={(nextScope, folderId) => void openFolder(nextScope, folderId)}
            t={t}
          />
        ) : null}
        <div className="oma-ml-split__main">
          {!allSelected && breadcrumb.length > 1 ? (
            <nav
              className="oma-ml-crumb"
              aria-label={t('media.folderTree')}
              data-testid="media-breadcrumb"
            >
              {breadcrumb.map((crumb, idx) => (
                <span key={crumb.id} className="oma-ml-crumb__item">
                  {idx > 0 ? (
                    <span className="oma-ml-crumb__sep" aria-hidden>
                      /
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="oma-ml-crumb__btn"
                    disabled={idx === breadcrumb.length - 1}
                    onClick={() => {
                      if (crumb.id === '__all__') void openFolder('all');
                      else if (brandFolder && crumb.id === brandFolder.id)
                        void openFolder('brand', crumb.id);
                      else void openFolder('organization', crumb.id);
                    }}
                  >
                    <span dir="auto">{crumb.name}</span>
                  </button>
                </span>
              ))}
            </nav>
          ) : null}
          <div className="oma-ml-gridwrap" data-testid="media-browser" aria-busy={browsing}>
            {browsing && !browse && !items.length ? (
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
                {visibleGridCount < items.length || browse?.files_has_more || lib?.next_cursor ? (
                  <div
                    ref={gridSentinelRef}
                    className="oma-ml-grid-sentinel"
                    data-testid="media-grid-sentinel"
                    aria-hidden
                  />
                ) : null}
                {browseLoadingMore || assetsLoadingMore ? (
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
        </div>
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
