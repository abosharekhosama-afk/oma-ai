'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FileImageOutlined,
  FolderOutlined,
  LinkOutlined,
  PictureOutlined,
  SearchOutlined,
  SmileOutlined,
} from '../ui/lucide-icons';
import { MediaPickerDialog, MediaThumb } from './media-picker';
import { mediaApi, type MediaAsset, type MediaKind } from '../../lib/workdrive-api';
import { useToast } from '../ui/toast';
import { getApiError } from '../../lib/brand-api';

type Tr = (key: string) => string;

const GALLERY_ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm';
const GIF_ACCEPT = 'image/gif';
const IMAGE_URL = /\.(gif|png|jpe?g|webp)(\?|$)/i;
const EMOJIS = [
  '😀',
  '😍',
  '🔥',
  '🎉',
  '👏',
  '💯',
  '🎈',
  '❤️',
  '✨',
  '🙌',
  '👍',
  '🙏',
  '☀️',
  '🌙',
  '⭐',
];

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function ComposeMediaToolbar({
  brandId,
  kind = 'posts',
  locale,
  t,
  canConnectStorage,
  disabled,
  onAdd,
  linkUrl,
  onLinkUrl,
  onCaptionInsert,
}: {
  brandId: string | null;
  kind?: MediaKind;
  locale: string;
  t: Tr;
  canConnectStorage: boolean;
  disabled?: boolean;
  onAdd: (asset: MediaAsset) => void;
  linkUrl?: string;
  onLinkUrl?: (url: string) => void;
  onCaptionInsert?: (text: string) => void;
}) {
  const toast = useToast();
  const isAr = locale.toLowerCase().startsWith('ar');
  const galleryRef = useRef<HTMLInputElement>(null);
  const gifRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState(linkUrl ?? '');
  const [placeDraft, setPlaceDraft] = useState('');
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<MediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!gifOpen || !brandId) return;
    mediaApi
      .list(brandId, kind)
      .then((r) =>
        setGifs(r.data.assets.filter((a) => a.mime === 'image/gif' || /\.gif$/i.test(a.name))),
      )
      .catch(() => setGifs([]));
  }, [gifOpen, brandId, kind]);

  function closePops(except?: 'gif' | 'link' | 'emoji' | 'place') {
    setGifOpen(except === 'gif');
    setLinkOpen(except === 'link');
    setEmojiOpen(except === 'emoji');
    setPlaceOpen(except === 'place');
  }

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

  async function importImageUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return;
    onLinkUrl?.(trimmed);
    if (!brandId || !IMAGE_URL.test(trimmed)) return;
    setUploading(true);
    try {
      const res = await fetch(trimmed);
      const blob = await res.blob();
      const name = trimmed.split('/').pop()?.split('?')[0] || 'image';
      const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
      const asset = await mediaApi.upload(brandId, kind, file);
      onAdd(asset);
    } catch {
      toast.push(
        isAr
          ? 'تعذر رفع الرابط إلى WorkDrive. أُضيف إلى المنشور.'
          : 'Could not upload URL; added to the post.',
        'default',
      );
    } finally {
      setUploading(false);
    }
  }

  const visibleGifs = gifs.filter((g) =>
    gifQuery.trim() ? g.name.toLowerCase().includes(gifQuery.trim().toLowerCase()) : true,
  );

  return (
    <>
      <div className="oma-compose-toolbar" data-testid="compose-media-toolbar">
        <div className="oma-compose-toolbar__group">
          <button
            type="button"
            className="oma-compose-icon-btn"
            disabled={disabled || uploading || !brandId}
            data-testid="compose-media-gallery"
            title={isAr ? 'من المعرض' : 'From computer'}
            aria-label={isAr ? 'رفع من المعرض' : 'Upload from gallery'}
            onClick={() => galleryRef.current?.click()}
          >
            <PictureOutlined />
          </button>
          <div className="oma-compose-pop-anchor">
            <button
              type="button"
              className="oma-compose-icon-btn"
              disabled={disabled || uploading || !brandId}
              data-testid="compose-media-gif"
              data-active={gifOpen ? 'true' : 'false'}
              title="GIF"
              aria-label="GIF"
              onClick={() => closePops(gifOpen ? undefined : 'gif')}
            >
              <FileImageOutlined />
            </button>
            {gifOpen ? (
              <div className="oma-compose-gif" role="dialog" data-testid="compose-gif-popover">
                <label className="oma-compose-gif__search-wrap">
                  <SearchOutlined />
                  <input
                    className="oma-compose-gif__search"
                    value={gifQuery}
                    placeholder={isAr ? 'ابحث عن GIF' : 'Search for a GIF'}
                    onChange={(e) => setGifQuery(e.target.value)}
                  />
                </label>
                <div className="oma-compose-gif__grid">
                  {visibleGifs.length === 0 ? (
                    <button
                      type="button"
                      className="oma-compose-gif__empty"
                      onClick={() => gifRef.current?.click()}
                    >
                      {isAr ? 'ارفع GIF من الجهاز' : 'Upload a GIF from your computer'}
                    </button>
                  ) : (
                    visibleGifs.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        className="oma-compose-gif__cell"
                        onClick={() => {
                          onAdd(asset);
                          setGifOpen(false);
                        }}
                      >
                        <MediaThumb asset={asset} t={t} />
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="oma-compose-icon-btn"
            disabled={disabled || uploading || !brandId}
            data-testid="compose-media-library"
            title={t('content.media_library')}
            aria-label={t('content.media_library')}
            onClick={() => setLibraryOpen(true)}
          >
            <FolderOutlined />
          </button>
          <div className="oma-compose-pop-anchor">
            <button
              type="button"
              className="oma-compose-icon-btn"
              disabled={disabled}
              data-testid="compose-media-link"
              data-active={linkOpen ? 'true' : 'false'}
              title={isAr ? 'رابط صورة' : 'Image link'}
              aria-label={isAr ? 'رابط' : 'Link'}
              onClick={() => closePops(linkOpen ? undefined : 'link')}
            >
              <LinkOutlined />
            </button>
            {linkOpen ? (
              <form
                className="oma-compose-link"
                data-testid="compose-link-field"
                onSubmit={(e) => {
                  e.preventDefault();
                  void importImageUrl(linkDraft);
                  setLinkOpen(false);
                }}
              >
                <input
                  value={linkDraft}
                  placeholder={isAr ? 'الصق رابط الصورة' : 'Paste image URL'}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  autoFocus
                />
                <button type="submit" disabled={!linkDraft.trim()}>
                  {isAr ? 'إضافة' : 'Add'}
                </button>
              </form>
            ) : null}
          </div>
          <div className="oma-compose-pop-anchor">
            <button
              type="button"
              className="oma-compose-icon-btn"
              disabled={disabled}
              data-testid="compose-media-place"
              data-active={placeOpen ? 'true' : 'false'}
              title={isAr ? 'موقع' : 'Location'}
              aria-label={isAr ? 'موقع' : 'Location'}
              onClick={() => closePops(placeOpen ? undefined : 'place')}
            >
              <PinIcon />
            </button>
            {placeOpen ? (
              <form
                className="oma-compose-link"
                data-testid="compose-place-field"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = placeDraft.trim();
                  if (value) onCaptionInsert?.(`📍 ${value}`);
                  setPlaceOpen(false);
                  setPlaceDraft('');
                }}
              >
                <input
                  value={placeDraft}
                  placeholder={isAr ? 'اسم المكان' : 'Add a location'}
                  onChange={(e) => setPlaceDraft(e.target.value)}
                  autoFocus
                />
                <button type="submit" disabled={!placeDraft.trim()}>
                  {isAr ? 'إضافة' : 'Add'}
                </button>
              </form>
            ) : null}
          </div>
          <div className="oma-compose-pop-anchor">
            <button
              type="button"
              className="oma-compose-icon-btn"
              disabled={disabled}
              data-testid="compose-media-emoji"
              data-active={emojiOpen ? 'true' : 'false'}
              title={isAr ? 'رموز تعبيرية' : 'Emoji'}
              aria-label={isAr ? 'رموز تعبيرية' : 'Emoji'}
              onClick={() => closePops(emojiOpen ? undefined : 'emoji')}
            >
              <SmileOutlined />
            </button>
            {emojiOpen ? (
              <div className="oma-compose-emoji" role="dialog" data-testid="compose-emoji-popover">
                {EMOJIS.map((emo) => (
                  <button
                    key={emo}
                    type="button"
                    onClick={() => {
                      onCaptionInsert?.(emo);
                      setEmojiOpen(false);
                    }}
                  >
                    {emo}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
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
          setGifOpen(false);
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
