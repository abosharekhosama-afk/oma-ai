'use client';

import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { useEscape, useFocusTrap, useScrollLock } from './use-focus-trap';

export function Drawer({
  open,
  onClose,
  children,
  label,
  nav = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  nav?: boolean;
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
        className={nav ? 'oma-drawer oma-drawer--nav' : 'oma-drawer'}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </>
  );
}
