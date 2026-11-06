'use client';

import { useEffect, useRef, useState } from 'react';
import { SmileOutlined } from '../ui/lucide-icons';

export const CONTENT_EMOJIS = [
  '😀',
  '😍',
  '😂',
  '🔥',
  '🎉',
  '👏',
  '💯',
  '❤️',
  '🙌',
  '👍',
  '🙏',
  '😮',
  '😢',
  '😡',
  '✨',
  '☀️',
  '🌙',
  '⭐',
  '✅',
  '💡',
];

export function ContentEmojiPicker({
  onPick,
  ariaLabel,
  testId,
  disabled,
  label,
}: {
  onPick: (emoji: string) => void;
  ariaLabel: string;
  testId?: string;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="oma-content-emoji" ref={ref}>
      <button
        type="button"
        className="oma-content-emoji__btn"
        aria-label={ariaLabel}
        aria-expanded={open}
        disabled={disabled}
        data-testid={testId}
        onClick={() => setOpen((v) => !v)}
      >
        {label ? <span>{label}</span> : <SmileOutlined />}
      </button>
      {open ? (
        <div className="oma-content-emoji__pop" role="dialog" data-testid="content-emoji-popover">
          {CONTENT_EMOJIS.map((emo) => (
            <button
              key={emo}
              type="button"
              onClick={() => {
                onPick(emo);
                setOpen(false);
              }}
            >
              {emo}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
