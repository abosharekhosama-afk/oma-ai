'use client';

import { useRef, useState } from 'react';
import {
  FileImageOutlined,
  FolderOutlined,
  LinkOutlined,
  PictureOutlined,
} from '../ui/lucide-icons';
import { MediaPickerDialog } from './media-picker';
import { mediaApi, type MediaAsset, type MediaKind } from '../../lib/workdrive-api';
import { useToast } from '../ui/toast';
import { getApiError } from '../../lib/brand-api';

type Tr = (key: string) => string;

const GALLERY_ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm';
const GIF_ACCEPT = 'image/gif';

export function ComposeMediaToolbar({
  brandId,
  kind = 'posts',
  locale,
  t,
  canConnectStorage,
  disabled,
  onAdd,
}: {
  brandId: string | null;
  kind?: MediaKind;
  locale: string;
  t: Tr;
  canConnectStorage: boolean;
  disabled?: boolean;
  onAdd: (asset: MediaAsset) => void;
}) {
  const toast = useToast();
  const isAr = locale.toLowerCase().startsWith('ar');
  const galleryRef = useRef<HTMLInputElement>(null);
  const gifRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function uploadFiles(files: FileList | null, acceptGifOnly: boolean) {
    if (!brandId || !files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (acceptGifOnly && file.type !== 'image/gif') continue;
        const asset = await mediaApi.upload(brandId, kind, file);
        onAdd(asset);
      }
    } catch (err) {
      toast.push(getApiError(err).message, 'danger');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="oma-compose-toolbar" data-testid="compose-media-toolbar">
        <div className="oma-compose-toolbar__group">
          <button
            type="button"
            className="oma-compose-toolbar__btn"
            disabled={disabled || uploading || !brandId}
            data-testid="compose-media-gallery"
            title={isAr ? 'من المعرض / الجهاز' : 'From gallery / computer'}
            aria-label={isAr ? 'رفع من المعرض' : 'Upload from gallery'}
            onClick={() => galleryRef.current?.click()}
          >
            <PictureOutlined />
            <span>{isAr ? 'معرض' : 'Gallery'}</span>
          </button>
          <button
            type="button"
            className="oma-compose-toolbar__btn"
            disabled={disabled || uploading || !brandId}
            data-testid="compose-media-library"
            title={isAr ? 'مكتبة الوسائط (WorkDrive)' : 'Media library (WorkDrive)'}
            aria-label={t('content.media_library')}
            onClick={() => setLibraryOpen(true)}
          >
            <FolderOutlined />
            <span>{isAr ? 'ميديا' : 'Media'}</span>
          </button>
          <button
            type="button"
            className="oma-compose-toolbar__btn"
            disabled={disabled || uploading || !brandId}
            data-testid="compose-media-gif"
            title={isAr ? 'إضافة GIF' : 'Add GIF'}
            aria-label={isAr ? 'GIF' : 'GIF'}
            onClick={() => gifRef.current?.click()}
          >
            <FileImageOutlined />
            <span>GIF</span>
          </button>
          <button
            type="button"
            className="oma-compose-toolbar__btn oma-compose-toolbar__btn--muted"
            disabled={disabled}
            data-testid="compose-media-link"
            title={isAr ? 'رابط' : 'Link'}
            aria-label={isAr ? 'رابط' : 'Link'}
            onClick={() =>
              toast.push(
                isAr ? 'أضف الرابط في نص المنشور.' : 'Paste the link in your post caption for now.',
                'default',
              )
            }
          >
            <LinkOutlined />
            <span>{isAr ? 'رابط' : 'Link'}</span>
          </button>
        </div>
      </div>
      <input
        ref={galleryRef}
        type="file"
        accept={GALLERY_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          void uploadFiles(e.target.files, false);
          e.target.value = '';
        }}
      />
      <input
        ref={gifRef}
        type="file"
        accept={GIF_ACCEPT}
        hidden
        onChange={(e) => {
          void uploadFiles(e.target.files, true);
          e.target.value = '';
        }}
      />
      <MediaPickerDialog
        open={libraryOpen}
        brandId={brandId}
        kind={kind}
        t={t}
        locale={locale}
        canConnect={canConnectStorage}
        onClose={() => setLibraryOpen(false)}
        onPick={(asset) => {
          onAdd(asset);
          setLibraryOpen(false);
        }}
      />
    </>
  );
}
