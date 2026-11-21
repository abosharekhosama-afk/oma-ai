import { brandFolderSlug } from '@oma/domain';

const UUIDISH = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const TENANT_SEG = /^tenants?$/i;

export type FolderLabelCtx = {
  brandId: string;
  brandName: string;
  brandFolderId?: string;
  workspaceLabel?: string | null;
  folderId: string;
};

export function displayFolderLabel(
  rawName: string,
  t: (key: string) => string,
  ctx: FolderLabelCtx,
): string {
  const name = (rawName ?? '').trim();
  if (!name || name === '__all__' || name === 'All files') return t('media.allAssets');
  const lower = name.toLowerCase();
  if (lower === 'posts') return t('media.folderPosts');
  if (lower === 'logos') return t('media.folderLogos');
  if (lower === 'deliverables') return t('media.folderDeliverables');
  if (lower === 'canva') return 'Canva';
  if (ctx.brandFolderId && ctx.folderId === ctx.brandFolderId) return ctx.brandName;
  if (TENANT_SEG.test(name) || UUIDISH.test(name)) {
    return ctx.workspaceLabel?.trim() || t('media.workspaceRoot');
  }
  const slug = brandFolderSlug(ctx.brandName, ctx.brandId.slice(-8).toLowerCase());
  if (name === slug || name.startsWith(`${slug}-`) || name === ctx.brandId) return ctx.brandName;
  if (/^[a-f0-9]{24,}$/i.test(name)) return ctx.brandName;
  return name;
}
