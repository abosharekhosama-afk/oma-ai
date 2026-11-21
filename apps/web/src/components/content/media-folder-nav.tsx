'use client';

import { useMemo } from 'react';
import { ArrowRightOutlined, FolderOutlined } from '../ui/lucide-icons';
import { displayFolderLabel, type FolderLabelCtx } from '../../lib/media-folder-display';
import type { WorkDriveBrowse } from '../../lib/workdrive-api';
import type { MediaTreeScope } from './media-scope';

type Tr = (key: string) => string;

type NavChip = {
  id: string;
  label: string;
  scope: MediaTreeScope;
  active: boolean;
};

export function MediaFolderNav({
  brandId,
  brandDisplayName,
  workspaceLabel,
  browse,
  orgRoot,
  brandFolderId,
  allSelected,
  browsing,
  onBack,
  onNavigate,
  t,
}: {
  brandId: string;
  brandDisplayName: string;
  workspaceLabel: string | null;
  browse: WorkDriveBrowse | null;
  orgRoot: WorkDriveBrowse | null;
  brandFolderId?: string;
  allSelected: boolean;
  browsing: boolean;
  onBack: () => void;
  onNavigate: (scope: MediaTreeScope, folderId?: string) => void;
  t: Tr;
}) {
  const labelCtx = useMemo(
    (): Omit<FolderLabelCtx, 'folderId'> => ({
      brandId,
      brandName: brandDisplayName,
      brandFolderId,
      workspaceLabel,
    }),
    [brandDisplayName, brandFolderId, brandId, workspaceLabel],
  );

  const labelFor = (folderId: string, rawName: string) =>
    displayFolderLabel(rawName, t, { ...labelCtx, folderId });

  const pathChips = useMemo((): NavChip[] => {
    const chips: NavChip[] = [
      {
        id: '__all__',
        label: t('media.allAssets'),
        scope: 'all',
        active: allSelected,
      },
    ];
    if (allSelected) return chips;

    const path = browse?.path?.length
      ? browse.path
      : browse?.folder
        ? [{ id: browse.folder.id, name: browse.folder.name }]
        : [];
    for (const crumb of path) {
      if (crumb.id === '__all__') continue;
      const scope: MediaTreeScope =
        brandFolderId && (crumb.id === brandFolderId || path.some((p) => p.id === brandFolderId))
          ? 'brand'
          : 'organization';
      chips.push({
        id: crumb.id,
        label: labelFor(crumb.id, crumb.name),
        scope,
        active: !allSelected && browse?.folder.id === crumb.id,
      });
    }
    return chips;
  }, [allSelected, brandFolderId, browse, labelCtx, t]);

  const childChips = useMemo((): NavChip[] => {
    if (allSelected) {
      const rootFolders = orgRoot?.folders ?? [];
      return rootFolders.map((f) => ({
        id: f.id,
        label: labelFor(f.id, f.name),
        scope: (brandFolderId && f.id === brandFolderId
          ? 'brand'
          : 'organization') as MediaTreeScope,
        active: false,
      }));
    }
    const kids = browse?.folders ?? [];
    return kids.map((f) => ({
      id: f.id,
      label: labelFor(f.id, f.name),
      scope: (brandFolderId &&
      (f.id === brandFolderId || browse?.path?.some((p) => p.id === brandFolderId))
        ? 'brand'
        : 'organization') as MediaTreeScope,
      active: false,
    }));
  }, [allSelected, brandFolderId, browse, labelFor, orgRoot?.folders]);

  const canBack = !allSelected && (browse?.path?.length ?? 0) > 1;

  return (
    <nav
      className="oma-ml-folders"
      data-testid="media-folder-nav"
      aria-label={t('media.folderTree')}
    >
      {canBack ? (
        <button
          type="button"
          className="oma-ml-folder oma-ml-folder--back"
          data-testid="media-folder-back"
          aria-label={t('media.folderBack')}
          disabled={browsing}
          onClick={onBack}
        >
          <ArrowRightOutlined
            className="oma-ml-folder__icon oma-ml-folder__icon--back"
            aria-hidden
          />
          <span>{t('media.folderBack')}</span>
        </button>
      ) : null}
      {pathChips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className="oma-ml-folder"
          data-testid={chip.id === '__all__' ? 'media-all-assets' : 'media-folder-chip'}
          data-active={chip.active ? 'true' : 'false'}
          disabled={browsing && !chip.active}
          onClick={() => onNavigate(chip.scope, chip.id === '__all__' ? undefined : chip.id)}
        >
          <FolderOutlined className="oma-ml-folder__icon" aria-hidden />
          <span dir="auto">{chip.label}</span>
        </button>
      ))}
      {childChips.length
        ? childChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="oma-ml-folder oma-ml-folder--child"
              data-testid="media-folder-child"
              data-active="false"
              disabled={browsing}
              onClick={() => onNavigate(chip.scope, chip.id)}
            >
              <FolderOutlined className="oma-ml-folder__icon" aria-hidden />
              <span dir="auto">{chip.label}</span>
            </button>
          ))
        : null}
    </nav>
  );
}
