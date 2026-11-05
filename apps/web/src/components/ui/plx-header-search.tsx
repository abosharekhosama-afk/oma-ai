'use client';

import { SearchOutlined } from './lucide-icons';
import { createPortal } from 'react-dom';

type PlxHeaderSearchProps = {
  headerSlot: HTMLElement | null;
  value: string;
  onChange: (value: string) => void;
  testId: string;
  placeholder: string;
  ariaLabel: string;
};

export function PlxHeaderSearch({
  headerSlot,
  value,
  onChange,
  testId,
  placeholder,
  ariaLabel,
}: PlxHeaderSearchProps) {
  if (!headerSlot || !headerSlot.isConnected) return null;

  return createPortal(
    <div className="oma-workspace-header-actions oma-plx-header-filter-actions oma-plx-header-search-actions">
      <label className="oma-plx-header-search">
        <SearchOutlined aria-hidden className="oma-plx-header-search__icon" />
        <input
          type="search"
          className="oma-plx-header-search__input"
          value={value}
          maxLength={120}
          data-testid={testId}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>,
    headerSlot,
  );
}
