'use client';

import type { ReactNode } from 'react';
import { useCallback, useId } from 'react';
import { useEscape, useFocusTrap, useScrollLock } from './use-focus-trap';
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
  const trapRef = useFocusTrap(open);
  useScrollLock(open);
  useEscape(open, close);
  const titleId = useId();
  const resolvedLabelledBy = labelledBy ?? (title ? titleId : undefined);

  if (!open) return null;

  return (
    <>
      <div className="oma-overlay-backdrop" onClick={close} aria-hidden="true" />
      <div
        ref={trapRef}
        className={['oma-dialog', size === 'lg' ? 'oma-dialog--lg' : ''].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={resolvedLabelledBy ? undefined : title}
        aria-labelledby={resolvedLabelledBy}
      >
        {title || closeLabel !== undefined ? (
          <div className="oma-dialog-header">
            {title ? (
              <h2 id={titleId} className="oma-dialog-title">
                {title}
              </h2>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="oma-icon-btn"
              onClick={close}
              aria-label={closeLabel ?? t('common.close')}
            >
              ×
            </button>
          </div>
        ) : null}
        <div className="oma-dialog-body">{children}</div>
        {footer ? <div className="oma-dialog-footer">{footer}</div> : null}
      </div>
    </>
  );
}
