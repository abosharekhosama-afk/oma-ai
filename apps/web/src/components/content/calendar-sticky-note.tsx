'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  LockOutlined,
  MoreOutlined,
  TeamOutlined,
  UpOutlined,
} from '../ui/lucide-icons';

export const NOTE_COLORS = ['yellow', 'peach', 'pink', 'lavender', 'blue', 'mint'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];
export type NoteVisibility = 'only_me' | 'team' | 'all';

export type CalendarNoteValue = {
  text: string;
  color: string;
  visibility: NoteVisibility;
};

type Props = {
  dayKey: string;
  note: CalendarNoteValue;
  active: boolean;
  colorOpen: boolean;
  menuOpen: boolean;
  t: (key: string) => string;
  onActivate: () => void;
  onClosePopovers: () => void;
  onToggleColor: () => void;
  onToggleMenu: () => void;
  onChangeText: (text: string) => void;
  onCommitText: (text: string) => void;
  onColor: (color: NoteColor) => void;
  onVisibility: (visibility: NoteVisibility) => void;
  onDelete: () => void;
  onCreatePost: () => void;
};

export function CalendarStickyNote({
  dayKey,
  note,
  active,
  colorOpen,
  menuOpen,
  t,
  onActivate,
  onClosePopovers,
  onToggleColor,
  onToggleMenu,
  onChangeText,
  onCommitText,
  onColor,
  onVisibility,
  onDelete,
  onCreatePost,
}: Props) {
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const closePopoversRef = useRef(onClosePopovers);
  closePopoversRef.current = onClosePopovers;
  const [colorPos, setColorPos] = useState<{ top: number; insetInlineStart: number } | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; insetInlineStart: number } | null>(null);
  const visibility = note.visibility ?? 'only_me';
  const color = NOTE_COLORS.includes(note.color as NoteColor)
    ? (note.color as NoteColor)
    : 'yellow';

  useLayoutEffect(() => {
    if (!colorOpen || !colorBtnRef.current) {
      setColorPos(null);
      return;
    }
    const r = colorBtnRef.current.getBoundingClientRect();
    const dir = document.documentElement.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';
    const insetInlineStart =
      dir === 'rtl' ? Math.max(8, window.innerWidth - r.right) : Math.max(8, r.left);
    setColorPos({ top: r.bottom + 8, insetInlineStart });
  }, [colorOpen]);

  useLayoutEffect(() => {
    if (!menuOpen || !menuBtnRef.current) {
      setMenuPos(null);
      return;
    }
    const r = menuBtnRef.current.getBoundingClientRect();
    const dir = document.documentElement.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';
    const insetInlineStart =
      dir === 'rtl'
        ? Math.max(8, window.innerWidth - r.right)
        : Math.max(8, Math.min(r.left, window.innerWidth - 248));
    setMenuPos({ top: r.bottom + 8, insetInlineStart });
  }, [menuOpen]);

  useEffect(() => {
    if (!colorOpen && !menuOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (colorBtnRef.current?.contains(target) || menuBtnRef.current?.contains(target)) return;
      const pop = document.querySelector('[data-oma-note-pop="true"]');
      if (pop?.contains(target)) return;
      closePopoversRef.current();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopoversRef.current();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc, true);
    };
  }, [colorOpen, menuOpen]);

  return (
    <div
      className="oma-cal-note oma-cal-note--inline"
      data-color={color}
      data-active={active ? 'true' : 'false'}
      data-popover-open={colorOpen || menuOpen ? 'true' : 'false'}
      data-testid={`demo-cal-note-card-${dayKey}`}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
    >
      <span className="oma-cal-note__fold" aria-hidden="true" />
      <textarea
        className="oma-cal-note__input"
        placeholder={t('content.note_placeholder')}
        value={note.text}
        rows={3}
        autoFocus={active}
        onChange={(e) => onChangeText(e.target.value)}
        onFocus={onActivate}
        onBlur={(e) => onCommitText(e.target.value)}
      />
      {visibility === 'only_me' ? (
        <span className="oma-cal-note__lock" aria-label={t('content.note.only_me')}>
          <LockOutlined />
        </span>
      ) : null}
      <div className="oma-cal-note__toolbar">
        <button
          ref={colorBtnRef}
          type="button"
          className="oma-cal-note__action oma-cal-note__action--color"
          data-tooltip={t('content.note_color')}
          aria-label={t('content.note_color')}
          aria-expanded={colorOpen}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleColor();
          }}
        >
          <span className="oma-cal-note__color-dot" data-color={color} />
          {colorOpen ? (
            <UpOutlined className="oma-cal-note__action-ico" />
          ) : (
            <DownOutlined className="oma-cal-note__action-ico" />
          )}
        </button>
        <button
          ref={menuBtnRef}
          type="button"
          className="oma-cal-note__action"
          data-tooltip={t('content.post_actions')}
          aria-label={t('content.post_actions')}
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu();
          }}
        >
          <MoreOutlined />
        </button>
        <button
          type="button"
          className="oma-cal-note__action"
          data-tooltip={t('wsPanel.delete')}
          aria-label={t('wsPanel.delete')}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <DeleteOutlined />
        </button>
      </div>
      {colorOpen && colorPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="oma-cal-note__swatches oma-cal-note__swatches--portal"
              role="listbox"
              data-oma-note-pop="true"
              style={{ top: colorPos.top, insetInlineStart: colorPos.insetInlineStart }}
            >
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="oma-cal-note-swatch"
                  data-color={c}
                  data-active={color === c ? 'true' : 'false'}
                  aria-label={c}
                  onClick={(e) => {
                    e.stopPropagation();
                    onColor(c);
                  }}
                >
                  {color === c ? <CheckOutlined /> : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
      {menuOpen && menuPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="oma-cal-note__menu"
              role="menu"
              data-oma-note-pop="true"
              style={{ top: menuPos.top, insetInlineStart: menuPos.insetInlineStart }}
            >
              <button
                type="button"
                role="menuitem"
                className="oma-cal-note__menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreatePost();
                }}
              >
                <EditOutlined />
                <span>{t('content.note.create_post')}</span>
              </button>
              {(
                [
                  ['only_me', LockOutlined, 'content.note.only_me'],
                  ['team', EyeInvisibleOutlined, 'content.note.team_only'],
                  ['all', TeamOutlined, 'content.note.visible_to_all'],
                ] as const
              ).map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  className="oma-cal-note__menu-item"
                  data-active={visibility === id ? 'true' : 'false'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onVisibility(id);
                  }}
                >
                  <Icon />
                  <span>{t(label)}</span>
                  {visibility === id ? (
                    <CheckOutlined className="oma-cal-note__menu-check" />
                  ) : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
