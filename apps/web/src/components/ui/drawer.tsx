'use client';

import { Drawer as AntDrawer } from '@oma/ui/controls';
import type { ReactNode } from 'react';
import { useCallback } from 'react';

export function Drawer({
  open,
  onClose,
  children,
  label,
  nav = false,
  wide = false,
  placement,
  className,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  nav?: boolean;
  wide?: boolean;
  placement?: 'left' | 'right';
  className?: string;
  footer?: ReactNode;
}) {
  const close = useCallback(() => onClose(), [onClose]);
  return (
    <AntDrawer
      open={open}
      onClose={close}
      title={label}
      placement={placement ?? (nav ? 'left' : 'right')}
      size={wide ? 'large' : nav ? 256 : 'default'}
      destroyOnHidden
      closable={{ 'aria-label': 'Dismiss' }}
      mask={{ closable: true }}
      aria-label={label}
      className={className}
      footer={footer}
    >
      {children}
    </AntDrawer>
  );
}
