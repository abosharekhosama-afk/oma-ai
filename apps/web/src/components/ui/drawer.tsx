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
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  nav?: boolean;
  wide?: boolean;
}) {
  const close = useCallback(() => onClose(), [onClose]);
  const trapRef = useFocusTrap(open);
  useScrollLock(open);
  useEscape(open, close);

  if (!open) return null;

  const className = ['oma-drawer', nav ? 'oma-drawer--nav' : '', wide ? 'oma-drawer--wide' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className="oma-overlay-backdrop" onClick={close} aria-hidden="true" />
      <div ref={trapRef} className={className} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </>
  );
}
