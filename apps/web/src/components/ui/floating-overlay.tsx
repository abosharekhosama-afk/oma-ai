'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

export type FloatingRect = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function useFloatingPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  opts?: { width?: number; gap?: number; padding?: number; align?: 'start' | 'end' | 'center' },
): FloatingRect | null {
  const [rect, setRect] = useState<FloatingRect | null>(null);
  const widthHint = opts?.width ?? 260;
  const gap = opts?.gap ?? 8;
  const pad = opts?.padding ?? 12;
  const align = opts?.align ?? 'start';

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const width = Math.min(widthHint, Math.max(160, window.innerWidth - pad * 2));
    let left = box.left;
    if (align === 'end') left = box.right - width;
    if (align === 'center') left = box.left + box.width / 2 - width / 2;
    left = Math.min(Math.max(pad, left), window.innerWidth - width - pad);
    const spaceBelow = window.innerHeight - box.bottom - pad - gap;
    const spaceAbove = box.top - pad - gap;
    const placeBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(120, placeBelow ? spaceBelow : spaceAbove);
    const top = placeBelow ? box.bottom + gap : Math.max(pad, box.top - gap - maxHeight);
    setRect({ top, left, width, maxHeight });
  }, [anchorRef, widthHint, gap, pad, align]);

  useLayoutEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onLayout = () => measure();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [open, measure]);

  return rect;
}

export function FloatingOverlay({
  open,
  anchorRef,
  onClose,
  className,
  role,
  width,
  align,
  children,
  testId,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose?: () => void;
  className?: string;
  role?: string;
  width?: number;
  align?: 'start' | 'end' | 'center';
  children: ReactNode;
  testId?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const rect = useFloatingPosition(open, anchorRef, { width, align });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose?.();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !rect || typeof document === 'undefined') return null;

  const style = {
    '--oma-float-top': `${rect.top}px`,
    '--oma-float-left': `${rect.left}px`,
    '--oma-float-width': `${rect.width}px`,
    '--oma-float-max-h': `${rect.maxHeight}px`,
    top: rect.top,
    left: rect.left,
    width: rect.width,
    maxHeight: rect.maxHeight,
    zIndex: 12000,
  } as CSSProperties;

  return createPortal(
    <div
      ref={panelRef}
      className={`oma-floating-overlay${className ? ` ${className}` : ''}`}
      role={role}
      data-testid={testId}
      style={style}
    >
      {children}
    </div>,
    document.body,
  );
}
