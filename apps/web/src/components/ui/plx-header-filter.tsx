'use client';

import { CloseOutlined, FilterOutlined, PlusOutlined } from './lucide-icons';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type PlxFilterPopoverRect = {
  top: number;
  insetInlineStart: number;
  insetInlineEnd: number;
};

type PlxHeaderFilterProps = {
  headerSlot: HTMLElement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterTestId: string;
  filterLabel: string;
  filterCount?: number;
  panelTitle: string;
  panelTestId: string;
  children: ReactNode;
  createTestId?: string;
  createLabel?: string;
  onCreateClick?: () => void;
  footer?: ReactNode;
  headerLeading?: ReactNode;
  /** When true, only headerLeading / create actions render (no filter popover). */
  hideFilterTrigger?: boolean;
};

function usePopoverRect(open: boolean, anchorRef: React.RefObject<HTMLButtonElement | null>) {
  const [rect, setRect] = useState<PlxFilterPopoverRect | null>(null);

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    let start = box.left;
    if (start + width > window.innerWidth - 12) {
      start = Math.max(12, window.innerWidth - 12 - width);
    }
    setRect({
      top: box.bottom + 8,
      insetInlineStart: start,
      insetInlineEnd: window.innerWidth - box.right,
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onLayout = () => measure();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [open, measure]);

  return rect;
}

export function PlxHeaderFilter({
  headerSlot,
  open,
  onOpenChange,
  filterTestId,
  filterLabel,
  filterCount = 0,
  panelTitle,
  panelTestId,
  children,
  createTestId,
  createLabel,
  onCreateClick,
  footer,
  headerLeading,
  hideFilterTrigger = false,
}: PlxHeaderFilterProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rect = usePopoverRect(open, triggerRef);

  useEffect(() => {
    if (hideFilterTrigger) return;
    const root = document.documentElement;
    if (open) {
      root.setAttribute('data-plx-filter-open', 'true');
    } else {
      root.removeAttribute('data-plx-filter-open');
    }
    return () => root.removeAttribute('data-plx-filter-open');
  }, [open, hideFilterTrigger]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const headerActions =
    headerSlot && headerSlot.isConnected ? (
      <div className="oma-workspace-header-actions oma-plx-header-filter-actions">
        {headerLeading}
        {hideFilterTrigger ? null : (
          <div className="oma-plx-header-filter-anchor">
            <button
              ref={triggerRef}
              type="button"
              className="oma-plx-listening-filter__trigger"
              data-testid={filterTestId}
              data-active={open ? 'true' : 'false'}
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={() => onOpenChange(!open)}
            >
              <FilterOutlined aria-hidden />
              <span>{filterLabel}</span>
              {filterCount > 0 ? (
                <span className="oma-plx-deliv-filter-count">{filterCount}</span>
              ) : null}
            </button>
          </div>
        )}
        {createTestId && onCreateClick ? (
          <button
            type="button"
            className="oma-plx-tasks__create-icon"
            data-testid={createTestId}
            aria-label={createLabel}
            title={createLabel}
            onClick={onCreateClick}
          >
            <PlusOutlined aria-hidden />
            <span>{createLabel}</span>
          </button>
        ) : null}
      </div>
    ) : null;

  const popoverLayer =
    !hideFilterTrigger && open && typeof document !== 'undefined' ? (
      <>
        {createPortal(
          <button
            type="button"
            className="oma-plx-filter-popover-backdrop"
            data-state={open ? 'open' : 'closed'}
            aria-label="Close filters"
            onClick={() => onOpenChange(false)}
          />,
          document.body,
        )}
        {rect
          ? createPortal(
              <div
                className="oma-plx-filter-popover"
                data-state={open ? 'open' : 'closed'}
                data-testid={panelTestId}
                role="dialog"
                aria-label={panelTitle}
                style={{
                  top: rect.top,
                  insetInlineStart: rect.insetInlineStart,
                  width: 'min(320px, calc(100vw - 24px))',
                }}
              >
                <header className="oma-plx-filter-popover__head">
                  <strong>{panelTitle}</strong>
                  <button
                    type="button"
                    className="oma-plx-deliv-filter-panel__close"
                    aria-label="Close"
                    onClick={() => onOpenChange(false)}
                  >
                    <CloseOutlined />
                  </button>
                </header>
                <div className="oma-plx-filter-popover__body">{children}</div>
                {footer ? <footer className="oma-plx-filter-popover__foot">{footer}</footer> : null}
              </div>,
              document.body,
            )
          : null}
      </>
    ) : null;

  return (
    <>
      {headerActions && headerSlot ? createPortal(headerActions, headerSlot) : null}
      {popoverLayer}
    </>
  );
}
