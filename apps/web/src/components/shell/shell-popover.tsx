'use client';

import type { ReactNode } from 'react';
import { Popover } from 'antd';
import { useLocale } from '../../lib/use-locale';

/**
 * Popover used by the sidebar account menu and the notifications bell.
 * - Rendered in a portal on <body> above every shell layer (rail, drawers, sticky headers).
 * - Opens upward from the sidebar footer, aligned to the inline-start edge (mirrored in RTL),
 *   and auto-flips/shifts to stay inside the viewport (collision padding 8px).
 * - Panel content caps its height to the viewport and scrolls internally (see .oma-shell-popover).
 */
export function ShellPopover(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const locale = useLocale();
  const rtl = locale === 'ar';
  return (
    <Popover
      open={props.open}
      onOpenChange={props.onOpenChange}
      trigger="click"
      arrow={false}
      placement={rtl ? 'topRight' : 'topLeft'}
      autoAdjustOverflow
      align={{ overflow: { adjustX: true, adjustY: true, shiftX: 8, shiftY: 8 } }}
      getPopupContainer={() => document.body}
      zIndex={1300}
      destroyOnHidden
      content={<div dir={rtl ? 'rtl' : 'ltr'}>{props.content}</div>}
      classNames={{ root: `oma-shell-popover ${props.className ?? ''}`.trim() }}
    >
      {props.children}
    </Popover>
  );
}
