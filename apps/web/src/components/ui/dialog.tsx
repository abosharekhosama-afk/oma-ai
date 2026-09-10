'use client';

import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { useEscape, useFocusTrap, useScrollLock } from './use-focus-trap';

export function Dialog({
  open,
  title,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  const close = useCallback(() => onClose(), [onClose]);
  const trapRef = useFocusTrap(open);
  useScrollLock(open);
  useEscape(open, close);

  if (!open) return null;

  return (
    <>
      <div className="oma-overlay-backdrop" onClick={close} aria-hidden="true" />
      <div
        ref={trapRef}
        className="oma-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
      >
        {title && !labelledBy ? <h2 className="oma-dialog-title">{title}</h2> : null}
        {children}
      </div>
    </>
  );
}
