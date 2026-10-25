'use client';

import { Drawer as AntDrawer } from '@oma/ui/controls';
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { useLocale } from '../../lib/use-locale';

export function Drawer({
  open,
  onClose,
  children,
  label,
  nav = false,
  wide = false,
  id,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  nav?: boolean;
  wide?: boolean;
  id?: string;
}) {
  const close = useCallback(() => onClose(), [onClose]);
  const rtl = useLocale().toLowerCase().startsWith('ar');
  // Nav drawer opens from the inline-start edge (left in LTR, right in RTL).
  const placement = nav ? (rtl ? 'right' : 'left') : 'right';
  return (
    <AntDrawer
      open={open}
      onClose={close}
      title={label}
      placement={placement}
      id={id}
      rootClassName={nav ? 'oma-drawer oma-drawer--nav' : undefined}
      size={wide ? 'large' : nav ? 256 : 'default'}
      destroyOnHidden
      closable={{ 'aria-label': 'Dismiss' }}
      mask={{ closable: true }}
      aria-label={label}
    >
      {children}
    </AntDrawer>
  );
}
