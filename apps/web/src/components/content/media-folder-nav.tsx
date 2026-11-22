'use client';

import { ArrowRightOutlined, FolderOutlined } from '../ui/lucide-icons';
import type { FolderCrumb, FolderTabs } from './media-folder-trail';

type Tr = (key: string) => string;

/**
 * Folder bar of the media library: Back + breadcrumb, then one level of folders as tabs.
 * Opening a folder swaps the tabs for its subfolders (drill-down). Hovering a tab prefetches it.
 */
export function MediaFolderNav({
  rootLabel,
  trail,
  tabs,
  browsing,
  onRoot,
  onCrumb,
  onOpen,
  onBack,
  onPrefetch,
  t,
}: {
  rootLabel: string;
  trail: FolderCrumb[];
  tabs: FolderTabs;
  browsing: boolean;
  onRoot: () => void;
  onCrumb: (index: number) => void;
  onOpen: (folder: FolderCrumb) => void;
  onBack: () => void;
  onPrefetch?: (folder: FolderCrumb) => void;
  t: Tr;
}) {
  const atRoot = trail.length === 0;
  return (
    <nav
      className="oma-ml-folder-tree"
      data-testid="media-folder-nav"
      data-level={trail.length}
      aria-label={t('media.folderTree')}
    >
      {!atRoot ? (
        <div className="oma-ml-crumbs" data-testid="media-folder-crumbs">
          <button
            type="button"
            className="oma-ml-folder oma-ml-folder--back"
            data-testid="media-folder-back"
            aria-label={t('media.folderBack')}
            onClick={onBack}
          >
            <ArrowRightOutlined
              className="oma-ml-folder__icon oma-ml-folder__icon--back"
              aria-hidden
            />
            <span>{t('media.folderBack')}</span>
          </button>
          <ol className="oma-ml-crumbs__list">
            <li>
              <button
                type="button"
                className="oma-ml-crumb"
                data-testid="media-crumb-root"
                onClick={onRoot}
              >
                {rootLabel}
              </button>
            </li>
            {trail.map((c, i) => (
              <li key={c.id}>
                <span className="oma-ml-crumbs__sep" aria-hidden>
                  ›
                </span>
                {i === trail.length - 1 ? (
                  <span
                    className="oma-ml-crumb oma-ml-crumb--current"
                    aria-current="page"
                    dir="auto"
                  >
                    {c.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="oma-ml-crumb"
                    data-testid="media-crumb"
                    dir="auto"
                    onClick={() => onCrumb(i)}
                  >
                    {c.label}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <div
        className="oma-ml-folders oma-ml-folders--tabs"
        role="tablist"
        aria-label={atRoot ? t('media.folderTree') : t('media.subfolders')}
        data-mode={tabs.mode}
        data-testid="media-folder-tabs"
      >
        {atRoot ? (
          <button
            type="button"
            role="tab"
            className="oma-ml-folder"
            data-testid="media-all-assets"
            data-active="true"
            aria-selected="true"
            onClick={onRoot}
          >
            <FolderOutlined className="oma-ml-folder__icon" aria-hidden />
            <span>{t('media.allAssets')}</span>
          </button>
        ) : null}
        {tabs.folders.map((f) => {
          const active = tabs.activeId === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              className={
                tabs.mode === 'children' ? 'oma-ml-folder oma-ml-folder--child' : 'oma-ml-folder'
              }
              data-testid={tabs.mode === 'children' ? 'media-folder-child' : 'media-folder-chip'}
              data-active={active ? 'true' : 'false'}
              aria-selected={active}
              disabled={browsing && !active}
              onPointerEnter={() => onPrefetch?.(f)}
              onFocus={() => onPrefetch?.(f)}
              onClick={() => (active ? undefined : onOpen(f))}
            >
              <FolderOutlined className="oma-ml-folder__icon" aria-hidden />
              <span dir="auto">{f.label}</span>
            </button>
          );
        })}
        {!atRoot && tabs.mode === 'siblings' && tabs.folders.length <= 1 ? (
          <span className="oma-ml-folder-tree__label" data-testid="media-no-subfolders">
            {t('media.noSubfolders')}
          </span>
        ) : null}
      </div>
    </nav>
  );
}
