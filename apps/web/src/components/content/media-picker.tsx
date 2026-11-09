'use client';
import { openSettings } from '../../lib/settings-dialog';

import {
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  FolderAddOutlined,
  SearchOutlined,
  UploadOutlined,
} from '../ui/lucide-icons';
import { MediaSurface } from './media-surface';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getApiError } from '../../lib/brand-api';
import {
  formatBytes,
  mediaApi,
  type MediaAsset,
  type MediaKind,
  type MediaLibrary,
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

function fileToItem(file: WorkDriveBrowseFile, brandId: string, kind: MediaKind): GridItem {
  const view =
    file.view_url ||
    `/api/v1/brands/${brandId}/media/file-preview?file_id=${encodeURIComponent(file.id)}`;
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

  useEffect(() => {
    try {
      setHideCanva(sessionStorage.getItem(CANVA_HIDE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const loadLibrary = useCallback(async () => {
    if (!brandId) return;
    setError(null);
    try {
      const r = await mediaApi.list(brandId, kind);
      setLib(r.data);
    } catch (e) {
      setError(getApiError(e).message);
    }
  }, [brandId, kind]);

  const openFolder = useCallback(
    async (nextScope: Scope, folderId?: string) => {
      if (!brandId) return;
      setBrowsing(true);
      setError(null);
      try {
        const r = await mediaApi.browse(brandId, kind, folderId, nextScope);
        setBrowse(r.data);
        setScope(nextScope);
        setSelectedFolderId(folderId || r.data.folder.id);
        if (nextScope === 'organization' && !folderId) setOrgRoot(r.data);
        if (nextScope === 'brand' && !folderId) setBrandRoot(r.data);
        if (r.data.brand_folder && nextScope === 'brand' && !folderId) setBrandRoot(r.data);
      } catch (e) {
        if (nextScope === 'organization') {
          try {
            const r = await mediaApi.browse(brandId, kind, folderId, 'brand');
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
    [brandId, kind],
  );

  useEffect(() => {
    if (!open || !brandId) return;
    void loadLibrary();
    void (async () => {
      setBrowsing(true);
      try {
        const [org, brand] = await Promise.allSettled([
          mediaApi.browse(brandId, kind, undefined, 'organization'),
          mediaApi.browse(brandId, kind, undefined, 'brand'),
        ]);
        if (org.status === 'fulfilled') {
          setOrgRoot(org.value.data);
          setBrowse(org.value.data);
          setScope('organization');
          setSelectedFolderId(org.value.data.folder.id);
        }
        if (brand.status === 'fulfilled') {
          setBrandRoot(brand.value.data);
          if (org.status !== 'fulfilled') {
            setBrowse(brand.value.data);
            setScope('brand');
            setSelectedFolderId(brand.value.data.folder.id);
          }
        }
        if (org.status === 'rejected' && brand.status === 'rejected') {
          setError(getApiError(org.reason).message);
        }
      } finally {
        setBrowsing(false);
      }
    })();
  }, [open, brandId, kind, loadLibrary]);

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

  const storageReady = lib?.workdrive.can_upload ?? lib?.workdrive.connected;
  const brandFolder = browse?.brand_folder || brandRoot?.brand_folder || orgRoot?.brand_folder;
  const allSelected = scope === 'all' || selectedFolderId === '__all__';
  const brandSelected = Boolean(
    !allSelected && brandFolder && selectedFolderId === brandFolder.id && scope === 'brand',
  );

  const chipFolders = useMemo(() => {
    const root = orgRoot ?? (scope === 'organization' ? browse : null);
    const others = (root?.folders ?? []).filter((f) => f.id !== brandFolder?.id);
    return others;
  }, [orgRoot, browse, scope, brandFolder?.id]);

  const items = useMemo(() => {
    const source = allSelected ? browse : brandSelected ? (brandRoot ?? browse) : browse;
    const files = source?.files ?? [];
    const mapped = files.map((f) => fileToItem(f, brandId || '', kind));
    const seen = new Set(mapped.map((i) => i.key));
    if ((allSelected || !brandSelected) && lib?.assets.length) {
      for (const a of lib.assets) {
        if (seen.has(a.id)) continue;
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
  ]);

  const facets = browse?.filter_facets || orgRoot?.filter_facets || brandRoot?.filter_facets;
  const filterCount = usage.size + types.size + campaigns.size + uploaders.size;

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
      );
      onPick(a);
      if (variant === 'drawer') onClose();
      else {
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
      const r = await mediaApi.importFile(brandId, kind, item.fileId);
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
      {error ? (
        <p className="oma-bs-notice oma-bs-notice--error" role="alert">
          {error}
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
            onClick={() => setError(t('media.canvaUnavailable'))}
          >
            {t('media.canvaConnect')}
          </button>
        </div>
      ) : null}

      <div className="oma-ml-toolbar">
        <button
          type="button"
          className="oma-ml-btn"
          data-testid="media-dropzone"
          disabled={Boolean(progress)}
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

      <div className="oma-ml-folders" data-testid="media-folders">
        <button
          type="button"
          className="oma-ml-folder"
          data-testid="media-all-assets"
          data-active={allSelected ? 'true' : 'false'}
          onClick={() => void openFolder('all')}
        >
          <FolderMosaic
            name={t('media.allAssets')}
            thumbs={(browse?.files ?? orgRoot?.files ?? [])
              .filter((f) => f.mime.startsWith('image/') && f.view_url)
              .slice(0, 4)
              .map((f) => f.view_url as string)}
            selected={allSelected}
          />
          <span>{t('media.allAssets')}</span>
        </button>
        {chipFolders.map((f) => (
          <button
            key={f.id}
            type="button"
            className="oma-ml-folder"
            data-active={
              selectedFolderId === f.id && !brandSelected && !allSelected ? 'true' : 'false'
            }
            onClick={() => void openFolder('organization', f.id)}
          >
            <FolderMosaic
              name={f.name}
              thumbs={[]}
              selected={selectedFolderId === f.id && !brandSelected}
            />
            <span>{f.name}</span>
          </button>
        ))}
        {brandFolder ? (
          <button
            type="button"
            className="oma-ml-folder"
            data-testid="media-brand-assets"
            data-active={brandSelected ? 'true' : 'false'}
            onClick={() => void openFolder('brand', brandFolder.id)}
          >
            <FolderMosaic
              name={t('media.brandAssets')}
              thumbs={(brandRoot?.files ?? [])
                .filter((f) => f.mime.startsWith('image/') && f.view_url)
                .slice(0, 4)
                .map((f) => f.view_url as string)}
              selected={brandSelected}
            />
            <span>{t('media.brandAssets')}</span>
          </button>
        ) : null}
      </div>

      <div className="oma-ml-gridwrap" data-testid="media-browser" aria-busy={browsing}>
        {browsing && !browse && !items.length ? (
          <MediaShimmer rows={6} />
        ) : items.length ? (
          <div className="oma-ml-grid" data-testid="media-files">
            {items.map((item) => {
              const video = item.mime.startsWith('video/');
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
                  <span className="oma-ml-thumb">
                    {item.missing ? (
                      <span className="oma-mp-thumb oma-mp-thumb--missing">
                        {t('media.missingShort')}
                      </span>
                    ) : item.mime.startsWith('image/') || video ? (
                      <MediaSurface
                        className="oma-ml-thumb__media"
                        src={video ? item.streamUrl || item.viewUrl : item.viewUrl}
                        mime={item.mime}
                        alt=""
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
                  <span className="oma-ml-item__name">{item.name}</span>
                </button>
              );
            })}
          </div>
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
      className={`oma-ml ${variant === 'panel' ? 'oma-ml--panel' : 'oma-ml--drawer'}`}
      data-testid="media-picker"
      hidden={!open}
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
          </>
        )}
        <button
          type="button"
          className="oma-ml-iconbtn"
          aria-label={t('common.close')}
          onClick={() => {
            abort.current?.abort();
            onClose();
          }}
        >
          <CloseOutlined />
        </button>
      </header>
      <div className="oma-ml-body">{open ? body : null}</div>
    </aside>
  );

  if (variant === 'panel') return open ? panel : null;
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
