'use client';
import { openSettings } from '../../lib/settings-dialog';

import {
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FolderOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { Button, Modal, Progress, Tabs } from 'antd';
import { MediaSurface } from './media-surface';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiError } from '../../lib/brand-api';
import {
  formatBytes,
  mediaApi,
  type MediaAsset,
  type MediaKind,
  type MediaLibrary,
  type WorkDriveBrowse,
} from '../../lib/workdrive-api';

type Tr = (key: string) => string;

const ACCEPT: Record<MediaKind, string> = {
  posts: 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm',
  logos: 'image/png,image/jpeg,image/webp,image/gif',
  deliverables:
    'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf',
};

function fileIcon(mime: string) {
  if (mime.startsWith('video/')) return <PlayCircleOutlined />;
  if (mime.startsWith('image/')) return <FileImageOutlined />;
  if (mime.includes('pdf')) return <FilePdfOutlined />;
  return <FileOutlined />;
}

function formatDate(iso: string | null | undefined, locale: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

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

/** Real media picker: upload to the brand's WorkDrive folder or choose an existing WorkDrive file. */
export function MediaPickerDialog({
  open,
  brandId,
  kind = 'posts',
  t,
  locale,
  canConnect,
  onClose,
  onPick,
}: {
  open: boolean;
  brandId: string | null;
  kind?: MediaKind;
  t: Tr;
  locale: string;
  canConnect: boolean;
  onClose: () => void;
  onPick: (asset: MediaAsset) => void;
}) {
  const [lib, setLib] = useState<MediaLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'upload' | 'workdrive'>('upload');
  // The connected WorkDrive root is the authorization boundary. Start there so the picker
  // shows every folder this key can access, not only the generated folder for the active brand.
  const [browseScope, setBrowseScope] = useState<'brand' | 'organization'>('organization');
  const [progress, setProgress] = useState<{ name: string; value: number } | null>(null);
  const [browse, setBrowse] = useState<WorkDriveBrowse | null>(null);
  const [trail, setTrail] = useState<Array<{ id: string; name: string }>>([]);
  const [browsing, setBrowsing] = useState(false);
  const isAr = locale.toLowerCase().startsWith('ar');
  const fileInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    if (!brandId) return;
    setError(null);
    mediaApi
      .list(brandId, kind)
      .then((r) => setLib(r.data))
      .catch((e) => setError(getApiError(e).message));
  }, [brandId, kind]);

  useEffect(() => {
    if (open) load();
    else {
      setBrowse(null);
      setTrail([]);
      setProgress(null);
      setBrowseScope('organization');
    }
  }, [open, load]);

  const openFolder = useCallback(
    async (
      folderId?: string,
      name?: string,
      back = false,
      scope: 'brand' | 'organization' = 'brand',
    ) => {
      if (!brandId) return;
      setBrowsing(true);
      setError(null);
      try {
        const r = await mediaApi.browse(brandId, kind, folderId, scope);
        setBrowse(r.data);
        setTrail((prev) => {
          const apiPath = r.data.path?.length
            ? r.data.path.map((crumb) => ({
                id: crumb.id,
                name: crumb.name || r.data.root_name || '',
              }))
            : null;
          if (apiPath) return apiPath;
          if (!folderId)
            return [{ id: r.data.folder.id, name: r.data.folder.name || r.data.root_name || '' }];
          if (back) {
            const i = prev.findIndex((crumb) => crumb.id === folderId);
            return i >= 0
              ? prev.slice(0, i + 1)
              : [{ id: r.data.folder.id, name: r.data.folder.name }];
          }
          return [...prev, { id: r.data.folder.id, name: name ?? r.data.folder.name }];
        });
      } catch (e) {
        if (scope === 'organization') {
          // Root may be unset — retry against the brand folder instead of a CONFLICT_STATE toast.
          try {
            const r = await mediaApi.browse(brandId, kind, folderId, 'brand');
            setBrowse(r.data);
            setBrowseScope('brand');
            setTrail(
              r.data.path?.length
                ? r.data.path.map((crumb) => ({
                    id: crumb.id,
                    name: crumb.name || r.data.root_name || '',
                  }))
                : [{ id: r.data.folder.id, name: r.data.folder.name || r.data.root_name || '' }],
            );
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
    if (open && tab === 'workdrive' && !browse && lib?.workdrive.connected)
      void openFolder(undefined, undefined, false, browseScope);
  }, [open, tab, browse, lib, openFolder, browseScope]);

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
      );
      onPick(a);
      onClose();
    } catch (e) {
      if ((e as { code?: string }).code !== 'ABORTED') setError(getApiError(e).message);
    } finally {
      setProgress(null);
    }
  };

  const connected = lib?.workdrive.connected;

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
  ) : !connected ? (
    <div className="oma-mp-connect" data-testid="media-connect-workdrive">
      <strong>{t('media.connectTitle')}</strong>
      <p>{lib.workdrive.available ? t('media.connectBody') : t('workdrive.notEnabled')}</p>
      {lib.workdrive.available ? (
        canConnect ? (
          <Button type="primary" onClick={() => openSettings('storage')}>
            {t('media.connectCta')}
          </Button>
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
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as 'upload' | 'workdrive')}
        items={[
          {
            key: 'upload',
            label: t('media.tabUpload'),
            children: (
              <div className="oma-mp-pane">
                <div
                  className="oma-mp-drop"
                  role="button"
                  tabIndex={0}
                  data-testid="media-dropzone"
                  onClick={() => !progress && fileInput.current?.click()}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !progress)
                      fileInput.current?.click();
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f && !progress) void upload(f);
                  }}
                >
                  {progress ? (
                    <div className="oma-mp-progress">
                      <span className="oma-mp-progress__name">{progress.name}</span>
                      <Progress percent={Math.round(progress.value * 100)} size="small" />
                      <Button size="small" onClick={() => abort.current?.abort()}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <strong>{t('media.dropTitle')}</strong>
                      <span>
                        {t('media.dropHint')
                          .replace('{image}', String(lib.workdrive.max_image_mb))
                          .replace('{video}', String(lib.workdrive.max_video_mb))}
                      </span>
                      <span className="oma-bs-hint">
                        {t('media.savedTo').replace('{org}', lib.workdrive.org_name ?? 'WorkDrive')}
                      </span>
                    </>
                  )}
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
                {lib.assets.length ? (
                  <>
                    <h3 className="oma-mp-subtitle">{t('media.recent')}</h3>
                    <div className="oma-mp-grid" data-testid="media-recent">
                      {lib.assets.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className="oma-mp-item"
                          disabled={a.missing}
                          title={a.missing ? t('media.missing') : a.name}
                          onClick={() => {
                            onPick(a);
                            onClose();
                          }}
                        >
                          <MediaThumb asset={a} t={t} />
                          <span className="oma-mp-item__name">{a.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ),
          },
          {
            key: 'workdrive',
            label: t('media.tabWorkDrive'),
            children: (
              <div className="oma-mp-pane" data-testid="media-browser" aria-busy={browsing}>
                <div
                  className="oma-mp-scope"
                  role="group"
                  aria-label={isAr ? 'نطاق الملفات' : 'File scope'}
                >
                  <button
                    type="button"
                    data-active={browseScope === 'organization' ? 'true' : 'false'}
                    onClick={() => {
                      setBrowseScope('organization');
                      setBrowse(null);
                      setTrail([]);
                      void openFolder(undefined, undefined, false, 'organization');
                    }}
                  >
                    {t('media.scopeOrganization')}
                  </button>
                  <button
                    type="button"
                    data-active={browseScope === 'brand' ? 'true' : 'false'}
                    onClick={() => {
                      setBrowseScope('brand');
                      setBrowse(null);
                      setTrail([]);
                      void openFolder(undefined, undefined, false, 'brand');
                    }}
                  >
                    {t('media.scopeBrand')}
                  </button>
                </div>
                <nav className="oma-mp-trail" aria-label={t('media.folders')}>
                  {browse?.folder.parent_id && trail.length === 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        void openFolder(browse.folder.parent_id!, undefined, false, browseScope)
                      }
                    >
                      {t('media.up')}
                    </button>
                  ) : null}
                  {trail.length === 0 && browse ? (
                    <strong>{browse.folder.name || browse.root_name || t('media.folders')}</strong>
                  ) : null}
                  {trail.map((crumb, i) => (
                    <span key={crumb.id}>
                      {i > 0 ? <span aria-hidden="true"> / </span> : null}
                      {i === trail.length - 1 ? (
                        <strong>{crumb.name}</strong>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void openFolder(crumb.id, crumb.name, true, browseScope)}
                        >
                          {crumb.name}
                        </button>
                      )}
                    </span>
                  ))}
                </nav>
                {browsing && !browse ? <MediaShimmer rows={5} /> : null}
                {browse ? (
                  browse.folders.length || browse.files.length ? (
                    <>
                      {browse.folders.length ? (
                        <>
                          <div className="oma-mp-tree" data-testid="media-folder-tree">
                            {trail.map((crumb, i) => (
                              <button
                                key={`tree-${crumb.id}`}
                                type="button"
                                className="oma-mp-tree__row"
                                data-active={i === trail.length - 1 ? 'true' : 'false'}
                                style={{ paddingInlineStart: 8 + i * 12 }}
                                onClick={() => void openFolder(crumb.id, crumb.name, true, browseScope)}
                              >
                                <FolderOutlined /> {crumb.name}
                              </button>
                            ))}
                            {browse.folders.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                className="oma-mp-tree__row"
                                style={{ paddingInlineStart: 8 + Math.max(trail.length, 1) * 12 }}
                                onClick={() => void openFolder(f.id, f.name, false, browseScope)}
                              >
                                <FolderOutlined /> {f.name}
                              </button>
                            ))}
                          </div>
                          <div className="oma-mp-folder-chips" data-testid="media-folders">
                            {browse.folders.map((f) => (
                              <button
                                key={`chip-${f.id}`}
                                type="button"
                                className="oma-mp-folder-chip"
                                onClick={() => void openFolder(f.id, f.name, false, browseScope)}
                              >
                                <span className="oma-mp-folder-chip__ico" aria-hidden>
                                  <FolderOutlined />
                                </span>
                                <span>{f.name}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}
                      {browse.files.length ? (
                        <>
                          <p className="oma-mp-section-title">
                            {t('media.files') || t('media.recent')}
                          </p>
                          <div className="oma-mp-files" data-testid="media-files">
                            {browse.files.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                className="oma-mp-file"
                                data-testid="media-browser-file"
                                title={[...trail.map((crumb) => crumb.name), f.name]
                                  .filter(Boolean)
                                  .join(' / ')}
                                onClick={async () => {
                                  try {
                                    const r = await mediaApi.importFile(brandId, kind, f.id);
                                    onPick(r.data);
                                    onClose();
                                  } catch (e) {
                                    setError(getApiError(e).message);
                                  }
                                }}
                              >
                                <span className="oma-mp-file__thumb" aria-hidden>
                                  {String(f.mime || '').startsWith('video/') ? (
                                    <span className="oma-mp-file__badge" aria-hidden>
                                      ▶
                                    </span>
                                  ) : null}
                                  {fileIcon(f.mime)}
                                </span>
                                <span className="oma-mp-file__name">{f.name}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <p className="oma-mp-empty">{t('media.emptyFolder')}</p>
                  )
                ) : browsing ? null : (
                  <MediaShimmer rows={3} />
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  );

  return (
    <Modal
      open={open}
      title={t('media.title')}
      footer={null}
      width={760}
      zIndex={1200}
      onCancel={() => {
        abort.current?.abort();
        onClose();
      }}
      destroyOnHidden
    >
      <div data-testid="media-picker">{body}</div>
    </Modal>
  );
}
