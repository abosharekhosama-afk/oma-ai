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

function scopeForFolder(
  folderId: string,
  brandFolderId: string | undefined,
  pathBrandScoped: boolean,
  activeScope: MediaTreeScope,
): MediaTreeScope {
  if (activeScope === 'organization' || activeScope === 'all')
    return activeScope === 'all' ? 'all' : 'organization';
  if (brandFolderId && (folderId === brandFolderId || pathBrandScoped)) return 'brand';
  return 'organization';
}

export function MediaFolderNav({
  brandId,
  brandDisplayName,
  workspaceLabel,
  browse,
  orgRoot,
  brandFolderId,
  allSelected,
  browsing,
  activeScope,
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
  activeScope: MediaTreeScope;
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

  const pathBrandScoped = Boolean(
    brandFolderId &&
    (browse?.path?.some((p) => p.id === brandFolderId) || browse?.folder.id === brandFolderId),
  );

  const primaryChips = useMemo((): NavChip[] => {
    const allChip: NavChip = {
      id: '__all__',
      label: t('media.allAssets'),
      scope: 'all',
      active: allSelected,
    };
    if (allSelected) {
      const roots = (orgRoot?.folders ?? []).map((f) => ({
        id: f.id,
        label: labelFor(f.id, f.name),
        scope: scopeForFolder(f.id, brandFolderId, false, activeScope),
        active: false,
      }));
      return [allChip, ...roots];
    }

    const path = browse?.path?.length
      ? browse.path
      : browse?.folder
        ? [{ id: browse.folder.id, name: browse.folder.name }]
        : [];
    const crumbs: NavChip[] = [allChip];
    for (const crumb of path) {
      if (crumb.id === '__all__') continue;
      crumbs.push({
        id: crumb.id,
        label: labelFor(crumb.id, crumb.name),
        scope: scopeForFolder(crumb.id, brandFolderId, pathBrandScoped, activeScope),
        active: browse?.folder.id === crumb.id,
      });
    }
    return crumbs;
  }, [
    activeScope,
    allSelected,
    brandFolderId,
    browse,
    labelFor,
    orgRoot?.folders,
    pathBrandScoped,
    t,
  ]);

  const childChips = useMemo((): NavChip[] => {
    if (allSelected) return [];
    const atOrgRoot =
      Boolean(orgRoot?.folder.id) && browse?.folder.id === orgRoot?.folder.id && !pathBrandScoped;
    const folders =
      (browse?.folders?.length ? browse.folders : atOrgRoot ? (orgRoot?.folders ?? []) : []) ?? [];
    return folders.map((f) => ({
      id: f.id,
      label: labelFor(f.id, f.name),
      scope: scopeForFolder(
        f.id,
        brandFolderId,
        pathBrandScoped || f.id === brandFolderId,
        activeScope,
      ),
      active: false,
    }));
  }, [
    activeScope,
    allSelected,
    brandFolderId,
    browse?.folder.id,
    browse?.folders,
    labelFor,
    orgRoot?.folder.id,
    orgRoot?.folders,
    pathBrandScoped,
  ]);

  const canBack = !allSelected && (browse?.path?.length ?? 0) > 1;

  const renderChip = (chip: NavChip, variant: 'path' | 'child') => (
    <button
      key={`${variant}-${chip.id}`}
      type="button"
      className={variant === 'child' ? 'oma-ml-folder oma-ml-folder--child' : 'oma-ml-folder'}
      data-testid={
        chip.id === '__all__'
          ? 'media-all-assets'
          : variant === 'child'
            ? 'media-folder-child'
            : 'media-folder-chip'
      }
      data-active={chip.active ? 'true' : 'false'}
      disabled={browsing && !chip.active}
      onClick={() => onNavigate(chip.scope, chip.id === '__all__' ? undefined : chip.id)}
    >
      <FolderOutlined className="oma-ml-folder__icon" aria-hidden />
      <span dir="auto">{chip.label}</span>
    </button>
  );

  return (
    <nav className="oma-ml-folder-tree" data-testid="media-folder-nav">
      <div className="oma-ml-folders oma-ml-folders--path" aria-label={t('media.folderTree')}>
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
        {primaryChips.map((chip) => renderChip(chip, 'path'))}
      </div>
      {childChips.length > 0 ? (
        <div className="oma-ml-folder-tree__sub" data-testid="media-folder-subtabs">
          <p className="oma-ml-folder-tree__label">{t('media.subfolders')}</p>
          <div
            className="oma-ml-folders oma-ml-folders--children"
            aria-label={t('media.subfolders')}
          >
            {childChips.map((chip) => renderChip(chip, 'child'))}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
