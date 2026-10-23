'use client';

import { Modal } from '@oma/ui/controls';
import type { ReactNode } from 'react';
import { useCallback, useId } from 'react';
import { useT } from '../../lib/use-locale';

export function Dialog({
  open,
  title,
  onClose,
  children,
  labelledBy,
  footer,
  size = 'md',
  closeLabel,
  className,
  zIndex,
  hideClose = false,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  closeLabel?: string;
  className?: string;
  zIndex?: number;
  hideClose?: boolean;
}) {
  const t = useT();
  const close = useCallback(() => onClose(), [onClose]);
  const titleId = useId();
  return (
    <Modal
      open={open}
      title={title ? <h2 id={labelledBy ?? titleId}>{title}</h2> : undefined}
      onCancel={close}
      footer={footer ?? null}
      width={size === 'xl' ? 1180 : size === 'lg' ? 720 : 480}
      className={className}
      zIndex={zIndex}
      destroyOnHidden
      closable={hideClose ? false : { 'aria-label': 'Dismiss' }}
      mask={{ closable: true }}
      focusable={{ focusTriggerAfterClose: false }}
      cancelText={closeLabel ?? t('common.close')}
    >
      {children}
    </Modal>
  );
}
