import { brandFolderSlug } from '@oma/domain/browser';

const UUIDISH = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const ULIDISH = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i;
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
  if (name === ctx.brandId || (ctx.brandFolderId && ctx.folderId === ctx.brandFolderId)) {
    return ctx.brandName;
  }
  if (TENANT_SEG.test(name) || UUIDISH.test(name) || ULIDISH.test(name)) {
    if (name === ctx.brandId) return ctx.brandName;
    return ctx.workspaceLabel?.trim() || t('media.workspaceRoot');
  }
  const slug = brandFolderSlug(ctx.brandName, ctx.brandId.slice(-8).toLowerCase());
  if (name === slug || name.startsWith(`${slug}-`) || name === ctx.brandId) return ctx.brandName;
  if (ULIDISH.test(name) && name === ctx.brandId) return ctx.brandName;
  if (lower === 'brands' && ctx.brandName) return ctx.brandName;
  return name;
}
