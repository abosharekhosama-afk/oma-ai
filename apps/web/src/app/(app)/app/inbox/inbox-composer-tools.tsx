'use client';

import { useEffect, useRef, useState } from 'react';
import { PictureOutlined, SmileOutlined } from '../../../../components/ui/lucide-icons';
import { MediaPickerDialog } from '../../../../components/content/media-picker';
import type { MediaAsset } from '../../../../lib/workdrive-api';

type Tr = (key: string) => string;

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

export function InboxComposerTools({
  t,
  locale,
  brandId,
  onInsertEmoji,
  onAiDraft,
  onPickMedia,
  aiBusy,
  disabled,
}: {
  t: Tr;
  locale: string;
  brandId: string | null;
  onInsertEmoji: (emo: string) => void;
  onAiDraft: () => void;
  onPickMedia: (asset: MediaAsset) => void;
  aiBusy?: boolean;
  disabled?: boolean;
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const isAr = locale.toLowerCase().startsWith('ar');

  useEffect(() => {
    if (!emojiOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [emojiOpen]);

  return (
    <div className="oma-plx-inbox-composer-tools" ref={wrapRef}>
      <button
        type="button"
        className="oma-plx-inbox-composer__emoji"
        aria-label={t('inbox.attach') || (isAr ? 'وسائط' : 'Attach media')}
        disabled={disabled}
        data-testid="inbox-tool-media"
        onClick={() => setLibraryOpen(true)}
      >
        <PictureOutlined />
      </button>
      <div className="oma-plx-inbox-composer-tools__emoji-wrap">
        <button
          type="button"
          className="oma-plx-inbox-composer__emoji"
          aria-label={t('inbox.emoji') || (isAr ? 'إيموجي' : 'Emoji')}
          aria-expanded={emojiOpen}
          disabled={disabled}
          data-testid="inbox-tool-emoji"
          onClick={() => setEmojiOpen((v) => !v)}
        >
          <SmileOutlined />
        </button>
        {emojiOpen ? (
          <div className="oma-plx-inbox-emoji" role="dialog" data-testid="inbox-emoji-popover">
            {EMOJIS.map((emo) => (
              <button
                key={emo}
                type="button"
                onClick={() => {
                  onInsertEmoji(emo);
                  setEmojiOpen(false);
                }}
              >
                {emo}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="oma-plx-inbox-composer__emoji"
        aria-label={t('inbox.aiDraft') || (isAr ? 'اقتراح ذكاء اصطناعي' : 'AI draft')}
        disabled={disabled || aiBusy}
        data-testid="inbox-tool-ai"
        onClick={onAiDraft}
      >
        ✦
      </button>
      <MediaPickerDialog
        open={libraryOpen}
        brandId={brandId}
        kind="posts"
        t={t}
        locale={locale}
        canConnect={Boolean(brandId)}
        onClose={() => setLibraryOpen(false)}
        onPick={(asset) => {
          onPickMedia(asset);
          setLibraryOpen(false);
        }}
      />
    </div>
  );
}
