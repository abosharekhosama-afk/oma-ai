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
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  closeLabel?: string;
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
      width={size === 'lg' ? 720 : 480}
      destroyOnHidden
      closable={{ 'aria-label': 'Dismiss' }}
      mask={{ closable: true }}
      focusable={{ focusTriggerAfterClose: true }}
      cancelText={closeLabel ?? t('common.close')}
    >
      {children}
    </Modal>
  );
}
