'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckOutlined, UpOutlined } from '../../../../components/ui/lucide-icons';

export type InboxStatusFilter = 'OPEN' | 'PENDING' | 'CLOSED';

type Option = { value: InboxStatusFilter; label: string; count?: number };

export function InboxStatusDropdown({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: InboxStatusFilter;
  options: Option[];
  onChange: (v: InboxStatusFilter) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0]!;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="oma-plx-inbox-status-dd" ref={ref}>
      <button
        type="button"
        className="oma-plx-inbox-status-dd__trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{current.label}</span>
        <UpOutlined className="oma-plx-inbox-status-dd__chev" />
      </button>
      {open ? (
        <ul className="oma-plx-inbox-status-dd__menu" role="listbox">
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`oma-plx-inbox-status-dd__item${o.value === value ? ' is-selected' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span className="oma-plx-inbox-status-dd__item-label">
                  {o.value === value ? <CheckOutlined /> : <span className="oma-plx-inbox-status-dd__check-spacer" />}
                  {o.label}
                </span>
                {o.count != null && o.count > 0 ? (
                  <span className="oma-plx-inbox-status-dd__count">{o.count}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
