export const MEDIA_KINDS = ['posts', 'logos', 'deliverables'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export function isMediaKind(v: unknown): v is MediaKind {
  return typeof v === 'string' && (MEDIA_KINDS as readonly string[]).includes(v);
}

/** Folder-safe slug: keeps Arabic letters, drops characters WorkDrive rejects. */
export function brandFolderSlug(name: string, fallback: string) {
  const s = name
    .normalize('NFKC')
    .toLowerCase()
    // eslint-disable-next-line no-control-regex -- strip control characters from names
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || fallback;
}

/**
 * `OMA/{brand-slug}/{kind}`. With a key confined to a root folder the path is created under that
 * root, so the leading `OMA` is dropped when the root already is the OMA folder.
 */
export function mediaFolderSegments(input: {
  brandSlug: string;
  kind: MediaKind;
  rootFolderName?: string | null;
}) {
  const root = input.rootFolderName?.trim().toLowerCase();
  return [...(root === 'oma' ? [] : ['OMA']), input.brandSlug, input.kind];
}

/** WorkDrive file names: 1–191 chars, none of \ / : * ? " < > | or control characters. */
export function safeFileName(name: string) {
  const cleaned = name
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex -- strip control characters from names
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/^\.+/, '')
    .trim();
  if (!cleaned) return 'file';
  if (cleaned.length <= 191) return cleaned;
  const dot = cleaned.lastIndexOf('.');
  const ext = dot > 0 && cleaned.length - dot <= 12 ? cleaned.slice(dot) : '';
  return cleaned.slice(0, 191 - ext.length) + ext;
}

export const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm'];
export const DOCUMENT_MIME = ['application/pdf'];
export function allowedMimeFor(kind: MediaKind) {
  if (kind === 'logos') return IMAGE_MIME;
  if (kind === 'posts') return [...IMAGE_MIME, ...VIDEO_MIME];
  return [...IMAGE_MIME, ...VIDEO_MIME, ...DOCUMENT_MIME];
}
export const DEFAULT_MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const DEFAULT_MAX_IMAGE_BYTES = 25 * 1024 * 1024;
