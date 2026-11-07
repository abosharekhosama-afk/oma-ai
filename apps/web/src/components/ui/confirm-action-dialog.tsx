'use client';

import { useEffect, type ReactNode } from 'react';
import { CloseOutlined, DeleteOutlined, InfoCircleOutlined } from './lucide-icons';
import { useLocale } from '../../lib/use-locale';

export type ConfirmActionDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
};

/**
 * Standardized Planable confirmation card modal for all delete / destructive / confirmation actions.
 */
export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
  testId = 'confirm-action-dialog',
}: ConfirmActionDialogProps) {
  const locale = useLocale();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="oma-plx-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${testId}-title`}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      data-testid={testId}
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div className="oma-plx-confirm-card" onClick={(e) => e.stopPropagation()} data-tone={tone}>
        <header className="oma-plx-confirm-card__head">
          <span
            className={`oma-plx-confirm-card__badge oma-plx-confirm-card__badge--${tone}`}
            aria-hidden="true"
          >
            {tone === 'danger' ? <DeleteOutlined /> : <InfoCircleOutlined />}
          </span>
          <h3 id={`${testId}-title`} className="oma-plx-confirm-card__title">
            {title}
          </h3>
          <button
            type="button"
            className="oma-plx-confirm-card__close"
            onClick={onCancel}
            disabled={busy}
            aria-label={cancelLabel}
          >
            <CloseOutlined />
          </button>
        </header>

        <div className="oma-plx-confirm-card__body">{description}</div>

        <footer className="oma-plx-confirm-card__foot">
          <button
            type="button"
            className="oma-plx-confirm-card__btn oma-plx-confirm-card__btn--cancel"
            onClick={onCancel}
            disabled={busy}
            data-testid={`${testId}-cancel`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`oma-plx-confirm-card__btn oma-plx-confirm-card__btn--${tone}`}
            onClick={onConfirm}
            disabled={busy}
            data-testid={`${testId}-confirm`}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
